import { CaretRightIcon, InfoIcon } from '@phosphor-icons/react'
import { Badge } from '@seed-seeker/design/ui/badge'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@seed-seeker/design/ui/field'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from '@seed-seeker/design/ui/popover'
import { Switch } from '@seed-seeker/design/ui/switch'
import { type ReactNode, useId } from 'react'

/**
 * A collapsed settings section: its title, the number of settings in use,
 * and the body once opened.
 */
export function SettingsDetails({
  title,
  count = 0,
  children,
}: {
  title: string
  count?: number
  children: ReactNode
}) {
  return (
    <section aria-label={title}>
      <details className="group/settings flex flex-col gap-2">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <CaretRightIcon className="size-3.5 transition-transform group-open/settings:rotate-90" />
          <span>{title}</span>
          {count > 0 ? <Badge variant="secondary">{count}</Badge> : null}
        </summary>
        <div className="flex flex-col gap-3 pt-2">{children}</div>
      </details>
    </section>
  )
}

/** A switch with its label beside it and an optional note under the label. */
export function SettingSwitch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  const id = useId()
  return (
    <Field
      orientation="horizontal"
      className="items-start gap-2"
      data-disabled={disabled ? true : undefined}
    >
      <Switch
        id={id}
        size="sm"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <FieldContent className="gap-0.5">
        <FieldLabel htmlFor={id} className="font-normal">
          {label}
        </FieldLabel>
        {description ? (
          <FieldDescription className="text-xs">{description}</FieldDescription>
        ) : null}
      </FieldContent>
    </Field>
  )
}

/** An info button that opens a short explanation on click, tap or Enter. */
export function HelpNote({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          aria-label={label}
        >
          <InfoIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <PopoverDescription>{children}</PopoverDescription>
      </PopoverContent>
    </Popover>
  )
}

/** A short help text under a setting. */
export function SettingCaption({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>
}
