import {
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  CopyIcon,
  SpinnerGapIcon,
} from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import { Kbd } from '@seed-seeker/design/ui/kbd'
import { useState } from 'react'
import type { SeedReport } from '../../../engine/types'
import { stepPreview } from './selection'

const plural = (count: number, word: string) =>
  `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`

/** "Matches 3 of 3 requirements · with Mimic Tooth". */
function reportSummary(report: SeedReport): string {
  const parts: string[] = []
  if (report.query)
    parts.push(
      `Matches ${report.query.matchedRequirements} of ${plural(report.query.totalRequirements, 'requirement')}`
    )
  const trinket = report.trinkets.offers.find(
    (offer) => offer.id === report.trinkets.selected
  )
  if (trinket) parts.push(`with ${trinket.name}`)
  return parts.join(' · ')
}

/** The previewed seed, its place in the results, and the way to Analyze. */
export function PreviewHeader({
  code,
  index,
  total,
  report,
  loading,
  onAnalyze,
}: {
  code: string
  index: number
  total: number
  report: SeedReport | null
  /** A report for this seed or trinket is on its way. */
  loading: boolean
  onAnalyze: () => void
}) {
  const [copied, setCopied] = useState(false)
  const summary = report ? reportSummary(report) : ''

  function copy() {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_200)
    })
  }

  return (
    <header className="flex flex-col gap-2 border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <h2
          data-preview-seed
          className="font-pixel text-px-2 min-w-0 break-all select-all"
        >
          {code}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Copy seed ${code}`}
          title="Copy seed"
          onClick={copy}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={onAnalyze}
        >
          Analyze seed
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <nav aria-label="Previewed result" className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Previous result"
            disabled={index === 0}
            onClick={() => stepPreview(-1)}
          >
            <CaretLeftIcon />
          </Button>
          <span className="tabular-nums" aria-live="polite">
            Result {index + 1} of {total.toLocaleString()}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Next result"
            disabled={index === total - 1}
            onClick={() => stepPreview(1)}
          >
            <CaretRightIcon />
          </Button>
        </nav>
        {summary ? <span data-preview-summary>{summary}</span> : null}
        {loading ? (
          <SpinnerGapIcon
            role="status"
            aria-label="Loading the preview"
            className="size-4 animate-spin"
          />
        ) : null}
        <span className="ml-auto hidden xl:inline">
          <Kbd>J</Kbd> <Kbd>K</Kbd>
        </span>
      </div>
    </header>
  )
}
