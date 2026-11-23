import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { Badge } from '@seed-seeker/design/ui/badge'
import { Button } from '@seed-seeker/design/ui/button'
import { useEffect, useState } from 'react'
import type { ChallengeName, SeedReport } from '../../../engine/types'
import { GameWindow } from '../../../shared/ui/GameWindow'
import { seedPath } from '../seed-link'
import { IdentitiesPanel } from './IdentitiesPanel'
import { RunSettings, type RunSettingsChoice } from './RunSettings'
import { hasSection } from './report-text'
import { ShareSeedButton } from './ShareSeedButton'

const COPIED_MS = 2000

/** The seed in the game's pixel font and window frame, with a copy action. */
function SeedTitle({
  report,
  sharePath,
  shareDisabled,
}: {
  report: SeedReport
  sharePath: string
  shareDisabled?: boolean
}) {
  const text = report.seed.code
  const query = report.query
  const complete = query?.matchedRequirements === query?.totalRequirements
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
      <GameWindow className="max-w-full">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1.5 py-0.5">
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
            size="icon-sm"
            onClick={() => void copy()}
            aria-label={copied ? `Copied ${text}` : `Copy seed ${text}`}
            title={copied ? 'Copied seed' : 'Copy seed'}
          >
            {copied ? <CheckIcon weight="bold" /> : <CopyIcon />}
          </Button>
          <ShareSeedButton
            seed={text}
            path={sharePath}
            disabled={shareDisabled}
          />
        </div>
      </GameWindow>
      {query ? (
        <Badge
          data-query-summary
          variant={complete ? 'secondary' : 'warning'}
          className="h-auto min-h-6 max-w-full py-1 text-sm whitespace-normal tabular-nums"
          aria-live="polite"
        >
          {complete ? (
            <CheckIcon data-icon="inline-start" weight="bold" />
          ) : null}
          <span>
            Matches {query.matchedRequirements} of {query.totalRequirements}{' '}
            query{' '}
            {query.totalRequirements === 1 ? 'requirement' : 'requirements'}.
          </span>
        </Badge>
      ) : null}
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

/** The seed and query summary, replay settings, and identities. */
export function RunHeader({
  report,
  challenges,
  lorePages,
  runSettings,
}: {
  report: SeedReport
  challenges: readonly ChallengeName[]
  lorePages: boolean
  runSettings?: RunSettingsChoice
}) {
  return (
    <header data-run-header className="flex flex-col gap-6 pb-6">
      <SeedTitle
        report={report}
        sharePath={seedPath({
          seed: report.seed.code,
          challenges: [...challenges],
          lorePages,
          trinket: report.trinkets.selected ?? undefined,
        })}
        shareDisabled={runSettings?.busy}
      />
      {runSettings ? (
        <RunSettings
          report={report}
          challenges={challenges}
          lorePages={lorePages}
          choice={runSettings}
        />
      ) : null}
      {hasSection(report, 'identities') ? (
        <IdentitiesPanel report={report} />
      ) : null}
    </header>
  )
}
