// What a point on the map holds: the item tooltip whose raised sprite
// covers it, and the mobs, traps and plants generated on its cell.
import type {
  LevelMapDocument,
  MapItemTooltip,
  MapMob,
  MapPlant,
  MapTrap,
} from './types'

type InspectableMap = Pick<
  LevelMapDocument,
  'width' | 'height' | 'itemTooltips' | 'contents' | 'traps'
> & { scene: Pick<LevelMapDocument['scene'], 'tileSize'> }

/** The raised sprite rectangle, in map pixels; it drives hit tests and the outline. */
export function itemBounds(
  tip: MapItemTooltip,
  columns: number,
  tile: number
): [number, number, number, number] {
  const [x, y, width, height] = tip.bounds ?? [0, 0, tile, tile]
  return [
    (tip.cell % columns) * tile + x,
    Math.floor(tip.cell / columns) * tile + y,
    width,
    height,
  ]
}

/** The tooltip under a point given in map pixels, hidden ones included. */
export function itemAtPoint(
  map: InspectableMap,
  x: number,
  y: number
): MapItemTooltip | undefined {
  const tile = map.scene.tileSize
  if (x < 0 || y < 0 || x >= map.width * tile || y >= map.height * tile) return
  return map.itemTooltips?.find((tip) => {
    const [left, top, width, height] = itemBounds(tip, map.width, tile)
    return x >= left && y >= top && x < left + width && y < top + height
  })
}

/** Traps the map does not describe; a summoning room is full of them. */
const UNLISTED_TRAPS = new Set(['Summoning'])

export interface MapInspection {
  /** The cell under the point. */
  cell: number
  tip?: MapItemTooltip
  /** The disguised mimic whose loot the tooltip lists. */
  carrier?: MapMob
  mobs: MapMob[]
  traps: MapTrap[]
  plants: MapPlant[]
}

/** Everything generated under a point given in map pixels, or null off the map. */
export function inspectPoint(
  map: InspectableMap,
  x: number,
  y: number
): MapInspection | null {
  const tile = map.scene.tileSize
  const column = Math.floor(x / tile)
  const row = Math.floor(y / tile)
  if (column < 0 || row < 0 || column >= map.width || row >= map.height) {
    return null
  }
  const cell = row * map.width + column
  const tip = itemAtPoint(map, x, y)
  const contents = map.contents
  // A mimic's tooltip already names it and lists its loot.
  const disguised = (mob: MapMob) =>
    mob.kind.endsWith('Mimic') &&
    (map.itemTooltips ?? []).some((entry) => entry.cell === mob.cell)
  const carrier = tip
    ? contents?.mobs.find((mob) => mob.cell === tip.cell && disguised(mob))
    : undefined
  return {
    cell: tip?.cell ?? cell,
    tip,
    ...(carrier ? { carrier } : {}),
    mobs: (contents?.mobs ?? []).filter(
      (mob) => mob.cell === cell && !disguised(mob)
    ),
    traps: (contents?.traps ?? map.traps).filter(
      (trap) => trap.cell === cell && !UNLISTED_TRAPS.has(trap.kind)
    ),
    plants: (contents?.plants ?? []).filter((plant) => plant.cell === cell),
  }
}

/**
 * Identifies what a point shows. A raised sprite does not cover its whole
 * cell, so the same cell reads with and without its tooltip.
 */
export function inspectionKey(inspection: MapInspection | null): string {
  if (!inspection) return ''
  return `${inspection.cell}:${inspection.tip ? 'tip' : 'cell'}`
}

export function hasInspection(inspection: MapInspection | null): boolean {
  if (!inspection) return false
  return (
    inspection.tip !== undefined ||
    inspection.mobs.length > 0 ||
    inspection.traps.length > 0 ||
    inspection.plants.length > 0
  )
}

/** `PoisonDartTrap` → `Poison dart trap`. */
export function kindName(kind: string): string {
  const words = kind
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
