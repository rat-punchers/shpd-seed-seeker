# web-v2 browser tests

Playwright tests for `web-v2`, run in Chromium against the production build
served by `vite preview` on `127.0.0.1:46001`. The run is pinned for
reproducible pixels: UTC, `en-US`, light color scheme, reduced motion, a
1440×1200 viewport at device scale 1.

- **Canvas snapshots** compare a canvas's backing bitmap with a committed PNG
  in `snapshots/`, pixel for pixel. Each channel may differ by up to 2 of 255
  (`MAX_CHANNEL_DELTA` in `tests/helpers/canvas.ts`): Chromium on macOS arm64
  and on Linux x86-64 (CI) round alpha blending that much differently, so one
  snapshot set serves both. A larger difference falls through to the exact
  `toMatchSnapshot`, which fails and writes the diff. Reading the bitmap
  avoids viewport clipping when a map is taller than its dialog.
- **Everything else** (DOM, text, layout) is checked with assertions, not
  screenshots.

## Helpers

`tests/helpers/`:

- `app.ts`: `openApp(page, storage)` opens the app with cleared storage, the
  given `seed-seeker-v2-` entries, light theme and reduced motion.
- `browser-errors.ts`: `collectBrowserErrors(page)` and
  `expectNoBrowserErrors(errors)` for console errors and uncaught exceptions.
- `canvas.ts`: `waitForCanvasPaint(canvas)` and
  `snapshotCanvas(canvas, name)`.
- `fake-report-worker.ts`: `installFakeReportWorker(page, reports)` replaces
  the seed-report worker with one that answers from fixtures, using the
  protocol in `web-v2/src/engine/report-protocol.ts`. `loadReportFixtures()`
  reads the engine's real reports from
  `crates/seedfinder-wasm/tests/fixtures/seed-report/`. Other workers stay
  real.
- `map-fixtures.ts`: `MAP_FIXTURES`, the floor maps with committed canvas
  snapshots (main floors, the Crystal and Gnoll mines, the Imp Vault), and
  the names the app gives their map buttons and dialogs.
  `unit/map-fixtures.test.ts` checks the registry under `bun test`
  (`bun run test` from the repository root runs it).
- `map-dialog.ts`: `analyzeSeed(page, typed, seed)` with the real engine,
  `openMap(page, level)`, and pan, zoom and hover helpers that read the
  stage's `data-zoom`, `data-pan-x` and `data-pan-y`.

## First-time setup

From the repository root:

```bash
bun install
bun run build:wasm
bun run install:visual-browser
```

## Run

```bash
bun run test:visual        # build every workspace, then run the tests
bun run test:visual:only   # run against the current web-v2/dist
```

Playwright starts and stops the preview server itself. Failures write the
actual and expected images, the pixel diff and a trace to
`tooling/web-visual/test-results/` (gitignored).

## Update snapshots on purpose

After reviewing a deliberate rendering change:

```bash
bun run test:visual:update
git diff -- tooling/web-visual/snapshots
```

Review snapshot updates as binary artifacts. Do not use them to hide
unexpected differences.
