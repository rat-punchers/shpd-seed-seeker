import {
  CaretLeftIcon,
  CaretRightIcon,
  SpinnerGapIcon,
} from '@phosphor-icons/react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@seed-seeker/design/ui/alert'
import { Button } from '@seed-seeker/design/ui/button'
import { Kbd } from '@seed-seeker/design/ui/kbd'
import { useStore } from '@tanstack/react-store'
import type { ReactNode } from 'react'
import { searchStore } from '../search/store'
import { resultPosition, stepActiveResult } from './navigation'
import { SeedReportView } from './report/SeedReportView'
import { cancelReport, type SeedSession, selectTrinket } from './sessions'

/** "Result 3 of 120" with previous and next, when the tab shows a search result. */
function ResultNavigator({ code }: { code: string }) {
  const seeds = useStore(searchStore, (state) => state.matches)
  const position = resultPosition(
    seeds.map((match) => match.code),
    code
  )
  if (!position) return null
  return (
    <nav
      aria-label="Search results"
      className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm"
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Previous result"
        disabled={position.index === 0}
        onClick={() => stepActiveResult(-1)}
      >
        <CaretLeftIcon />
      </Button>
      <span className="tabular-nums" aria-live="polite">
        Result {position.index + 1} of {position.total}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Next result"
        disabled={position.index === position.total - 1}
        onClick={() => stepActiveResult(1)}
      >
        <CaretRightIcon />
      </Button>
      <span className="hidden md:inline">
        <Kbd>J</Kbd> next, <Kbd>K</Kbd> previous
      </span>
    </nav>
  )
}

/** One tab's body: progress, a failure, or the report. */
export function SessionPane({ session }: { session: SeedSession }) {
  const loading = session.status === 'pending' || session.status === 'loading'
  const code = session.report?.seed.code ?? session.seed

  // A trinket pick regenerates in place; the previous report stays on screen.
  let body: ReactNode = null
  if (loading && !session.report) {
    body = (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 py-12">
        <SpinnerGapIcon className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm" role="status">
          Analyzing{' '}
          <span className="text-foreground font-mono">{session.seed}</span>…
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => cancelReport(session.id)}
        >
          Cancel analysis
        </Button>
      </div>
    )
  } else if (session.status === 'cancelled') {
    body = (
      <Alert>
        <AlertTitle>Analysis cancelled</AlertTitle>
        <AlertDescription>Enter the seed again to analyze it.</AlertDescription>
      </Alert>
    )
  } else if (session.status === 'error') {
    body = (
      <Alert variant="destructive">
        <AlertTitle>Analysis failed</AlertTitle>
        <AlertDescription>
          {session.error ?? 'Unknown error analyzing this seed.'}
        </AlertDescription>
      </Alert>
    )
  } else if (session.report) {
    body = (
      <SeedReportView
        report={session.report}
        trinketChoice={{
          busy: loading,
          select: (trinket) => void selectTrinket(session.id, trinket),
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ResultNavigator code={code} />
      {body}
    </div>
  )
}
