import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import { cn } from '@seed-seeker/design/utils'
import { useEffect, useState } from 'react'
import type { SeedReport } from '../../../engine/types/report'
import { IdentitiesPanel } from './IdentitiesPanel'
import { hasSection } from './report-text'

const COPIED_MS = 2000

/** The seed in the game's pixel font, with a copy action. */
function SeedTitle({ report }: { report: SeedReport }) {
  const text = report.seed.code
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setFailed(false)
      setCopied(true)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="bg-card shadow-window inset-shadow-raised flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 border px-3 py-2">
        <h2
          data-seed-title
          className="font-pixel text-px-2 lg:text-px-3 min-w-0 break-all select-all"
        >
          {text}
        </h2>
        {report.seed.daily ? (
          <span className="text-muted-foreground text-sm">Daily run</span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void copy()}
          aria-label={copied ? `Copied ${text}` : `Copy seed ${text}`}
        >
          {copied ? (
            <CheckIcon data-icon="inline-start" weight="bold" />
          ) : (
            <CopyIcon data-icon="inline-start" />
          )}
          {/* Both labels share one cell so the button keeps the wider width. */}
          <span className="grid">
            <span
              className={cn('col-start-1 row-start-1', copied && 'invisible')}
            >
              Copy seed
            </span>
            <span
              className={cn('col-start-1 row-start-1', !copied && 'invisible')}
            >
              Copied
            </span>
          </span>
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? `Copied ${text} to the clipboard` : ''}
      </span>
      {failed ? (
        <p className="text-destructive w-full text-sm" role="alert">
          The clipboard is blocked here. Select the seed and copy it instead.
        </p>
      ) : null}
    </div>
  )
}

/** Top of a report: the seed, the query it was matched against, its identities. */
export function RunHeader({ report }: { report: SeedReport }) {
  return (
    <header data-run-header className="flex flex-col gap-6 pb-6">
      <SeedTitle report={report} />
      {report.query ? (
        <p className="text-muted-foreground text-sm" data-query-summary>
          Matches {report.query.matchedRequirements} of{' '}
          {report.query.totalRequirements} query requirements.
        </p>
      ) : null}
      {hasSection(report, 'identities') ? (
        <IdentitiesPanel report={report} />
      ) : null}
    </header>
  )
}
