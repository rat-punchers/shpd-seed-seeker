import { Input } from '@seed-seeker/design/ui/input'
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@seed-seeker/design/ui/native-select'
import type {
  EditorChange,
  EditorForm,
  EditorOption,
  TierMode,
  UpgradeMode,
} from '../../../engine/types'
import {
  Caption,
  CheckBox,
  LabeledControl,
  Segmented,
  SliderRow,
  Stepper,
  SwitchRow,
} from './controls'

// The sheet draws the shared core's form (docs/requirement-editor.md): which
// controls show, what they offer, their ranges, labels, help texts and errors
// all come from it, and every control the user moves goes back as a change.
// The dialog's chrome (titles, headings, slider names, button labels) is the
// app's.

type Change = (change: EditorChange) => void

/** What the tier slider is called in each mode; the core shows it only in a bounded one. */
const TIER_SLIDER: Record<TierMode, string> = {
  any: 'Tier',
  exact: 'Exact tier',
  at_least: 'Minimum tier',
  at_most: 'Maximum tier',
}

/** What the upgrade slider is called in each mode; the core shows it only in a bounded one. */
const UPGRADE_SLIDER: Record<UpgradeMode, string> = {
  any: 'Upgrade',
  exact: 'Exactly',
  at_least: 'Minimum upgrade',
}

export const SECTION =
  'flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0'
export const HEADING = 'font-pixel text-px-1'

/** The item picker's options, those under one heading (`Tier 3`) in an optgroup. */
function ItemOptions({ options }: { options: EditorOption<string | null>[] }) {
  const runs: {
    group: string | null
    options: EditorOption<string | null>[]
  }[] = []
  for (const option of options) {
    const last = runs.at(-1)
    if (option.group !== null && last?.group === option.group)
      last.options.push(option)
    else runs.push({ group: option.group, options: [option] })
  }
  const render = (option: EditorOption<string | null>) => (
    <NativeSelectOption key={option.value ?? ''} value={option.value ?? ''}>
      {option.label}
    </NativeSelectOption>
  )
  return runs.flatMap(({ group, options: run }) =>
    group === null
      ? run.map(render)
      : [
          <NativeSelectOptGroup key={group} label={group}>
            {run.map(render)}
          </NativeSelectOptGroup>,
        ]
  )
}

/** What the requirement is: category, weapon type, item and tier. */
export function ItemSection({
  form,
  onChange,
}: {
  form: EditorForm
  onChange: Change
}) {
  const { tier } = form
  return (
    <section className={SECTION}>
      <h3 className={HEADING}>Item</h3>
      {form.category.visible ? (
        <Segmented
          value={form.category.value}
          options={form.category.options}
          onChange={(value) => onChange({ type: 'set_category', value })}
          ariaLabel="Category"
          fill
        />
      ) : null}
      {form.weapon_type.visible ? (
        <LabeledControl label="Weapon type">
          <Segmented
            value={form.weapon_type.value}
            options={form.weapon_type.options}
            onChange={(value) => onChange({ type: 'set_weapon_type', value })}
            ariaLabel="Weapon type"
          />
        </LabeledControl>
      ) : null}
      {form.item.visible ? (
        <LabeledControl
          label={form.category.value === 'trinket' ? 'Trinket' : 'Item'}
        >
          <NativeSelect
            className="w-full"
            aria-label={form.category.value === 'trinket' ? 'Trinket' : 'Item'}
            value={form.item.value ?? ''}
            onChange={(event) =>
              onChange({
                type: 'set_item',
                value: event.currentTarget.value || null,
              })
            }
          >
            <ItemOptions options={form.item.options} />
          </NativeSelect>
        </LabeledControl>
      ) : null}
      {tier.visible ? (
        <>
          <LabeledControl label="Tier">
            <Segmented
              value={tier.mode}
              options={tier.modes}
              onChange={(value) => onChange({ type: 'set_tier_mode', value })}
              ariaLabel="Tier predicate"
            />
          </LabeledControl>
          {tier.value_visible ? (
            <SliderRow
              label={TIER_SLIDER[tier.mode]}
              valueLabel={tier.value_label}
              min={tier.min}
              max={tier.max}
              value={tier.value}
              onChange={(value) => onChange({ type: 'set_tier', value })}
            />
          ) : null}
        </>
      ) : null}
    </section>
  )
}

/** A trinket's transmutation limit and its choice at +3. */
export function TrinketSections({
  form,
  onChange,
}: {
  form: EditorForm
  onChange: Change
}) {
  const { transmutations } = form
  return (
    <>
      {transmutations.visible ? (
        <section className={SECTION}>
          <SwitchRow
            label={transmutations.label}
            checked={transmutations.enabled}
            onChange={(value) =>
              onChange({ type: 'set_transmutations_enabled', value })
            }
          />
          {transmutations.enabled ? (
            <LabeledControl label="Maximum transmutations">
              <Stepper
                value={transmutations.value}
                min={transmutations.min}
                max={transmutations.max}
                onChange={(value) =>
                  onChange({ type: 'set_transmutations', value })
                }
                ariaLabel="Maximum transmutations"
                text={transmutations.value_label}
              />
            </LabeledControl>
          ) : null}
          {transmutations.caption_visible && transmutations.caption !== null ? (
            <Caption>{transmutations.caption}</Caption>
          ) : null}
        </section>
      ) : null}
      {form.select_trinket.visible ? (
        <section className={SECTION}>
          <CheckBox
            control={form.select_trinket}
            onChange={(value) =>
              onChange({ type: 'set_select_trinket', value })
            }
          />
        </section>
      ) : null}
    </>
  )
}

/** Arcane Resin's amount, or Auto with its meaning in the amount's place. */
export function ResinSection({
  form,
  onChange,
}: {
  form: EditorForm
  onChange: Change
}) {
  const { resin } = form
  if (!resin.visible) return null
  return (
    <section className={SECTION}>
      <LabeledControl label={resin.label}>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={resin.auto}
            options={resin.modes}
            onChange={(value) => onChange({ type: 'set_resin_auto', value })}
            ariaLabel="Resin amount mode"
          />
          {!resin.auto ? (
            <Input
              className="w-28"
              type="number"
              aria-label={resin.label}
              min={resin.min}
              max={resin.max}
              step={1}
              value={resin.amount ?? ''}
              onChange={(event) => {
                const amount = event.currentTarget.valueAsNumber
                onChange({
                  type: 'set_resin_amount',
                  value: Number.isNaN(amount) ? null : amount,
                })
              }}
            />
          ) : null}
        </div>
      </LabeledControl>
      {resin.auto ? <Caption>{resin.caption}</Caption> : null}
    </section>
  )
}

/** The upgrade predicate and its value. */
export function UpgradeSection({
  form,
  onChange,
}: {
  form: EditorForm
  onChange: Change
}) {
  const { upgrade } = form
  if (!upgrade.visible) return null
  return (
    <section className={SECTION}>
      <h3 className={HEADING}>Upgrade level</h3>
      <Segmented
        value={upgrade.mode}
        options={upgrade.modes}
        onChange={(value) => onChange({ type: 'set_upgrade_mode', value })}
        ariaLabel="Upgrade predicate"
        fill
      />
      {upgrade.value_visible ? (
        <SliderRow
          label={UPGRADE_SLIDER[upgrade.mode]}
          valueLabel={upgrade.value_label}
          min={upgrade.min}
          max={upgrade.max}
          value={upgrade.value}
          onChange={(value) => onChange({ type: 'set_upgrade', value })}
        />
      ) : null}
    </section>
  )
}
