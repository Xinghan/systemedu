"""Single-device reference loop. Resume is supported at completed epoch boundaries."""
import argparse
import functools
import itertools
import json
import random
import subprocess
import time
from pathlib import Path
import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, set_seed
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from core import read_rows, encode, collate, causal_loss_sum, assert_disjoint, sha256


def load_model(cfg, device):
    if cfg['method'] not in ('lora', 'qlora'):
        raise ValueError('method must be lora or qlora')
    if device.type == 'cuda':
        dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    else:
        dtype = torch.float32
    kwargs = dict(revision=cfg['revision'], torch_dtype=dtype, trust_remote_code=False)
    if cfg['method'] == 'qlora':
        if device.type != 'cuda':
            raise ValueError('This QLoRA reference requires one NVIDIA CUDA GPU')
        kwargs.update(device_map={'': 0}, quantization_config=BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type='nf4', bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=dtype))
    base = AutoModelForCausalLM.from_pretrained(cfg['model'], **kwargs)
    resolved = base.config._commit_hash
    if cfg['method'] == 'qlora':
        base = prepare_model_for_kbit_training(base, use_gradient_checkpointing=cfg['gradient_checkpointing'])
    else:
        base.to(device)
    base.config.use_cache = False
    model = get_peft_model(base, LoraConfig(task_type='CAUSAL_LM', r=cfg['r'], lora_alpha=cfg['alpha'],
        lora_dropout=cfg['dropout'], target_modules=cfg['target_modules'], bias='none'))
    if cfg['gradient_checkpointing']:
        model.enable_input_require_grads()
        model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={'use_reentrant': False})
    params = [(n, p) for n, p in model.named_parameters() if p.requires_grad]
    if not params or any('lora_' not in n for n, _ in params):
        raise ValueError('Unexpected trainable parameter set')
    model.print_trainable_parameters()
    return model, dtype, resolved


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--device', choices=['cpu', 'cuda'], default='cuda')
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    cfg = json.loads(Path(args.config).read_text())
    for k in ('batch_size', 'accumulation', 'epochs', 'max_length', 'r'):
        if not isinstance(cfg[k], int) or cfg[k] < 1:
            raise ValueError(f'{k} must be a positive integer')
    set_seed(cfg['seed'])
    device = torch.device(args.device)
    train, dev, test = [read_rows(cfg[k]) for k in ('train', 'dev', 'test')]
    assert_disjoint(train, dev, test)  # test labels never participate in training or model selection
    hashes = {k: sha256(cfg[k]) for k in ('train', 'dev', 'test')}
    output = Path(cfg['output'])
    if output.exists() and any(output.iterdir()) and not args.resume:
        raise ValueError('Output exists; choose a new run directory or --resume')
    previous = None
    if args.resume:
        previous = json.loads((output/'run.json').read_text())
        previous_cfg = previous['config']
        if hashes != previous['dataset_sha256']:
            raise ValueError('Dataset changed since checkpoint')
        for key, value in cfg.items():
            if key not in ('epochs', 'revision') and value != previous_cfg[key]:
                raise ValueError(f'Config changed on resume: {key}')
        if cfg['revision'] not in ('main', previous_cfg['revision']):
            raise ValueError('Model revision changed on resume')
        cfg['revision'] = previous_cfg['revision']
    model, dtype, resolved = load_model(cfg, device)
    cfg['revision'] = resolved or cfg['revision']
    tokenizer = AutoTokenizer.from_pretrained(cfg['model'], revision=cfg['revision'], trust_remote_code=False)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    datasets = [[encode(row, tokenizer, cfg['max_length']) for row in rows] for rows in (train, dev)]
    make_batch = functools.partial(collate, pad_id=tokenizer.pad_token_id)
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=cfg['learning_rate'])
    scaler = torch.amp.GradScaler('cuda', enabled=device.type == 'cuda' and dtype == torch.float16)
    epoch_start = step = 0
    if args.resume:
        from peft import set_peft_model_state_dict
        from safetensors.torch import load_file
        set_peft_model_state_dict(model, load_file(str(output/'adapter'/'adapter_model.safetensors')))
        state = torch.load(output/'training.pt', map_location='cpu', weights_only=True)
        optimizer.load_state_dict(state['optimizer']); scaler.load_state_dict(state['scaler'])
        torch.set_rng_state(state['torch_rng']); random.setstate(state['python_rng'])
        if device.type == 'cuda':
            torch.cuda.set_rng_state_all(state['cuda_rng'])
        epoch_start, step = state['next_epoch'], state['step']
    output.mkdir(parents=True, exist_ok=True)
    env = subprocess.check_output([__import__('sys').executable, '-m', 'pip', 'freeze'], text=True)
    (output/'environment.txt').write_text(env)
    start = time.perf_counter()
    if device.type == 'cuda':
        torch.cuda.reset_peak_memory_stats()
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    history = previous.get('history', []) if previous else []
    for epoch in range(epoch_start, cfg['epochs']):
        generator = torch.Generator().manual_seed(cfg['seed'] + epoch)
        loader = iter(DataLoader(datasets[0], batch_size=cfg['batch_size'], shuffle=True,
                                 generator=generator, collate_fn=make_batch))
        model.train()
        while window := list(itertools.islice(loader, cfg['accumulation'])):
            # Count first: short answers and the final partial window must get correct weight.
            tokens = sum(int((batch['labels'][:, 1:] != -100).sum()) for batch in window)
            optimizer.zero_grad(set_to_none=True)
            total_loss = 0.0
            for cpu_batch in window:
                batch = {k: v.to(device) for k, v in cpu_batch.items()}
                with torch.autocast(device_type=device.type, dtype=dtype, enabled=device.type == 'cuda'):
                    logits = model(input_ids=batch['input_ids'], attention_mask=batch['attention_mask']).logits
                    loss_sum, _ = causal_loss_sum(logits, batch['labels'])
                scaler.scale(loss_sum / tokens).backward()
                total_loss += float(loss_sum.detach())
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
            scaler.step(optimizer); scaler.update(); step += 1
            entry = {'epoch': epoch + 1, 'step': step, 'tokens': tokens, 'train_nll': total_loss/tokens}
            with (output/'metrics.jsonl').open('a') as f:
                f.write(json.dumps(entry) + '\n')
            print(json.dumps(entry), flush=True)
        model.eval()
        val_sum = val_tokens = 0
        with torch.no_grad():
            for cpu_batch in DataLoader(datasets[1], batch_size=cfg['batch_size'], collate_fn=make_batch):
                batch = {k: v.to(device) for k, v in cpu_batch.items()}
                with torch.autocast(device_type=device.type, dtype=dtype, enabled=device.type == 'cuda'):
                    logits = model(input_ids=batch['input_ids'], attention_mask=batch['attention_mask']).logits
                    loss_sum, count = causal_loss_sum(logits, batch['labels'])
                val_sum += float(loss_sum); val_tokens += int(count)
        history.append({'epoch': epoch+1, 'dev_nll': val_sum/val_tokens})
        model.save_pretrained(output/'adapter'); tokenizer.save_pretrained(output/'adapter')
        torch.save({'next_epoch': epoch+1, 'step': step, 'optimizer': optimizer.state_dict(),
            'scaler': scaler.state_dict(), 'torch_rng': torch.get_rng_state(), 'python_rng': random.getstate(),
            'cuda_rng': torch.cuda.get_rng_state_all() if device.type == 'cuda' else []}, output/'training.pt')
        run = {'config': cfg, 'dataset_sha256': hashes, 'trainable_parameters': trainable,
            'history': history, 'elapsed_seconds_this_invocation': time.perf_counter()-start,
            'cuda': torch.version.cuda, 'device': str(device),
            'gpu': torch.cuda.get_device_name() if device.type == 'cuda' else None,
            'peak_allocated_gib': torch.cuda.max_memory_allocated()/2**30 if device.type == 'cuda' else None,
            'peak_reserved_gib': torch.cuda.max_memory_reserved()/2**30 if device.type == 'cuda' else None}
        (output/'run.json').write_text(json.dumps(run, indent=2))
    print(f'Finished epochs {epoch_start}..{cfg["epochs"]}; adapter and epoch checkpoint: {output}')


if __name__ == '__main__':
    main()
