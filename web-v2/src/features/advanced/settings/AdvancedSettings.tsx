import { Challenges } from './Challenges'
import { FarmingFloors } from './FarmingFloors'
import { Performance } from './Performance'
import { BlacksmithSettings, WandmakerSettings } from './QuestSettings'
import { SearchScope } from './SearchScope'

/**
 * The query's settings beyond its requirements: the search scope, the
 * quests, rooms and feelings, the worker count and the challenges.
 */
export function AdvancedSettings() {
  return (
    <div className="flex flex-col gap-4" data-testid="advanced-settings">
      <SearchScope />
      <WandmakerSettings />
      <BlacksmithSettings />
      <FarmingFloors />
      <Performance />
      <Challenges />
    </div>
  )
}
