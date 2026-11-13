import type { ChipView, RequirementRow, ResinCondition } from './board'
import type {
  ItemCategory,
  ItemSource,
  RequirementKind,
  TierFilter,
  UpgradeFilter,
} from './query'

/**
 * A requirement sheet between two requests. The core owns its contents; the
 * app keeps the string as it came and sends it back with the next request.
 */
export type EditorDraft = string & { readonly __editorDraft: unique symbol }

export type TierMode = TierFilter['mode']
export type UpgradeMode = UpgradeFilter['mode']
export type EffectMode = 'any' | 'any_enchantment' | 'specific'
export type WeaponType = 'any' | 'melee' | 'thrown'

/** One control the user moved. */
export type EditorChange =
  | { type: 'set_category'; value: ItemCategory }
  | { type: 'set_weapon_type'; value: WeaponType }
  | { type: 'set_kind'; value: RequirementKind }
  /** An item's stable id, `null` for the wildcard, or `arcane_resin`. */
  | { type: 'set_item'; value: string | null }
  | { type: 'set_tier_mode'; value: TierMode }
  | { type: 'set_upgrade_mode'; value: UpgradeMode }
  | { type: 'set_effect_mode'; value: EffectMode }
  | { type: 'toggle_effect'; value: string }
  | { type: 'set_source'; value: ItemSource | null }
  | {
      type:
        | 'set_tier'
        | 'set_upgrade'
        | 'set_floor_limit'
        | 'set_transmutations'
        | 'set_count'
        | 'set_copy_depth'
        | 'set_total'
      value: number
    }
  | {
      type:
        | 'set_uncursed'
        | 'set_floor_limit_enabled'
        | 'set_exclude_resin'
        | 'set_transmutations_enabled'
        | 'set_select_trinket'
        | 'set_copy_depth_enabled'
        | 'set_count_levels'
        | 'set_resin_auto'
        | 'set_include_mage_wand'
      value: boolean
    }
  /** The number as typed, `null` for an empty field. */
  | { type: 'set_resin_amount'; value: number | null }

export type EditorRequest =
  | {
      op: 'open'
      rows: RequirementRow[]
      /** The row the sheet opens on; `null` for a new chip. */
      key?: number | null
      /** The new chip's section. */
      blanket?: boolean
      /** The query's resin condition, which seeds the resin section. */
      resin?: ResinCondition | null
      offer_resin?: boolean
      /** Opens the query's resin chip. */
      open_resin?: boolean
    }
  | { op: 'change'; draft: EditorDraft; change: EditorChange }
  | {
      op: 'save'
      draft: EditorDraft
      rows: RequirementRow[]
      next_key?: number
    }

/** One choice of a picker; `hidden` marks one offered only because the draft names it. */
export interface EditorOption<T> {
  value: T
  label: string
  /** The heading the choice sits under (`Tier 3`). */
  group: string | null
  hidden: boolean
}

export interface EditorChoice<T> {
  visible: boolean
  value: T
  options: EditorOption<T>[]
}

/** A check box, with the help text shown under it whenever it shows. */
export interface EditorToggle {
  visible: boolean
  value: boolean
  label: string
  caption: string | null
}

/** A mode picker with its value slider. */
export interface EditorModeRange<M> {
  visible: boolean
  mode: M
  modes: EditorOption<M>[]
  /** The value slider shows: the control does, in a mode other than `any`. */
  value_visible: boolean
  value: number
  min: number
  max: number
  value_label: string
}

/** A switch with a floor slider, whose options skip the empty boss floors. */
export interface EditorFloorToggle {
  visible: boolean
  enabled: boolean
  value: number
  options: EditorOption<number>[]
  label: string
  value_label: string
}

/** A switch with a stepper or slider, which shows while the switch is on. */
export interface EditorRangeToggle {
  visible: boolean
  enabled: boolean
  value: number
  min: number
  max: number
  label: string
  caption: string | null
  /** The caption shows: while the switch is on for the transmutation limit, whenever the control does for the combined level. */
  caption_visible: boolean
  value_label: string
}

export type EffectGroup = 'enchantment' | 'curse'

/** Everything the sheet shows for a draft. */
export interface EditorForm {
  v: number
  mode: 'new' | 'edit'
  origin: { type: 'new' } | { type: 'row'; key: number } | { type: 'resin' }
  blanket: boolean
  in_cluster: boolean
  resin_picked: boolean
  /** The header's title; there even while the draft has errors. */
  title: string
  /** The chip a save would produce, or `null` while there are errors or resin is picked. */
  preview: ChipView | null
  category: EditorChoice<ItemCategory>
  kind: EditorChoice<RequirementKind>
  weapon_type: EditorChoice<WeaponType>
  item: EditorChoice<string | null>
  tier: EditorModeRange<TierMode>
  upgrade: EditorModeRange<UpgradeMode>
  effect: {
    visible: boolean
    /** The section's label: `Enchantment`, or `Glyph` on armor. */
    label: string
    mode: EffectMode
    modes: EditorOption<EffectMode>[]
    /** The "Specific…" grid shows: the control does, in mode `specific`. */
    choices_visible: boolean
    choices: {
      value: string
      label: string
      group: EffectGroup
      selected: boolean
    }[]
    groups: EditorOption<EffectGroup>[]
    caption: string
  }
  uncursed: EditorToggle
  source: EditorChoice<ItemSource | null>
  floor_limit: EditorFloorToggle
  exclude_resin: EditorToggle
  transmutations: EditorRangeToggle
  select_trinket: EditorToggle
  stack: {
    visible: boolean
    /** The section's label, which the count stepper takes too. */
    label: string
    count: number
    min: number
    max: number
    value_label: string
    copy_depth: EditorFloorToggle
    count_levels: EditorRangeToggle
  }
  resin: {
    visible: boolean
    /** The section's label, which the amount field takes too. */
    label: string
    auto: boolean
    /** The Amount/Auto choice, each option valued as `auto` is. */
    modes: EditorOption<boolean>[]
    /** What Auto means, shown in the amount field's place while `auto` is on. */
    caption: string
    /** The amount as typed; `null` for an empty field. */
    amount: number | null
    /** The amounts that save. */
    min: number
    max: number
    include_mage_wand: EditorToggle
  }
  /** Why the draft cannot be saved, in the order to show them. */
  errors: string[]
  can_save: boolean
}

/** An open sheet: the draft to send back and the form it shows. */
export interface EditorSheet {
  draft: EditorDraft
  form: EditorForm
}

/** What a save wrote. */
export interface EditorSaved {
  rows: RequirementRow[]
  next_key: number
  changed: boolean
  rekeyed: [number, number][]
  /** The visible row the save landed on. */
  focus: number | null
  /** The query's resin: set when Arcane Resin was saved, cleared when the resin chip became a row. */
  resin: { set: ResinCondition } | { clear: true } | null
}

/** Open and change answer a sheet; save answers what it saved, or the sheet with its errors. */
export type EditorResponse = EditorSheet | { saved: EditorSaved }
