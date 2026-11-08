# Seed report floor items (`allItems`)

The `allItems` section of [seed-report-format.md](seed-report-format.md)
fills `floors[].items` for every item category, with `prediction`,
`conditions` and `ranges`. The builder is
`crates/seedfinder-core/src/report/` (`observe.rs`, `loose.rs`,
`predict.rs`).

`allItems` lists every item generated with a floor, from the same replay
`scout` runs (no assumed pickups; `level_map` instead assumes a found
hourglass is taken, so its later shops can differ). It covers:

- the heaps, containers and carried items (mimics, statues) of floors 1–24,
  including the Rat King room on floor 5 and the iron key
  `PrisonBossLevel` always drops on floor 10;
- the depth-20 Imp shop stock, which the game generates with that floor;
- equipment that lies in no heap, as in `scout`: quest rewards, sacrificial
  fire prizes, the Trinket Catalyst's four offers (the catalyst itself is not
  listed again) and the Imp's vault treasure.

The Blacksmith mines and the rest of the Imp's vault are not listed.

Items other than equipment have:

- `id`: the game class in snake case (`potion_of_healing`,
  `stone_of_blink`, `gold`, `iron_key`, `region_lore_page_halls`). Exotic
  potions and scrolls are `exotic_` plus their base (`exotic_scroll_of_upgrade`
  is the Scroll of Enchantment). The secret laboratory's
  and library's potions and scrolls are the picks under the pinned Temurin
  runtime's class order; other Java/ART runtimes may pick differently.
  `name`: the game's English name.
- `category`: `potion`, `scroll`, `stone`, `seed`, `food`, `gold`, `key`,
  `missile` (plain darts) or `other`.
- `spriteIndex`: the sprite this run draws, so potions and scrolls show the
  run's appearance. `upgrade` 0, `effect` `null`, `cursed` false.
- `source`: the heap (`heap`, `chest`, `locked_chest`, `crystal_chest`,
  `tomb`, `skeleton`, `shop`) or carrier (`mimic`, `golden_mimic`,
  `crystal_mimic`, `statue`, `armored_statue`). `secret`: inside a secret
  room.
- `accessibility`: the crystal choice and crystal path rooms' limits. A
  group the room shares with equipment keeps the equipment's number; other
  groups get numbers no other floor uses.
- `matched`, `resinDonor`, `excluded`: false; queries match equipment only.

`prediction` and `conditions`:

- `exact`: the item spawns as listed whatever the player does. No
  conditions.
- `constrained`: the seed fixes the item, but it spawns only under its
  conditions:
  - Quest rewards (`ghost_reward`, `wandmaker_reward`, `blacksmith_reward`,
    `imp_reward`): `{type: "quest"}` and `{type: "choice", group: <reward
    source>}`. `optionCount` counts the options of the item's choice group;
    the Imp's group includes the vault treasure, since one item leaves the
    vault. Vault treasure carries the Imp's quest and choice too.
  - The depth-20 shop: `{type: "quest", quest: "imp"}`; it opens when the
    Imp quest is done.
  - The Catalyst's offers: `{type: "choice", group: "trinket_catalyst",
    optionCount: 4, selectedCount: 1}`.
  - Sacrificial fire prizes: `{type: "runtime", state: "sacrificial_fire"}`.
  - With a selected trinket this engine models in generation (Parchment
    Scrap, Mimic Tooth, Rat Skull, Cracked Spyglass, Exotic Crystals, Trap
    Mechanism, Mossy Clump), every item of a floor generated with it active
    carries `{type: "trinket", events: [{beforeDepth: <depth>, kind:
    "acquired", trinket, minUpgrades: 3}]}`. Other trinkets add nothing.
- `variable`: play or unseeded runtime state picks the identity:
  `{type: "runtime", state: "unseeded_selection"}` for the secret
  laboratory's and library's picks, `state: "shop_bag"` for the shop's bag (the listed bag
  assumes the Scroll Holder, Potion Bandolier, Magical Holster purchase
  order).

`ranges` are exact (`min` equals `max`): `quantity` is the stack size, absent
for thrown weapons that lie in no heap; `tier` for weapons and armor; `level`
is the identified level for equipment other than trinkets.

## Parity

`crates/seedfinder-core/tests/fixtures/seed-report-items.json` holds, per
floor, the heap and carried items other than equipment that the official
v4.0.2 JAR generates for seven runs: four seeds, the daily run
`2026-01-01`, `AAA-AAA-AAA` with challenge mask 111, and `AAA-AAA-AAA` with
Mimic Tooth. `report::parity` checks the report's floor items against it, and
against the `level_map` heaps of every map floor up to the first hourglass.
Equipment parity comes from the existing floor fixtures. Regenerate the
fixture with JDK 17 or later (`JAVA_21_HOME`, else `JAVA_HOME`, else
`PATH`):

```sh
python3 tooling/oracle-4.0/generate-seed-report-items.py
```
