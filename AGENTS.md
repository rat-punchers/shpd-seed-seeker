# Agent guidance

## CI test budget

Cap seed equivalence and randomized matcher differential tests at 1,024 seeds/cases.
Keep smaller samples small, retain known positive and negative cases, and reuse
generated worlds across query combinations where possible. Large calibration
and exhaustive sweeps must stay opt-in (`#[ignore]`, run with `--release`).

The test profile optimizes `shpd-seedfinder-core` while retaining debug assertions
and overflow checks. Keep that setting: complex query tests can take minutes in
an unoptimized build even when they generate only one seed.

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

## Rust toolchain drift

CI installs unpinned Rust `stable` and runs clippy with `-D warnings`, so a
new Rust release can turn main red with no code change. Check the clippy
version in the CI log, then reproduce locally:

```sh
rustup toolchain install <ver> --profile minimal -c clippy
cargo +<ver> clippy --locked --workspace --exclude shpd-seedfinder-gtk --all-targets -- -D warnings
```

Keep fixes compiling on the workspace MSRV (`rust-version` in `Cargo.toml`,
currently 1.85). The GTK crate in `linux/` sets its own, higher MSRV.

## PGO profiles

A rustc upgrade can invalidate part of `pgo/*.profdata`. The `-Cprofile-use`
build then warns `function control flow change detected (hash mismatch)`.
Nothing in CI checks for this. When you see the warning, re-record the profile
with `scripts/record-pgo-profile.sh`.

## macOS app screenshots

To screenshot the app headlessly, find its window id with
`CGWindowListCopyWindowInfo` and run `screencapture -x -o -l <id>`. Match the
window on pid, because the user's release app may also be running.

The debug binary's defaults domain is `SeedSeeker`. The release app's is
`dev.seedseeker.mac`.

A fresh worktree needs `scripts/build-macos-native.sh` first. It builds the
engine and generates `engine_revision.h`.

For menus or seed-specific states, add a temporary env-gated hook. Commit the
real work before you revert the hook.

## iOS tint

Inside a `fullScreenCover`, `Color.accentColor` is system blue, because the
cover starts outside the app's tint. Use `AppTheme.accent`, and set
`.tint(AppTheme.accent)` on the cover's root view.

## Reading SHPD constants

`tooling/oracle-4.0/build.sh` downloads the pinned SHPD desktop JAR into
`tooling/oracle-4.0/.work/`. To read a constant, unzip the `.class` files from
that JAR and run `javap -p -c` on them.

Match probabilities at depth 24 can round to exactly 1.0 in f64. Pin
probability ordering tests at a shallow depth.
