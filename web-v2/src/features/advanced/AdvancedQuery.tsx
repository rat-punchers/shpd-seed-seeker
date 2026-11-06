import { CheckIcon, CopyIcon, LinkIcon, XIcon } from '@phosphor-icons/react'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@seed-seeker/design/ui/alert'
import { Button } from '@seed-seeker/design/ui/button'
import { useStore } from '@tanstack/react-store'
import { useMemo } from 'react'
import { $query } from '../../app/store/query'
import { requirementBoardOf } from '../query/requirements/board'
import { validateQuery } from '../query/validation'
import { AdvancedBoundary } from './AdvancedBoundary'
import { $copied, $copyError, type CopyKind, copyQuery } from './copy'
import { PresetsSection } from './PresetsSection'
import { RequirementSections } from './RequirementSections'
import { AdvancedSettings } from './settings/AdvancedSettings'
import { $shareNotice, dismissShareNotice } from './share-import'
import { RequirementEditor } from './sheet/RequirementEditor'
import {
  $editor,
  $editorFailure,
  changeEditor,
  closeEditor,
  saveEditor,
} from './store'

const COPY_LABELS: Record<CopyKind, { idle: string; title: string }> = {
  search: { idle: 'Copy JSON', title: 'Copy this search as JSON' },
  link: { idle: 'Share', title: 'Copy a shareable link to this search' },
}

function CopyButton({ kind, disabled }: { kind: CopyKind; disabled: boolean }) {
  const copied = useStore($copied) === kind
  const Icon = copied ? CheckIcon : kind === 'link' ? LinkIcon : CopyIcon
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      title={COPY_LABELS[kind].title}
      aria-label={COPY_LABELS[kind].title}
      disabled={disabled}
      onClick={() => void copyQuery(kind)}
    >
      <Icon data-icon="inline-start" />
      {copied ? 'Copied' : COPY_LABELS[kind].idle}
    </Button>
  )
}

function ShareNotice() {
  const notice = useStore($shareNotice)
  if (!notice) return null
  return (
    <Alert variant="destructive">
      <AlertTitle>Share link not loaded</AlertTitle>
      <AlertDescription>
        This share link couldn't be loaded: {notice}
      </AlertDescription>
      <AlertAction>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss"
          title="Dismiss"
          onClick={dismissShareNotice}
        >
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  )
}

/**
 * The query's requirements as the core draws them, the count in the header,
 * Copy JSON and Share, and the open sheet. A board or sheet the editor cannot
 * draw throws to the boundary around it.
 */
function QueryBoard() {
  const query = useStore($query)
  const editor = useStore($editor)
  const failure = useStore($editorFailure)
  const validation = useMemo(() => validateQuery(query), [query])
  const copyError = useStore($copyError)
  // Both boards, the header count and the Copy and Share gate read one answer
  // of the shared core, drawn once per change of the requirements.
  const drawn = requirementBoardOf(query)
  if (!drawn.ok) throw new Error(drawn.error)
  if (failure) throw new Error(failure)
  const { counts } = drawn.value
  const floorCount = query.floorRequirements?.length ?? 0
  const total =
    counts.ordinary +
    counts.blanket +
    Number(Boolean(query.arcaneResin)) +
    floorCount
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="text-muted-foreground text-sm"
          data-testid="requirement-count"
        >
          {total > 0
            ? `${total} requirement${total === 1 ? '' : 's'}`
            : 'No requirements'}
        </span>
        <span className="flex gap-1.5">
          <CopyButton kind="search" disabled={!validation.valid} />
          <CopyButton kind="link" disabled={!validation.valid} />
        </span>
      </div>
      {copyError ? (
        <p role="status" className="text-destructive text-xs">
          {copyError}
        </p>
      ) : null}
      <RequirementSections board={drawn.value} />
      {editor ? (
        <RequirementEditor
          sheet={editor.sheet}
          notice={editor.notice}
          onChange={changeEditor}
          onSave={saveEditor}
          onCancel={closeEditor}
        />
      ) : null}
    </>
  )
}

/**
 * Advanced: the whole saved query, as the requirement board and its sheet,
 * then the settings beyond the requirements.
 */
export function AdvancedQuery() {
  return (
    <div className="flex flex-col gap-4" data-testid="advanced-query">
      <ShareNotice />
      <PresetsSection />
      <AdvancedBoundary>
        <QueryBoard />
      </AdvancedBoundary>
      <AdvancedSettings />
    </div>
  )
}
