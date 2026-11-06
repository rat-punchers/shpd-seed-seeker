import { useEffect, useState } from 'react'
import { mapRequestJson, requestLevelMap } from './client'
import type { LevelMapRequest, MapBundle } from './types'

export type LevelMapState =
  | { status: 'loading' }
  | { status: 'ready'; bundle: MapBundle }
  | { status: 'error'; error: string }

/** Loads one map; `retry` asks again after a failure. */
export function useLevelMap(request: LevelMapRequest): {
  state: LevelMapState
  retry: () => void
} {
  const key = mapRequestJson(request)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{
    key: string
    attempt: number
    state: LevelMapState
  }>()

  useEffect(() => {
    let active = true
    const request = JSON.parse(key) as {
      seed: string
      depth: number
      branch: number
      challenges: LevelMapRequest['challenges']
      trinket: string
    }
    requestLevelMap({
      ...request,
      selectedTrinket: request.trinket === 'none' ? null : request.trinket,
    }).then(
      (bundle) => {
        if (active)
          setLoaded({ key, attempt, state: { status: 'ready', bundle } })
      },
      (reason: unknown) => {
        if (!active) return
        const error = reason instanceof Error ? reason.message : String(reason)
        setLoaded({ key, attempt, state: { status: 'error', error } })
      }
    )
    return () => {
      active = false
    }
  }, [key, attempt])

  const current =
    loaded?.key === key && loaded.attempt === attempt ? loaded.state : undefined
  return {
    state: current ?? { status: 'loading' },
    retry: () => setAttempt((value) => value + 1),
  }
}
