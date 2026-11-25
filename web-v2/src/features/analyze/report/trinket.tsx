import type {
  ReportTrinkets,
  SeedReport,
  TrinketTiming,
} from '../../../engine/types/report'
import { itemArt } from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'
import { hasSection } from './report-text'

/** The player's Catalyst pick for one seed tab. */
export interface TrinketChoice {
  /** A regenerated report is on its way. */
  busy: boolean
  /** An offer id, or `"none"` for No Trinket. */
  select: (trinket: string) => void
}

export type TrinketEffect = TrinketTiming['optionEffects'][number]

/** The effect of an offer on generated floors, when the report models timing. */
export function trinketEffect(
  trinkets: ReportTrinkets,
  id: string
): TrinketEffect | undefined {
  const index = trinkets.offers.findIndex((offer) => offer.id === id)
  return trinkets.timing?.optionEffects[index]
}

export function trinketEffectLabel(effect: TrinketEffect): string {
  switch (effect) {
    case 'modeled':
      return 'Changes later floors'
    case 'unmodeled':
      return 'Changes floors, not modeled'
    case 'none':
      return 'No effect on floors'
  }
}

export function heldTrinketAt(report: SeedReport, depth: number) {
  const { trinkets } = report
  const timing = hasSection(report, 'trinketTiming')
    ? trinkets.timing
    : undefined
  if (!timing || depth < timing.firstEffectiveDepth) return undefined
  return trinkets.offers.find((offer) => offer.id === trinkets.selected)
}

/** Banner mark for floors generated with the selected trinket. */
export function HeldTrinketChip({
  name,
  spriteIndex,
  changeable = true,
}: {
  name: string
  spriteIndex: number
  changeable?: boolean
}) {
  const label = `Generated with ${name}`
  const art = itemArt(spriteIndex)
  if (!changeable) return <ItemSprite art={art} label={label} />

  const changeLabel = `${label}. Change trinket`
  return (
    <button
      type="button"
      aria-label={changeLabel}
      title={changeLabel}
      className="focus-visible:ring-ring inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 outline-none hover:bg-white/10 focus-visible:ring-2"
      onClick={() => {
        const reduce = window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        ).matches
        document.querySelector('[data-trinket-choice]')?.scrollIntoView({
          block: 'center',
          behavior: reduce ? 'auto' : 'smooth',
        })
      }}
    >
      <ItemSprite art={art} />
    </button>
  )
}
