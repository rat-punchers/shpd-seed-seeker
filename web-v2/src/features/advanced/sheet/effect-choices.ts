import type {
  EditorChange,
  EditorForm,
  EffectMode,
} from '../../../engine/types'
import type { PickerEntry, PickerGroup } from './GroupedPicker'

/** One choice of the effect picker: a mode (Any, Any enchantment), or one effect to tick. */
export interface EffectEntry extends PickerEntry {
  mode: EffectMode | null
  effect: string | null
}

/**
 * The modes but "Specific…", which ticking an effect stands for, then the
 * effects under the core's headings (Enchantments, Curses).
 */
export function effectGroups({
  effect,
}: EditorForm): PickerGroup<EffectEntry>[] {
  return [
    {
      value: '',
      items: effect.modes
        .filter((mode) => mode.value !== 'specific')
        .map((mode) => ({
          value: `mode:${mode.value}`,
          label: mode.label,
          mode: mode.value,
          effect: null,
        })),
    },
    ...effect.groups.map((group) => ({
      value: group.label,
      items: effect.choices
        .filter((choice) => choice.group === group.value)
        .map((choice) => ({
          value: `effect:${choice.value}`,
          label: choice.label,
          mode: null,
          effect: choice.value,
        })),
    })),
  ].filter((group) => group.items.length > 0)
}

/** The ticked effects, else the mode; "Specific…" with none ticked means any. */
export function checkedEffects(
  groups: PickerGroup<EffectEntry>[],
  { effect }: EditorForm
): EffectEntry[] {
  const entries = groups.flatMap((group) => group.items)
  const ticked =
    effect.mode === 'specific'
      ? effect.choices
          .filter((choice) => choice.selected)
          .flatMap(
            (choice) =>
              entries.find((entry) => entry.effect === choice.value) ?? []
          )
      : []
  if (ticked.length > 0) return ticked
  const mode = effect.mode === 'specific' ? 'any' : effect.mode
  return entries.filter((entry) => entry.mode === mode)
}

/** What the closed picker says: the mode, or the ticked effects. */
export function effectSummary({ effect }: EditorForm): string {
  const ticked = effect.choices.filter((choice) => choice.selected)
  if (effect.mode !== 'specific' || ticked.length === 0)
    return (
      effect.modes.find(
        (mode) =>
          mode.value === (effect.mode === 'specific' ? 'any' : effect.mode)
      )?.label ?? 'Any'
    )
  return ticked.map((choice) => choice.label).join(', ')
}

/**
 * What checking or unchecking `entry` sends: a mode as is; an effect ticks
 * into "Specific…" (which starts empty), and unticking the last one returns
 * to Any.
 */
export function effectChanges(
  { effect }: EditorForm,
  entry: EffectEntry
): EditorChange[] {
  if (entry.mode !== null)
    return [{ type: 'set_effect_mode', value: entry.mode }]
  if (entry.effect === null) return []
  if (effect.mode !== 'specific')
    return [
      { type: 'set_effect_mode', value: 'specific' },
      { type: 'toggle_effect', value: entry.effect },
    ]
  const ticked = effect.choices.filter((choice) => choice.selected)
  const lastOne = ticked.length === 1 && ticked[0]?.value === entry.effect
  return lastOne
    ? [{ type: 'set_effect_mode', value: 'any' }]
    : [{ type: 'toggle_effect', value: entry.effect }]
}
