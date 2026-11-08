import { Sprite } from '@seed-seeker/design/spd/sprite'
import { useMemo, useRef } from 'react'
import type { ChallengeName } from '../../../engine/types'
import type { SeedReport } from '../../../engine/types/report'
import { STAIRS_ICON } from '../../../shared/ui/game-icons'
import { AutomaticOutcomes } from './AutomaticOutcomes'
import { DescentRail } from './DescentRail'
import { ReportMapContext, type ReportMapRun } from './FloorMapButton'
import { prefersReducedMotion, stuckBottom, useCurrentFloor } from './hooks'
import { ItemDetailLayer } from './ItemDetail'
import { RunHeader } from './RunHeader'
import type { TrinketChoice } from './trinket'

const NO_CHALLENGES: readonly ChallengeName[] = []

/** One seed's report: header, the floor strip, then every floor. */
export function SeedReportView({
  report,
  trinketChoice,
  challenges = NO_CHALLENGES,
}: {
  report: SeedReport
  trinketChoice: TrinketChoice
  /** The challenges the report was asked with; floor maps use them too. */
  challenges?: readonly ChallengeName[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const current = useCurrentFloor(containerRef, railRef)
  const mapRun = useMemo<ReportMapRun>(
    () => ({
      seed: report.seed.code,
      challenges,
      selectedTrinket: report.trinkets.selected,
    }),
    [report.seed.code, report.trinkets.selected, challenges]
  )

  function scrollToFloor(depth: number) {
    const section = containerRef.current?.querySelector<HTMLElement>(
      `[data-floor-depth="${depth}"]`
    )
    if (!section) return
    const top =
      window.scrollY +
      section.getBoundingClientRect().top -
      stuckBottom(railRef.current)
    window.scrollTo({
      top,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  // The strip is a sticky child of this wrapper, so it stays for the whole report.
  return (
    <ReportMapContext value={mapRun}>
      <div
        ref={containerRef}
        className="space-y-4"
        data-seed-report={report.seed.code}
      >
        <RunHeader report={report} />
        {report.floors.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Sprite sprite={STAIRS_ICON} />
              <h2 id="floors-title" className="font-pixel text-px-1">
                Floors
              </h2>
              <span className="text-muted-foreground text-sm">
                Items you may find on each floor
              </span>
            </div>
            <DescentRail
              ref={railRef}
              report={report}
              current={current}
              onSelect={scrollToFloor}
            />
          </>
        ) : null}
        <AutomaticOutcomes report={report} trinketChoice={trinketChoice} />
        {report.notes.length > 0 ? (
          <ul
            aria-label="Report notes"
            className="text-muted-foreground list-disc pl-5 text-sm"
          >
            {report.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
        <ItemDetailLayer />
      </div>
    </ReportMapContext>
  )
}
