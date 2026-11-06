import type {
  ReportTrinkets,
  TrinketTiming,
} from '../../../engine/types/report'
import { itemArt } from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'

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

/** Banner mark for floors generated with the selected trinket; jumps to the pick. */
export function HeldTrinketChip({
  name,
  spriteIndex,
}: {
  name: string
  spriteIndex: number
}) {
  const label = `Generated with ${name}. Change trinket`
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
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
      <ItemSprite art={itemArt(spriteIndex)} size={32} />
    </button>
  )
}
