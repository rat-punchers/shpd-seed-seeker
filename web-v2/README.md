# web-v2

Seed Seeker's second web app: React 19, Vite, Tailwind CSS v4 and the
`@seed-seeker/design` components, running this repository's engine as
WebAssembly in the browser. It has two modes:

- **Find** searches for seeds. Simple edits one item list; Advanced edits the
  full query (requirement board and sheet, presets, share links, search
  scope, quests, rooms, challenges, workers, results files). Both are views
  of one saved query.
- **Analyze** shows one seed per tab from the engine's `seed_report`
  ([docs/seed-report-format.md](../docs/seed-report-format.md)), with floor
  maps from `level_map` and seeds read from a screenshot.

## Commands

From the repository root:

```bash
bun install
bun run build:wasm      # engine + editor wasm and game assets into web-v2/
bun run dev:web-v2      # dev server on http://localhost:46000
bun run check           # Biome
bun run check:types     # tsc -b
bun run build           # every workspace; web-v2 builds to web-v2/dist
bun run test            # bun test + happy-dom
bun run test:visual     # build, then Playwright in tooling/web-visual
```

Run `bun run build:wasm` again after engine changes. The preview server
(`vite preview`, port 46001) is started by the browser tests.

## Source layout

- `src/main.tsx`, `src/index.css`: entry point and theme import.
- `src/config.ts`: app name, `seed-seeker-v2-` localStorage keys and links.
  The only module that may read `import.meta.env`.
- `src/app/`: the shell (`App`, `AppSidebar`, `SiteFooter`, `ThemeToggle`)
  and the TanStack stores for mode, theme, query, Find view and presets.
- `src/engine/`: the wasm wrappers (`wasm.ts`, `editor.ts`), engine
  constants, the seed-report worker and its protocol, and the engine's
  TypeScript types (`types/`). `pkg/` and `editor-pkg/` are build output of
  `bun run build:wasm` and are not committed.
- `src/features/find/`: Simple Find (`simple.ts` maps the item list to
  requirements and decides when a query needs Advanced), the result list,
  the seed preview beside it on wide screens (`preview/`) and the results
  file.
- `src/features/advanced/`: the requirement board (`board/`), the
  requirement sheet (`sheet/`), presets, share-link import and the settings
  panels (`settings/`).
- `src/features/query/`: the query document, its codec and share links,
  validation and limits.
- `src/features/search/`: the search coordinator, its workers and the
  search store, and the results tabs (`tabs.ts`), saved to localStorage.
- `src/features/analyze/`: seed tabs, the seed field, `?scout=` links,
  result navigation (J/K, swipe), the report worker client, the report view
  (`report/`) and the screenshot reader (`screenshot/`).
- `src/features/level-map/`: the floor map dialog, stage, settings and
  inspect panels, the `level_map` client and worker, and the canvas
  renderer (`rendering/`).
- `src/shared/`: game catalog helpers, sprites, persistent stores and small
  shared UI.
- `src/generated/`: catalog, sprite art and bounds written by
  `bun run build:wasm`; not committed.
- `public/`: `_headers`, favicons, and (written by `bun run build:wasm`) the
  game's runtime assets and license texts.
- `tests/`: `bun test` suites mirroring `src/`. Report tests read the
  engine's real fixtures in
  `crates/seedfinder-wasm/tests/fixtures/seed-report/`.
- `wrangler.toml`: the Cloudflare Worker `shpd-seed-seeker-v2` serving
  `dist/` at `seedseeker.nerdcoder.xyz`.

Files stay at or under 300 lines. Browser tests and canvas snapshots live in
[`tooling/web-visual`](../tooling/web-visual/README.md).
