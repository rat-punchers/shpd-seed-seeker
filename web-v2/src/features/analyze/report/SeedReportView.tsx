import { useRef } from 'react'
import type { SeedReport } from '../../../engine/types/report'
import { AutomaticOutcomes } from './AutomaticOutcomes'
import { DescentRail } from './DescentRail'
import { prefersReducedMotion, stuckBottom, useCurrentFloor } from './hooks'
import { ItemDetailLayer } from './ItemDetail'
import { RunHeader } from './RunHeader'
import type { TrinketChoice } from './trinket'

/** One seed's report: header, the floor strip, then every floor. */
export function SeedReportView({
  report,
  trinketChoice,
}: {
  report: SeedReport
  trinketChoice: TrinketChoice
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const current = useCurrentFloor(containerRef, railRef)

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
    <div
      ref={containerRef}
      className="space-y-4"
      data-seed-report={report.seed.code}
    >
      <RunHeader report={report} />
      {report.floors.length > 0 ? (
        <>
          <div className="flex items-baseline gap-2">
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
  )
}
