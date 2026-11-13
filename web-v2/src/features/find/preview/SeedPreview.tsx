import { EyeIcon, SpinnerGapIcon } from '@phosphor-icons/react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@seed-seeker/design/ui/alert'
import { useStore } from '@tanstack/react-store'
import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import { WorkspaceEmptyPlaceholder } from '../../../shared/ui/WorkspaceEmptyPlaceholder'
import {
  ReportMapContext,
  type ReportMapRun,
} from '../../analyze/report/FloorMapButton'
import { ItemDetailLayer } from '../../analyze/report/ItemDetail'
import { searchStore } from '../../search/store'
import { resultsTabsStore } from '../../search/tabs'
import { analyzeMatch } from '../run'
import { PreviewFloors } from './PreviewFloors'
import { PreviewHeader } from './PreviewHeader'
import { previewFloors } from './preview-floors'
import {
  $previewPicks,
  listedMatches,
  matchTrinket,
  previewedMatch,
} from './selection'
import { previewRequest, usePreviewReport } from './use-preview-report'

/**
 * The previewed result beside the result list: its header, then the floors
 * holding what the search asked for, in a panel that scrolls on its own.
 */
export function SeedPreview() {
  const matches = useStore(searchStore, (search) => search.matches)
  const query = useStore(searchStore, (search) => search.query)
  const running = useStore(searchStore, (search) => search.state === 'running')
  const tab = useStore(resultsTabsStore, (state) => state.activeId)
  const pick = useStore($previewPicks, (picks) => picks[tab])
  const listed = listedMatches(matches)
  const match = previewedMatch(listed, pick)
  const preview = usePreviewReport(
    match ? previewRequest(match.code, query, matchTrinket(match)) : undefined
  )
  const report = preview.report
  const floors = useMemo(
    () => (report ? previewFloors(report, query) : []),
    [report, query]
  )
  const scrollerRef = useRef<HTMLDivElement>(null)
  const shownCode = report?.seed.code

  // A new seed starts at its first floor.
  useEffect(() => {
    if (shownCode) scrollerRef.current?.scrollTo?.({ top: 0 })
  }, [shownCode])

  const mapRun = useMemo<ReportMapRun | null>(
    () =>
      report
        ? {
            seed: report.seed.code,
            challenges: query?.challenges ?? [],
            selectedTrinket: report.trinkets.selected,
          }
        : null,
    [report, query]
  )

  let body: ReactNode
  if (!match) {
    body = (
      <WorkspaceEmptyPlaceholder
        icon={EyeIcon}
        title="Nothing to preview"
        description={
          running
            ? 'The first matching seed shows here as soon as it is found.'
            : 'Matching seeds show here, floor by floor.'
        }
      />
    )
  } else if (preview.error) {
    body = (
      <Alert variant="destructive" className="m-4 w-auto">
        <AlertTitle>Preview failed</AlertTitle>
        <AlertDescription>{preview.error}</AlertDescription>
      </Alert>
    )
  } else if (!report) {
    body = (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 py-12">
        <SpinnerGapIcon className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm" role="status">
          Analyzing{' '}
          <span className="text-foreground font-mono">{match.code}</span>…
        </p>
      </div>
    )
  } else {
    body = (
      <ReportMapContext value={mapRun}>
        <div
          className="transition-opacity"
          data-seed-preview={report.seed.code}
          aria-busy={preview.loading}
          style={{ opacity: preview.stale ? 0.55 : 1 }}
        >
          <PreviewFloors report={report} floors={floors} />
        </div>
        <ItemDetailLayer />
      </ReportMapContext>
    )
  }

  return (
    <aside
      aria-label="Seed preview"
      className="bg-background sticky flex min-w-0 flex-col self-start border-l"
      style={{
        top: 'var(--results-tabs-height, 3rem)',
        height: 'calc(100svh - var(--results-tabs-height, 3rem))',
      }}
    >
      {match ? (
        <PreviewHeader
          code={match.code}
          index={listed.indexOf(match)}
          total={listed.length}
          report={preview.stale ? null : report}
          loading={preview.loading && report !== null}
          onAnalyze={() => analyzeMatch(match)}
        />
      ) : null}
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {body}
      </div>
    </aside>
  )
}
