import { CONFIG } from '../../config'
import { enumCodec, persistentStore } from '../../shared/store/persistent'

/** The workspace the sidebar tabs switch between. */
export type AppMode = 'analyze' | 'find'

export const APP_MODES: readonly AppMode[] = ['analyze', 'find']

export const $mode = persistentStore<AppMode>(
  CONFIG.storageKeys.mode,
  'analyze',
  enumCodec(APP_MODES, 'analyze')
)

export function setMode(mode: AppMode) {
  $mode.set(mode)
}

export function isAppMode(value: string): value is AppMode {
  return (APP_MODES as readonly string[]).includes(value)
}
