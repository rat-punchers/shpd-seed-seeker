import { InfoIcon } from '@phosphor-icons/react'
import { Badge } from '@seed-seeker/design/ui/badge'
import { Button } from '@seed-seeker/design/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@seed-seeker/design/ui/popover'
import { Progress } from '@seed-seeker/design/ui/progress'
import type { ReactNode } from 'react'
import type { RewardSlot } from '../../../engine/types/report'
import { getItem } from '../../../shared/game/catalog'
import { itemArt } from '../../../shared/sprites/sprites'
import { SpriteSlot } from './ItemSlot'

/** `+1`, `−2`, or `seed draw` for the no-history draw. */
export function driftText(drifts: number[]): string {
  return drifts
    .map((drift) =>
      drift === 0 ? 'seed draw' : `${drift > 0 ? '+' : '−'}${Math.abs(drift)}`
    )
    .join(' / ')
}

/** The widest deck shift any slot's candidates were enumerated over. */
export function driftWindow(slots: readonly RewardSlot[]): number {
  return Math.max(
    0,
    ...slots.flatMap((slot) =>
      (slot.candidates ?? []).flatMap((candidate) =>
        candidate.drifts.map((drift) => Math.abs(drift))
      )
    )
  )
}

/** A reward's art, or an empty slot for an item outside the catalog. */
export function RewardArt({ item, label }: { item: string; label: string }) {
  const sprite = getItem(item)?.sprite
  return sprite === undefined ? (
    <span className="bg-muted inline-block size-[42px] border" title={label} />
  ) : (
    <SpriteSlot art={itemArt(sprite)} label={label} />
  )
}

/** One slot's candidate items with their share of the drift window. */
export function SlotCandidates({
  slot,
  title,
}: {
  slot: RewardSlot
  title: (item: string) => string
}) {
  return (
    <ul className="flex flex-col gap-1">
      {(slot.candidates ?? []).map((candidate) => {
        const share =
          slot.scenarioCount === 0
            ? 0
            : (100 * candidate.weight) / slot.scenarioCount
        const seedDraw = candidate.drifts.includes(0)
        const name = title(candidate.item)
        return (
          <li
            key={candidate.item}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2"
          >
            <RewardArt item={candidate.item} label={name} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex min-w-0 flex-wrap items-baseline gap-1.5">
                <span
                  className={
                    seedDraw
                      ? 'truncate text-sm font-medium'
                      : 'truncate text-sm'
                  }
                >
                  {name}
                </span>
                {seedDraw ? <Badge variant="outline">seed draw</Badge> : null}
              </span>
              <Progress value={share} className="h-1" />
            </span>
            <span className="flex items-baseline gap-1.5 text-xs tabular-nums">
              <span>{share.toFixed(0)}%</span>
              <span className="text-muted-foreground">
                {driftText(candidate.drifts)}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** The info button and popover a reward distribution opens from. */
export function DistributionPopover({
  label,
  title,
  descriptions,
  children,
}: {
  label: string
  title: string
  descriptions: ReactNode[]
  children: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={label}>
          <InfoIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          {descriptions.map((description, index) => (
            <PopoverDescription key={index}>{description}</PopoverDescription>
          ))}
        </PopoverHeader>
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {children}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
