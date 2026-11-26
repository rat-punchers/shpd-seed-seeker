import { CONFIG } from '../src/config.ts'

const { home, analyze, find, advanced } = CONFIG.routes

const screens = [
  {
    path: home,
    file: 'index.html',
    title: CONFIG.appName,
    description:
      'Find and analyze Shattered Pixel Dungeon seeds in your browser.',
  },
  {
    path: analyze,
    file: 'analyze.html',
    title: CONFIG.screenTitles.analyze,
    description:
      'Open a Shattered Pixel Dungeon seed and explore its items, replay settings, and floor maps.',
  },
  {
    path: find,
    file: 'find.html',
    title: CONFIG.screenTitles.find,
    description:
      'Find Shattered Pixel Dungeon seeds that contain the items you want.',
  },
  {
    path: advanced,
    file: 'find/advanced.html',
    title: CONFIG.screenTitles.advanced,
    description:
      'Search Shattered Pixel Dungeon seeds by items, quests, rooms, and challenges.',
  },
] as const

const slot = '<!-- screen metadata -->'

export function screenShells(html: string) {
  if (!html.includes(slot)) throw new Error(`The HTML shell needs ${slot}`)
  return screens.map((screen) => ({
    file: screen.file,
    html: html.replace(slot, metadata(screen)),
  }))
}

export function devScreenShell(html: string, url: string) {
  const path = new URL(url, CONFIG.siteOrigin).pathname
  return html.replace(
    slot,
    metadata(screens.find((screen) => screen.path === path) ?? screens[0])
  )
}

function metadata({ path, title, description }: (typeof screens)[number]) {
  const url = `${CONFIG.siteOrigin}${path}`
  const image = `${CONFIG.siteOrigin}${CONFIG.socialImage}`
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${CONFIG.appName}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="Seed Seeker for Shattered Pixel Dungeon" />',
    '<meta name="twitter:card" content="summary_large_image" />',
  ].join('\n    ')
}
