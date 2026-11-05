import { CONFIG_GLOBAL } from '../config.ts'

/**
 * Runs in `<head>` before first paint, after the config embed, so a stored
 * dark theme never flashes light. It mirrors `applyTheme` in `store/theme.ts`.
 */
export const THEME_SCRIPT = `(() => {
  try {
    const key = window.${CONFIG_GLOBAL}.storageKeys.theme
    const theme = localStorage.getItem(key) || 'system'
    const dark =
      theme === 'dark' ||
      (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  } catch {}
})()`
