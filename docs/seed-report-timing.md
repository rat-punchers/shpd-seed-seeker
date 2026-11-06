# Seed report trinket timing, alchemy pots and builders

The `trinketTiming`, `alchemyPots` and `builders` sections of
[seed-report-format.md](seed-report-format.md) fill `trinkets.timing`,
`floors[].appearances` and `floors[].builder`. The builder is
`crates/seedfinder-core/src/report/timing.rs`, reading the same replay as
`allItems`.

## `trinkets.timing`

When a selected trinket takes effect, as the engine applies it:

- `catalystDepth`: the floor the Trinket Catalyst generates on (the floor of
  its four offers).
- `firstAlchemyPotDepth`: the first floor with an alchemy pot.
  `firstAlchemyPotSecret` is true when every pot on that floor is in a secret
  room.
- `selectionDepth`: the larger of the two, the first floor the trinket can be
  brewed on.
- `firstEffectiveDepth`: `selectionDepth + 1`, the first floor generated with
  the trinket, held at +3.
- `optionEffects`, index-aligned with `offers`: `modeled` for the trinkets
  whose generation change the engine applies (Parchment Scrap, Mimic Tooth,
  Rat Skull, Cracked Spyglass, Exotic Crystals, Trap Mechanism, Mossy Clump),
  `none` for trinkets that only change play. `unmodeled` marks a generation
  change the engine does not apply; no v4.0.2 trinket has one.

`timing` is absent when the Catalyst or a pot never generates through depth
24. In v4.0.2 both are guaranteed by depth 4.

## `floors[].appearances`

One `{kind: "alchemy_pot", room, secret}` per `ALCHEMY` map cell, in cell
order; empty on floors without one. `room` is the room type holding the pot
(`laboratory` or `secret_laboratory`); `secret` is true inside a secret room.

## `floors[].builder`

The class that laid out the floor's room graph: `loop` (`LoopBuilder`) or
`figure_eight` (`FigureEightBuilder`). Floor 5 (`SewerBossLevel`) is always
`figure_eight`. Floors 10, 15 and 20 build no room graph and omit `builder`.

## Parity

`crates/seedfinder-core/tests/fixtures/seed-report-timing.json` holds, per
floor, the builder class, whether the Trinket Catalyst has dropped, and the
room of each alchemy pot, from the official v4.0.2 JAR's `--run-checkpoints`
records for 47 runs: four named seeds, the daily run `2026-01-01`,
`AAA-AAA-AAA` with challenge mask 111 and with Mimic Tooth, and 40 fixed
random seeds. `report::timing_parity` checks `builder`, `appearances` and
`trinkets.timing` against it, and checks that a selected trinket is active
exactly from `firstEffectiveDepth`. Regenerate the fixture with JDK 17 or
later (`JAVA_21_HOME`, else `JAVA_HOME`, else `PATH`):

```sh
python3 tooling/oracle-4.0/generate-seed-report-timing.py
```
