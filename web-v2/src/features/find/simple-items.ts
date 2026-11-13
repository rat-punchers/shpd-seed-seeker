import type { RequirementKind } from '../../engine/types'
import {
  type CatalogItem,
  getItem,
  items,
  kindFamily,
  wildcardSpriteForKind,
} from '../../shared/game/catalog'

/** The item kinds a Simple row offers, in menu order. */
export const SIMPLE_KINDS: readonly { kind: RequirementKind; label: string }[] =
  [
    { kind: 'ring', label: 'Rings' },
    { kind: 'wand', label: 'Wands' },
    { kind: 'artifact', label: 'Artifacts' },
    { kind: 'trinket', label: 'Trinkets' },
    { kind: 'melee_weapon', label: 'Melee weapons' },
    { kind: 'thrown_weapon', label: 'Thrown weapons' },
    { kind: 'weapon', label: 'Any weapon' },
    { kind: 'armor', label: 'Armor' },
  ]

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

const kindLabel = new Map(
  SIMPLE_KINDS.map((entry) => [entry.kind, entry.label])
)

export const simpleKindLabel = (kind: RequirementKind): string =>
  kindLabel.get(kind) ?? kind

const matchesKind = (item: CatalogItem, kind: RequirementKind): boolean =>
  item.type === kindFamily(kind) &&
  (kind === 'melee_weapon'
    ? item.class === 'melee'
    : kind === 'thrown_weapon'
      ? item.class === 'thrown'
      : true)

const itemsByKind = new Map(
  SIMPLE_KINDS.map(({ kind }) => [
    kind,
    items
      .filter((item) => matchesKind(item, kind))
      .sort((left, right) => left.name.localeCompare(right.name)),
  ])
)

/** The items a row of `kind` can name, by name. */
export const itemsForKind = (kind: RequirementKind): CatalogItem[] =>
  itemsByKind.get(kind) ?? []

/** Trinkets and artifacts are searched by name only: the engine has no "any". */
export const requiresItem = (kind: RequirementKind): boolean =>
  kind === 'trinket' || kind === 'artifact'

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

/** One entry of a row's item picker: a named item, or any item of a kind. */
export interface ItemChoice {
  value: string
  label: string
  kind: RequirementKind
  item?: string
}

export interface ItemChoiceGroup {
  value: string
  items: ItemChoice[]
}

const ANY_LABEL: Partial<Record<RequirementKind, string>> = {
  ring: 'Any ring',
  wand: 'Any wand',
  melee_weapon: 'Any melee weapon',
  thrown_weapon: 'Any thrown weapon',
  weapon: 'Any weapon',
  armor: 'Any armor',
}

const choiceValue = (kind: RequirementKind, item?: string) =>
  `${kind}:${item ?? 'any'}`

/** The picker's menu: the "any" choices first, then each kind's items. */
export const ITEM_CHOICE_GROUPS: readonly ItemChoiceGroup[] = [
  {
    value: 'Any of a kind',
    items: SIMPLE_KINDS.filter(({ kind }) => !requiresItem(kind)).map(
      ({ kind }) => ({
        value: choiceValue(kind),
        label: ANY_LABEL[kind] ?? simpleKindLabel(kind),
        kind,
      })
    ),
  },
  // "Any weapon" names no items of its own: they sit under melee and thrown.
  ...SIMPLE_KINDS.filter(({ kind }) => kind !== 'weapon').map(
    ({ kind, label }) => ({
      value: label,
      items: itemsForKind(kind).map((item) => ({
        value: choiceValue(kind, item.id),
        label: item.name,
        kind,
        item: item.id,
      })),
    })
  ),
]

const choices = new Map(
  ITEM_CHOICE_GROUPS.flatMap((group) => group.items).map((choice) => [
    choice.value,
    choice,
  ])
)

/** A row's current choice; one the menu does not list is described anyway. */
export function choiceFor(kind: RequirementKind, item?: string): ItemChoice {
  const value = choiceValue(kind, item)
  return (
    choices.get(value) ?? {
      value,
      label: (item ? getItem(item)?.name : undefined) ?? simpleKindLabel(kind),
      kind,
      ...(item ? { item } : {}),
    }
  )
}

/** The sprite a row shows: its item, or the kind's wildcard. */
export const rowSprite = (kind: RequirementKind, item?: string): number =>
  (item ? getItem(item)?.sprite : undefined) ?? wildcardSpriteForKind(kind)
