import { XIcon } from '@phosphor-icons/react'
import { Badge } from '@seed-seeker/design/ui/badge'
import { Button } from '@seed-seeker/design/ui/button'
import { Toggle } from '@seed-seeker/design/ui/toggle'
import { useStore } from '@tanstack/react-store'
import { $query } from '../../../app/store/query'
import type { FloorRequirement } from '../../../engine/types'
import {
  FARMING_FLOORS,
  isFarmingRequirement,
} from '../../../shared/game/floor-requirements'
import { removeFloorRequirement, toggleFarming } from './edit'
import { HelpNote, SettingsDetails } from './parts'

const NO_FLOORS: readonly FloorRequirement[] = []

const words = (id: string) => id.replaceAll('_', ' ')

/** A floor requirement the farming toggles do not draw, with its remove button. */
function FloorFilter({ floor }: { floor: FloorRequirement }) {
  return (
    <li
      className="flex flex-wrap items-center gap-1.5 text-sm"
      data-floor-requirement={floor.depth}
    >
      <span className="font-semibold">Floor {floor.depth}</span>
      {floor.feeling && floor.feeling !== 'none' ? (
        <Badge variant="secondary">{floor.feeling} floor</Badge>
      ) : null}
      {floor.rooms?.map((room) => (
        <Badge key={room} variant="outline">
          {words(room)}
        </Badge>
      ))}
      {floor.any_rooms?.length ? (
        <Badge variant="outline">
          {floor.any_rooms.map(words).join(' / ')}
        </Badge>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove floor ${floor.depth} requirement`}
        onClick={() => removeFloorRequirement(floor.depth)}
      >
        <XIcon />
      </Button>
    </li>
  )
}

/**
 * Rooms and feelings: the Ring of Wealth farming floors as toggles, then
 * every other floor requirement the query carries (from a preset, a share
 * link or an import), each removable.
 */
export function FarmingFloors() {
  const floors =
    useStore($query, (query) => query.floorRequirements) ?? NO_FLOORS
  const others = floors.filter((floor) => !isFarmingRequirement(floor))
  return (
    <SettingsDetails title="Rooms and feelings" count={floors.length}>
      <fieldset className="flex flex-col gap-2" data-farming-floors>
        <legend className="mb-2 flex items-center gap-1 text-sm">
          <span>Ring of Wealth farming floors</span>
          <HelpNote label="About Ring of Wealth farming floors">
            Dark floor with a garden.
          </HelpNote>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {FARMING_FLOORS.map((depth) => (
            <Toggle
              key={depth}
              variant="outline"
              size="sm"
              pressed={floors.some(
                (floor) => floor.depth === depth && isFarmingRequirement(floor)
              )}
              onPressedChange={() => toggleFarming(depth)}
            >
              Floor {depth}
            </Toggle>
          ))}
        </div>
      </fieldset>
      {others.length > 0 ? (
        <ul
          className="flex flex-col gap-1.5"
          aria-label="Other floor requirements"
        >
          {others.map((floor) => (
            <FloorFilter key={floor.depth} floor={floor} />
          ))}
        </ul>
      ) : null}
    </SettingsDetails>
  )
}
