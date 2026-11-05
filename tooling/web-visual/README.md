# web-v2 browser tests

Playwright tests for `web-v2`, run in Chromium against the production build
served by `vite preview` on `127.0.0.1:46001`. The run is pinned for
reproducible pixels: UTC, `en-US`, light color scheme, reduced motion, a
1440×1200 viewport at device scale 1.

- **Canvas snapshots** compare a canvas's backing bitmap with a committed PNG
  in `snapshots/`, pixel for pixel (`maxDiffPixels: 0`, `threshold: 0`).
  Reading the bitmap avoids viewport clipping when a map is taller than its
  dialog.
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
