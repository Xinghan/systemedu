"""Create plumbing-only examples; optionally pin model revision before any experiment."""
import argparse
import json
from pathlib import Path
from core import read_rows, assert_disjoint


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--pin', action='store_true', help='Resolve model commit from Hugging Face; network required')
    args = p.parse_args()
    if args.pin:
        from huggingface_hub import HfApi
        configs = [Path('configs/lora.json'), Path('configs/qlora.json')]
        sha = HfApi().model_info(json.loads(configs[0].read_text())['model']).sha
        for path in configs:
            cfg = json.loads(path.read_text()); cfg['revision'] = sha
            path.write_text(json.dumps(cfg, indent=2)+'\n')
        print('Pinned both configurations to', sha)
    examples = [
        ('billing', 'normal', 'My invoice contains a duplicate charge.'),
        ('billing', 'normal', 'Please send a copy of the monthly invoice.'),
        ('account', 'normal', 'I forgot my password and need to reset it.'),
        ('account', 'urgent', 'An attacker has logged into my account.'),
        ('bug', 'normal', 'The export button has the wrong label.'),
        ('bug', 'urgent', 'Our production service is down for all users.'),
    ]
    Path('data').mkdir(exist_ok=True)
    for split, count in [('train', 36), ('dev', 12), ('test', 12)]:
        path = Path(f'data/{split}.jsonl')
        if path.exists():
            print('Preserved', path); continue
        rows = []
        for i in range(count):
            cat, priority, text = examples[i % len(examples)]
            rows.append({'id': f'{split}-{i}', 'group': f'{split}-case-{i}',
                'text': f'Ticket {split.upper()}-{i:03d}: {text}',
                'target': {'category': cat, 'priority': priority}, 'source': 'synthetic-plumbing-only'})
        path.write_text('\n'.join(json.dumps(x) for x in rows)+'\n')
    splits = [read_rows(f'data/{s}.jsonl') for s in ('train', 'dev', 'test')]
    assert_disjoint(*splits)
    print('WARNING: templates overlap semantically. This sample is for plumbing only, not a generalization benchmark.')


if __name__ == '__main__':
    main()
