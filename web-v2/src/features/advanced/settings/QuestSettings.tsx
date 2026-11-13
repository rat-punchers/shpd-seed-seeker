import { Field, FieldLabel } from '@seed-seeker/design/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@seed-seeker/design/ui/select'
import { useStore } from '@tanstack/react-store'
import { useId } from 'react'
import { $query } from '../../../app/store/query'
import { WANDMAKER_QUESTS, type WandmakerQuest } from '../../../engine/types'
import { BLACKSMITH_LAST_FLOOR } from '../../query/query'
import { patchQuery } from './edit'
import { SettingCaption, SettingSwitch, SettingsDetails } from './parts'

const WANDMAKER_LABELS: Record<WandmakerQuest, string> = {
  corpse_dust: 'Corpse Dust',
  elemental_embers: 'Elemental Embers',
  rotberry: 'Rotberry',
}

/** The "Any" item's value: a select item cannot have an empty one. */
const ANY = 'any'

const isWandmakerQuest = (value: string): value is WandmakerQuest =>
  (WANDMAKER_QUESTS as readonly string[]).includes(value)

/** Which quest the Wandmaker gives, or any. */
export function WandmakerSettings() {
  const quest = useStore($query, (query) => query.wandmakerQuest)
  const id = useId()
  return (
    <SettingsDetails title="Wandmaker" count={quest ? 1 : 0}>
      <Field>
        <FieldLabel htmlFor={id}>Quest</FieldLabel>
        <Select
          value={quest ?? ANY}
          onValueChange={(value) =>
            patchQuery({
              wandmakerQuest: isWandmakerQuest(value) ? value : undefined,
            })
          }
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any</SelectItem>
            {WANDMAKER_QUESTS.map((variant) => (
              <SelectItem key={variant} value={variant}>
                {WANDMAKER_LABELS[variant]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </SettingsDetails>
  )
}

/** Require the Blacksmith, and keep required items out of his reward. */
export function BlacksmithSettings() {
  const maxDepth = useStore($query, (query) => query.maxDepth)
  const require = useStore($query, (query) => query.requireBlacksmith)
  const exclude = useStore($query, (query) => query.excludeBlacksmithRewards)
  // A floor limit reaching his last floor always meets him.
  const alwaysMet = maxDepth >= BLACKSMITH_LAST_FLOOR
  return (
    <SettingsDetails
      title="Blacksmith"
      count={Number(require) + Number(exclude)}
    >
      <SettingSwitch
        label="Require accessible blacksmith"
        checked={require}
        disabled={alwaysMet}
        onChange={(value) => patchQuery({ requireBlacksmith: value })}
      />
      <div className="flex flex-col gap-1">
        <SettingSwitch
          label="Exclude Smith rewards"
          checked={exclude}
          onChange={(value) => patchQuery({ excludeBlacksmithRewards: value })}
        />
        <SettingCaption>
          Required items cannot come from the 2,000-favor Smith choice, leaving
          favor available for reforging.
        </SettingCaption>
      </div>
    </SettingsDetails>
  )
}
