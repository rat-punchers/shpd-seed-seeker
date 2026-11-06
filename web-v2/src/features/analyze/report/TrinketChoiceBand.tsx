import {
  ToggleGroup,
  ToggleGroupItem,
} from '@seed-seeker/design/ui/toggle-group'
import type { ReportTrinkets } from '../../../engine/types/report'
import { itemArt } from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'
import { SpriteSlot } from './ItemSlot'
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
                <SpriteSlot
                  art={itemArt(item.spriteIndex)}
                  label={`${index + 1}. ${item.name}${item.matched ? ', used by the query' : ''}`}
                />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}
