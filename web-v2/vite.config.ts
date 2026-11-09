import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import wasm from 'vite-plugin-wasm'
import { THEME_SCRIPT } from './src/app/theme-script.ts'
import { CONFIG_SCRIPT } from './src/config.ts'
import { contentSecurityPolicy } from './vite/csp.ts'
import { fontPreload } from './vite/font-preload.ts'

// Ports from the repository's block (see AGENTS.md).
const DEV_PORT = 46000
const PREVIEW_PORT = 46001

/** Embeds the build config, then the pre-paint theme script, first in `<head>`. */
function documentScripts(): Plugin {
  return {
    name: 'seed-seeker-document-scripts',
    transformIndexHtml: () => [
      { tag: 'script', children: CONFIG_SCRIPT, injectTo: 'head-prepend' },
      { tag: 'script', children: THEME_SCRIPT, injectTo: 'head' },
    ],
  }
}

export default defineConfig({
  plugins: [
    documentScripts(),
    fontPreload(),
    react(),
    tailwindcss(),
    wasm(),
    contentSecurityPolicy(),
  ],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { target: 'esnext' },
  worker: { format: 'es', plugins: () => [wasm()] },
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: PREVIEW_PORT, strictPort: true },
})
