import { TrashIcon } from '@phosphor-icons/react'
import { Badge } from '@seed-seeker/design/ui/badge'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@seed-seeker/design/ui/card'
import { useStore } from '@tanstack/react-store'
import { useEffect, useState } from 'react'
import {
  compactNumber,
  estimateDuration,
  formatDuration,
  probabilityLabel,
} from '../../shared/format'
import {
  type CoordinatorState,
  canClearResults,
  isSearchActive,
} from '../search/coordinator-state'
import { searchStatusNotes } from '../search/status'
import { clearResults, searchStore } from '../search/store'
import { $analysis } from './run'

/** Re-renders 10 times a second while active so the stats stay live. */
function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

const plural = (count: number, word: string) =>
  `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`

function statusCopy(search: CoordinatorState): {
  label: string
  description: string
} {
  switch (search.state) {
    case 'running':
      return search.filtering
        ? {
            label: 'Verifying',
            description: 'Re-checking the seeds found so far.',
          }
        : {
            label: 'Searching',
            description: 'Scanning seeds in background workers.',
          }
    case 'stopping':
      return { label: 'Cancelling', description: 'Stopping the workers.' }
    case 'cancelled':
      return {
        label: 'Cancelled',
        description: 'Find again to continue where this search stopped.',
      }
    case 'failed':
      return { label: 'Failed', description: 'The search stopped on an error.' }
    case 'imported':
      return { label: 'Imported', description: 'Seeds loaded from a file.' }
    default:
      return {
        label: 'Completed',
        description:
          search.matches.length > 0
            ? 'The search finished.'
            : 'No seeds matched this query in the searched range.',
      }
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  )
}

/** The run's state, live stats while it scans, and Clear. */
export function SearchStatusCard() {
  const search = useStore(searchStore)
  const analysis = useStore($analysis)
  const running = isSearchActive(search)
  const now = useTicker(running)
  const elapsed = running ? now - search.startedAt : search.elapsed
  const probability = analysis?.valid ? analysis.probability : null
  const timeToSeed =
    probability && probability > 0 && search.rate > 0
      ? 1_000 / (probability * search.rate)
      : undefined
  const copy = statusCopy(search)
  const notes = searchStatusNotes(search)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle role="status">{copy.label}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Badge
            variant={search.state === 'failed' ? 'destructive' : 'secondary'}
          >
            {plural(search.matches.length, 'seed')}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Clear results"
            title="Clear these results, so the next search starts from scratch"
            disabled={!canClearResults(search)}
            onClick={clearResults}
          >
            <TrashIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {running && !search.filtering ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Tested" value={compactNumber(search.tested)} />
            <Stat
              label="Rate"
              value={search.rate > 0 ? `${compactNumber(search.rate)}/s` : '—'}
            />
            <Stat label="Elapsed" value={formatDuration(elapsed)} />
            <Stat label="First seed ≈" value={estimateDuration(timeToSeed)} />
          </div>
        ) : null}
        {!running && search.state !== 'imported' ? (
          <p className="text-muted-foreground text-sm">
            Tested {compactNumber(search.tested)} in{' '}
            {formatDuration(search.elapsed)}
          </p>
        ) : null}
        {running ? (
          <p className="text-muted-foreground text-sm">
            {probabilityLabel(probability)}
          </p>
        ) : null}
        {notes.map((note) => (
          <p
            key={note.kind}
            className={note.kind === 'cap' ? 'text-warning text-sm' : 'text-sm'}
          >
            {note.text}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
