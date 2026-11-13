// Region floor strips, quest giver, quest target and boss sprites from the design package.
import blacksmithUrl from '@seed-seeker/design/assets/sprites/blacksmith.png'
import crabUrl from '@seed-seeker/design/assets/sprites/crab.png'
import dm300Url from '@seed-seeker/design/assets/sprites/dm300.png'
import ghostUrl from '@seed-seeker/design/assets/sprites/ghost.png'
import gnollUrl from '@seed-seeker/design/assets/sprites/gnoll.png'
import gooUrl from '@seed-seeker/design/assets/sprites/goo.png'
import impUrl from '@seed-seeker/design/assets/sprites/imp.png'
import kingUrl from '@seed-seeker/design/assets/sprites/king.png'
import ratUrl from '@seed-seeker/design/assets/sprites/rat.png'
import tenguUrl from '@seed-seeker/design/assets/sprites/tengu.png'
import wandmakerUrl from '@seed-seeker/design/assets/sprites/wandmaker.png'
import yogUrl from '@seed-seeker/design/assets/sprites/yog.png'
import alchemyPotsUrl from '@seed-seeker/design/assets/textures/alchemy_pots.png'
import cavesUrl from '@seed-seeker/design/assets/textures/caves.png'
import cityUrl from '@seed-seeker/design/assets/textures/city.png'
import hallsUrl from '@seed-seeker/design/assets/textures/halls.png'
import prisonUrl from '@seed-seeker/design/assets/textures/prison.png'
import sewersUrl from '@seed-seeker/design/assets/textures/sewers.png'
import type { RegionId } from '@seed-seeker/design/lib/regions'
import type { Sprite } from '@seed-seeker/design/lib/sprites'
import type { QuestName } from '../../../engine/types'

/** A 128×32 strip of the region's floor tiles, drawn at 2× behind a banner. */
export const REGION_STRIPS: Record<RegionId, string> = {
  sewers: sewersUrl,
  prison: prisonUrl,
  caves: cavesUrl,
  city: cityUrl,
  halls: hallsUrl,
}

/** A looping idle animation: one sprite crop per frame. */
export interface SpriteFilm {
  frames: Sprite[]
  frameDurationMs: number
}

/**
 * An idle film on a `TextureFilm` of `w`×`h` cells, as the sprite class
 * plays it: `frames` are cell indices, `fps` the animation's rate.
 */
function film(
  url: string,
  [sheetWidth, sheetHeight]: [number, number],
  [w, h]: [number, number],
  frames: number[],
  fps: number
): SpriteFilm {
  const columns = Math.floor(sheetWidth / w)
  return {
    frames: frames.map((frame) => ({
      url,
      sheetWidth,
      sheetHeight,
      x: (frame % columns) * w,
      y: Math.floor(frame / columns) * h,
      w,
      h,
    })),
    frameDurationMs: 1000 / fps,
  }
}

/** Keyed by boss depth, as `Dungeon.bossLevel` fixes them in v4.0.2. */
export const BOSS_FILMS: Record<number, SpriteFilm> = {
  5: film(gooUrl, [256, 16], [20, 14], [2, 1, 0, 0, 1], 10),
  10: film(tenguUrl, [256, 16], [14, 16], [0, 0, 0, 1], 2),
  15: film(dm300Url, [256, 64], [25, 22], [0, 1], 10),
  20: film(kingUrl, [256, 16], [16, 16], [...Array(12).fill(0), 1, 2], 12),
  25: film(
    yogUrl,
    [256, 32],
    [20, 19],
    [0, 1, 2, 2, 1, 0, 3, 4, 4, 3, 0, 5, 6, 6, 5],
    10
  ),
}

/** The quest givers' idle films (`GhostSprite`, `WandmakerSprite`, …). */
export const QUEST_NPC_FILMS: Record<QuestName, SpriteFilm> = {
  ghost: film(ghostUrl, [128, 16], [14, 15], [0, 1], 5),
  wandmaker: film(
    wandmakerUrl,
    [64, 16],
    [12, 14],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 2, 1],
    10
  ),
  blacksmith: film(
    blacksmithUrl,
    [64, 16],
    [13, 16],
    [0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 3],
    15
  ),
  imp: film(
    impUrl,
    [64, 16],
    [12, 14],
    [
      0, 1, 2, 3, 0, 1, 2, 3, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 1, 2, 3,
      0, 1, 2, 3, 0, 1, 3, 0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 4, 4, 4, 4,
      4, 4, 4, 4,
    ],
    10
  ),
}

/** The quest givers' first idle frames. */
export const QUEST_NPCS = Object.fromEntries(
  Object.entries(QUEST_NPC_FILMS).map(([quest, npcFilm]) => [
    quest,
    npcFilm.frames[0],
  ])
) as Record<QuestName, Sprite>

/** The Ghost's target by quest variant (`FetidRatSprite`, …). */
export const GHOST_TARGET_FILMS: Record<string, SpriteFilm> = {
  fetid_rat: film(ratUrl, [256, 64], [16, 15], [32, 32, 32, 33], 2),
  gnoll_trickster: film(
    gnollUrl,
    [256, 64],
    [12, 15],
    [42, 42, 42, 43, 42, 42, 43, 43],
    2
  ),
  great_crab: film(crabUrl, [256, 64], [16, 16], [32, 33, 32, 34], 5),
}

const POT_REGIONS: RegionId[] = ['sewers', 'prison', 'caves', 'city', 'halls']

/** The region's raised alchemy pot, 16×20, as the game draws its tile. */
export function alchemyPotSprite(region: RegionId): Sprite {
  return {
    url: alchemyPotsUrl,
    sheetWidth: 80,
    sheetHeight: 20,
    x: Math.max(0, POT_REGIONS.indexOf(region)) * 16,
    y: 0,
    w: 16,
    h: 20,
  }
}
