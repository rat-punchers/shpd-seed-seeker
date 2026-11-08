import { Sprite } from '@seed-seeker/design/spd/sprite'
import type { ReportIdentity, SeedReport } from '../../../engine/types/report'
import { CATALOG_ICON } from '../../../shared/ui/game-icons'
import { SpriteSlot } from './ItemSlot'

/** Journal cell at scale 3: 17×3 + 8px padding. */
const IDENTITY_SCALE = 3

function IdentityGrid({
  label,
  entries,
  rings = false,
}: {
  label: string
  entries: ReportIdentity[]
  /**
   * Ring entries come in catalog ring order and their cell is already the
   * seed's gem, so the class glyph is the entry's position.
   */
  rings?: boolean
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-0.5">
      {entries.map((entry, index) => (
        <li key={entry.name}>
          <SpriteSlot
            art={
              rings
                ? { cell: entry.spriteIndex, ringGlyph: index }
                : { cell: entry.spriteIndex }
            }
            scale={IDENTITY_SCALE}
            label={`${entry.name} (${entry.appearance.toLowerCase()})`}
            caption={entry.appearance.toLowerCase()}
          />
        </li>
      ))}
    </ul>
  )
}

/** What each unidentified potion, scroll and ring looks like in this seed. */
export function IdentitiesPanel({ report }: { report: SeedReport }) {
  const { identities } = report
  return (
    <section
      data-identities
      aria-labelledby="identities-title"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sprite sprite={CATALOG_ICON} />
        <h3 id="identities-title" className="font-pixel text-px-1">
          Identities
        </h3>
        <span className="text-muted-foreground text-sm">
          Unidentified appearances for this seed
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <IdentityGrid label="Potions" entries={identities.potions} />
        <IdentityGrid label="Scrolls" entries={identities.scrolls} />
        <IdentityGrid label="Rings" entries={identities.rings} rings />
      </div>
    </section>
  )
}
