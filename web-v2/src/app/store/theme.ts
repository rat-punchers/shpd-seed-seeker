import { CONFIG } from '../../config'
import { enumCodec, persistentStore } from '../../shared/store/persistent'

/** The color theme preference; `system` follows the OS setting. */
export type Theme = 'light' | 'dark' | 'system'

const THEMES: readonly Theme[] = ['light', 'dark', 'system']
const DARK_QUERY = '(prefers-color-scheme: dark)'

export const $theme = persistentStore<Theme>(
  CONFIG.storageKeys.theme,
  'system',
  enumCodec(THEMES, 'system')
)

export function setTheme(theme: Theme) {
  $theme.set(theme)
}

/** Cycles light → dark → system → light. */
export function cycleTheme() {
  const index = THEMES.indexOf($theme.get())
  $theme.set(THEMES[(index + 1) % THEMES.length] ?? 'system')
}

export function resolvedTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/** Sets `.dark` and `color-scheme` on `<html>` for the preference. */
export function applyTheme(theme: Theme) {
  const resolved = resolvedTheme(theme)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

/**
 * Applies the stored theme and keeps `<html>` in sync with the store and,
 * for `system`, the OS setting. Returns the cleanup.
 */
export function initTheme(): () => void {
  applyTheme($theme.get())
  const subscription = $theme.subscribe(applyTheme)
  const media = window.matchMedia(DARK_QUERY)
  const onSystemChange = () => {
    if ($theme.get() === 'system') applyTheme('system')
  }
  media.addEventListener('change', onSystemChange)
  return () => {
    subscription.unsubscribe()
    media.removeEventListener('change', onSystemChange)
  }
}
