import { regionOf } from '@seed-seeker/design/lib/regions'
import { Badge } from '@seed-seeker/design/ui/badge'
import { cn } from '@seed-seeker/design/utils'
import type { ReportItem, SeedReport } from '../../../engine/types'
import type { RingGems } from '../../../shared/sprites/sprites'
import { ItemList } from '../../analyze/report/FloorItemSections'
import { FloorMapButton } from '../../analyze/report/FloorMapButton'
import { ItemName } from '../../analyze/report/ItemName'
import { ItemSlot } from '../../analyze/report/ItemSlot'
import {
  hasSection,
  humanize,
  itemLocation,
  questTitle,
} from '../../analyze/report/report-text'
import type { PreviewFloor, PreviewQuest } from './preview-floors'

/** A matched item with its name and where it lies. */
function MatchedItem({
  item,
  ringGems,
}: {
  item: ReportItem
  ringGems?: RingGems
}) {
  return (
    <li className="flex min-w-0 items-center gap-3">
      <ItemSlot item={item} ringGems={ringGems} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          <ItemName item={item} />
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {itemLocation(item)}
        </p>
      </div>
    </li>
  )
}

/** A quest giver on the floor and the rewards the player picks from. */
function QuestRewards({
  entry,
  ringGems,
}: {
  entry: PreviewQuest
  ringGems?: RingGems
}) {
  const { quest, rewards } = entry
  const { optionCount, selectedCount } = quest.rewards
  return (
    <section
      data-quest={quest.quest}
      aria-label={`${questTitle(quest.quest)} rewards`}
      className="border-l-primary bg-accent/40 flex flex-col gap-2 border-l-4 px-3 py-2"
    >
      <p className="text-sm font-semibold">
        {questTitle(quest.quest)}{' '}
        <span className="text-muted-foreground font-normal">
          rewards, choose {selectedCount} of {optionCount}
        </span>
      </p>
      {rewards.length > 0 ? (
        <ItemList items={rewards} ringGems={ringGems} />
      ) : null}
    </section>
  )
}

function FloorSection({
  floor,
  ringGems,
}: {
  floor: PreviewFloor
  ringGems?: RingGems
}) {
  const region = regionOf(floor.depth)
  return (
    <section data-floor-depth={floor.depth} aria-label={`Floor ${floor.depth}`}>
      {/* Sticky at the top of the preview's scroller. */}
      <div className="bg-card sticky top-0 z-10 flex min-h-10 items-stretch gap-2 border-y pr-1">
        <span
          className={cn(
            'text-region-foreground inset-shadow-raised font-pixel text-px-1 flex w-10 shrink-0 items-center justify-center',
            region.fill
          )}
        >
          {floor.depth}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-1.5">
          <h3 className="mr-1 text-sm font-semibold">
            Floor {floor.depth}{' '}
            <span className="text-muted-foreground font-normal">
              {region.name}
            </span>
          </h3>
          {floor.feeling ? (
            <Badge variant="secondary" data-preview-feeling={floor.feeling}>
              {humanize(floor.feeling)} floor
            </Badge>
          ) : null}
          {floor.rooms.map((room) => (
            <Badge key={room} variant="outline" data-preview-room={room}>
              {humanize(room)}
            </Badge>
          ))}
        </div>
        <span className="flex items-center">
          <FloorMapButton depth={floor.depth} />
        </span>
      </div>
      {floor.items.length > 0 || floor.quests.length > 0 ? (
        <div className="@container flex flex-col gap-3 p-3">
          {floor.items.length > 0 ? (
            <ul
              aria-label="Matched items"
              className="grid gap-2 @md:grid-cols-2"
            >
              {floor.items.map((item, index) => (
                <MatchedItem
                  key={`${item.id}-${index}`}
                  item={item}
                  ringGems={ringGems}
                />
              ))}
            </ul>
          ) : null}
          {floor.quests.map((entry) => (
            <QuestRewards
              key={entry.quest.quest}
              entry={entry}
              ringGems={ringGems}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

/** The preview's floors; `floors` comes from `previewFloors`. */
export function PreviewFloors({
  report,
  floors,
}: {
  report: SeedReport
  floors: PreviewFloor[]
}) {
  const ringGems = hasSection(report, 'ringGems') ? report.ringGems : undefined
  if (floors.length === 0)
    return (
      <p className="text-muted-foreground p-4 text-sm">
        No matched items, asked-for rooms or quests within the floor limit.
      </p>
    )
  return (
    <div className="flex flex-col">
      {floors.map((floor) => (
        <FloorSection key={floor.depth} floor={floor} ringGems={ringGems} />
      ))}
    </div>
  )
}
