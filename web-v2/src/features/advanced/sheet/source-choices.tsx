import { AsteriskIcon } from '@phosphor-icons/react'
import { Sprite } from '@seed-seeker/design/spd/sprite'
import type { EditorOption, ItemSource, QuestName } from '../../../engine/types'
import { itemArt } from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'
import { QUEST_NPCS } from '../../analyze/report/art'
import type { PickerEntry, PickerGroup } from './GroupedPicker'

/** One choice of the sheet's source picker; `source` is `null` for any. */
export interface SourceEntry extends PickerEntry {
  source: ItemSource | null
}

/** The picker's headings, in menu order; the app's grouping of the core's options. */
const SOURCE_GROUPS: readonly [string, readonly ItemSource[]][] = [
  ['Floor', ['heap', 'skeleton', 'tomb', 'sacrificial_fire']],
  ['Chests', ['chest', 'locked_chest', 'crystal_chest']],
  ['Mimics', ['mimic', 'golden_mimic', 'crystal_mimic']],
  ['Statues', ['statue', 'armored_statue']],
  [
    'Shops and quests',
    [
      'shop',
      'ghost_reward',
      'wandmaker_reward',
      'blacksmith_reward',
      'imp_reward',
      'vault_treasure',
    ],
  ],
]

/**
 * `items.png` cells (`ItemSpriteSheet`): what each source looks like in the
 * game, or what it holds where it has no item art of its own.
 */
const SOURCE_CELLS: Partial<Record<ItemSource, number>> = {
  heap: 0, // SOMETHING, the unknown heap
  skeleton: 32, // BONES
  tomb: 34,
  sacrificial_fire: 51, // TORCH
  chest: 36,
  locked_chest: 37,
  crystal_chest: 38,
  mimic: 36,
  golden_mimic: 37,
  crystal_mimic: 38,
  statue: 112, // the weapon an animated statue wields
  armored_statue: 180, // and the armor an armored one wears
  shop: 18, // GOLD
  vault_treasure: 56, // GOLDEN_KEY
}

const SOURCE_NPCS: Partial<Record<ItemSource, QuestName>> = {
  ghost_reward: 'ghost',
  wandmaker_reward: 'wandmaker',
  blacksmith_reward: 'blacksmith',
  imp_reward: 'imp',
}

/** A source's picture, in a 16px box. */
export function SourceIcon({ source }: { source: ItemSource | null }) {
  const npc = source ? SOURCE_NPCS[source] : undefined
  const cell = source ? SOURCE_CELLS[source] : undefined
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      {npc ? (
        <Sprite sprite={QUEST_NPCS[npc]} scale={1} />
      ) : cell !== undefined ? (
        <ItemSprite art={itemArt(cell)} size={16} />
      ) : (
        <AsteriskIcon className="text-muted-foreground size-3.5" />
      )}
    </span>
  )
}

const entryOf = (option: EditorOption<ItemSource | null>): SourceEntry => ({
  value: option.value ?? 'any',
  label: option.label,
  source: option.value,
})

/** The core's sources under the picker's headings; any it adds later go last. */
export function sourceGroups(
  options: EditorOption<ItemSource | null>[]
): PickerGroup<SourceEntry>[] {
  const grouped = new Set(SOURCE_GROUPS.flatMap(([, sources]) => sources))
  const of = (keep: (source: ItemSource | null) => boolean) =>
    options.filter((option) => keep(option.value)).map(entryOf)
  return [
    { value: '', items: of((source) => source === null) },
    ...SOURCE_GROUPS.map(([value, sources]) => ({
      value,
      items: sources.flatMap((source) =>
        of((candidate) => candidate === source)
      ),
    })),
    {
      value: 'Other',
      items: of((source) => source !== null && !grouped.has(source)),
    },
  ].filter((group) => group.items.length > 0)
}
