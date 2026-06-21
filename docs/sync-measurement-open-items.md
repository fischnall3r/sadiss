# Sync Measurement — Open Items & Things to Remember

Status notes for the instrumentation build (docs/sync-replacement-plan.md §6.1).
Not blocking; things to confirm or revisit before/around the first rehearsal.

## Test fleet vs performance scale (important)

- **Performance scale: ~50 devices, ~15 min.** This is what a real show runs.
- **Test fleet: 6 devices MAXIMUM — 3 Android + 3 iPhone.** There is no
  50-phone rehearsal, ever. We cannot reproduce performance scale in a test.

Implications:

- **The worst-device / 4G-tail problem at 50 devices cannot be reproduced in a
  test.** Six phones won't surface it. Don't expect a rehearsal to prove
  large-scale accuracy.
- **The only way to get genuine 50-device data is to ride along in a real
  performance.** Because the instrumentation is additive (MCorp still drives
  playback), the instrumentation build can be shipped and left recording during
  an actual show with zero risk — capturing true-scale data for free. This,
  not a rehearsal, is the source of large-scale truth.

## Staged test runs (≤6 devices)

1. **Small Android run (~3 phones, Linux build, no MacBook).** Pipeline
   validation only: `measureSample`s arrive server-side, JSONL files are written
   and retrievable, timestamps are sane (`serverRecv/serverSend` between `t0` and
   `t3`), `ctxTime` populates once audio starts. Draw no accuracy conclusions.
2. **Add the 3 iPhones (needs the iOS/MacBook build).** Now you can compare
   Android vs iOS behaviour and the MCorp-vs-new clock divergence across both
   platforms — still only 6 devices, so still not large-scale accuracy.
3. **Real performance (~50 devices).** Instrumentation rides along; this is the
   only true-scale dataset.

## Before a live rehearsal

- **Confirm ping load is comfortable.** Server config defaults to `enabled`
  with a **3000 ms** ping cadence. Trivial at 6 test phones; the only time it
  matters is when the instrumentation rides along a real ~50-device show
  (~17 tiny ping/pong round trips per second plus one `measureSample` upload
  each — still tiny next to chunk delivery, but confirm before that show).
  Tunable without a rebuild via env: `MEASUREMENT_ENABLED`,
  `MEASUREMENT_INTERVAL_MS`, and at runtime via `measurementService.setConfig`.
- **Where data lands:** raw samples are written as JSONL, one file per
  performance, under `MEASUREMENTS_DIR` (default `measurements/`, gitignored).
  Make sure that directory is writable/persisted on the deployment, and that
  there's a way to retrieve the files after the rehearsal.
- **Runtime round trip is not yet validated end to end.** The protocol is
  unit- and integration-tested (server WS round trip + pure controller) and all
  glue typechecks, but no real device has completed a live round trip yet — that
  validation *is* the rehearsal. Watch the first run for: samples actually
  arriving server-side, sane `serverRecv/serverSend` vs `t0/t3`, and `ctxTime`
  being populated (it's −1 until the AudioContext starts).

## Safety / scope reminders

- This is **additive instrumentation only**. MCorp still drives playback;
  nothing here changes or risks the live sync. Removing MCorp is a later,
  separate step that needs the second (cutover) app rebuild.
- The instrumentation app build is the **first** of the planned two rebuilds.
  iOS needs the MacBook/Xcode; Android builds on Linux.

## Toolchain debt surfaced (not caused by this work)

Moving to a modern machine (Node 24, Ubuntu 24.04/OpenSSL 3) surfaced pre-existing
breakage that was fixed where it blocked tests, and noted where it didn't:

- Server: bumped `mongodb-memory-server` 8→11 + pinned MongoDB 7.0.14;
  `skipLibCheck: true`. Two pre-existing `tsc` errors remain and were left alone:
  `req.user.id` in `middlewares/validatePerformanceAccess.ts` and
  `validateTrackAccess.ts` (passport `User` type lacks the mongoose `id` virtual).
- App: renamed `jest.config.js`/`babel.config.js` to `.cjs` (ESM conflict with
  `"type": "module"`), and added undeclared dev deps (`@vue/cli-plugin-unit-jest`,
  `@vue/cli-plugin-babel`, `@pinia/testing`).
- Bigger picture: this codebase's toolchain deserves a dedicated modernization
  pass (separate from the MCorp work).

## Next (from the plan)

1. **Small Android run (~3 phones, Linux build)** → validate the pipeline
   end-to-end.
2. **Add the 3 iPhones (iOS/MacBook build)** → 6-device cross-platform
   comparison (Android vs iOS, MCorp-vs-new divergence). Still not large scale.
3. **Ride along a real ~50-device performance** → the only genuine large-scale
   dataset (safe, since instrumentation is additive).
4. §6.2: build and A/B the offset+skew estimator **offline** against the
   recordings — no phones, no further rebuild.
5. Cutover build only once the data supports a replacement within budget,
   including reasoning about the 4G tail that 6 test phones can't show.
