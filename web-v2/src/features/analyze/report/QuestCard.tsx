import { InfoIcon } from '@phosphor-icons/react'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@seed-seeker/design/ui/popover'
import type {
  ReportBranch,
  ReportItem,
  ReportQuest,
} from '../../../engine/types/report'
import type { RingGems } from '../../../shared/sprites/sprites'
import { itemArt } from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'
import { GHOST_TARGET_FILMS, QUEST_NPC_FILMS } from './art'
import { FilmSprite } from './FilmSprite'
import { FloorBanner } from './FloorBanner'
import { ItemList } from './FloorItemSections'
import { BranchMapButton } from './FloorMapButton'
import { ImpRewardDistribution } from './ImpRewardDistribution'
import { branchTitle, humanize, itemName, questTitle } from './report-text'
import { WandmakerRewardDistribution } from './WandmakerRewardDistribution'

/** `ItemSpriteSheet` cells of the Wandmaker's quest items. */
const WANDMAKER_ITEMS: Record<string, number> = {
  corpse_dust: 465,
  elemental_embers: 467,
  rotberry: 384,
}

/**
 * Every Imp option is +2 or better, and lower vault scores only let an
 * item at +0/+1 leave, so the statue is the only way to keep one.
 */
function ImpStatueNote() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="About the Imp Statue"
          className="text-white hover:text-white"
        >
          <InfoIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Imp Statue</PopoverTitle>
          <PopoverDescription>
            Keeping one of these six requires leaving with the Imp Statue: every
            option is +2 or better, and lower vault scores can only take out an
            item at +0/+1.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}

/** The quest's target, beside its title. */
function QuestTarget({ quest }: { quest: ReportQuest }) {
  if (quest.quest === 'imp') return <ImpStatueNote />
  const label =
    quest.quest === 'wandmaker'
      ? itemName(quest.variant)
      : humanize(quest.variant)
  const mob =
    quest.quest === 'ghost' ? GHOST_TARGET_FILMS[quest.variant] : undefined
  if (mob) {
    return (
      <span data-quest-target={quest.variant} title={label} className="flex">
        <FilmSprite film={mob} label={label} />
      </span>
    )
  }
  const sprite =
    quest.quest === 'wandmaker' ? WANDMAKER_ITEMS[quest.variant] : undefined
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-white/85">
      {sprite === undefined ? null : (
        <ItemSprite art={itemArt(sprite)} size={32} />
      )}
      {label}
    </span>
  )
}

function accessText(branch: ReportBranch): string {
  const parts = [
    branch.access.requiresAcceptance
      ? 'opens once the quest is accepted'
      : 'always open',
  ]
  if (branch.access.requiredItem) {
    parts.push(`needs ${itemName(branch.access.requiredItem)}`)
  }
  return parts.join(', ')
}

/** A quest sub-floor entered from this floor; `map` adds its map button. */
export function BranchNote({
  depth,
  branch,
  map = true,
}: {
  depth: number
  branch: ReportBranch
  map?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <p
        data-branch-kind={branch.kind}
        className="text-muted-foreground text-sm"
      >
        <span className="text-foreground font-semibold">
          {branchTitle(branch.kind)}
        </span>{' '}
        (branch {branch.branch}): {accessText(branch)}.
      </p>
      {map ? <BranchMapButton depth={depth} branch={branch} /> : null}
    </div>
  )
}

/**
 * A quest giver's card: the giver and target, how many rewards the player
 * keeps, the reward items, and the quest's branch floor.
 */
export function QuestCard({
  quest,
  rewards,
  branch,
  ringGems,
}: {
  quest: ReportQuest
  rewards: ReportItem[]
  branch?: ReportBranch
  ringGems?: RingGems
}) {
  const slots = quest.slots ?? []
  const { optionCount, selectedCount, favorRequirement } = quest.rewards
  const favor = favorRequirement ? ` at ${favorRequirement} favor` : ''
  return (
    // Quests share one band: the lantern rule marks them out of the item
    // lists without spending a hue the regions and loot tiers already own.
    <section
      data-quest={quest.quest}
      aria-label={`${questTitle(quest.quest)} quest`}
      className="border-l-primary bg-accent/40 flex flex-col overflow-hidden rounded-md border border-l-4"
    >
      <FloorBanner
        depth={quest.depth}
        title={questTitle(quest.quest)}
        headingLevel={4}
        showDepth={false}
        leading={<FilmSprite film={QUEST_NPC_FILMS[quest.quest]} />}
        meta={null}
        action={
          branch ? (
            <BranchMapButton depth={quest.depth} branch={branch} />
          ) : undefined
        }
      >
        <QuestTarget quest={quest} />
      </FloorBanner>
      <div className="flex flex-col gap-2 border-t px-3 py-2.5">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold">
            Rewards{' '}
            <span className="text-muted-foreground font-normal">
              choose {selectedCount} of {optionCount}
              {favor}
            </span>
          </p>
          {quest.quest === 'imp' ? (
            <ImpRewardDistribution
              slots={slots}
              upgradesPinned={quest.upgradesPinned ?? true}
              totalUpgradeValue={quest.totalUpgradeValue}
            />
          ) : null}
          {quest.quest === 'wandmaker' ? (
            <WandmakerRewardDistribution slots={slots} />
          ) : null}
        </div>
        {rewards.length > 0 ? (
          <ItemList items={rewards} ringGems={ringGems} />
        ) : null}
        <p className="text-muted-foreground text-xs">
          The giver can appear on floors {quest.spawnDepthRange.min}–
          {quest.spawnDepthRange.max}.
        </p>
        {branch ? (
          <BranchNote depth={quest.depth} branch={branch} map={false} />
        ) : null}
      </div>
    </section>
  )
}
