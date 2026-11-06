import { DiceFiveIcon, PawPrintIcon } from '@phosphor-icons/react'
import { Badge } from '@seed-seeker/design/ui/badge'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@seed-seeker/design/ui/item'
import type {
  EncounterReward,
  ReportEncounter,
} from '../../../engine/types/report'
import { getItem } from '../../../shared/game/catalog'
import { humanize, itemName } from './report-text'
import { RewardArt } from './reward-candidates'

function rewardName(reward: EncounterReward): string {
  const base = reward.item ? itemName(reward.item) : `random ${reward.category}`
  const level = reward.level ? ` +${reward.level}` : ''
  const effect = reward.effect ? `${reward.effect} ` : ''
  return `${reward.cursed ? 'cursed ' : ''}${effect}${base}${level}`
}

function rewardText(reward: EncounterReward): string {
  const name = rewardName(reward)
  if (reward.prediction === 'runtime_chance' && reward.chance) {
    const percent = (100 * reward.chance.numerator) / reward.chance.denominator
    return `${Number(percent.toFixed(1))}% runtime chance: ${name}`
  }
  if (reward.prediction === 'generated_with_floor') return `Carries ${name}`
  return `Drops ${name}`
}

function RewardBadge({ reward }: { reward: EncounterReward }) {
  if (reward.prediction === 'runtime_chance') {
    return (
      <Badge variant="outline">
        <DiceFiveIcon data-icon="inline-start" />
        Runtime roll
      </Badge>
    )
  }
  if (reward.prediction === 'generated_with_floor') {
    return <Badge variant="secondary">Generated with floor</Badge>
  }
  return <Badge variant="secondary">Guaranteed on defeat</Badge>
}

/** The mobs a floor generates with, and what each drops or carries. */
export function FloorEncounterSection({
  encounters,
}: {
  encounters: ReportEncounter[]
}) {
  if (encounters.length === 0) return null
  const count = encounters.reduce((total, entry) => total + entry.quantity, 0)

  return (
    <section aria-label="Initial encounters" className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold">
          Initial encounters{' '}
          <span className="text-muted-foreground ml-1 font-normal tabular-nums">
            {count}
          </span>
        </p>
        <p className="text-muted-foreground text-sm">
          Generated with this floor. Runtime summons and bonus drops are not
          predicted.
        </p>
      </div>
      <ItemGroup className="gap-1.5">
        {encounters.map((encounter) => (
          <Item key={encounter.mob} variant="muted" size="xs">
            <ItemMedia variant="icon">
              <PawPrintIcon aria-hidden />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="flex-wrap">
                {humanize(encounter.mob)}
                {encounter.quantity > 1 ? (
                  <span className="text-muted-foreground tabular-nums">
                    x{encounter.quantity}
                  </span>
                ) : null}
              </ItemTitle>
              {encounter.rewards?.length ? (
                encounter.rewards.map((reward, index) => (
                  <ItemDescription
                    key={`${reward.item ?? reward.category}-${index}`}
                    className="line-clamp-none flex flex-wrap items-center gap-1.5"
                  >
                    {reward.item && getItem(reward.item) ? (
                      <RewardArt
                        item={reward.item}
                        label={rewardName(reward)}
                      />
                    ) : null}
                    <span>{rewardText(reward)}</span>
                    <RewardBadge reward={reward} />
                  </ItemDescription>
                ))
              ) : (
                <ItemDescription>No seed-determined base drop</ItemDescription>
              )}
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </section>
  )
}
