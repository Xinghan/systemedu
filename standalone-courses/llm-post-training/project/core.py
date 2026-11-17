"""Single-turn, completion-only SFT. No model/network needed to import."""
import hashlib
import json
from pathlib import Path
import torch
import torch.nn.functional as F

SYSTEM = ('Classify this support ticket. Return only a JSON object with exactly '
          'two keys: category (billing, account, or bug) and priority (normal or urgent). '
          'Use urgent only for a security incident or a production outage.')


def read_rows(path):
    rows = [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]
    if not rows:
        raise ValueError('Empty dataset')
    for row in rows:
        if not all(isinstance(row.get(k), str) and row[k] for k in ('id', 'group', 'text')):
            raise ValueError('Expected nonempty id, group, text')
        if not valid_target(row.get('target')):
            raise ValueError('Invalid target schema')
    if len({row['id'] for row in rows}) != len(rows):
        raise ValueError('Duplicate ids')
    return rows


def valid_target(value):
    return (isinstance(value, dict) and set(value) == {'category', 'priority'}
            and value['category'] in ('billing', 'account', 'bug')
            and value['priority'] in ('normal', 'urgent'))


def messages(row):
    return [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': row['text']}]


def encode(row, tokenizer, max_length):
    prompt = tokenizer.apply_chat_template(messages(row), tokenize=True, add_generation_prompt=True)
    full = tokenizer.apply_chat_template(messages(row) + [{'role': 'assistant', 'content':
        json.dumps(row['target'], ensure_ascii=False, sort_keys=True)}], tokenize=True, add_generation_prompt=False)
    # Not every template is prefix-stable. Fail loudly instead of masking the wrong region.
    if full[:len(prompt)] != prompt:
        raise ValueError('Template is not prefix-stable; implement its assistant mask explicitly')
    if len(full) > max_length:
        raise ValueError(f"{row['id']}: {len(full)} tokens exceeds max_length; do not truncate the answer")
    labels = [-100] * len(prompt) + full[len(prompt):]
    if not any(x != -100 for x in labels[1:]):
        raise ValueError('No supervised next-token targets')
    return {'input_ids': full, 'labels': labels}


def collate(examples, pad_id):
    length = max(len(x['input_ids']) for x in examples)
    result = {'input_ids': [], 'labels': [], 'attention_mask': []}
    for x in examples:
        pad = length - len(x['input_ids'])
        result['input_ids'].append(x['input_ids'] + [pad_id] * pad)
        result['labels'].append(x['labels'] + [-100] * pad)
        result['attention_mask'].append([1] * len(x['input_ids']) + [0] * pad)
    return {k: torch.tensor(v, dtype=torch.long) for k, v in result.items()}


def causal_loss_sum(logits, labels):
    """Logit at t predicts label at t+1. We shift ONCE; do not pass labels to HF too."""
    target = labels[:, 1:].contiguous()
    count = (target != -100).sum()
    if count == 0:
        raise ValueError('Zero target tokens')
    total = F.cross_entropy(logits[:, :-1].contiguous().float().reshape(-1, logits.size(-1)),
                            target.reshape(-1), ignore_index=-100, reduction='sum')
    return total, count


def assert_disjoint(*splits):
    groups, texts, ids = set(), set(), set()
    for rows in splits:
        g = {r['group'] for r in rows}
        t = {' '.join(r['text'].lower().split()) for r in rows}
        i = {r['id'] for r in rows}
        if groups & g or texts & t or ids & i:
            raise ValueError('Split leakage: repeated group, text, or id')
        groups |= g; texts |= t; ids |= i


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def score_predictions(rows, predictions):
    if len(rows) != len(predictions) or not rows:
        raise ValueError('Prediction count mismatch or empty evaluation')
    valid = correct = 0
    confusion = {c: {'tp': 0, 'fp': 0, 'fn': 0} for c in ('billing', 'account', 'bug')}
    for row, text in zip(rows, predictions):
        try:
            pred = json.loads(text)
        except (ValueError, TypeError):
            pred = None
        ok = valid_target(pred)
        valid += int(ok)
        correct += int(ok and pred == row['target'])
        gold = row['target']['category']
        guess = pred['category'] if ok else None
        for c in confusion:
            confusion[c]['tp'] += int(gold == c and guess == c)
            confusion[c]['fp'] += int(gold != c and guess == c)
            confusion[c]['fn'] += int(gold == c and guess != c)
    f1 = [2*v['tp']/max(1, 2*v['tp']+v['fp']+v['fn']) for v in confusion.values()]
    return {'n': len(rows), 'schema_valid_rate': valid/len(rows), 'exact_match': correct/len(rows),
            'category_macro_f1': sum(f1)/len(f1), 'confusion': confusion}
