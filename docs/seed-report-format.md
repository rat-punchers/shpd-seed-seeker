# Seed report format (schema version 1)

`seed_report` describes one seed for the web-v2 Analyze screen. It is exported
by `crates/seedfinder-wasm` only; the builder is
`crates/seedfinder-core/src/report/`. `scout`, `level_map`, FFI, JNI and the
native apps do not use it. Floor maps stay on `level_map`
([level-map-format.md](level-map-format.md)).

## Request

```json
{"seed": "AAA-AAA-AAA", "challenges": ["on_diet"], "trinket": "mimic_tooth", "query": {}}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `seed` | string | Required. A seed code in any case or grouping, or a UTC daily date `YYYY-MM-DD`, as `scout` accepts. |
| `challenges` | string[] | Optional. Challenge names from `engine_info.challenges`. |
| `trinket` | string | Optional. One of the seed's four Catalyst offers by item id, or `"none"` for No Trinket. Absent resolves the selection from `query`, like `scout`. |
| `query` | object | Optional. A query document ([search-query-format.md](search-query-format.md)). It selects the trinket when `trinket` is absent and sets the `matched`, `resinDonor` and `excluded` item marks. Its own `challenges` are not applied; pass them in `challenges`. |

Unknown request fields, invalid seeds, unknown challenges, invalid queries and
trinkets outside the four offers are errors. The wasm export throws a
JavaScript error carrying the message.

## Contract rules

- `sections` lists the parts of the report the engine fills. The UI renders a
  part only when its section is listed.
- Fields of an unlisted section are absent. Fields that are always present
  belong to sections every report lists.
- `status` is `partial` while any section below is not filled, else
  `complete`. `notes` are human-readable remarks about what the report omits.
- Adding a field or a section keeps `schemaVersion`. Renaming or removing a
  field bumps it.
- Adding a section: implement it, add it to `report::SECTIONS`, regenerate
  the fixtures, and update this document.

## Sections

| Section | Filled | Fields |
| --- | --- | --- |
| `identities` | yes | `identities` |
| `ringGems` | yes | `ringGems` |
| `trinketOffers` | yes | `trinkets.offers`, `trinkets.selected`, `trinkets.transmutationOrder` |
| `artifactDecks` | yes | `trinkets.artifactDecks` |
| `feelings` | yes | `floors[].feeling` |
| `rooms` | yes | `floors[].rooms` |
| `equipment` | yes | `floors[].items` for weapons, armor, wands, rings, trinkets and artifacts |
| `quests` | yes | `quests[]` without `slots`, `upgradesPinned`, `totalUpgradeValue` |
| `branches` | yes | `floors[].branches` |
| `allItems` | yes | `floors[].items` for every category, with `prediction`, `conditions`, `ranges`; see [seed-report-items.md](seed-report-items.md) |
| `trinketTiming` | no | `trinkets.timing` |
| `alchemyPots` | no | `floors[].appearances` |
| `builders` | no | `floors[].builder` |
| `questRewardSlots` | no | `quests[].slots`, `quests[].upgradesPinned`, `quests[].totalUpgradeValue` |
| `encounters` | no | `floors[].encounters` |

## Response

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | string | Always `seed-seeker-seed-report`. |
| `schemaVersion` | number | `1`. |
| `shpdVersion`, `shpdCommit` | string | The pinned game version and source commit. |
| `status` | `partial` \| `complete` | See the contract rules. |
| `notes` | string[] | Remarks about omitted data. |
| `sections` | string[] | Filled sections, in the order of the table above. |
| `seed` | object | `code` (`XXX-XXX-XXX` or the daily date), `value` (the numeric seed), `daily`. |
| `query` | object | Present only with a request query: `matchedRequirements`, `totalRequirements`. |
| `identities` | object | `scrolls`, `potions`, `rings`: twelve `{name, appearance, spriteIndex}` each, in the game's class order. |
| `ringGems` | number[12] | The gem each ring class is drawn with, in catalog ring order, as in `scout`. |
| `trinkets` | object | See below. |
| `floors` | object[] | Floors 1–24 in depth order. See below. |
| `quests` | object[] | Quests present in the world, Ghost, Wandmaker, Blacksmith, Imp order. See below. |

### `trinkets`

- `offers`: the four Catalyst offers. `transmutationOrder`: transmutation
  results 1–13. Both hold `{id, name, spriteIndex, matched}`; `matched` marks
  a transmutation the query uses.
- `selected`: the selected offer id, or `null` for No Trinket.
- `artifactDecks`: `{depth, order}` for depth 0 (before floor 1) through 24,
  the remaining artifact deck after that floor, as in `scout`.
- `timing` (`trinketTiming`): `catalystDepth`, `firstAlchemyPotDepth`,
  `firstAlchemyPotSecret`, `selectionDepth` (first floor the trinket can be
  chosen on), `firstEffectiveDepth` (first floor whose generation it can
  change), `optionEffects` (index-aligned with `offers`: `modeled`,
  `unmodeled` or `none`).

### `floors[]`

- `depth`; `feeling` (absent on boss floors); `rooms` (room type ids, empty on
  floors without room tracking).
- `builder` (`builders`): the level builder class.
- `appearances` (`alchemyPots`): `{kind: "alchemy_pot", room?, secret}`.
- `items`: equipment in world order, then the other categories. Equipment
  base fields equal one `scout` item: `id`, `name`, `category`,
  `spriteIndex`, `upgrade`, `effect` (`{name, kind}`, `kind` `enchantment` or
  `curse`, or `null`), `cursed`, `secret`, `depth`, `source`, `accessibility`
  (`{type: "independent"}`, `{type: "choice", group, option}` or `{type:
  "scenarios", group, mask}`, `mask` as `0x…` hex), `matched`, `resinDonor`,
  `excluded`. With `allItems` ([seed-report-items.md](seed-report-items.md)):
  - `prediction`: `exact`, `constrained` or `variable`.
  - `conditions`: any of `{type: "challenge", challenge, enabled}`,
    `{type: "trinket", events}`, `{type: "artifact", events}`,
    `{type: "quest", quest, depth?}`,
    `{type: "choice", group, optionCount, selectedCount, favorRequirement?}`,
    `{type: "inventory", requirement}`, `{type: "runtime", state}`. Trinket
    events are `{beforeDepth, kind: acquired|upgraded|transmuted, trinket?,
    minUpgrades?}`; artifact events are `{beforeDepth, kind:
    obtained|transmuted, artifact}`.
  - `ranges`: optional `quantity`, `tier`, `level`, each `{min, max}`
    inclusive.
- `encounters` (`encounters`): `{mob, quantity, rewards?}`; a reward is
  `{item?, category, level?, cursed?, effect?, prediction, chance?}` with
  `prediction` `guaranteed`, `runtime_chance` or `generated_with_floor` and
  `chance` `{numerator, denominator}`.
- `branches`: quest sub-levels entered from this floor:
  `{branch, kind, objective, access}`. `kind` is `blacksmith_crystal`,
  `blacksmith_gnoll` or `imp_vault`, as `level_map` names it; request that map
  with the floor's `depth` and this `branch`. `objective` is the quest
  variant. `access` is `{quest, requiresAcceptance, requiredItem?}`.

### `quests[]`

- `quest` (`ghost`, `wandmaker`, `blacksmith`, `imp`), `variant` (as in
  `scout`), `depth` (the quest giver's floor).
- `spawnDepthRange`: `{min, max}`, the floors the quest giver can spawn on.
- `rewards`: `{source, optionCount, selectedCount, favorRequirement?}`. The
  player keeps `selectedCount` of `optionCount` rewards; the reward items
  carry `source`. Ghost 1 of 2, Wandmaker 1 of 2, Blacksmith 1 of 4 at 2000
  favor, Imp 1 of 6.
- `questRewardSlots`: `slots` (`{slot, item, level, levelPinned, role?,
  levelRule?, effect?, candidates?, scenarioCount}`; `levelRule` is
  `{type: "range", min, max}` or `{type: "transfer_upgrade", transfer}`; a
  candidate is `{item, drifts, weight}` with weights over `scenarioCount`),
  and for the Imp `upgradesPinned` and `totalUpgradeValue`.

## Fixtures

`crates/seedfinder-wasm/tests/fixtures/seed-report/` holds real reports for
`AAA-AAA-AAA`, `RZN-LKU-EFS` and the daily run `2026-01-01`. The
`seed_report` fixture test fails when they are stale. Regenerate them with:

```sh
UPDATE_SEED_REPORT_FIXTURES=1 cargo test -p shpd-seedfinder-wasm seed_report
```

## Example

A synthetic report showing every field, with lists shortened. Real reports
list only the filled sections; this example fills all of them.
`crates/seedfinder-core/src/report/tests.rs` checks that it reads into the
report types and writes back unchanged.

```json
{
  "format": "seed-seeker-seed-report",
  "schemaVersion": 1,
  "shpdVersion": "4.0.2",
  "shpdCommit": "57a4e06a4caf162446d1c28caa7983f0493fecf0",
  "status": "complete",
  "notes": [],
  "sections": [
    "identities", "ringGems", "trinketOffers", "artifactDecks", "feelings", "rooms",
    "equipment", "quests", "branches", "allItems", "trinketTiming", "alchemyPots",
    "builders", "questRewardSlots", "encounters"
  ],
  "seed": {"code": "AAA-AAA-AAA", "value": 0, "daily": false},
  "query": {"matchedRequirements": 1, "totalRequirements": 2},
  "identities": {
    "scrolls": [{"name": "Scroll of upgrade", "appearance": "KAUNAN", "spriteIndex": 112}],
    "potions": [{"name": "Potion of strength", "appearance": "crimson", "spriteIndex": 128}],
    "rings": [{"name": "Ring of accuracy", "appearance": "garnet", "spriteIndex": 336}]
  },
  "ringGems": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  "trinkets": {
    "offers": [{"id": "mimic_tooth", "name": "Mimic Tooth", "spriteIndex": 600, "matched": false}],
    "selected": "mimic_tooth",
    "transmutationOrder": [{"id": "rat_skull", "name": "Rat Skull", "spriteIndex": 601, "matched": true}],
    "artifactDecks": [
      {"depth": 0, "order": [{"id": "horn_of_plenty", "name": "Horn of Plenty", "spriteIndex": 400, "matched": false}]}
    ],
    "timing": {
      "catalystDepth": 2,
      "firstAlchemyPotDepth": 3,
      "firstAlchemyPotSecret": false,
      "selectionDepth": 3,
      "firstEffectiveDepth": 4,
      "optionEffects": ["modeled", "unmodeled", "none", "modeled"]
    }
  },
  "floors": [
    {
      "depth": 1,
      "feeling": "none",
      "rooms": ["garden"],
      "builder": "loop",
      "appearances": [{"kind": "alchemy_pot", "room": "laboratory", "secret": false}],
      "items": [
        {
          "id": "hand_axe",
          "name": "Hand Axe",
          "category": "weapon",
          "spriteIndex": 30,
          "upgrade": 1,
          "effect": {"name": "Grim", "kind": "enchantment"},
          "cursed": false,
          "secret": false,
          "depth": 1,
          "source": "chest",
          "accessibility": {"type": "scenarios", "group": 3, "mask": "0x5"},
          "matched": true,
          "resinDonor": false,
          "excluded": false,
          "prediction": "constrained",
          "conditions": [
            {"type": "challenge", "challenge": "on_diet", "enabled": false},
            {"type": "trinket", "events": [{"beforeDepth": 1, "kind": "acquired", "trinket": "mimic_tooth", "minUpgrades": 3}]},
            {"type": "artifact", "events": [{"beforeDepth": 1, "kind": "obtained", "artifact": "horn_of_plenty"}]},
            {"type": "quest", "quest": "ghost", "depth": 2},
            {"type": "choice", "group": "blacksmith_reward", "optionCount": 4, "selectedCount": 1, "favorRequirement": 2000},
            {"type": "inventory", "requirement": "iron_key"},
            {"type": "runtime", "state": "shop_purchase"}
          ],
          "ranges": {"quantity": {"min": 1, "max": 1}, "tier": {"min": 3, "max": 3}, "level": {"min": 0, "max": 2}}
        },
        {
          "id": "wand_of_magic_missile",
          "name": "Wand of Magic Missile",
          "category": "wand",
          "spriteIndex": 200,
          "upgrade": 2,
          "effect": null,
          "cursed": false,
          "secret": true,
          "depth": 1,
          "source": "heap",
          "accessibility": {"type": "independent"},
          "matched": false,
          "resinDonor": false,
          "excluded": false
        }
      ],
      "encounters": [
        {
          "mob": "rat",
          "quantity": 3,
          "rewards": [
            {"item": "mystery_meat", "category": "food", "level": 0, "cursed": false, "effect": "Grim", "prediction": "runtime_chance", "chance": {"numerator": 1, "denominator": 8}}
          ]
        }
      ],
      "branches": [
        {"branch": 1, "kind": "blacksmith_gnoll", "objective": "gnoll", "access": {"quest": "blacksmith", "requiresAcceptance": true, "requiredItem": "pickaxe"}}
      ]
    }
  ],
  "quests": [
    {
      "quest": "imp",
      "variant": "vault",
      "depth": 18,
      "spawnDepthRange": {"min": 17, "max": 19},
      "rewards": {"source": "imp_reward", "optionCount": 6, "selectedCount": 1},
      "slots": [
        {
          "slot": 0,
          "item": "ring_of_haste",
          "level": 3,
          "levelPinned": true,
          "role": "ring",
          "levelRule": {"type": "range", "min": 2, "max": 3},
          "effect": "Grim",
          "candidates": [{"item": "ring_of_haste", "drifts": [0, -1], "weight": 5}],
          "scenarioCount": 7
        },
        {
          "slot": 1,
          "item": "chalice_of_blood",
          "level": 5,
          "levelPinned": true,
          "levelRule": {"type": "transfer_upgrade", "transfer": 5},
          "scenarioCount": 1
        }
      ],
      "upgradesPinned": true,
      "totalUpgradeValue": 14
    },
    {
      "quest": "blacksmith",
      "variant": "crystal",
      "depth": 13,
      "spawnDepthRange": {"min": 12, "max": 14},
      "rewards": {"source": "blacksmith_reward", "optionCount": 4, "selectedCount": 1, "favorRequirement": 2000}
    }
  ]
}
```
