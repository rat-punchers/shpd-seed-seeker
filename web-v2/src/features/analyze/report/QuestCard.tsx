import { Button } from '@seed-seeker/design/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@seed-seeker/design/ui/popover'
import type { ReportBranch, ReportQuest } from '../../../engine/types/report'
import type { RingGems } from '../../../shared/sprites/sprites'
import { itemArt } from '../../../shared/sprites/sprites'
import { ItemSprite } from '../../../shared/ui/ItemSprite'
import { BLACKSMITH_TARGETS, GHOST_TARGET_FILMS, QUEST_NPC_FILMS } from './art'
import { FilmSprite } from './FilmSprite'
import { FloorBanner } from './FloorBanner'
import { ItemList } from './FloorItemSections'
import { BranchMapButton } from './FloorMapButton'
import type { QuestItemGroups } from './floor-items'
import { ImpRewardDistribution } from './ImpRewardDistribution'
import { ImpVaultLoot } from './ImpVaultLoot'
import { humanize, itemName, questTitle } from './report-text'
import { WandmakerRewardDistribution } from './WandmakerRewardDistribution'

/** `ItemSpriteSheet` cells of the Wandmaker's quest items. */
const WANDMAKER_ITEMS: Record<string, number> = {
  corpse_dust: 465,
  elemental_embers: 467,
  rotberry: 384,
}

/** ImpStatue in the game's item sheet and English examine text. */
function ImpStatue() {
  const name = 'Obsidian statuette'
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={name}>
          <ItemSprite art={itemArt(474)} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-1rem)]">
        <PopoverHeader>
          <PopoverTitle>{name}</PopoverTitle>
          <PopoverDescription>
            A small jet-black statue carved out of obsidian. It resembles the
            Imp who sent you down here, it even has their glowing green eyes.
            There is an inscription on the base of the statue in a language
            you've never seen before.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}

/** The quest's target, beside its title. */
function QuestTarget({ quest }: { quest: ReportQuest }) {
  if (quest.quest === 'imp') return <ImpStatue />
  const miningTarget =
    quest.quest === 'blacksmith' ? BLACKSMITH_TARGETS[quest.variant] : undefined
  const label =
    quest.quest === 'wandmaker'
      ? itemName(quest.variant)
      : (miningTarget?.label ?? humanize(quest.variant))
  const mob =
    quest.quest === 'ghost'
      ? GHOST_TARGET_FILMS[quest.variant]
      : miningTarget?.film
  if (mob) {
    return (
      <span data-quest-target={quest.variant} title={label} className="flex">
        <FilmSprite film={mob} label={label} scale={miningTarget?.scale} />
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

/**
 * A quest giver's card: the giver and target, how many rewards the player
 * keeps, the reward items, and the quest's branch floor.
 */
export function QuestCard({
  quest,
  items,
  branch,
  ringGems,
}: {
  quest: ReportQuest
  items: QuestItemGroups
  branch?: ReportBranch
  ringGems?: RingGems
}) {
  const slots = quest.slots ?? []
  const { rewards, vaultTreasure } = items
  const imp = quest.quest === 'imp'
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
            {imp ? 'Final room rewards' : 'Rewards'}{' '}
            <span className="text-muted-foreground font-normal">
              {imp
                ? `${optionCount} options`
                : `choose ${selectedCount} of ${optionCount}`}
              {favor}
            </span>
          </p>
          {imp ? (
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
        {imp ? (
          <ImpVaultLoot treasure={vaultTreasure} ringGems={ringGems} />
        ) : null}
      </div>
    </section>
  )
}
