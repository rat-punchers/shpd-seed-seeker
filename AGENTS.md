# Agent guidance

## CI test budget

Cap seed equivalence and randomized matcher differential tests at 1,024 seeds/cases.
Keep smaller samples small, retain known positive and negative cases, and reuse
generated worlds across query combinations where possible. Large calibration
and exhaustive sweeps must stay opt-in (`#[ignore]`, run with `--release`).

The test profile optimizes `shpd-seedfinder-core` while retaining debug assertions
and overflow checks. Keep that setting: complex query tests can take minutes in
an unoptimized build even when they generate only one seed.

## web-v2 (Bun monorepo)

The repository root is a Bun workspace (isolated linker) for `web-v2`,
`packages/*`, `tooling/web-visual` and `tooling/web-deploy`. Biome formats and
lints only those workspaces and the root config files.

- Do not edit `web/`. It keeps its own Vite+ (`vp`) and pnpm setup, CI job and
  Cloudflare Pages deploy. It is not a Bun workspace and Biome ignores it.
- Commands from the repository root: `bun install`, `bun run check`
  (`check:fix` to apply fixes), `bun run check:types` (`tsc -b`, TypeScript
  native compiler), `bun run build`, `bun run test`, `bun run dev`.
- `bun run build:wasm` builds the engine and editor wasm packages and copies
  the game assets into `web-v2/` (`scripts/build-web-wasm.sh web-v2`). Run it
  before building or testing web-v2, and again after engine changes.
- `bun run dev:web-v2` and `bun run dev:design` start one dev server each.
  Do not start or leave a dev server running yourself; tell the user the
  command instead.
- Browser tests live in `tooling/web-visual` (Playwright, Chromium):
  `bun run install:visual-browser` once, then `bun run test:visual` (build +
  run) or `bun run test:visual:only`. Playwright starts and stops
  `vite preview` on 46001 itself. Canvas output is compared pixel for pixel
  with `tooling/web-visual/snapshots/`; everything else is asserted.
  `bun run test:visual:update` rewrites snapshots on purpose only.
- Deploy: the `web-v2` workflow deploys the Worker `shpd-seed-seeker-v2`
  (`web-v2/wrangler.toml`) to `seedseeker.nerdcoder.xyz` on every push to
  `main` after its checks pass. `bun run deploy:setup` stores the Cloudflare
  credentials in the GitHub `web-v2` environment. Do not run it, or deploy,
  without being asked.
- Definition of Done, in order: `bun run check` → `bun run check:types` →
  `bun run build` → `bun run test`. All four must pass. Changes to web-v2's
  UI also need `bun run test:visual`. Engine changes also need
  `cargo fmt --all -- --check`,
  `cargo clippy --workspace --exclude shpd-seedfinder-gtk --all-targets -- -D warnings`
  and `cargo test --workspace --exclude shpd-seedfinder-gtk`, then
  `bun run build:wasm` before the web checks.
- Source layout: `web-v2/README.md`. Browser test helpers:
  `tooling/web-visual/README.md`.
- TypeScript: `tsconfig.base.json` holds shared options only. Each package has
  its own composite `tsconfig.json` that includes only its own files and is
  listed in the root solution `tsconfig.json`. No cross-package `include` or
  relative import; share code through a workspace package.
- Files stay at or under 300 lines.
- Ports (block 46000+): web-v2 dev 46000, web-v2 preview 46001, design
  preview 46002.
- `seed_report` contract: `docs/seed-report-format.md` defines the format.
  Fields not yet computed are optional, and the report lists filled sections
  in `sections`; the UI renders a section only when it is listed. Adding a
  section means implementing it, adding it to `sections`, regenerating the
  fixtures in `crates/seedfinder-wasm/tests/fixtures/seed-report/`, and
  updating the doc. Renaming or removing a field bumps `schemaVersion`.
  web-v2's report tests and browser specs read those real fixtures or run the
  real engine. For a section the engine does not fill yet, a hand-made
  fixture served by `installFakeReportWorker` (`tooling/web-visual`) stands
  in until it does.

## Android Canary builds

When asked to build the Canary app, use the `dev` build variant. From the
repository root, run:

```sh
cd android
./gradlew :app:assembleDev
```

The resulting APK is `android/app/build/outputs/apk/dev/app-dev.apk` (relative
to the repository root).

Canary uses the real JNI engine with release optimizations and is signed with
the local Android debug key. Keep `~/.android/debug.keystore` stable when
building updates for an existing Canary installation. See `android/README.md`
for the required JDK, Android SDK/NDK, and Rust targets.
