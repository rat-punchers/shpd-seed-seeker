import type {
  EditorChange,
  EditorFloorToggle,
  EditorForm,
} from '../../../engine/types'
import {
  Caption,
  CheckBox,
  LabeledControl,
  SliderRow,
  Stepper,
  SwitchRow,
} from './controls'
import {
  checkedEffects,
  type EffectEntry,
  effectChanges,
  effectGroups,
  effectSummary,
} from './effect-choices'
import { GroupedPicker } from './GroupedPicker'
import { HEADING, SECTION } from './ItemSection'
import { type SourceEntry, SourceIcon, sourceGroups } from './source-choices'

type Change = (change: EditorChange) => void

/**
 * A floor switch and its slider, which offers the floors the core lists. The
 * core's value label says the whole reading ("Within first 4 floors"), so the
 * slider keeps a fixed name of its own.
 */
function FloorLimit({
  control,
  name,
  onEnabled,
  onFloor,
}: {
  control: EditorFloorToggle
  name: string
  onEnabled: (enabled: boolean) => void
  onFloor: (floor: number) => void
}) {
  return (
    <>
      <SwitchRow
        label={control.label}
        checked={control.enabled}
        onChange={onEnabled}
      />
      {control.enabled ? (
        <SliderRow
          label={control.value_label}
          ariaLabel={name}
          values={control.options.map((option) => option.value)}
          value={control.value}
          onChange={onFloor}
        />
      ) : null}
    </>
  )
}

/** How many of the item, their floor, and whether their levels count together. */
export function StackSection({
  form,
  onChange,
}: {
  form: EditorForm
  onChange: Change
}) {
  const { stack } = form
  if (!stack.visible) return null
  const levels = stack.count_levels
  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={HEADING}>{stack.label}</h3>
        <Stepper
          value={stack.count}
          min={stack.min}
          max={stack.max}
          text={stack.value_label}
          onChange={(value) => onChange({ type: 'set_count', value })}
          ariaLabel={stack.label}
        />
      </div>
      {stack.copy_depth.visible ? (
        <FloorLimit
          control={stack.copy_depth}
          name="Copies within first"
          onEnabled={(value) =>
            onChange({ type: 'set_copy_depth_enabled', value })
          }
          onFloor={(value) => onChange({ type: 'set_copy_depth', value })}
        />
      ) : null}
      {levels.visible ? (
        <>
          <SwitchRow
            label={levels.label}
            checked={levels.enabled}
            onChange={(value) => onChange({ type: 'set_count_levels', value })}
          />
          {/* This caption explains the switch, so it shows beside it. */}
          {levels.caption_visible && levels.caption !== null ? (
            <Caption>{levels.caption}</Caption>
          ) : null}
          {levels.enabled ? (
            <SliderRow
              label="Levels reach"
              valueLabel={levels.value_label}
              min={levels.min}
              max={levels.max}
              value={levels.value}
              onChange={(value) => onChange({ type: 'set_total', value })}
            />
          ) : null}
        </>
      ) : null}
    </section>
  )
}

/**
 * The effect filter as one searchable list: Any, Any enchantment, or the
 * effects to tick, which stay open for more.
 */
function EffectPicker({
  form,
  onChange,
}: {
  form: EditorForm
  onChange: Change
}) {
  const { effect } = form
  const noun = effect.label.toLowerCase()
  return (
    <LabeledControl label={effect.label}>
      <GroupedPicker<EffectEntry>
        label={effect.label}
        face={
          <span className="min-w-0 flex-1 truncate">{effectSummary(form)}</span>
        }
        groups={() => effectGroups(form)}
        value={(groups) => checkedEffects(groups, form)}
        searchPlaceholder={`Search ${noun}s…`}
        emptyText={`No ${noun}s match.`}
        keepOpen={(entry) => entry.effect !== null}
        onPick={(entry) => {
          for (const change of effectChanges(form, entry)) onChange(change)
        }}
      />
      {effect.choices_visible ? <Caption>{effect.caption}</Caption> : null}
    </LabeledControl>
  )
}

/** Where the item comes from, as a searchable list under headings. */
function SourcePicker({
  form,
  onChange,
}: {
  form: EditorForm
  onChange: Change
}) {
  const { source } = form
  const label =
    source.options.find((option) => option.value === source.value)?.label ??
    'Any'
  return (
    <GroupedPicker<SourceEntry>
      label="Source"
      face={
        <>
          <SourceIcon source={source.value} />
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </>
      }
      groups={() => sourceGroups(source.options)}
      value={(groups) =>
        groups
          .flatMap((group) => group.items)
          .find((entry) => entry.source === source.value) ?? null
      }
      icon={(entry) => <SourceIcon source={entry.source} />}
      searchPlaceholder="Search sources…"
      emptyText="No sources match."
      onPick={(entry) => onChange({ type: 'set_source', value: entry.source })}
    />
  )
}

/** Effects, uncursed, source and floor limit. */
export function DetailsSection({
  form,
  onChange,
}: {
  form: EditorForm
  onChange: Change
}) {
  if (
    !form.effect.visible &&
    !form.uncursed.visible &&
    !form.source.visible &&
    !form.floor_limit.visible
  )
    return null
  return (
    <section className={SECTION}>
      <h3 className={HEADING}>Details</h3>
      {form.effect.visible ? (
        <EffectPicker form={form} onChange={onChange} />
      ) : null}
      {form.uncursed.visible ? (
        <CheckBox
          control={form.uncursed}
          onChange={(value) => onChange({ type: 'set_uncursed', value })}
        />
      ) : null}
      {form.source.visible ? (
        <LabeledControl label="Source">
          <SourcePicker form={form} onChange={onChange} />
        </LabeledControl>
      ) : null}
      {form.floor_limit.visible ? (
        <FloorLimit
          control={form.floor_limit}
          name="Within first"
          onEnabled={(value) =>
            onChange({ type: 'set_floor_limit_enabled', value })
          }
          onFloor={(value) => onChange({ type: 'set_floor_limit', value })}
        />
      ) : null}
    </section>
  )
}

/** The resin switches: the Mage's starting wand, and a wand's own exclusion. */
export function ResinSwitches({
  form,
  onChange,
}: {
  form: EditorForm
  onChange: Change
}) {
  return (
    <>
      {form.resin.include_mage_wand.visible ? (
        <section className={SECTION}>
          <CheckBox
            control={form.resin.include_mage_wand}
            onChange={(value) =>
              onChange({ type: 'set_include_mage_wand', value })
            }
          />
        </section>
      ) : null}
      {form.exclude_resin.visible ? (
        <section className={SECTION}>
          <CheckBox
            control={form.exclude_resin}
            onChange={(value) => onChange({ type: 'set_exclude_resin', value })}
          />
        </section>
      ) : null}
    </>
  )
}
