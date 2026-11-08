import {
  ToggleGroup,
  ToggleGroupItem,
} from '@seed-seeker/design/ui/toggle-group'
import { useRef } from 'react'
import type {
  ReportItemRef,
  ReportTrinkets,
} from '../../../engine/types/report'
import { itemArt } from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'
import {
  type DetailSubject,
  scheduleHideItemDetail,
  showItemDetail,
  togglePinItemDetail,
} from './item-detail-store'
import {
  type TrinketChoice,
  trinketEffect,
  trinketEffectLabel,
} from './trinket'

function selectedNote(trinkets: ReportTrinkets): string {
  const from = trinkets.timing?.firstEffectiveDepth
  const floors = from ? `Floors ${from}+` : 'Later floors'
  const selected = trinkets.offers.find(
    (offer) => offer.id === trinkets.selected
  )
  if (!selected) return `${floors} are generated with no trinket.`
  switch (trinketEffect(trinkets, selected.id)) {
    case 'unmodeled':
      return `${selected.name} changes generated floors, but the engine does not model that yet. ${floors} may differ from the game.`
    case 'none':
      return `${selected.name} only changes play, not generated floors.`
    default:
      return `${floors} are generated with ${selected.name}.`
  }
}

/** A transmutation result: hover shows the game's text, a click pins it. */
function TransmutationSlot({
  trinket,
  step,
}: {
  trinket: ReportItemRef
  step: number
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const subject: DetailSubject = {
    kind: 'trinket',
    trinket,
    note: `Transmutation result ${step}.`,
  }
  return (
    <button
      ref={ref}
      type="button"
      data-slot="trinket-box"
      aria-label={`${step}. ${trinket.name}${trinket.matched ? ', used by the query' : ''}`}
      className="bg-muted inset-shadow-recessed grid size-[42px] shrink-0 cursor-pointer place-items-center border p-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      onPointerEnter={() => ref.current && showItemDetail(ref.current, subject)}
      onPointerLeave={() => ref.current && scheduleHideItemDetail(ref.current)}
      onClick={() => ref.current && togglePinItemDetail(ref.current, subject)}
    >
      <ItemSprite art={itemArt(trinket.spriteIndex)} size={32} />
    </button>
  )
}

/**
 * The Catalyst's four offers as one choice; picking one regenerates the
 * report with it, pressing it again switches to No Trinket.
 */
export function TrinketChoiceBand({
  trinkets,
  choice,
}: {
  trinkets: ReportTrinkets
  choice: TrinketChoice
}) {
  const value = trinkets.selected ?? ''
  return (
    <section
      data-trinket-choice
      aria-labelledby="trinket-choice-title"
      className="bg-muted/30 flex flex-col gap-3 rounded-md border p-3"
      aria-busy={choice.busy}
    >
      <div className="space-y-1">
        <h4 id="trinket-choice-title" className="text-sm font-semibold">
          Trinket Catalyst
        </h4>
        <p className="text-muted-foreground text-sm">
          The Catalyst offers these trinkets. Select the one you take to apply
          it, or press it again for no trinket.
        </p>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        spacing={2}
        className="flex-wrap items-stretch"
        value={value}
        disabled={choice.busy}
        aria-label="Trinket to take from the Catalyst"
        onValueChange={(next) => {
          if (next === value) return
          choice.select(next === '' ? 'none' : next)
        }}
      >
        {trinkets.offers.map((offer) => {
          const effect = trinketEffect(trinkets, offer.id)
          return (
            <ToggleGroupItem
              key={offer.id}
              value={offer.id}
              aria-label={offer.name}
              className="h-auto w-32 cursor-pointer flex-col justify-start gap-1 px-2 py-2 whitespace-normal"
              onPointerEnter={(event) =>
                showItemDetail(event.currentTarget, {
                  kind: 'trinket',
                  trinket: offer,
                  note: effect
                    ? `Offered by the Trinket Catalyst. ${trinketEffectLabel(effect)}.`
                    : 'Offered by the Trinket Catalyst.',
                })
              }
              onPointerLeave={(event) =>
                scheduleHideItemDetail(event.currentTarget)
              }
            >
              <ItemSprite art={itemArt(offer.spriteIndex)} size={48} />
              <span className="text-foreground text-center leading-tight">
                {offer.name}
              </span>
              {effect ? (
                <span className="text-muted-foreground text-center text-xs leading-tight font-normal">
                  {trinketEffectLabel(effect)}
                </span>
              ) : null}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      <p className="text-muted-foreground text-sm" aria-live="polite">
        {choice.busy ? 'Regenerating floors…' : selectedNote(trinkets)}
      </p>

      {trinkets.transmutationOrder.length > 0 ? (
        <div data-transmutation-order className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">Transmutation order</p>
          <ol className="flex flex-wrap gap-px">
            {trinkets.transmutationOrder.map((item, index) => (
              <li key={`${index}-${item.id}`}>
                <TransmutationSlot trinket={item} step={index + 1} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}
