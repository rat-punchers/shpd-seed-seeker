import { regionOf } from '@seed-seeker/design/lib/regions'
import { Sprite } from '@seed-seeker/design/spd/sprite'
import type { ReportFloor, SeedReport } from '../../../engine/types/report'
import { AlchemyBubbles } from './AlchemyBubbles'
import { alchemyPotSprite } from './art'
import { FloorBanner } from './FloorBanner'
import { FloorItemSections } from './FloorItemSections'
import { FloorMapButton } from './FloorMapButton'
import { questRewardItems } from './floor-items'
import { BranchNote, QuestCard } from './QuestCard'
import { hasSection, humanize } from './report-text'
import { TrinketChoiceBand } from './TrinketChoiceBand'
import { HeldTrinketChip, type TrinketChoice } from './trinket'

/** Source pixels from the pot sprite's bottom edge up to its open rim. */
const POT_RIM = 16

function AlchemyPots({ floor }: { floor: ReportFloor }) {
  const pot = alchemyPotSprite(regionOf(floor.depth).id)
  return (floor.appearances ?? [])
    .filter((appearance) => appearance.kind === 'alchemy_pot')
    .map((appearance, index) => {
      const room = appearance.room
        ? `, ${humanize(appearance.room).toLowerCase()}`
        : ''
      const label = `Alchemy pot${room}${appearance.secret ? ', in a secret room' : ''}`
      return (
        <span
          key={`${appearance.room ?? 'pot'}-${index}`}
          role="img"
          aria-label={label}
          title={label}
          data-alchemy-pot
          className="relative inline-flex"
        >
          <Sprite sprite={pot} scale={2} />
          <AlchemyBubbles scale={2} origin={POT_RIM} />
        </span>
      )
    })
}

function FloorDetail({
  floor,
  report,
  trinketChoice,
}: {
  floor: ReportFloor
  report: SeedReport
  trinketChoice: TrinketChoice
}) {
  const { trinkets } = report
  const timing = hasSection(report, 'trinketTiming')
    ? trinkets.timing
    : undefined
  const held =
    timing && floor.depth >= timing.firstEffectiveDepth
      ? trinkets.offers.find((offer) => offer.id === trinkets.selected)
      : undefined
  const quests = hasSection(report, 'quests')
    ? report.quests.filter((quest) => quest.depth === floor.depth)
    : []
  const branches = hasSection(report, 'branches') ? floor.branches : []
  const branchOf = (quest: string) =>
    branches.find((branch) => branch.access.quest === quest)
  const leftover = branches.filter(
    (branch) => !quests.some((quest) => quest.quest === branch.access.quest)
  )
  const ringGems = hasSection(report, 'ringGems') ? report.ringGems : undefined
  const feeling =
    hasSection(report, 'feelings') && floor.feeling && floor.feeling !== 'none'
      ? floor.feeling
      : undefined

  return (
    <section data-floor-depth={floor.depth} aria-label={`Floor ${floor.depth}`}>
      {/* Sticky below the seed tabs and the floor strip; z-10 keeps it under both. */}
      <div
        className="sticky z-10"
        style={{
          top: 'calc(var(--seed-tabs-height, 3rem) + var(--descent-rail-height, 0px))',
        }}
      >
        <FloorBanner
          depth={floor.depth}
          action={<FloorMapButton depth={floor.depth} />}
        >
          {feeling ? (
            <span
              data-feeling={feeling}
              className="rounded-sm bg-white/15 px-1.5 text-sm font-semibold text-white"
            >
              {humanize(feeling)}
            </span>
          ) : null}
          {hasSection(report, 'alchemyPots') ? (
            <AlchemyPots floor={floor} />
          ) : null}
          {held ? (
            <HeldTrinketChip name={held.name} spriteIndex={held.spriteIndex} />
          ) : null}
        </FloorBanner>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {timing &&
        floor.depth === timing.selectionDepth &&
        hasSection(report, 'trinketOffers') ? (
          <TrinketChoiceBand trinkets={trinkets} choice={trinketChoice} />
        ) : null}
        {quests.map((quest) => (
          <QuestCard
            key={quest.quest}
            quest={quest}
            rewards={questRewardItems(
              report,
              quest.rewards.source,
              floor.depth
            )}
            branch={branchOf(quest.quest)}
            ringGems={ringGems}
          />
        ))}
        <FloorItemSections floor={floor} report={report} />
        {leftover.map((branch) => (
          <BranchNote
            key={`${branch.kind}-${branch.branch}`}
            depth={floor.depth}
            branch={branch}
          />
        ))}
      </div>
    </section>
  )
}

/**
 * Everything the seed decides on its own, floor by floor. Without trinket
 * timing the Catalyst choice sits above the floors.
 */
export function AutomaticOutcomes({
  report,
  trinketChoice,
}: {
  report: SeedReport
  trinketChoice: TrinketChoice
}) {
  const timed = hasSection(report, 'trinketTiming') && report.trinkets.timing
  return (
    <>
      {!timed && hasSection(report, 'trinketOffers') ? (
        <TrinketChoiceBand trinkets={report.trinkets} choice={trinketChoice} />
      ) : null}
      {report.floors.length > 0 ? (
        // Ancestors must not set overflow:hidden, or the banners cannot stick.
        <section
          aria-labelledby="floors-title"
          className="bg-card text-card-foreground rounded-lg border"
        >
          {report.floors.map((floor) => (
            <FloorDetail
              key={floor.depth}
              floor={floor}
              report={report}
              trinketChoice={trinketChoice}
            />
          ))}
        </section>
      ) : null}
    </>
  )
}
