"""Identical prompt/greedy decoding for baseline and adapted model; strict JSON scoring."""
import argparse
import json
import time
from pathlib import Path
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel
from core import messages, read_rows, score_predictions, sha256


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--config', required=True)
    p.add_argument('--adapter', help='Run directory containing run.json and adapter/')
    p.add_argument('--data', default='data/test.jsonl')
    p.add_argument('--output', required=True)
    p.add_argument('--device', choices=['cuda', 'cpu'], default='cuda')
    args = p.parse_args()
    cfg = json.loads(Path(args.config).read_text())
    if args.adapter:
        cfg = json.loads((Path(args.adapter)/'run.json').read_text())['config']
    device = torch.device(args.device)
    dtype = (torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16) if args.device == 'cuda' else torch.float32
    kwargs = dict(revision=cfg['revision'], torch_dtype=dtype, trust_remote_code=False)
    if cfg['method'] == 'qlora':
        if args.device != 'cuda':
            raise ValueError('QLoRA evaluation requires CUDA in this reference')
        kwargs.update(device_map={'': 0}, quantization_config=BitsAndBytesConfig(load_in_4bit=True,
            bnb_4bit_quant_type='nf4', bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=dtype))
    model = AutoModelForCausalLM.from_pretrained(cfg['model'], **kwargs)
    revision = model.config._commit_hash or cfg['revision']
    if cfg['method'] == 'lora':
        model.to(device)
    tokenizer = AutoTokenizer.from_pretrained(cfg['model'], revision=revision)
    if args.adapter:
        model = PeftModel.from_pretrained(model, Path(args.adapter)/'adapter')
    model.eval()
    rows, predictions = read_rows(args.data), []
    start = time.perf_counter()
    if args.device == 'cuda':
        torch.cuda.reset_peak_memory_stats()
    with torch.inference_mode():
        for row in rows:
            ids = tokenizer.apply_chat_template(messages(row), tokenize=True, add_generation_prompt=True, return_tensors='pt').to(device)
            result = model.generate(ids, attention_mask=torch.ones_like(ids), max_new_tokens=96,
                do_sample=False, pad_token_id=tokenizer.eos_token_id)
            predictions.append(tokenizer.decode(result[0, ids.shape[1]:], skip_special_tokens=True))
    scores = score_predictions(rows, predictions)
    scores.update({'model_revision': revision, 'quantization': cfg['method'], 'data_sha256': sha256(args.data),
        'elapsed_seconds': time.perf_counter()-start, 'max_new_tokens': 96, 'do_sample': False,
        'peak_allocated_gib': torch.cuda.max_memory_allocated()/2**30 if args.device == 'cuda' else None})
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'metrics': scores, 'predictions': [dict(id=r['id'], target=r['target'], output=s)
        for r, s in zip(rows, predictions)]}, ensure_ascii=False, indent=2))
    print(json.dumps(scores, indent=2))


if __name__ == '__main__':
    main()
