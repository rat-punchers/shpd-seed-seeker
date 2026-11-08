// Region floor strips, quest giver and boss sprites from the design package.
import blacksmithUrl from '@seed-seeker/design/assets/sprites/blacksmith.png'
import dm300Url from '@seed-seeker/design/assets/sprites/dm300.png'
import ghostUrl from '@seed-seeker/design/assets/sprites/ghost.png'
import gooUrl from '@seed-seeker/design/assets/sprites/goo.png'
import impUrl from '@seed-seeker/design/assets/sprites/imp.png'
import kingUrl from '@seed-seeker/design/assets/sprites/king.png'
import tenguUrl from '@seed-seeker/design/assets/sprites/tengu.png'
import wandmakerUrl from '@seed-seeker/design/assets/sprites/wandmaker.png'
import yogUrl from '@seed-seeker/design/assets/sprites/yog.png'
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

/** First frame of a mob `TextureFilm`. */
function npc(url: string, sheetWidth: number, w: number, h: number): Sprite {
  return { url, sheetWidth, sheetHeight: 16, x: 0, y: 0, w, h }
}

/** A looping idle animation: one sprite crop per frame. */
export interface SpriteFilm {
  frames: Sprite[]
  frameDurationMs: number
}

/** A boss's idle film on a 256px-wide `TextureFilm`, as its sprite class plays it. */
function boss(
  url: string,
  sheetHeight: number,
  [w, h]: [number, number],
  frames: number[],
  fps: number
): SpriteFilm {
  const columns = Math.floor(256 / w)
  return {
    frames: frames.map((frame) => ({
      url,
      sheetWidth: 256,
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
  5: boss(gooUrl, 16, [20, 14], [2, 1, 0, 0, 1], 10),
  10: boss(tenguUrl, 16, [14, 16], [0, 0, 0, 1], 2),
  15: boss(dm300Url, 64, [25, 22], [0, 1], 10),
  20: boss(kingUrl, 16, [16, 16], [...Array(12).fill(0), 1, 2], 12),
  25: boss(
    yogUrl,
    32,
    [20, 19],
    [0, 1, 2, 2, 1, 0, 3, 4, 4, 3, 0, 5, 6, 6, 5],
    10
  ),
}

export const QUEST_NPCS: Record<QuestName, Sprite> = {
  ghost: npc(ghostUrl, 128, 14, 15),
  wandmaker: npc(wandmakerUrl, 64, 12, 14),
  blacksmith: npc(blacksmithUrl, 64, 13, 16),
  imp: npc(impUrl, 64, 12, 14),
}
