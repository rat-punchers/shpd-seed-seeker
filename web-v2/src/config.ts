// The build's identity, storage keys and links. The only module that may
// read `import.meta.env`; it reads none today, so `vite.config.ts` can import
// it to embed `CONFIG_SCRIPT` in the document.

/** Every localStorage key this app writes starts with this prefix. */
const STORAGE_PREFIX = 'seed-seeker-v2-'

export const CONFIG = Object.freeze({
  appName: 'Seed Seeker',
  storagePrefix: STORAGE_PREFIX,
  storageKeys: Object.freeze({
    mode: `${STORAGE_PREFIX}mode`,
    theme: `${STORAGE_PREFIX}theme`,
    query: `${STORAGE_PREFIX}query`,
    findView: `${STORAGE_PREFIX}find-view`,
    presets: `${STORAGE_PREFIX}presets`,
    workers: `${STORAGE_PREFIX}workers`,
    resultsTabs: `${STORAGE_PREFIX}results-tabs`,
    openSeeds: `${STORAGE_PREFIX}open-seeds`,
    activeSeed: `${STORAGE_PREFIX}active-seed`,
  }),
  links: Object.freeze({
    license: '/licenses/COPYING.txt',
    attribution: '/third_party/shattered-pixel-dungeon/ATTRIBUTION.md',
    shpd: 'https://github.com/00-Evan/shattered-pixel-dungeon',
  }),
})

export type AppConfig = typeof CONFIG

/** The global the document embed defines; pre-paint scripts read it. */
export const CONFIG_GLOBAL = '__SEED_SEEKER_CONFIG__'

/** The embed, emitted before any other inline script. */
export const CONFIG_SCRIPT = `window.${CONFIG_GLOBAL}=${JSON.stringify(CONFIG)};`
