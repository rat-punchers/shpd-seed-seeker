#!/usr/bin/env python3
"""Regenerate the seed report's quest reward fixture from the pinned official JAR.

For each seed, one run through depth 19 with --vault records the four quests'
reward options. Then, for each drift k in 1..3, two runs draw k extra items
from the reward decks just before the quest floor (the oracle's
seedfinder.deckDrift property): the Ghost's weapon tiers and the wand deck
before the Ghost and Wandmaker floors, and the Imp's six decks before the Imp
floor. Those runs record what the quest gives when run history has drawn k
more cards. The Rust test is `report::quest_parity::quest_slots_match_official_engine`.
"""
import json
import os
from pathlib import Path
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'tooling/parity'))
from compare_floors import effect_name, item_id, simple  # noqa: E402

ORACLE = ROOT / 'tooling/oracle-4.0'
FIXTURE = ROOT / 'crates/seedfinder-core/tests/fixtures/seed-report-quests.json'
QUESTS = {'ghost_quest': 'ghost', 'wandmaker_quest': 'wandmaker',
          'blacksmith_quest': 'blacksmith', 'imp_quest': 'imp'}
GHOST_DECKS = 'WEP_T2,WEP_T3,WEP_T4,WEP_T5'
IMP_DECKS = 'ARTIFACT,RING,WAND,WEP_T4,WEP_T5,MIS_T4,MIS_T5'
DRIFTS = (1, 2, 3)
RANDOM_SEEDS = 15
NAMED = [('AAA-AAA-AAA', False), ('RZN-LKU-EFS', False), ('BAD-RAT-KNG', False),
         ('ZZZ-ZZZ-ZZZ', False), ('2026-01-01', True)]


def random_seeds():
    rng = random.Random(14)
    letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    while True:
        code = ''.join(rng.choice(letters) for _ in range(9))
        yield (f'{code[:3]}-{code[3:6]}-{code[6:]}', False)


def rewards(seed, daily, drift=None, vault=False):
    """[quest, depth, option, item id, level, effect] per reward option."""
    env = os.environ.copy()
    if drift:
        env['JAVA_TOOL_OPTIONS'] = f'-Dseedfinder.deckDrift={drift}'
    command = [str(ORACLE / 'run.sh'), '--daily' if daily else '--seed', seed,
               '--floors', '1-19', '--format', 'json'] + (['--vault'] if vault else [])
    document = json.loads(subprocess.check_output(command, env=env))
    rows = []
    for record in document['records']:
        if record['record'] != 'item' or record['source'] not in QUESTS:
            continue
        effect = simple(record['enchantment'] or record['glyph'])
        rows.append([QUESTS[record['source']], record['depth'], record['choice'],
                     item_id(record['simple_class']), record['true_level'],
                     effect and effect_name(effect)])
    return rows


def depth_of(rows, quest):
    return next((row[1] for row in rows if row[0] == quest), None)


def generate(case):
    seed, daily = case
    base = rewards(seed, daily, vault=True)
    drifted = {}
    for k in DRIFTS:
        early = [f'{depth}:{k}:{decks}' for depth, decks in
                 ((depth_of(base, 'ghost'), GHOST_DECKS), (depth_of(base, 'wandmaker'), 'WAND'))
                 if depth]
        rows = [row for row in rewards(seed, daily, ';'.join(early))
                if row[0] in ('ghost', 'wandmaker')]
        imp = depth_of(base, 'imp')
        if imp:
            rows += [row for row in rewards(seed, daily, f'{imp}:{k}:{IMP_DECKS}')
                     if row[0] == 'imp']
        drifted[str(k)] = [[row[0], row[2], row[3], row[4]] for row in rows]
    return dict(seed=seed, rewards=base, drifted=drifted)


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
    samples = [generate(case) for case in NAMED]
    seeds = random_seeds()
    while len(samples) < len(NAMED) + RANDOM_SEEDS:
        case = next(seeds)
        try:
            samples.append(generate(case))
        except subprocess.CalledProcessError:
            # Some floors drop items whose sprite needs textures the headless
            # oracle does not load (RingRoom); those seeds are skipped.
            print(f'Skipped {case[0]}: the oracle failed', file=sys.stderr)
    fixture = dict(source='official ShatteredPD-v4.0.2-Java.jar; ParityOracle --floors 1-19; '
                          'rewards: [quest, depth, option, item, level, effect] (--vault); '
                          'drifted: k extra deck draws before the quest floor '
                          '(seedfinder.deckDrift), [quest, option, item, level]',
                   samples=samples)
    FIXTURE.write_text(format_fixture(fixture))
    print(f'Wrote {len(samples)} samples to {FIXTURE.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
