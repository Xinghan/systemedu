"""Offline integration: actual train, partial accumulation, epoch resume, evaluate."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from tokenizers import Tokenizer
from tokenizers.models import WordLevel
from tokenizers.pre_tokenizers import WhitespaceSplit
from transformers import PreTrainedTokenizerFast, Qwen2Config, Qwen2ForCausalLM
from safetensors.torch import load_file
import torch

ROOT = Path(__file__).resolve().parents[1]


class OfflineCLITest(unittest.TestCase):
    def test_train_resume_evaluate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            model_path = root/'tiny'
            tokenizer = Tokenizer(WordLevel({'<unk>':0, '<s>':1, '</s>':2, 'system':3,
                'user':4, 'assistant':5, 'billing':6, 'account':7, 'bug':8}, unk_token='<unk>'))
            tokenizer.pre_tokenizer = WhitespaceSplit()
            fast = PreTrainedTokenizerFast(tokenizer_object=tokenizer, unk_token='<unk>',
                bos_token='<s>', eos_token='</s>', pad_token='</s>')
            fast.chat_template = "{{ bos_token }} {% for message in messages %}{{ message['role'] }} {{ message['content'] }} {{ eos_token }} {% endfor %}{% if add_generation_prompt %}assistant {% endif %}"
            fast.save_pretrained(model_path)
            torch.manual_seed(42)
            Qwen2ForCausalLM(Qwen2Config(vocab_size=9, hidden_size=16, intermediate_size=32,
                num_hidden_layers=1, num_attention_heads=2, num_key_value_heads=2,
                eos_token_id=2, pad_token_id=2)).save_pretrained(model_path)
            cfg = json.loads((ROOT/'configs/lora.json').read_text())
            cfg.update(model=str(model_path), batch_size=1, accumulation=2, epochs=1,
                gradient_checkpointing=True, output=str(root/'run'))
            for split, n in [('train',3), ('dev',1), ('test',1)]:
                data = root/f'{split}.jsonl'
                data.write_text('\n'.join(json.dumps({'id':f'{split}{i}', 'group':f'{split}{i}',
                    'text':f'{split}{i} invoice', 'target':{'category':'billing','priority':'normal'}}) for i in range(n))+'\n')
                cfg[split] = str(data)
            path = root/'config.json'
            path.write_text(json.dumps(cfg))
            env = dict(os.environ, HF_HUB_OFFLINE='1', TOKENIZERS_PARALLELISM='false', OMP_NUM_THREADS='1')
            def run(script, *args):
                result = subprocess.run([sys.executable, str(ROOT/script), *args], cwd=ROOT,
                    env=env, text=True, capture_output=True, timeout=90)
                self.assertEqual(result.returncode, 0, result.stdout+'\n'+result.stderr)
            run('train.py', '--config', str(path), '--device', 'cpu')
            state = torch.load(root/'run/training.pt', weights_only=True)
            self.assertEqual(state['step'], 2)
            cfg['epochs'] = 2; path.write_text(json.dumps(cfg))
            run('train.py', '--config', str(path), '--device', 'cpu', '--resume')
            self.assertEqual(len(json.loads((root/'run/run.json').read_text())['history']), 2)
            cfg['output'] = str(root/'uninterrupted'); path.write_text(json.dumps(cfg))
            run('train.py', '--config', str(path), '--device', 'cpu')
            resumed = load_file(str(root/'run/adapter/adapter_model.safetensors'))
            direct = load_file(str(root/'uninterrupted/adapter/adapter_model.safetensors'))
            for key in resumed:
                self.assertTrue(torch.allclose(resumed[key], direct[key], atol=1e-6), key)
            run('evaluate.py', '--config', str(path), '--adapter', str(root/'run'),
                '--data', cfg['test'], '--output', str(root/'eval.json'), '--device', 'cpu')
            result = json.loads((root/'eval.json').read_text())
            self.assertEqual(result['metrics']['n'], 1)
            self.assertEqual(len(result['predictions']), 1)
