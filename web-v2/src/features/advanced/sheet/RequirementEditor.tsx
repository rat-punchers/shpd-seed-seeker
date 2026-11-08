import { Button } from '@seed-seeker/design/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@seed-seeker/design/ui/dialog'
import type { EditorChange, EditorSheet } from '../../../engine/types'
import { requirementArt } from '../../../shared/sprites/requirement-art'
import { ItemSprite } from '../../../shared/ui/ItemSprite'
import { DetailsSection, ResinSwitches, StackSection } from './DetailSections'
import {
  ItemSection,
  ResinSection,
  TrinketSections,
  UpgradeSection,
} from './ItemSection'

/** The dialog's title for a sheet. */
export function sheetTitle({ form }: EditorSheet): string {
  const isNew = form.mode === 'new'
  if (form.blanket)
    return isNew ? 'New Blanket Requirement' : 'Edit Blanket Requirement'
  return isNew ? 'New Requirement' : 'Edit Requirement'
}

/**
 * The sheet's form, as the core draws it: every section it shows, then why
 * the draft cannot be saved.
 */
export function SheetBody({
  sheet,
  notice,
  onChange,
}: {
  sheet: EditorSheet
  /** Why the last request failed, when the core could not answer it. */
  notice?: string | undefined
  onChange: (change: EditorChange) => void
}) {
  const { form } = sheet
  return (
    <div data-slot="sheet-body" className="flex flex-col gap-4">
      <ItemSection sheet={sheet} onChange={onChange} />
      <TrinketSections form={form} onChange={onChange} />
      <ResinSection form={form} onChange={onChange} />
      <UpgradeSection form={form} onChange={onChange} />
      <StackSection form={form} onChange={onChange} />
      <DetailsSection form={form} onChange={onChange} />
      <ResinSwitches form={form} onChange={onChange} />
      {form.errors.length > 0 || notice ? (
        <ul role="alert" className="text-destructive list-disc pl-4 text-sm">
          {form.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
          {notice ? <li>{notice}</li> : null}
        </ul>
      ) : null}
    </div>
  )
}

/** The requirement sheet: a new or existing chip, or the resin chip. */
export function RequirementEditor({
  sheet,
  notice,
  onChange,
  onSave,
  onCancel,
}: {
  /** The open sheet: the core's draft and the form it shows. */
  sheet: EditorSheet
  notice?: string | undefined
  onChange: (change: EditorChange) => void
  onSave: () => void
  onCancel: () => void
}) {
  const { form } = sheet
  const isNew = form.mode === 'new'
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent
        data-slot="requirement-sheet"
        className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 sm:max-w-lg"
      >
        <DialogHeader className="flex-row items-center gap-3">
          <ItemSprite
            art={requirementArt({
              item: form.item.value,
              kind: form.kind.value,
            })}
            size={32}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle>{sheetTitle(sheet)}</DialogTitle>
            <DialogDescription data-slot="sheet-subject" className="font-mono">
              {form.title}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5">
          <SheetBody sheet={sheet} notice={notice} onChange={onChange} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!form.can_save} onClick={onSave}>
            {isNew
              ? form.blanket
                ? 'Add Blanket Requirement'
                : 'Add Requirement'
              : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
