import { useStore } from '@tanstack/react-store'
import { $query } from '../../../app/store/query'
import type { ChallengeName } from '../../../engine/types'
import {
  challenges as challengeOptions,
  LEVEL_GEN_CHALLENGES,
} from '../../../shared/game/catalog'
import { toggleChallenge } from './edit'
import { SettingCaption, SettingSwitch, SettingsDetails } from './parts'

/** What enabling a challenge does to the seeds a search finds. */
export function challengeEffect(name: ChallengeName): string {
  if (name === 'badder_bosses') return 'Changes boss layouts.'
  return LEVEL_GEN_CHALLENGES.has(name)
    ? 'Changes level generation.'
    : 'No effect on seed content.'
}

/** The challenges a search simulates its runs with. */
export function Challenges() {
  const active = useStore($query, (query) => query.challenges)
  return (
    <SettingsDetails title="Challenges" count={active.length}>
      <SettingCaption>
        Searches simulate runs with the selected challenges enabled.
      </SettingCaption>
      <div className="flex flex-col gap-2">
        {challengeOptions.map((challenge) => (
          <SettingSwitch
            key={challenge.value}
            label={challenge.label}
            description={challengeEffect(challenge.value)}
            checked={active.includes(challenge.value)}
            onChange={() => toggleChallenge(challenge.value)}
          />
        ))}
      </div>
    </SettingsDetails>
  )
}
