import type {
  ItemCategory,
  ItemSource,
  RequirementDocument,
  RequirementKind,
} from './query'

// The requirement editor's JSON envelopes (docs/requirement-editor.md). The
// shared core owns every rule and every word behind them; these types only
// spell out the wire format.

/** One requirement of the editor's flat list: the document entry, its key and its either/or label. */
export interface RequirementRow extends RequirementDocument {
  key: number
  alternative_group?: number
}

/** The query's Arcane Resin condition as the editor reads it. */
export interface ResinCondition {
  amount: number | 'auto'
  filter: {
    uncursed: boolean
    max_depth: number | null
    source: ItemSource | null
    include_mage_wand: boolean
  } | null
}

/** One board edit; keys name visible rows (a chip or one cluster member). */
export type BoardEdit =
  | { type: 'normalize' }
  | { type: 'join'; source: number; target: number }
  | { type: 'detach'; key: number }
  /** The chip menu's Remove: the chip with its whole stack. */
  | { type: 'remove'; key: number }
  /** A drop on the remove target: one item of the chip. */
  | { type: 'remove_one'; key: number }
  | { type: 'remove_item'; key: number }
  | { type: 'set_count'; key: number; count: number }
  | { type: 'set_total'; key: number; total: number | null }
  | { type: 'toggle_levels'; key: number }
  | { type: 'set_copy_depth'; key: number; max_depth: number | null }
  | {
      type: 'save'
      key: number | null
      requirement: RequirementDocument
      count: number
      total: number | null
      copy_depth: number | null
    }

export interface BoardRequest {
  rows: RequirementRow[]
  next_key?: number
  edits?: BoardEdit[]
  resin?: ResinCondition | null
}

export interface BoardRefusal {
  reason: 'blanket_total' | 'no_free_group'
  message: string
}

/**
 * A qualifier beside a chip's name. The upgrade is tinted apart from the rest,
 * and on the resin chip so is the resin it counts (`credit`: the amount and
 * `Mage +2`) from the donor filter.
 */
export interface ChipTag {
  text: string
  style: 'plain' | 'upgrade' | 'credit'
  /** The tag's own hover text; only the resin chip's `Auto` and `Mage +2` have one. */
  tooltip: string | null
}

/** A stack (×N / ≤N) or combined-level (Σ) badge. */
export interface StackBadge {
  text: string
  compact_text: string
  tooltip: string
}

/** A chip's stack (×N / ≤N) and combined-level (Σ) badges, each absent when not shown. */
export interface ChipBadges {
  count: StackBadge | null
  total: StackBadge | null
}

/** What a chip's count and combined-level steppers offer. */
export interface StackView {
  count: number
  max: number
  can_grow: boolean
  can_change_count: boolean
  /** The count stepper's upper bound: `max` while the chip can grow, else its count. */
  count_max: number
  total: number | null
  can_count_levels: boolean
  level_capacity: number
  default_total: number
  copy_depth: number | null
  can_set_copy_depth: boolean
  count_text: string
  total_text: string
}

/**
 * What a chip shows of one item: its own row's face, or the face of the bare
 * copy a drag of it carries (`ChipView.lifted`). Drawn, never edited.
 */
export interface ChipFace {
  name: string
  title: string
  item: string | null
  /** Null only for a row the editor cannot read. */
  kind: RequirementKind | null
  family: ItemCategory | null
  tags: ChipTag[]
  trailing_tags: ChipTag[]
  effect: {
    label: string
    effects: string[]
    any_enchantment: boolean
    curses_only: boolean
  } | null
  uncursed: boolean
  details: string[]
  description: string
}

/** One visible row of the board: a chip, or one member of a cluster. Its face is its own row's. */
export interface ChipView extends ChipFace {
  key: number
  relations: { glyph: 'or' | 'sum' | 'times'; text: string }[]
  problem: string | null
  /** The badges at rest; a cluster member's are its own, drawn on its chip. */
  badges: ChipBadges
  /**
   * The badges the chip keeps while one item is lifted away, which a drag's
   * origin shows; null when the chip has no copies and the whole chip leaves.
   */
  remaining_badges: ChipBadges | null
  /**
   * The face of the item a drag of the chip carries — a bare copy of it, which
   * the moving chip draws — or null when the chip has no copies and moves itself.
   */
  lifted: ChipFace | null
  /** The hidden copies behind the chip's badge; members whose stacks are alike share theirs. */
  copies: number[]
  stack: StackView
  in_cluster: boolean
  can_detach: boolean
  /** The visible rows this chip may join, in list order. */
  join: number[]
  /** The visible rows a join onto is refused, with the reason. */
  refuse: ({ key: number } & BoardRefusal)[]
}

/** One board entry: a chip, or an either/or cluster. Stacks and badges are its chips'. */
export interface BoardItemView {
  /** `r<key>` for a chip, `c<label>` for a cluster; stable while the entry survives an edit. */
  id: string
  blanket: boolean
  cluster: number | null
  label: string | null
  /** The entry's name where a menu names it: a chip's name, or its members' joined with ` or `. */
  name: string
  members: number[]
  extras: number[]
  chips: ChipView[]
  problem: string | null
}

export interface ResinChipView {
  name: string
  tags: ChipTag[]
  uncursed: boolean
  /** The chip's hover text: the donors' source, the one filter no tag shows. */
  tooltip: string | null
  details: string[]
  description: string
}

export interface RequirementProblem {
  message: string
  keys: number[]
  scope: 'row' | 'group' | 'list'
}

export interface BoardResponse {
  rows: RequirementRow[]
  next_key: number
  changed: boolean
  rekeyed: [number, number][]
  focus: number | null
  refused: BoardRefusal | null
  items: BoardItemView[]
  counts: { ordinary: number; blanket: number }
  problems: RequirementProblem[]
  resin: ResinChipView | null
}
