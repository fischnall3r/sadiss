# Sync Measurement — Open Items & Things to Remember

Status notes for the instrumentation build (docs/sync-replacement-plan.md §6.1).
Not blocking; things to confirm or revisit before/around the first rehearsal.

## Rehearsals are staged: small Android run first

The first rehearsal is **~3 Android phones**, not the full 50. Android builds on
Linux (no MacBook/Xcode needed), so getting a new app version onto a few Android
devices is the fast path. Treat this as a **pipeline-validation run**, not an
accuracy measurement:

- Goal: prove the end-to-end data flow on real devices — `measureSample`s
  actually arrive server-side, the JSONL files are written and retrievable,
  timestamps are sane (`serverRecv/serverSend` between `t0` and `t3`), and
  `ctxTime` populates once audio starts.
- 3 devices will **not** surface the worst-device / 4G-tail problem (that's the
  whole point of the eventual 50-device run) — don't draw accuracy conclusions
  from it. It de-risks the plumbing cheaply before committing to the big run and
  the iOS build.

Only later: the full **50-device / 15-min / mixed WiFi+4G** rehearsal (needs the
iOS build too) for the real accuracy dataset.

## Before a live rehearsal

- **Confirm ping load is comfortable.** Server config defaults to `enabled`
  with a **3000 ms** ping cadence. Trivial at 3 phones; confirm before the
  larger ~50-device run (~17 tiny ping/pong round trips per second plus one
  `measureSample` upload each). Tunable without a rebuild via env:
  `MEASUREMENT_ENABLED`, `MEASUREMENT_INTERVAL_MS`, and at runtime via
  `measurementService.setConfig`.
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
2. Full **50-device / 15-min / WiFi+4G** rehearsal (incl. iOS build) → the real
   accuracy dataset.
3. §6.2: build and A/B the offset+skew estimator **offline** against that
   recording — no phones, no further rebuild.
4. Cutover build only once the data proves a replacement within budget across all
   devices including the 4G tail.
