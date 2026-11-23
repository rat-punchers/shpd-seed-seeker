import { CONFIG } from '../../config'
import { challenges } from '../../shared/game/catalog'
import type { SessionContext } from './session-context'

export type SeedLink = Pick<
  SessionContext,
  'seed' | 'challenges' | 'lorePages' | 'trinket'
>

export function scoutLinkSeed(search: string): string | undefined {
  return new URLSearchParams(search).get('scout')?.trim() || undefined
}

export function readSeedLink(params: URLSearchParams): SeedLink | undefined {
  const seed = params.get('seed')?.trim()
  if (!seed) return undefined
  const selected = new Set(params.getAll('challenge'))
  return {
    seed,
    challenges: challenges
      .filter(({ value }) => selected.has(value))
      .map(({ value }) => value),
    lorePages: params.get('lore') === '1',
    trinket: params.get('trinket')?.trim() || 'none',
  }
}

/** The same replay settings drive the address bar and share button. */
export function seedPath(link?: SeedLink): string {
  if (!link) return CONFIG.routes.analyze
  const params = new URLSearchParams({ seed: link.seed })
  for (const challenge of [...new Set(link.challenges)].sort())
    params.append('challenge', challenge)
  if (link.lorePages) params.set('lore', '1')
  if (link.trinket && link.trinket !== 'none')
    params.set('trinket', link.trinket)
  return `${CONFIG.routes.analyze}?${params}`
}
