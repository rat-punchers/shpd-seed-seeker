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

/** The tooltip under a point given in map pixels; hidden ones only with secrets. */
export function itemAtPoint(
  map: InspectableMap,
  x: number,
  y: number,
  secrets: boolean
): MapItemTooltip | undefined {
  const tile = map.scene.tileSize
  if (x < 0 || y < 0 || x >= map.width * tile || y >= map.height * tile) return
  return map.itemTooltips?.find((tip) => {
    if (tip.hidden && !secrets) return false
    const [left, top, width, height] = itemBounds(tip, map.width, tile)
    return x >= left && y >= top && x < left + width && y < top + height
  })
}

export interface MapInspection {
  /** The cell under the point. */
  cell: number
  tip?: MapItemTooltip
  mobs: MapMob[]
  traps: MapTrap[]
  plants: MapPlant[]
}

/** Everything generated under a point given in map pixels, or null off the map. */
export function inspectPoint(
  map: InspectableMap,
  x: number,
  y: number,
  secrets: boolean
): MapInspection | null {
  const tile = map.scene.tileSize
  const column = Math.floor(x / tile)
  const row = Math.floor(y / tile)
  if (column < 0 || row < 0 || column >= map.width || row >= map.height) {
    return null
  }
  const cell = row * map.width + column
  const tip = itemAtPoint(map, x, y, secrets)
  const contents = map.contents
  return {
    cell: tip?.cell ?? cell,
    tip,
    mobs: (contents?.mobs ?? []).filter((mob) => mob.cell === cell),
    traps: (contents?.traps ?? map.traps).filter(
      (trap) => trap.cell === cell && (secrets || !trap.hidden)
    ),
    plants: (contents?.plants ?? []).filter((plant) => plant.cell === cell),
  }
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
