import type { RequirementKind } from '../../engine/types'
import {
  getItem,
  kindFamily,
  wildcardSpriteForKind,
} from '../../shared/game/catalog'
import {
  choiceValue,
  type ItemChoice,
  type ItemChoiceGroup,
  itemList,
  KIND_HEADINGS,
} from '../query/item-list'

export type { ItemChoice, ItemChoiceGroup }

// Local copies of engine facts (`engine_info.limits`), asserted against the
// engine in `engine-constants.test.ts`.

/** Highest searchable upgrade per item family. */
export const MAX_UPGRADE_BY_KIND = {
  weapon: 5,
  armor: 4,
  wand: 4,
  ring: 4,
  trinket: 0,
  artifact: 5,
} as const
/** The one weapon tier that reaches the weapon maximum. */
export const EXTRA_UPGRADE_TIER = 4
/** Highest upgrade for every other weapon tier. */
export const MAX_UPGRADE_DEFAULT = 4

/** Floor a new first row searches to. */
export const DEFAULT_ROW_DEPTH = 4

/** A kind's plural name (`Melee weapons`). */
export const kindLabel = (kind: RequirementKind): string => KIND_HEADINGS[kind]

/** Trinkets and artifacts are searched by name only: the core offers no "any". */
export const requiresItem = (kind: RequirementKind): boolean =>
  !itemList().groups.some((group) =>
    group.items.some((choice) => choice.kind === kind && !choice.item)
  )

/** The minimum upgrades a row offers; empty when it has no upgrade filter. */
export function upgradeLevels(kind: RequirementKind, item?: string): number[] {
  const family = kindFamily(kind)
  if (family === 'artifact' && !item) return []
  const tier = item ? getItem(item)?.tier : undefined
  const max =
    family === 'weapon' && tier !== undefined && tier !== EXTRA_UPGRADE_TIER
      ? MAX_UPGRADE_DEFAULT
      : MAX_UPGRADE_BY_KIND[family]
  return Array.from({ length: max }, (_, index) => index + 1)
}

/** The picker's menu: the shared item list (`features/query/item-list.ts`). */
export const itemChoiceGroups = (): readonly ItemChoiceGroup[] =>
  itemList().groups

let choices: Map<string, ItemChoice> | undefined
const choiceMap = (): Map<string, ItemChoice> => {
  choices ??= new Map(
    itemChoiceGroups()
      .flatMap((group) => group.items)
      .map((choice) => [choice.value, choice])
  )
  return choices
}
/** A row's current choice; one the menu does not list is described anyway. */
export function choiceFor(kind: RequirementKind, item?: string): ItemChoice {
  const value = choiceValue(kind, item)
  return (
    choiceMap().get(value) ?? {
      value,
      label: (item ? getItem(item)?.name : undefined) ?? kindLabel(kind),
      kind,
      ...(item ? { item } : {}),
    }
  )
}

/** The sprite a row shows: its item, or the kind's wildcard. */
export const rowSprite = (kind: RequirementKind, item?: string): number =>
  (item ? getItem(item)?.sprite : undefined) ?? wildcardSpriteForKind(kind)
