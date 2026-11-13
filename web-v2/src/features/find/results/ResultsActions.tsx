import {
  ClipboardTextIcon,
  DownloadSimpleIcon,
  InfoIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'
import {
  Alert,
  AlertAction,
  AlertDescription,
} from '@seed-seeker/design/ui/alert'
import { Button } from '@seed-seeker/design/ui/button'
import { useStore } from '@tanstack/react-store'
import { useRef } from 'react'
import { isSearchActive } from '../../search/coordinator-state'
import { searchStore } from '../../search/store'
import {
  $resultsNotice,
  exportResults,
  importClipboard,
  importFile,
} from './results-io'

/** The last import's failure or caveat, dismissible. */
export function ResultsNotice() {
  const notice = useStore($resultsNotice)
  if (!notice) return null
  const error = notice.kind === 'error'
  return (
    <Alert
      variant={error ? 'destructive' : 'info'}
      role={error ? 'alert' : 'status'}
      data-testid="results-notice"
    >
      {error ? <WarningCircleIcon /> : <InfoIcon />}
      <AlertDescription>{notice.text}</AlertDescription>
      <AlertAction>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss"
          title="Dismiss"
          onClick={() => $resultsNotice.set(undefined)}
        >
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  )
}

/**
 * Import a results file or a copied query from a file or the clipboard, and
 * export the shown results. Imports wait while a search runs.
 */
export function ResultsActions() {
  const running = useStore(searchStore, (search) => isSearchActive(search))
  const exportable = useStore(
    searchStore,
    (search) => search.matches.length > 0 && search.query !== undefined
  )
  const input = useRef<HTMLInputElement>(null)
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="toolbar"
      aria-label="Results file"
    >
      <Button
        type="button"
        variant="outline"
        size="xs"
        title="Import results or a search from a file"
        aria-label="Import results or a search from a file"
        disabled={running}
        onClick={() => input.current?.click()}
      >
        <UploadSimpleIcon data-icon="inline-start" />
        Import
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        title="Import results or a search from the clipboard"
        aria-label="Import results or a search from the clipboard"
        disabled={running}
        onClick={() => void importClipboard()}
      >
        <ClipboardTextIcon data-icon="inline-start" />
        Paste
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        title="Export results to a file"
        aria-label="Export results to a file"
        disabled={running || !exportable}
        onClick={() => void exportResults()}
      >
        <DownloadSimpleIcon data-icon="inline-start" />
        Export
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        data-testid="results-file-input"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void importFile(file)
        }}
      />
    </div>
  )
}
