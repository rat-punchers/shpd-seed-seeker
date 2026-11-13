import type { HtmlTagDescriptor, Plugin } from 'vite'

/**
 * Fonts the first screen renders, by emitted file name. Latin subsets only;
 * Atkinson Mono stays lazy because the empty workspace shows no mono text.
 */
const FIRST_RENDER_FONTS = [
  /^pixel_font-[\w-]+\.ttf$/,
  /^atkinson-hyperlegible-next-latin-wght-normal-[\w-]+\.woff2$/,
]

const FONT_TYPES: Record<string, string> = {
  ttf: 'font/ttf',
  woff2: 'font/woff2',
}

/**
 * Preloads the first-render fonts from `<head>`, so they download alongside
 * the stylesheet instead of after it. Build only: dev has no bundle.
 */
export function fontPreload(): Plugin {
  let base = '/'
  return {
    name: 'seed-seeker-font-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml(_html, ctx) {
      if (!ctx.bundle) return
      const tags: HtmlTagDescriptor[] = []
      for (const fileName of Object.keys(ctx.bundle)) {
        const name = fileName.split('/').pop() ?? fileName
        if (!FIRST_RENDER_FONTS.some((pattern) => pattern.test(name))) continue
        const extension = name.split('.').pop() ?? ''
        tags.push({
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'font',
            type: FONT_TYPES[extension],
            href: `${base}${fileName}`,
            crossorigin: '',
          },
          injectTo: 'head',
        })
      }
      return tags
    },
  }
}
