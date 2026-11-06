# Seed report quest reward slots

The `questRewardSlots` section of [seed-report-format.md](seed-report-format.md)
fills `quests[].slots`, and for the Imp `upgradesPinned` and
`totalUpgradeValue`. The builders are `report/quest_slots.rs`,
`report/imp_slots.rs` and `report/drift.rs` in `crates/seedfinder-core/src`.

## Deck drift

Each seeded generator deck (wands, rings, artifacts, each weapon and thrown
weapon tier) draws its classes from a private seed, so the class at draw
index `i` is fixed by the seed. Run history, such as items generated during
play, only changes which index a reward draw lands on. A slot drawn from a
deck lists `candidates`: the classes at the seed draw's index and up to 3
indices either side (indices before the deck's first draw are left out).
`drifts` are the offsets that give the class, nearest first; `0` is the
seed draw. `weight` counts those offsets and `scenarioCount` counts the
window, so `weight / scenarioCount` is a share of the window, not a play
frequency. The seed draw's class comes first, then the rest by weight, then
by nearest offset.

`item`, `level` and `effect` are what the seed gives with no run history.
`levelPinned` is true when no offset in the window changes the level.

## Per quest

- **Ghost**: slot 0 is the weapon, drawn from its tier deck, with candidates.
  Slot 1 is the armor, chosen by the floor's RNG, with no candidates. Both
  levels are one roll after the draws, so both are pinned.
- **Wandmaker**: slot 0 is wand 1 and slot 1 wand 2, the next card of
  another class. Each skipped duplicate burns floor RNG, so wand 2's level is
  pinned only when every offset skips as many duplicates as the seed draw.
  Wand 1's level is always pinned.
- **Blacksmith**: the four rewards (two weapons, the thrown weapon, the
  armor) are drawn with `useDefaults` from the floor's RNG, so no drift
  reaches them: no candidates, all pinned. A plain-dart thrown option has no
  catalog item and no slot.
- **Imp**: the six vault options with `role` and `levelRule`. Slot 0 is the
  artifact (`transfer_upgrade` 5; `level` is the stored
  `round(5 * levelCap / 10)`, so 3 for Ethereal Chains and Timekeeper's
  Hourglass, 2 for Sandals of Nature, else 5), or a ring once the artifact
  deck is empty. Slot 1 is a ring of a different class, slots 2 and 3 the
  tier-5/tier-4 melee and thrown pair (slot 3 is `range` 3–5, the rest
  2–4), slot 4 the Plate Armor (no deck, no candidates), slot 5 a wand.
  `totalUpgradeValue` sums the levels, counting the artifact as its transfer
  amount.

  Every class in a deck consumes the same floor RNG, so a drift moves a
  slot's class and nothing else, with two exceptions: an Unstable Spellbook
  (or an empty artifact deck) at some slot-0 offset, and differing duplicate
  rejects in slot 1 when slot 0 is a ring. Either moves every later roll:
  `upgradesPinned` is false, the later slots' `levelPinned` is false, and
  the coin flip that orders slots 2 and 3 can change. The artifact slot's
  `levelPinned` is true when every candidate stores the same level.

## Parity

`crates/seedfinder-core/tests/fixtures/seed-report-quests.json` holds, for
four named seeds, the daily run `2026-01-01` and 15 fixed random seeds, every
quest reward option from the official v4.0.2 JAR (`--floors 1-19 --vault`).
For drifts 1, 2 and 3 it also holds the rewards after the oracle's
`seedfinder.deckDrift` property drew that many extra cards from the reward
decks just before the quest floor ([oracle README](../tooling/oracle-4.0/README.md)).
`report::quest_parity` checks each slot's `item`, `level` and `effect`
against the plain run, and each drifted reward against the candidate with
that drift and, when `levelPinned`, against `level`. Negative drifts use the
same deck replay; `report::drift_tests` checks the replay against real draws.
Regenerate the fixture with JDK 17 or later (`JAVA_21_HOME`, else
`JAVA_HOME`, else `PATH`):

```sh
python3 tooling/oracle-4.0/generate-seed-report-quests.py
```
