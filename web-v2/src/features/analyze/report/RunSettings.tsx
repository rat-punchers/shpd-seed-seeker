import { Sprite } from '@seed-seeker/design/spd/sprite'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@seed-seeker/design/ui/alert'
import { Switch } from '@seed-seeker/design/ui/switch'
import { Toggle } from '@seed-seeker/design/ui/toggle'
import { useId } from 'react'
import type { ChallengeName, SeedReport } from '../../../engine/types'
import { challenges as challengeCatalog } from '../../../shared/game/catalog'
import {
  CHALLENGE_ICON,
  CHALLENGE_ON_ICON,
} from '../../../shared/ui/game-icons'
import { ItemSprite } from '../../../shared/ui/ItemSprite'
import { BOSS_FILMS } from './art'

export interface RunSettingsChoice {
  busy: boolean
  error: string | null
  selectLorePages: (shown: boolean) => void
  selectChallenges: (challenges: ChallengeName[]) => void
}

const effects = {
  barren_land: 'Removes generated plants.',
  into_darkness: 'Adds torches to regular floors.',
  forbidden_runes: 'Halves the number of Scrolls of Upgrade that spawn.',
  badder_bosses: 'Adds more exposed wires on floor 15.',
} satisfies Partial<Record<ChallengeName, string>>

type EditableChallenge = keyof typeof effects

const editable = challengeCatalog.filter(
  (entry): entry is typeof entry & { value: EditableChallenge } =>
    Object.hasOwn(effects, entry.value)
)

function ChallengeArt({
  challenge,
  report,
}: {
  challenge: EditableChallenge
  report: SeedReport
}) {
  switch (challenge) {
    case 'barren_land':
      return <ItemSprite art={{ cell: 387 }} />
    case 'into_darkness':
      return <ItemSprite art={{ cell: 51 }} />
    case 'forbidden_runes': {
      const scroll = report.identities?.scrolls.find(
        (entry) => entry.name === 'Scroll of upgrade'
      )
      return (
        <ItemSprite
          art={{ cell: scroll?.spriteIndex ?? 304, icon: scroll?.icon }}
        />
      )
    }
    case 'badder_bosses': {
      const sprite = BOSS_FILMS[15]?.frames[0]
      return sprite ? <Sprite sprite={sprite} scale={1} /> : null
    }
  }
}

export function RunSettings({
  report,
  challenges,
  lorePages,
  choice,
}: {
  report: SeedReport
  challenges: readonly ChallengeName[]
  lorePages: boolean
  choice: RunSettingsChoice
}) {
  const id = useId()
  const hasEnabledChallenge = editable.some(({ value }) =>
    challenges.includes(value)
  )

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby={`${id}-lore`}
        aria-busy={choice.busy}
        className="space-y-2"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ItemSprite art={{ cell: 496 }} />
          <h3 id={`${id}-lore`} className="font-pixel text-px-1">
            Lore pages
          </h3>
          <p id={`${id}-lore-detail`} className="text-muted-foreground text-sm">
            A fresh journal adds guide and alchemy pages and can shift later
            loot.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id={`${id}-show`}
            checked={lorePages}
            disabled={choice.busy}
            aria-describedby={`${id}-lore-detail`}
            onCheckedChange={choice.selectLorePages}
          />
          <label
            className="cursor-pointer py-2 text-sm font-medium"
            htmlFor={`${id}-show`}
          >
            Use a fresh journal
          </label>
        </div>
      </section>
      <section
        aria-labelledby={`${id}-challenges`}
        aria-busy={choice.busy}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Sprite
            sprite={hasEnabledChallenge ? CHALLENGE_ON_ICON : CHALLENGE_ICON}
          />
          <h3 id={`${id}-challenges`} className="font-pixel text-px-1">
            Challenges
          </h3>
          <p className="text-muted-foreground text-sm">
            Only challenges that affect floor generation are shown.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {editable.map(({ value, label }) => (
            <Toggle
              key={value}
              variant="outline"
              pressed={challenges.includes(value)}
              disabled={choice.busy}
              aria-label={label}
              aria-describedby={`${id}-${value}`}
              className="h-auto min-h-12 justify-start gap-3 whitespace-normal px-3 py-2 text-left"
              onPressedChange={(enabled) =>
                choice.selectChallenges(
                  enabled
                    ? [...challenges, value]
                    : challenges.filter((entry) => entry !== value)
                )
              }
            >
              <span className="grid size-8 shrink-0 place-items-center">
                <ChallengeArt challenge={value} report={report} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-foreground leading-tight">{label}</span>
                <span
                  id={`${id}-${value}`}
                  className="text-muted-foreground text-xs font-normal leading-tight"
                >
                  {effects[value]}
                </span>
              </span>
            </Toggle>
          ))}
        </div>
      </section>
      {choice.busy ? (
        <p role="status" className="text-muted-foreground text-sm">
          Regenerating floors…
        </p>
      ) : null}
      {choice.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t update replay settings</AlertTitle>
          <AlertDescription>{choice.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
