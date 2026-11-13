#!/usr/bin/env python3
"""Regenerate the seed report's floor-item fixture from the pinned official JAR.

Runs the oracle in the scout profile (no assumed pickups, no vault) and keeps,
per floor, every heap and carried item that is not searchable equipment:
potions, scrolls, stones, seeds, food, gold, keys and the rest. Equipment is
pinned by the floor fixtures already. The Rust test is
`report::parity::floor_items_match_official_engine`.
"""
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
ORACLE = ROOT / 'tooling/oracle-4.0'
FIXTURE = ROOT / 'crates/seedfinder-core/tests/fixtures/seed-report-items.json'
PREFIX = 'com.shatteredpixel.shatteredpixeldungeon.items.'
# Searchable equipment and the trinket catalyst, which the report lists as
# its trinket offers. Plain darts are not searchable equipment.
EQUIPMENT = tuple(PREFIX + package + '.' for package in
                  ('weapon', 'armor', 'wands', 'rings', 'artifacts', 'trinkets'))
DART = PREFIX + 'weapon.missiles.darts.Dart'
# (seed, daily, challenge mask, trinket class)
CASES = [
    ('AAA-AAA-AAA', False, 0, None),
    ('RZN-LKU-EFS', False, 0, None),
    ('BAD-RAT-KNG', False, 0, None),
    ('ZZZ-ZZZ-ZZZ', False, 0, None),
    ('2026-01-01', True, 0, None),
    ('AAA-AAA-AAA', False, 111, None),
    ('AAA-AAA-AAA', False, 0, 'MimicTooth'),
]


def listed(item):
    kind = item['kind']
    return kind == DART or not kind.startswith(EQUIPMENT)


def entry(item):
    return [item['kind'].rsplit('.', 1)[-1], item['image'], item['quantity']]


def generate(case):
    seed, daily, challenges, trinket = case
    env = os.environ.copy()
    if trinket:
        env['JAVA_TOOL_OPTIONS'] = f'-Dseedfinder.trinket={trinket}'
    command = [str(ORACLE / 'run.sh'), '--daily' if daily else '--seed', seed, '--floors', '1-24',
               '--map-contents', '--format', 'json', '--challenges', str(challenges)]
    document = json.loads(subprocess.check_output(command, env=env))
    floors = []
    for record in document['records']:
        if record['record'] != 'level' or record['branch'] != 0:
            continue
        carried = [item for mob in record['mobs'] for item in mob.get('items', [])]
        items = [item for heap in record['heaps'] for item in heap['items']] + carried
        floors.append(dict(depth=record['depth'],
                           items=sorted(entry(item) for item in items if listed(item))))
    return dict(seed=seed, challenges=challenges,
                trinket=trinket and 'mimic_tooth', floors=floors)


def format_fixture(fixture):
    """One floor per line keeps diffs readable."""
    lines = ['{', '  "source": ' + json.dumps(fixture['source']) + ',', '  "samples": [']
    for i, sample in enumerate(fixture['samples']):
        head = {key: sample[key] for key in ('seed', 'challenges', 'trinket')}
        lines.append('    ' + json.dumps(head)[:-1] + ', "floors": [')
        floors = sample['floors']
        lines += ['      ' + json.dumps(floor, separators=(',', ':')) +
                  (',' if k < len(floors) - 1 else '') for k, floor in enumerate(floors)]
        lines.append('    ]}' + (',' if i < len(fixture['samples']) - 1 else ''))
    lines += ['  ]', '}']
    return '\n'.join(lines) + '\n'


def main():
    # run.sh rebuilds the oracle on every call, so the runs stay sequential.
    samples = [generate(case) for case in CASES]
    fixture = dict(source='official ShatteredPD-v4.0.2-Java.jar; ParityOracle --floors 1-24 '
                          '--map-contents; heap and carried items other than equipment',
                   samples=samples)
    FIXTURE.write_text(format_fixture(fixture))
    print(f'Wrote {len(samples)} samples to {FIXTURE.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
