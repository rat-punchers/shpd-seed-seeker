import type { ChallengeName, QueryDocument } from '../../engine/types'

/** The most tabs kept open; opening one more drops the oldest. */
export const MAX_OPEN_SEEDS = 10

/** What a report is asked with, and what a reload restores. */
export interface SessionContext {
  /** A seed code (`ABC-DEF-GHI`) or daily date, as formatted for input. */
  seed: string
  query?: QueryDocument
  /** A Catalyst offer id or `"none"`; absent lets the query choose. */
  trinket?: string
  challenges?: ChallengeName[]
  lorePages?: boolean
  /** The Find results tab this tab walks (J/K), named after it. */
  results?: number
}

export type RunSettings = Pick<SessionContext, 'challenges' | 'lorePages'>

export const savedCodec = {
  encode: (value: SessionContext[]) => JSON.stringify(value),
  decode: (text: string): SessionContext[] => {
    try {
      const parsed = JSON.parse(text) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter(
          (entry): entry is SessionContext =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as SessionContext).seed === 'string'
        )
        .slice(-MAX_OPEN_SEEDS)
    } catch {
      return []
    }
  },
}

export function contextOf(session: SessionContext): SessionContext {
  const { seed, query, trinket, challenges, lorePages, results } = session
  return {
    seed,
    ...(query ? { query } : {}),
    ...(trinket ? { trinket } : {}),
    ...(challenges?.length ? { challenges } : {}),
    ...(lorePages === true ? { lorePages } : {}),
    ...(results === undefined ? {} : { results }),
  }
}
