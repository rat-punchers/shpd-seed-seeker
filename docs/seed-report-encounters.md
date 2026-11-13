# Seed report floor encounters

The `encounters` section of [seed-report-format.md](seed-report-format.md)
fills `floors[].encounters`. The builder is
`crates/seedfinder-core/src/report/encounter.rs`, reading the same replay as
`allItems`.

## `floors[].encounters`

The mobs a floor's level holds when it finishes generating, grouped by class
in `mob` order: `{mob, quantity, rewards?}`.

- `mob`: the game class name in snake case (`rat`, `crystal_mimic`, `dm100`,
  `fire_elemental`), as `level_map` names its mobs.
- `quantity`: how many the level generated.
- Left out: the `actors.mobs.npcs` classes (quest givers, shopkeepers, the
  Rat King, sheep and vault guards), and the partner a Ghoul creates when it
  first acts, which `level_map` draws as an `approximate` mob.
- Floors 10 and 20 list none: `PrisonBossLevel.createMobs` keeps Tengu out of
  the level and `CityBossLevel.createMobs` adds nothing. Floor 15 lists its
  pylons; DM-300 arrives later.
- The Blacksmith mines and the Imp's vault are not included.

`rewards` lists the items those mobs carry from generation, in mob cell
order: mimic contents and statue weapons. Each is `{item?, category, level?,
cursed?, effect?, prediction}` with `prediction` `generated_with_floor`.

- `item`: the report item id (`id` of the matching `floors[].items` entry);
  absent when the identity depends on play.
- `category`: as for `floors[].items`.
- `level` (above zero only), `cursed` and `effect` (the enchantment or curse
  name): equipment only.

The schema also has `prediction` `guaranteed` and `runtime_chance`, with
`chance` `{numerator, denominator}`, for death loot. Death loot is rolled
during play, so the engine lists neither and `chance` is always absent.
`rewards` is absent when the mobs carry nothing.

## Parity

`crates/seedfinder-core/tests/fixtures/seed-report-encounters.json` holds,
per floor 1–24, every non-NPC mob class and the engine ids of the items it
carries, from the official v4.0.2 JAR's `--map-contents` level records for 8
runs: `AAA-AAA-AAA`, `RZN-LKU-EFS`, `BAD-RAT-KNG`, `ZZZ-ZZZ-ZZZ`, the daily
run `2026-01-01`, `AAA-AAA-AAA` with challenge mask 111 and with Mimic Tooth,
and `RZN-LKU-EFS` with Rat Skull. `report::encounter_parity` checks mob
counts and reward items against it, and checks that every floor's encounters
equal the grouping of the `level_map` mobs for the same seed and trinket.
Regenerate the fixture with JDK 17 or later (`JAVA_21_HOME`, else
`JAVA_HOME`, else `PATH`):

```sh
python3 tooling/oracle-4.0/generate-seed-report-encounters.py
```
