import type { RewardSlot } from '../../../engine/types/report'
import { itemName } from './report-text'
import {
  DistributionPopover,
  driftWindow,
  SlotCandidates,
} from './reward-candidates'

/**
 * The deck-index window for the Old Wandmaker's two ordered wand options.
 * Shares count how many offsets in the window land on a wand, not how often
 * players see it; the seed-draw row is the no-history pair.
 */
export function WandmakerRewardDistribution({
  slots,
}: {
  slots: RewardSlot[]
}) {
  if (slots.length === 0) return null
  const window = driftWindow(slots)
  const wand2Pinned = slots.find((slot) => slot.slot === 1)?.levelPinned ?? true

  return (
    <DistributionPopover
      label="Wand reward outlook"
      title="Wand reward outlook"
      descriptions={[
        'The two options are ordered. The player keeps one.',
        `Shares are a ±${window} index window around the seed draw, a stability measure, not how often players see the wand. The seed-draw row is the no-history pair.`,
        `Wand 1's +N is fixed by the seed. ${
          wand2Pinned
            ? "Wand 2's +N is fixed across this window."
            : "Wand 2's +N can move when a shifted index rejects a different number of duplicate wands."
        }`,
      ]}
    >
      {slots.map((slot) => (
        <li
          key={slot.slot}
          className="flex flex-col gap-1 border-t pt-2 first:border-t-0 first:pt-0"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold">Wand {slot.slot + 1}</span>
            <span className="text-sm font-semibold tabular-nums">
              +{slot.level}
            </span>
          </div>
          <SlotCandidates slot={slot} title={itemName} />
        </li>
      ))}
    </DistributionPopover>
  )
}
