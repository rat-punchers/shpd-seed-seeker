#!/usr/bin/env python3
"""Regenerate the seed report's timing fixture from the pinned official JAR.

Runs the oracle with --run-checkpoints through depth 24 and keeps, per floor,
the level builder class, whether the Trinket Catalyst has dropped, and the
room of each alchemy pot. The Rust test is
`report::timing_parity::timing_matches_official_engine`.
"""
import json
import os
from pathlib import Path
import random
import subprocess

ROOT = Path(__file__).resolve().parents[2]
ORACLE = ROOT / 'tooling/oracle-4.0'
FIXTURE = ROOT / 'crates/seedfinder-core/tests/fixtures/seed-report-timing.json'
RANDOM_SEEDS = 40
# (seed, daily, challenge mask, trinket class)
NAMED = [
    ('AAA-AAA-AAA', False, 0, None),
    ('RZN-LKU-EFS', False, 0, None),
    ('BAD-RAT-KNG', False, 0, None),
    ('ZZZ-ZZZ-ZZZ', False, 0, None),
    ('2026-01-01', True, 0, None),
    ('AAA-AAA-AAA', False, 111, None),
    ('AAA-AAA-AAA', False, 0, 'MimicTooth'),
]


def random_seeds():
    rng = random.Random(13)
    letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for _ in range(RANDOM_SEEDS):
        code = ''.join(rng.choice(letters) for _ in range(9))
        yield (f'{code[:3]}-{code[3:6]}-{code[6:]}', False, 0, None)


def generate(case):
    seed, daily, challenges, trinket = case
    env = os.environ.copy()
    if trinket:
        env['JAVA_TOOL_OPTIONS'] = f'-Dseedfinder.trinket={trinket}'
    command = [str(ORACLE / 'run.sh'), '--daily' if daily else '--seed', seed, '--floors', '24',
               '--run-checkpoints', '--format', 'json', '--challenges', str(challenges)]
    document = json.loads(subprocess.check_output(command, env=env))
    floors = []
    for record in document['records']:
        if record['record'] != 'generator_checkpoint' or record['branch'] != 0:
            continue
        floors.append([record['depth'], record['builder'], record['trinket_catalyst_dropped'],
                       [pot['room'] for pot in record['alchemy_pots']]])
    return dict(seed=seed, challenges=challenges,
                trinket=trinket and 'mimic_tooth', floors=floors)


def format_fixture(fixture):
    """One sample per line keeps diffs readable."""
    lines = ['{', '  "source": ' + json.dumps(fixture['source']) + ',', '  "samples": [']
    samples = fixture['samples']
    lines += ['    ' + json.dumps(sample, separators=(',', ':')) +
              (',' if i < len(samples) - 1 else '') for i, sample in enumerate(samples)]
    lines += ['  ]', '}']
    return '\n'.join(lines) + '\n'


def main():
    # run.sh rebuilds the oracle on every call, so the runs stay sequential.
    samples = [generate(case) for case in NAMED + list(random_seeds())]
    fixture = dict(source='official ShatteredPD-v4.0.2-Java.jar; ParityOracle --floors 24 '
                          '--run-checkpoints; per floor [depth, builder, trinket catalyst '
                          'dropped, alchemy pot rooms]',
                   samples=samples)
    FIXTURE.write_text(format_fixture(fixture))
    print(f'Wrote {len(samples)} samples to {FIXTURE.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
