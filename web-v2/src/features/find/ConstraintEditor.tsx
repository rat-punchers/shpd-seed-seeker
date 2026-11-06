import { PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { tierClass } from '@seed-seeker/design/spd/item-slot'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Field,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from '@seed-seeker/design/ui/field'
import { InputGroup } from '@seed-seeker/design/ui/input-group'
import {
  NativeSelect,
  NativeSelectOption,
} from '@seed-seeker/design/ui/native-select'
import type { ReactNode } from 'react'
import type { RequirementKind } from '../../engine/types'
import { getItem } from '../../shared/game/catalog'
import { itemArt } from '../../shared/sprites/sprites'
import { ItemSprite } from '../../shared/ui/ItemSprite'
import { FLOOR_LIMIT_OPTIONS, nearestOptionIndex } from '../query/query'
import type { SimpleQuery } from './simple'
import {
  addSimpleRow,
  MAX_SIMPLE_ROWS,
  removeSimpleRow,
  rowDepth,
  setRowDepth,
  setRowItem,
  setRowKind,
  setRowUpgrade,
} from './simple-edit'
import {
  itemsForKind,
  requiresItem,
  rowSprite,
  SIMPLE_KINDS,
  simpleKindLabel,
  upgradeLevels,
} from './simple-items'

const OVERLAY_SELECT_CLASS =
  'absolute inset-0 h-full w-full cursor-pointer opacity-0 [&_[data-slot=native-select]]:h-full [&_[data-slot=native-select]]:border-0 [&_[data-slot=native-select]]:bg-transparent [&_[data-slot=native-select-icon]]:hidden'

/** A narrow select drawn as its value, with the native menu laid over it. */
function CompactOverlaySelect({
  value,
  display,
  disabled,
  label,
  onChange,
  children,
}: {
  value: string
  display: ReactNode
  disabled: boolean
  label: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <div className="relative flex w-10 shrink-0 items-center justify-center self-stretch border-l py-0 has-[select:disabled]:opacity-50">
      <span className="pointer-events-none whitespace-nowrap text-xs tabular-nums">
        {display}
      </span>
      <NativeSelect
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className={OVERLAY_SELECT_CLASS}
      >
        {children}
      </NativeSelect>
    </div>
  )
}

/** Simple's item rows: kind, item, minimum upgrade and floor for each. */
export function ConstraintEditor({
  simple,
  running,
}: {
  simple: SimpleQuery
  running: boolean
}) {
  const rows = simple.constraints
  return (
    <FieldSet data-disabled={running ? true : undefined}>
      <FieldLegend variant="label">Items</FieldLegend>
      <FieldGroup className="gap-2">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Add the items a seed must hold.
          </p>
        ) : null}
        {rows.map((row, index) => {
          const number = index + 1
          const levels = upgradeLevels(row.kind, row.item)
          const name = row.item ? getItem(row.item)?.name : undefined
          const depth = rowDepth(simple, row)
          const depthOption =
            FLOOR_LIMIT_OPTIONS[
              nearestOptionIndex(FLOOR_LIMIT_OPTIONS, depth)
            ] ?? depth
          return (
            <Field key={row.key} data-disabled={running ? true : undefined}>
              <div className="flex items-center gap-1">
                <InputGroup className="min-w-0 flex-1">
                  <div className="relative flex w-10 shrink-0 items-center justify-center self-stretch border-r py-0">
                    <ItemSprite
                      art={itemArt(rowSprite(row.kind, row.item))}
                      size={32}
                    />
                    <NativeSelect
                      value={row.kind}
                      disabled={running}
                      aria-label={`Item ${number} category`}
                      onChange={(event) =>
                        setRowKind(
                          row.key,
                          event.target.value as RequirementKind
                        )
                      }
                      className={OVERLAY_SELECT_CLASS}
                    >
                      {SIMPLE_KINDS.map(({ kind, label }) => (
                        <NativeSelectOption key={kind} value={kind}>
                          {label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>

                  <NativeSelect
                    value={row.item ?? 'any'}
                    disabled={running}
                    aria-label={`Item ${number} name`}
                    title={name ?? simpleKindLabel(row.kind)}
                    onChange={(event) =>
                      setRowItem(
                        row.key,
                        event.target.value === 'any'
                          ? undefined
                          : event.target.value
                      )
                    }
                    className="min-w-0 flex-1 [&_[data-slot=native-select]]:border-0 [&_[data-slot=native-select]]:bg-transparent [&_[data-slot=native-select]]:focus-visible:ring-0"
                  >
                    {requiresItem(row.kind) ? null : (
                      <NativeSelectOption value="any">Any</NativeSelectOption>
                    )}
                    {itemsForKind(row.kind).map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>

                  {levels.length > 0 ? (
                    <CompactOverlaySelect
                      value={
                        row.minUpgrade === undefined
                          ? 'any'
                          : String(row.minUpgrade)
                      }
                      display={
                        row.minUpgrade === undefined ? (
                          'Any'
                        ) : (
                          <span className={tierClass(row.minUpgrade)}>
                            +{row.minUpgrade}
                          </span>
                        )
                      }
                      disabled={running}
                      label={`Item ${number} upgrade level`}
                      onChange={(value) =>
                        setRowUpgrade(
                          row.key,
                          value === 'any' ? undefined : Number(value)
                        )
                      }
                    >
                      <NativeSelectOption value="any">Any</NativeSelectOption>
                      {levels.map((level) => (
                        <NativeSelectOption key={level} value={level}>
                          ≥ +{level}
                        </NativeSelectOption>
                      ))}
                    </CompactOverlaySelect>
                  ) : null}

                  <CompactOverlaySelect
                    value={String(depthOption)}
                    display={`↑${depth}`}
                    disabled={running}
                    label={`Item ${number} floor`}
                    onChange={(value) => setRowDepth(row.key, Number(value))}
                  >
                    {FLOOR_LIMIT_OPTIONS.map((floor) => (
                      <NativeSelectOption key={floor} value={floor}>
                        By floor {floor}
                      </NativeSelectOption>
                    ))}
                  </CompactOverlaySelect>
                </InputGroup>

                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={running}
                  onClick={() => removeSimpleRow(row.key)}
                  aria-label={`Remove item ${number}`}
                >
                  <TrashIcon />
                </Button>
              </div>
            </Field>
          )
        })}

        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={running || rows.length >= MAX_SIMPLE_ROWS}
            onClick={addSimpleRow}
            className="flex w-full items-center justify-center gap-1"
          >
            <PlusIcon /> Add item
          </Button>
        </div>
      </FieldGroup>
    </FieldSet>
  )
}
