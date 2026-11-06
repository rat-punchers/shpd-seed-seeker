import {
  BinocularsIcon,
  SpinnerGapIcon,
  StopIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@seed-seeker/design/ui/alert'
import { Button } from '@seed-seeker/design/ui/button'
import { Field, FieldLabel } from '@seed-seeker/design/ui/field'
import { Kbd } from '@seed-seeker/design/ui/kbd'
import { Switch } from '@seed-seeker/design/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@seed-seeker/design/ui/tooltip'
import { useStore } from '@tanstack/react-store'
import { type FormEvent, useMemo } from 'react'
import { $query } from '../../app/store/query'
import { probabilityLabel } from '../../shared/format'
import { validateQuery } from '../query/validation'
import { isSearchActive } from '../search/coordinator-state'
import { searchStore } from '../search/store'
import { ConstraintEditor } from './ConstraintEditor'
import { $analysis, toggleSearch } from './run'
import { toSimple } from './simple'
import { clearQuery, setMatchMode } from './simple-edit'

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent)
const SHORTCUT = isMac ? '⌘ + Enter' : 'Ctrl + Enter'

/** Shown when the saved query holds something the Simple view cannot. */
function AdvancedQueryNotice({ running }: { running: boolean }) {
  return (
    <Alert variant="info">
      <AlertTitle>Advanced query active</AlertTitle>
      <AlertDescription>
        <p>This query uses settings the Simple view cannot show.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={running}
          onClick={clearQuery}
        >
          Clear
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/** The query's estimate: impossible with the engine's reasons, or its odds. */
function QueryEstimate({ blocked }: { blocked: string | undefined }) {
  const analysis = useStore($analysis)
  if (analysis?.valid && analysis.impossible) {
    return (
      <Alert variant="destructive">
        <WarningCircleIcon />
        <AlertTitle>Impossible query</AlertTitle>
        <AlertDescription>
          {analysis.notes.length > 0 ? (
            <ul className="list-disc pl-4">
              {analysis.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            'No seed can match this query.'
          )}
        </AlertDescription>
      </Alert>
    )
  }
  const message =
    blocked ??
    (analysis && !analysis.valid
      ? analysis.error
      : analysis
        ? probabilityLabel(analysis.probability)
        : undefined)
  if (!message) return null
  return (
    <p
      className="text-muted-foreground text-sm"
      data-testid="query-estimate"
      role="status"
    >
      {message}
    </p>
  )
}

/** Find's sidebar: the Simple item rows, match mode and the Find button. */
export function FinderForm() {
  const query = useStore($query)
  const analysis = useStore($analysis)
  const status = useStore(searchStore, (state) => state.state)
  const running = isSearchActive({ state: status })
  const simple = useMemo(() => toSimple(query), [query])
  const validation = useMemo(() => validateQuery(query), [query])
  const impossible = Boolean(analysis?.valid && analysis.impossible)
  const unusable = analysis !== undefined && !analysis.valid
  const blocked = validation.valid ? undefined : validation.errors[0]

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void toggleSearch()
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {simple ? (
        <ConstraintEditor simple={simple} running={running} />
      ) : (
        <AdvancedQueryNotice running={running} />
      )}
      <QueryEstimate blocked={blocked} />
      <div className="flex items-end justify-between gap-2">
        {simple ? (
          <Field orientation="horizontal" className="w-auto gap-2">
            <FieldLabel htmlFor="finder-match-rule">
              {simple.matchMode === 'all' ? 'Match all' : 'Match any'}
            </FieldLabel>
            <Switch
              id="finder-match-rule"
              size="sm"
              checked={simple.matchMode === 'all'}
              disabled={running}
              onCheckedChange={(checked) =>
                setMatchMode(checked ? 'all' : 'any')
              }
              aria-label={
                simple.matchMode === 'all' ? 'Match all' : 'Match any'
              }
            />
          </Field>
        ) : (
          <span />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            {running ? (
              <Button
                type="submit"
                variant="destructive"
                disabled={status === 'stopping'}
                aria-keyshortcuts="Control+Enter Meta+Enter"
              >
                {status === 'stopping' ? (
                  <SpinnerGapIcon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <StopIcon data-icon="inline-start" />
                )}
                {status === 'stopping' ? 'Cancelling…' : 'Cancel'}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={Boolean(blocked) || impossible || unusable}
                aria-keyshortcuts="Control+Enter Meta+Enter"
              >
                <BinocularsIcon data-icon="inline-start" />
                Find
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent>
            {running ? 'Cancel' : 'Find'} <Kbd>{SHORTCUT}</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </form>
  )
}
