import { Badge } from '@seed-seeker/design/ui/badge'
import type { RewardSlot } from '../../../engine/types/report'
import { humanize, itemName } from './report-text'
import {
  DistributionPopover,
  driftWindow,
  RewardArt,
  SlotCandidates,
} from './reward-candidates'

const ROLE_LABEL: Record<string, string> = {
  artifact: 'Artifact',
  ring: 'Ring',
  weapon: 'Melee weapon',
  missile: 'Missile weapon',
  armor: 'Armor',
  wand: 'Wand',
}

function levelText(rule: RewardSlot['levelRule']): string | null {
  if (!rule) return null
  return rule.type === 'range'
    ? `+${rule.min}…+${rule.max}`
    : `+${rule.transfer} transferred`
}

function withEffect(name: string, effect: string | undefined): string {
  return effect ? `${effect} ${name}` : name
}

function SlotRow({
  slot,
  upgradesPinned,
}: {
  slot: RewardSlot
  upgradesPinned: boolean
}) {
  const rule = levelText(slot.levelRule)
  // The artifact slot always transfers the same amount; its stored level
  // differs by class, so the transfer is the number to show.
  const upgrade =
    slot.levelRule?.type === 'transfer_upgrade'
      ? `+${slot.levelRule.transfer}`
      : `+${slot.level}`
  const fixed = (slot.candidates ?? []).length === 0
  const title = (item: string) => withEffect(itemName(item), slot.effect)

  return (
    <li className="flex flex-col gap-1 border-t pt-2 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold">
          {ROLE_LABEL[slot.role ?? ''] ??
            (slot.role ? humanize(slot.role) : `Option ${slot.slot + 1}`)}
        </span>
        <span
          className="text-sm font-semibold tabular-nums"
          title={
            rule
              ? `${upgradesPinned ? 'Pinned by the seed. ' : ''}Rolled from ${rule}.`
              : undefined
          }
        >
          {upgrade}
        </span>
        {rule ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            of {rule}
          </span>
        ) : null}
        {fixed ? <Badge variant="outline">always</Badge> : null}
      </div>
      {fixed ? (
        <div className="flex items-center gap-2">
          <RewardArt item={slot.item} label={title(slot.item)} />
          <span className="text-sm">{title(slot.item)}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            100%
          </span>
        </div>
      ) : (
        <SlotCandidates slot={slot} title={title} />
      )}
    </li>
  )
}

/**
 * Per-slot projection of the Imp's six take-out options. Each category
 * draws in a fixed order set by the seed, so run history only shifts which
 * index the Imp lands on; the shares measure how stable a slot is against
 * that shift, not how often players see it.
 */
export function ImpRewardDistribution({
  slots,
  upgradesPinned = true,
  totalUpgradeValue,
}: {
  slots: RewardSlot[]
  upgradesPinned?: boolean
  totalUpgradeValue?: number
}) {
  if (slots.length === 0) return null
  const window = driftWindow(slots)
  const total =
    typeof totalUpgradeValue === 'number'
      ? `, ${totalUpgradeValue} upgrades across the six options`
      : ''
  return (
    <DistributionPopover
      label="Per-slot reward outlook"
      title="Per-slot outlook"
      descriptions={[
        `Each category draws in a fixed order set by the seed, so earlier play only changes which index the Imp lands on. These shares cover a ±${window} shift either way: they measure how stable a slot is, not how often players see it. Unchanged gameplay gets the seed-draw row.`,
        upgradesPinned
          ? `The upgrades and enchantments are fixed by the seed${total}. Every class in a category costs the same randomness, so a shift changes which item a slot holds, never its +N.`
          : 'Upgrades are fixed by the seed unless the artifact slot lands on the Unstable Spellbook, which is reachable here: it consumes extra randomness and shifts every later +N and enchantment.',
      ]}
    >
      {slots.map((slot) => (
        <SlotRow key={slot.slot} slot={slot} upgradesPinned={upgradesPinned} />
      ))}
    </DistributionPopover>
  )
}
