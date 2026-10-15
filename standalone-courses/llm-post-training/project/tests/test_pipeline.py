import tempfile
import unittest
from pathlib import Path
import torch
from transformers import Qwen2Config, Qwen2ForCausalLM
from peft import LoraConfig, PeftModel, get_peft_model
from core import collate, causal_loss_sum, encode, assert_disjoint, score_predictions


class Template:
    def apply_chat_template(self, messages, tokenize, add_generation_prompt):
        return [1, 2, 3] if add_generation_prompt else [1, 2, 3, 4, 5, 0]


class PipelineTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(42)
        self.row = {'id': 'a', 'group': 'a', 'text': 'billing', 'target': {'category': 'billing', 'priority': 'normal'}}

    def test_assistant_boundary_and_eos_padding(self):
        e = encode(self.row, Template(), 10)
        self.assertEqual(e['labels'], [-100, -100, -100, 4, 5, 0])
        b = collate([e, {'input_ids': [1, 0], 'labels': [-100, 0]}], pad_id=0)
        self.assertEqual(b['labels'][1].tolist(), [-100, 0, -100, -100, -100, -100])
        self.assertEqual(b['attention_mask'][1].tolist(), [1, 1, 0, 0, 0, 0])
        with self.assertRaises(ValueError):
            encode(self.row, Template(), 4)

    def test_shift_and_ignored_logits(self):
        labels = torch.tensor([[-100, -100, 2, 3]])
        logits = torch.zeros(1, 4, 5)
        logits[0, 1, 2] = 20; logits[0, 2, 3] = 20
        loss, count = causal_loss_sum(logits, labels)
        self.assertEqual(int(count), 2)
        self.assertLess(float(loss), 1e-6)
        logits[0, 0] = torch.randn(5) * 100  # only predicts ignored prompt
        self.assertLess(float(causal_loss_sum(logits, labels)[0]), 1e-6)
        with self.assertRaises(ValueError):
            causal_loss_sum(logits, torch.full_like(labels, -100))

    def test_accumulation_equals_token_weighted_batch(self):
        x = torch.randn(2, 5, 4)
        y = torch.tensor([[-100, 1, 2, 3, 4], [-100, -100, -100, 1, 2]])
        layer = torch.nn.Linear(4, 5)
        total, count = causal_loss_sum(layer(x), y)
        (total/count).backward()
        expected = layer.weight.grad.clone()
        layer.zero_grad()
        for i in range(2):
            part, _ = causal_loss_sum(layer(x[i:i+1]), y[i:i+1])
            (part/count).backward()
        self.assertTrue(torch.allclose(expected, layer.weight.grad, atol=1e-6))

    def test_lora_frozen_base_update_and_reload(self):
        cfg = Qwen2Config(vocab_size=32, hidden_size=16, intermediate_size=32,
                         num_hidden_layers=1, num_attention_heads=2, num_key_value_heads=2)
        torch.manual_seed(123)
        base = Qwen2ForCausalLM(cfg)
        initial = {k: v.clone() for k, v in base.state_dict().items()}
        model = get_peft_model(base, LoraConfig(task_type='CAUSAL_LM', r=2, lora_alpha=4,
            lora_dropout=0, target_modules=['q_proj', 'v_proj'], bias='none'))
        trainable = [(n, p) for n, p in model.named_parameters() if p.requires_grad]
        self.assertEqual(sum(p.numel() for _, p in trainable), 2 * 2 * (16+16))
        frozen = {n: p.detach().clone() for n, p in model.named_parameters() if not p.requires_grad}
        before = {n: p.detach().clone() for n, p in trainable}
        x = torch.tensor([[1, 2, 3, 4, 5]])
        optimizer = torch.optim.AdamW([p for _, p in trainable], lr=0.01)
        for _ in range(2):
            loss, n = causal_loss_sum(model(x).logits, x)
            (loss/n).backward(); optimizer.step(); optimizer.zero_grad()
        self.assertTrue(any(not torch.equal(before[n], p) for n, p in trainable))
        for n, p in model.named_parameters():
            if n in frozen:
                self.assertIsNone(p.grad)
                self.assertTrue(torch.equal(frozen[n], p))
        model.eval()
        expected = model(x).logits.detach()
        with tempfile.TemporaryDirectory() as temp:
            model.save_pretrained(temp)
            restored_base = Qwen2ForCausalLM(cfg)
            restored_base.load_state_dict(initial)
            restored = PeftModel.from_pretrained(restored_base, temp).eval()
            self.assertTrue(torch.allclose(expected, restored(x).logits, atol=1e-6))

    def test_split_leakage_and_strict_evaluation(self):
        with self.assertRaises(ValueError):
            assert_disjoint([self.row], [dict(self.row, id='b')])
        good = '{"category":"billing","priority":"normal"}'
        for bad in ('```json\n'+good+'\n```', '{"category":"billing"}', 'null',
                    '{"category":"other","priority":"normal"}', good+' extra'):
            score = score_predictions([self.row], [bad])
            self.assertEqual(score['schema_valid_rate'], 0)
            self.assertEqual(score['exact_match'], 0)
        self.assertEqual(score_predictions([self.row], [good])['exact_match'], 1)


if __name__ == '__main__':
    unittest.main()
