import { CheckIcon, MinusIcon, PlusIcon } from '@phosphor-icons/react'
import { cn } from '@seed-seeker/design/utils'
import type { ReactNode } from 'react'
import type { BoardEdit, ChipBadges, ChipView } from '../../../engine/types'
import type { StepperState } from './use-board'

const BADGE =
  'inline-flex h-5 items-center rounded-sm bg-muted px-1 font-mono text-xs font-semibold whitespace-nowrap'
const STEP =
  'inline-flex size-6 items-center justify-center rounded-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-40'

/** The badges a dragged chip's origin keeps: shown, never stepped. */
export function RemainingBadges({ count, total }: ChipBadges) {
  return (
    <>
      {count ? (
        <span data-slot="stack-badge" className={BADGE} title={count.tooltip}>
          {count.text}
        </span>
      ) : null}
      {total ? (
        <span data-slot="stack-badge" className={BADGE} title={total.tooltip}>
          {total.text}
        </span>
      ) : null}
    </>
  )
}

/** A badge's inline stepper: −, the reading, +, and Done. */
function InlineStepper({
  label,
  text,
  lower,
  raise,
  onLower,
  onRaise,
  onDone,
}: {
  label: 'How many' | 'Combined level'
  text: string
  lower: { label: string; disabled: boolean }
  raise: { label: string; disabled: boolean }
  onLower: () => void
  onRaise: () => void
  onDone: () => void
}) {
  return (
    <fieldset
      data-slot="stack-edit"
      data-no-drag
      aria-label={label}
      className="min-w-0 inline-flex items-center gap-0.5 rounded-sm border border-input bg-background px-0.5"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={STEP}
        aria-label={lower.label}
        disabled={lower.disabled}
        onClick={onLower}
      >
        <MinusIcon className="size-3" />
      </button>
      <span data-slot="stack-badge" className={BADGE}>
        {text}
      </span>
      <button
        type="button"
        className={STEP}
        aria-label={raise.label}
        disabled={raise.disabled}
        onClick={onRaise}
      >
        <PlusIcon className="size-3" />
      </button>
      <button type="button" className={STEP} aria-label="Done" onClick={onDone}>
        <CheckIcon className="size-3" />
      </button>
    </fieldset>
  )
}

function BadgeButton({
  text,
  title,
  onClick,
}: {
  text: string
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-slot="stack-badge"
      data-no-drag
      className={cn(BADGE, 'cursor-pointer hover:bg-accent')}
      title={title}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
    >
      {text}
    </button>
  )
}

/** A chip's stack (×N / ≤N) and combined-level (Σ) badges with their steppers. */
export function StackBadges({
  chip,
  stepper,
  onStepper,
  edit,
}: {
  chip: ChipView
  stepper: StepperState | null
  onStepper: (state: StepperState | null) => void
  edit: (...edits: BoardEdit[]) => void
}): ReactNode {
  const { key, stack, badges } = chip
  const editingCount = stepper?.key === key && stepper.which === 'count'
  const editingTotal = stepper?.key === key && stepper.which === 'total'
  const total = stack.total
  return (
    <>
      {editingCount ? (
        <InlineStepper
          label="How many"
          text={stack.count_text}
          lower={{ label: 'One fewer', disabled: stack.count <= 1 }}
          raise={{
            label: 'One more',
            disabled: stack.count >= stack.count_max,
          }}
          onLower={() =>
            edit({ type: 'set_count', key, count: stack.count - 1 })
          }
          onRaise={() =>
            edit({ type: 'set_count', key, count: stack.count + 1 })
          }
          onDone={() => onStepper(null)}
        />
      ) : badges.count || editingTotal ? (
        <BadgeButton
          text={badges.count?.text ?? stack.count_text}
          title={badges.count?.tooltip}
          onClick={() => onStepper({ key, which: 'count' })}
        />
      ) : null}
      {editingTotal ? (
        // Stepping below Σ ≥ 1 stops counting levels; stepping up from there
        // starts again where the core starts it.
        <InlineStepper
          label="Combined level"
          text={stack.total_text}
          lower={{ label: 'Lower total', disabled: total === null }}
          raise={{
            label: 'Raise total',
            disabled: total !== null && total >= stack.level_capacity,
          }}
          onLower={() =>
            edit({
              type: 'set_total',
              key,
              total: total && total > 1 ? total - 1 : null,
            })
          }
          onRaise={() =>
            edit(
              total === null
                ? { type: 'toggle_levels', key }
                : { type: 'set_total', key, total: total + 1 }
            )
          }
          onDone={() => onStepper(null)}
        />
      ) : badges.total ? (
        <BadgeButton
          text={badges.total.text}
          title={badges.total.tooltip}
          onClick={() => onStepper({ key, which: 'total' })}
        />
      ) : null}
    </>
  )
}
