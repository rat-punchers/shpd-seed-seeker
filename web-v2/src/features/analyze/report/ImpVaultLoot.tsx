import type { ReportItem } from '../../../engine/types/report'
import type { RingGems } from '../../../shared/sprites/sprites'
import { ItemGroupSection } from './FloorItemSections'

export function ImpVaultLoot({
  treasure,
  ringGems,
}: {
  treasure: ReportItem[]
  ringGems?: RingGems
}) {
  return (
    <>
      {treasure.length > 0 ? (
        <ItemGroupSection
          label="Vault treasure"
          items={treasure}
          ringGems={ringGems}
        />
      ) : null}
      <p className="text-muted-foreground text-sm">
        You can take only one item out of the vault.
      </p>
    </>
  )
}
