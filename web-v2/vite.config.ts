import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

// Ports from the repository's block (see AGENTS.md).
const DEV_PORT = 46000
const PREVIEW_PORT = 46001

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm()],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { target: 'esnext' },
  worker: { format: 'es', plugins: () => [wasm()] },
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: PREVIEW_PORT, strictPort: true },
})
