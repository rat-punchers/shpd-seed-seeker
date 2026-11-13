import { PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Field,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from '@seed-seeker/design/ui/field'
import { ItemPicker } from './ItemPicker'
import type { SimpleQuery } from './simple'
import {
  addSimpleRow,
  MAX_SIMPLE_ROWS,
  removeSimpleRow,
  rowDepth,
} from './simple-edit'

/** Simple's item rows: an item picker with its upgrade and floor, per row. */
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
          return (
            <Field key={row.key} data-disabled={running ? true : undefined}>
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <ItemPicker
                    row={row}
                    number={number}
                    depth={rowDepth(simple, row)}
                    disabled={running}
                  />
                </div>

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
