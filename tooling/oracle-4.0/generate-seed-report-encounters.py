#!/usr/bin/env python3
"""Regenerate the seed report's floor-encounter fixture from the pinned official JAR.

Runs the oracle in the scout profile and keeps, per floor, every mob the level
generated except the `actors.mobs.npcs` classes (quest givers, shopkeepers,
Rat King, sheep and vault guards), each with the classes of the items it
carries as engine item ids. Ghoul partners are created when the Ghoul first acts, so the level
holds none. The Rust test is
`report::encounter_parity::floor_encounters_match_official_engine`.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tooling/parity'))
from compare_floors import item_id  # noqa: E402
ORACLE = ROOT / 'tooling/oracle-4.0'
FIXTURE = ROOT / 'crates/seedfinder-core/tests/fixtures/seed-report-encounters.json'
NPCS = 'com.shatteredpixel.shatteredpixeldungeon.actors.mobs.npcs.'
# (seed, daily, challenge mask, trinket class)
CASES = [
    ('AAA-AAA-AAA', False, 0, None),
    ('RZN-LKU-EFS', False, 0, None),
    ('BAD-RAT-KNG', False, 0, None),
    ('ZZZ-ZZZ-ZZZ', False, 0, None),
    ('2026-01-01', True, 0, None),
    ('AAA-AAA-AAA', False, 111, None),
    ('AAA-AAA-AAA', False, 0, 'MimicTooth'),
    ('RZN-LKU-EFS', False, 0, 'RatSkull'),
]
TRINKET_IDS = {'MimicTooth': 'mimic_tooth', 'RatSkull': 'rat_skull'}


def short(kind):
    """`...mobs.Elemental$FireElemental` -> `FireElemental`."""
    return kind.rsplit('.', 1)[-1].rsplit('$', 1)[-1]


def item_class(kind):
    """`...plants.Earthroot$Seed` -> `EarthrootSeed`, as the engine names it."""
    return kind.rsplit('.', 1)[-1].replace('$', '')


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
        mobs = sorted([short(mob['class']), sorted(item_id(item_class(item['kind'])) for item in mob['items'])]
                      for mob in record['mobs'] if not mob['class'].startswith(NPCS))
        floors.append(dict(depth=record['depth'], mobs=mobs))
    return dict(seed=seed, challenges=challenges, trinket=TRINKET_IDS.get(trinket),
                floors=floors)


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
                          '--map-contents; level mobs other than npcs, with carried items',
                   samples=samples)
    FIXTURE.write_text(format_fixture(fixture))
    print(f'Wrote {len(samples)} samples to {FIXTURE.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
