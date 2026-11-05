// The build's identity and storage keys; the only module that may read
// `import.meta.env`.

export const CONFIG = Object.freeze({
  appName: 'Seed Seeker',
  /** Every localStorage key this app writes starts with this prefix. */
  storagePrefix: 'seed-seeker-v2-',
  dev: import.meta.env.DEV,
})
