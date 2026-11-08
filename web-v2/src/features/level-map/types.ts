// The `level_map` document (schema 2 or 3) and the map worker's messages.
import type { ChallengeName } from '../../engine/types'

export type Rectangle = [number, number, number, number]

export interface MapGlow {
  color: [number, number, number]
  periodMs: number
}

export type MapDraw =
  | {
      kind: 'blit'
      asset: string
      source: Rectangle
      opacity?: number
      tint?: [number, number, number]
      glow?: MapGlow
      destination: Rectangle
    }
  | {
      kind: 'fill'
      rgba: [number, number, number, number]
      destination: Rectangle
    }

export interface MapSprite {
  frameDurationMs: number
  frames: MapDraw[][]
}

/** Objects present after generation; runtime-dependent identities are explicit. */
export interface MapItem {
  kind: string
  image: number
  quantity: number
  deterministic: boolean
  glow?: MapGlow
}

export interface MapTrap {
  cell: number
  kind: string
  hidden: boolean
  active: boolean
}

export interface MapMob {
  cell: number
  kind: string
  stealthy: boolean
  sleeping: boolean
  approximate: boolean
  items: MapItem[]
}

export interface MapPlant {
  cell: number
  kind: string
  image: number
}

export interface MapContents {
  sentries?: {
    cell: number
    initialCooldown: number
    cooldown: number
    triggers: number
    warning: boolean
    directions: number[][]
    scan?: [number, number]
  }[]
  heaps: {
    cell: number
    kind: string
    haunted: boolean
    phantom?: boolean
    items: MapItem[]
  }[]
  mobs: MapMob[]
  plants: MapPlant[]
  effects: { cell: number; kind: string }[]
  features: {
    cell: number
    kind: string
    width: number
    height: number
    cycle?: { initialCooldown: number; cooldown: number; triggers: number }
  }[]
  traps: MapTrap[]
}

export interface MapTooltipItem {
  name: string
  description: string
  image: number
  icon?: [number, number, number, number] | null
  quantity: number
  deterministic: boolean
  upgrade?: number | null
  cursed?: boolean
  enchantment?: string | null
  curse?: string | null
  glow?: MapGlow | null
}

export interface MapItemTooltip {
  cell: number
  /** The raised sprite rectangle within the cell, in map pixels. */
  bounds?: [number, number, number, number]
  label: string
  hidden: boolean
  items: MapTooltipItem[]
}

/** A mob kind's examine window: in-game name, description and idle film. */
export interface MapMobDetail {
  name: string
  description: string
  asset: string
  frameDurationMs: number
  frames: Rectangle[]
}

export type MapKind =
  | 'regular'
  | 'blacksmith_crystal'
  | 'blacksmith_gnoll'
  | 'imp_vault'

export interface MapLayer {
  name: string
  blend?: 'add'
  cells: (number | null)[]
}

export interface LevelMapDocument {
  itemTooltips?: MapItemTooltip[]
  /** Keyed by mob kind; absent from older engines. */
  mobDetails?: Record<string, MapMobDetail>
  format: 'seed-seeker-level-map'
  schemaVersion: 2 | 3
  seed: string
  depth: number
  branch: number
  kind: MapKind
  challenges: ChallengeName[]
  selectedTrinket: string | null
  width: number
  height: number
  terrain: number[]
  entrance: number | null
  exit: number | null
  secretRooms: Rectangle[]
  secretDoors: number[]
  secretTraps: number[]
  traps: MapTrap[]
  branches: { depth: number; branch: number; kind: string; entrance: number }[]
  assets: { id: string; width: number; height: number; sha256: string }[]
  /** Optional for older v2 engines; drawing is always defined by scene. */
  contents?: MapContents
  pickupAssumptions?: {
    earlierHourglass: 'take_identify_uncurse'
    shopSand: 'buy'
  }
  scene: {
    emitters?: MapEmitter[]
    concealedEmitters?: MapEmitter[]
    tileSize: number
    sprites: MapSprite[]
    layers: MapLayer[]
    concealedLayers: MapLayer[]
  }
}

export interface LevelMapRequest {
  seed: string
  depth: number
  branch?: number
  challenges: readonly ChallengeName[]
  /** A Catalyst offer id; null or absent is No Trinket. */
  selectedTrinket?: string | null
}

export interface MapBundle {
  map: LevelMapDocument
  textures: ReadonlyMap<string, ImageBitmap>
}

export interface MapWorkerRequest {
  id: number
  requestJson: string
}

export type MapWorkerResponse =
  | {
      id: number
      map: LevelMapDocument
      assets: { id: string; png: ArrayBuffer }[]
    }
  | { id: number; error: string }

export interface MapCurve {
  points: [number, number][]
  sqrt: boolean
}

export interface MapEmitter {
  startMs?: number
  wallMask?: boolean
  clipToChasm?: boolean
  cell: number
  loopMs: number
  blend: 'add' | null
  image: MapDraw
  velocity: [number, number]
  acceleration: [number, number]
  angularSpeed: number
  alpha: MapCurve
  scale: MapCurve
  scaleX?: MapCurve
  scaleY?: MapCurve
  particles: {
    birthMs: number
    lifespanMs: number
    position: [number, number]
    scale: number
    angle: number
  }[]
}
