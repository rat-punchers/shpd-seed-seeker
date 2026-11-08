import { MinusIcon, PlusIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import { Field, FieldLabel } from '@seed-seeker/design/ui/field'
import { Slider } from '@seed-seeker/design/ui/slider'
import { Switch } from '@seed-seeker/design/ui/switch'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@seed-seeker/design/ui/toggle-group'
import { cn } from '@seed-seeker/design/utils'
import { type ReactNode, useId } from 'react'
import type { EditorOption, EditorToggle } from '../../../engine/types'
import { nearestOptionIndex } from '../../query/query'

/** A help text under a control, in the core's words. */
export function Caption({ children }: { children: ReactNode }) {
  return (
    <p data-slot="caption" className="text-muted-foreground text-xs">
      {children}
    </p>
  )
}

/** A control under its label. */
export function LabeledControl({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div data-slot="labeled-control" className="flex flex-col gap-1.5">
      <span data-slot="control-label" className="text-sm font-semibold">
        {label}
      </span>
      {children}
    </div>
  )
}

/** One choice of a few, as pressed-in toggles. */
export function Segmented<T extends string | number | boolean>({
  value,
  options,
  onChange,
  ariaLabel,
  fill,
}: {
  value: T
  options: EditorOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  fill?: boolean
}) {
  const index = options.findIndex((option) => option.value === value)
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={ariaLabel}
      value={index < 0 ? '' : String(index)}
      onValueChange={(next) => {
        const option = next === '' ? undefined : options[Number(next)]
        if (option) onChange(option.value)
      }}
      className={cn('flex-wrap', fill && 'w-full')}
    >
      {options.map((option, position) => (
        <ToggleGroupItem
          key={String(option.value)}
          value={String(position)}
          className={cn(fill && 'flex-1')}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** A −/+ stepper with its reading between. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  ariaLabel,
  text,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  ariaLabel: string
  /** The reading, in the core's words. */
  text: string
}) {
  return (
    <fieldset
      aria-label={ariaLabel}
      className="inline-flex min-w-0 items-center gap-1"
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="One fewer"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon />
      </Button>
      <span
        data-slot="stepper-value"
        className="min-w-10 text-center font-mono text-sm"
        aria-live="polite"
      >
        {text}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="One more"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon />
      </Button>
    </fieldset>
  )
}

/**
 * A range over the given values, or `min`…`max`. A value off the list snaps
 * to the nearest option below.
 */
export function SliderRow({
  label,
  valueLabel,
  ariaLabel = label,
  value,
  onChange,
  ...scale
}: {
  label: string
  /** The value in words; leave it out when `label` already says it. */
  valueLabel?: string
  /** The range input's name, when `label` changes with the value. */
  ariaLabel?: string
  value: number
  onChange: (value: number) => void
} & (
  | { values: readonly number[]; min?: undefined; max?: undefined }
  | { values?: undefined; min: number; max: number }
)) {
  const options =
    scale.values ??
    Array.from(
      { length: scale.max - scale.min + 1 },
      (_, index) => scale.min + index
    )
  const index = nearestOptionIndex(options, value)
  return (
    <div data-slot="slider" className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        {valueLabel !== undefined ? (
          <span className="text-muted-foreground font-mono text-xs">
            {valueLabel}
          </span>
        ) : null}
      </div>
      <Slider
        className="py-1"
        min={0}
        max={options.length - 1}
        step={1}
        value={[index]}
        thumbProps={{
          'aria-label': ariaLabel,
          'aria-valuetext': String(options[index]),
        }}
        onValueChange={([position]) => {
          const next = options[position ?? index]
          if (next !== undefined && next !== value) onChange(next)
        }}
      />
    </div>
  )
}

/** A switch with its label beside it. */
export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  const id = useId()
  return (
    <Field orientation="horizontal" className="gap-2">
      <Switch
        id={id}
        size="sm"
        checked={checked}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  )
}

/** A check box the core words, with its help text under it whenever it shows. */
export function CheckBox({
  control,
  onChange,
}: {
  control: EditorToggle
  onChange: (value: boolean) => void
}) {
  return (
    <>
      <SwitchRow
        label={control.label}
        checked={control.value}
        onChange={onChange}
      />
      {control.caption !== null ? <Caption>{control.caption}</Caption> : null}
    </>
  )
}
