import { Sprite } from '@seed-seeker/design/spd/sprite'
import type { FloorFeeling } from '../../engine/types'
import { floorFeelingIcon, STAIRS_ICON } from './game-icons'

/** The game draws the floor feeling on the staircase itself. */
export function FloorStairs({ feeling }: { feeling?: FloorFeeling }) {
  const indicator = floorFeelingIcon(feeling)
  const label =
    indicator && feeling
      ? `${feeling.charAt(0).toUpperCase()}${feeling.slice(1)} floor`
      : undefined
  return (
    <span
      className="inline-flex shrink-0"
      data-floor-stairs
      data-feeling={indicator ? feeling : undefined}
      title={label}
    >
      <Sprite sprite={indicator ?? STAIRS_ICON} label={label} />
    </span>
  )
}
