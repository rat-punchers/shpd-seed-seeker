import { Badge } from '@seed-seeker/design/ui/badge'
import { cn } from '@seed-seeker/design/utils'
import { type CSSProperties, forwardRef, type ReactNode } from 'react'
import { itemArt } from '../../shared/sprites/sprites'
import { ItemSprite } from '../../shared/ui/ItemSprite'
import { kindName, type MapInspection } from './item-inspection'
import { MobPortrait } from './MobPortrait'
import type {
  MapBundle,
  MapMob,
  MapPlant,
  MapTooltipItem,
  MapTrap,
} from './types'

function PictureRow({
  picture,
  children,
}: {
  picture?: ReactNode
  children: ReactNode
}) {
  if (!picture) return children
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0">{picture}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function ObjectSection({
  title,
  note,
  desc,
  badges,
}: {
  title: string
  note?: string | null
  desc?: string | null
  badges?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-popover-foreground font-semibold">{title}</p>
        {badges}
      </div>
      {note ? <p className="text-muted-foreground text-sm">{note}</p> : null}
      {desc ? (
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">
          {desc}
        </p>
      ) : null}
    </div>
  )
}

function itemTitle(item: MapTooltipItem): string {
  const upgrade = item.upgrade ? ` +${item.upgrade}` : ''
  const quantity = item.quantity > 1 ? ` ×${item.quantity}` : ''
  return `${item.name}${upgrade}${quantity}`
}

function ItemSection({ item }: { item: MapTooltipItem }) {
  const curse = item.curse ?? (item.cursed ? 'Cursed' : null)
  return (
    <PictureRow
      picture={
        <ItemSprite
          art={
            item.icon
              ? { cell: item.image, icon: item.icon }
              : itemArt(item.image)
          }
          size={32}
        />
      }
    >
      <ObjectSection
        title={itemTitle(item)}
        note={item.enchantment ? `Enchanted with ${item.enchantment}.` : null}
        desc={item.description}
        badges={
          <>
            {curse ? <Badge variant="destructive">{curse}</Badge> : null}
            {item.deterministic ? null : (
              <Badge variant="warning">Varies with play</Badge>
            )}
          </>
        }
      />
    </PictureRow>
  )
}

/** The mob as the game's examine window shows it: portrait, name, description. */
function MobSection({ mob, bundle }: { mob: MapMob; bundle: MapBundle }) {
  const detail = bundle.map.mobDetails?.[mob.kind]
  return (
    <PictureRow
      picture={detail ? <MobPortrait bundle={bundle} detail={detail} /> : null}
    >
      <ObjectSection
        title={detail?.name ?? kindName(mob.kind)}
        desc={detail?.description}
        badges={
          mob.approximate ? <Badge variant="warning">May differ</Badge> : null
        }
      />
    </PictureRow>
  )
}

function PlantSection({
  plant,
  bundle,
}: {
  plant: MapPlant
  bundle: MapBundle
}) {
  const detail = bundle.map.plantDetails?.[plant.kind]
  return (
    <PictureRow
      picture={detail ? <MobPortrait bundle={bundle} detail={detail} /> : null}
    >
      <ObjectSection
        title={detail?.name ?? kindName(plant.kind)}
        desc={detail?.description}
      />
    </PictureRow>
  )
}

function TrapSection({ trap }: { trap: MapTrap }) {
  return (
    <ObjectSection
      title={kindName(trap.kind)}
      note={trap.active ? null : 'Inactive.'}
      badges={trap.hidden ? <Badge variant="secondary">Hidden</Badge> : null}
    />
  )
}

/** Description panel for one map tile: everything generated on it. */
export const MapInspectPanel = forwardRef<
  HTMLDivElement,
  {
    inspection: MapInspection
    bundle: MapBundle
    pinned: boolean
    style?: CSSProperties
  }
>(function MapInspectPanel({ inspection, bundle, pinned, style }, ref) {
  const { tip, carrier, mobs, traps, plants } = inspection
  const sections: ReactNode[] = [
    ...(carrier
      ? [<MobSection key="carrier" mob={carrier} bundle={bundle} />]
      : []),
    ...(tip?.items ?? []).map((item, index) => (
      <ItemSection key={`item-${index}`} item={item} />
    )),
    ...mobs.map((mob, index) => (
      <MobSection key={`mob-${index}`} mob={mob} bundle={bundle} />
    )),
    ...traps.map((trap, index) => (
      <TrapSection key={`trap-${index}`} trap={trap} />
    )),
    ...plants.map((plant, index) => (
      <PlantSection key={`plant-${index}`} plant={plant} bundle={bundle} />
    )),
  ]
  return (
    <div
      ref={ref}
      data-slot="map-inspect"
      data-pinned={pinned || undefined}
      role="dialog"
      aria-label="Tile details"
      className={cn(
        'bg-popover text-popover-foreground shadow-window inset-shadow-raised absolute z-20 flex max-h-80 w-80 max-w-[calc(100%-1rem)] flex-col gap-2 overflow-y-auto rounded-lg border p-3.5 text-sm',
        !pinned && 'pointer-events-none'
      )}
      style={style}
    >
      {tip?.hidden ? (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">Secret</Badge>
        </div>
      ) : null}
      {tip?.label && !carrier ? (
        <p className="text-muted-foreground text-xs font-semibold">
          {tip.label}
        </p>
      ) : null}
      {sections.map((section, index) => (
        <div key={index} className={cn(index > 0 && 'border-t pt-2')}>
          {section}
        </div>
      ))}
    </div>
  )
})
