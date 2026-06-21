# Replacing MCorp Sync — Plan

Status: **draft / proposal** · Last updated: 2026-06-21

## 1. Why

Time synchronization across devices is the single most critical, make-or-break part
of SADISS. Today it is provided by **MCorp** (Motion Corporation), a hosted online
timing service. We want to stop depending on a third party and own the sync stack
ourselves — without regressing accuracy.

This document is the agreed approach. It is deliberately conservative: sync has
already cost multiple failed attempts, so the plan is **measure first, prove in
parallel, cut over only on the data.**

## 2. How MCorp works today

MCorp is a **client–server protocol**, not a pure backend service. Two halves:

1. **MCorp's cloud** — a shared reference clock, the same value for every device.
2. **`mcorp-2.0.js` on each phone** — loaded from MCorp's CDN
   ([app/index.html:42](../app/index.html#L42)). This library pings MCorp's server,
   measures round-trip time, estimates *this device's* clock skew, and exposes the
   result as `mCorpApp.motions['shared']` — an object with a `.pos` property (seconds)
   that reads the same wall-clock value on every device, drift-corrected continuously.

The skew estimate is intrinsically on-device: only the phone can measure its own
clock. No timing service can be purely server-side.

### How little of MCorp we actually use

Despite the full Timing Object model (position/velocity/acceleration, shared
play/pause/seek), SADISS uses MCorp as **a free-running shared wall clock only**.
The entire integration is:

- [app/src/composables/useMCorp.ts](../app/src/composables/useMCorp.ts) — inits MCorp,
  passes `motions['shared']` into the player via `setMotionRef`.
- [app/src/composables/usePlayer.ts](../app/src/composables/usePlayer.ts):
  - `let motion = reactive({ pos: -1 })` — the shared motion (line 11)
  - `setMotionRef(ref)` — injects it (line 196)
  - `setOffset() => offset = motion.pos - ctx.currentTime` (line 198) — **the only
    line that reads MCorp.** Called at audio-context start (line 46) and on every
    chunk (line 73).
  - `setStartTime(t) => startTimeInCtxTime = t - offset` (line 173) — converts the
    server's scheduled chunk time into local Web-Audio time.

The server ([server/activePerformance.ts](../server/activePerformance.ts)) already
drives all scheduling: it sends 1-second chunks stamped with a `startTime` ~2 s in
the future. MCorp's only job is to make `startTime - offset` mean the same instant on
every device.

**Conclusion:** we depend on MCorp for exactly one thing — *"what time is it, agreed
across all devices?"* — and we already run a server every device connects to.

## 3. Constraints (field-tested, non-negotiable)

- **Scale:** ~50 devices, ~15 minutes per track.
- **Network:** mixed — some WiFi, some cellular (4G). This is the **internet-routed**
  regime. No LAN-only shortcuts. 4G adds jitter and, worse, **path asymmetry**
  (uplink ≠ downlink latency), which *biases* offset estimates.
- **One-shot sync at start is disqualified — tested and failed multiple times.**
  Phone/`AudioContext` clocks drift ~10–50 ppm; at 30 ppm over 15 min that is ~27 ms
  of accumulated error, exceeding MCorp's ~20 ms budget. **Continuous re-estimation,
  modeling clock *rate* (skew), is mandatory** — not a single offset.
- **Worst device defines success, not the average.** With 50 phones the failure mode
  is the unluckiest device on the flakiest connection. Filtering must be tuned for the
  tail, not the mean.
- **Minimize app changes.** Re-shipping the mobile app is tedious (no OTA — see §6).

## 4. Why zero device changes is impossible

The on-device half of sync *is* `mcorp-2.0.js` today. The final step —
`offset = sharedTime - ctx.currentTime` — needs `ctx.currentTime`, which only exists
on the phone. To stop depending on MCorp we must replace its on-device library with
our own thin client. Even the most minimal version changes what runs on the phone.
There is no way to drop MCorp while leaving the device bit-for-bit identical.

The app has **no over-the-air update path** (`capacitor.config.ts`:
`webDir: 'dist'`, no live-update / Appflow / Capgo dependency), so the one change
requires a native rebuild + release. We therefore make that **one** change count
(§5) and never touch the app for sync again.

## 5. Proposed architecture: dumb phone, smart server

Split the work so the app holds only trivial, stable plumbing and all the brittle,
iteration-heavy logic lives on our server (where we redeploy freely).

| Piece | Today | After |
| --- | --- | --- |
| Reference clock | MCorp cloud | **SADISS server** |
| Skew/offset estimation, filtering, drift modeling | `mcorp-2.0.js` on phone | **SADISS server** |
| Local clock read + apply correction | on phone | on phone (unavoidable) |

### On-device (the one-time app change — kept as small as possible)

- Delete the `mcorp-2.0.js` `<script>` ([app/index.html:42](../app/index.html#L42)),
  the `VITE_APP_MCORP_API_KEY`, and
  [useMCorp.ts](../app/src/composables/useMCorp.ts).
- Add a tiny `useServerClock` composable that:
  1. Exchanges timestamped ping/pongs with the SADISS server over the **existing
     WebSocket** ([useWebsocketConnection.ts](../app/src/composables/useWebsocketConnection.ts)).
  2. Receives `offset` + `skew` from the server and exposes a **`{ get pos() }`**
     object: `serverTimeSeconds = (localClock + offset + skew * elapsed)`.
  3. Injects it via the **existing** `setMotionRef(...)`.
- **[usePlayer.ts](../app/src/composables/usePlayer.ts) is untouched.** It keeps
  reading `motion.pos`; we just swap what `pos` returns. `setOffset()` re-reading
  `motion.pos` each chunk continues to work because `pos` is now itself
  continuously drift-corrected.
- Contains **no** filtering / estimation logic — only ping/pong transport and a
  linear `offset + skew·t` evaluation. That part rarely changes.

### Server-side (where the real engineering lives, freely iterable)

- A clock endpoint over the existing WS: replies to each ping with its receive/send
  timestamps so the round trip can be measured.
- Per-device estimator: collect samples, **select lowest-RTT** (most symmetric, best
  on 4G), reject outliers, fit **offset + skew** (a line, not a point), update
  continuously every few seconds. Return offset+skew to the device; the device
  coasts on skew between updates.
- Candidate to avoid re-deriving the filter: **[`timesync`](https://github.com/enmasseio/timesync)**
  (MIT, NTP-style, multi-sample filtering, WS transport). Alternative for a full
  open Timing Object provider: **[tidoust/timingservice](https://github.com/tidoust/timingservice)**
  (heavier; we don't need the full model). Hand-rolling is viable — but the filter,
  not the handshake, is the deliverable.

### Units / gotchas

- `motion.pos` is in **seconds** (subtracted from `ctx.currentTime`). `serverNow()`
  must be seconds too.
- Correction must be **slewed, not snapped** — never step the clock mid-note; apply
  offset+skew smoothly so scheduling doesn't hiccup.
- Real precision ceiling also includes `outputLatencyOffset` and per-device audio
  output latency (the [OffsetCalibrationPage](../app/src/views/OffsetCalibrationPage.vue)
  calibration). Even a perfect clock leaves hardware-latency differences between
  devices — keep that calibration.
- The **admin client** also uses MCorp
  ([admin_client/src/composables/useMCorp.ts](../admin_client/src/composables/useMCorp.ts));
  migrate it the same way.

## 6. Build order: instrument once, iterate offline, rebuild as little as possible

The scarcest resource is the **app rebuild** — iOS requires the MacBook/Xcode, and
shipping to devices is slow. So we do **not** build candidate-clock-X into the app.
Instead the very first (and ideally *only* pre-cutover) app build is a **generic,
server-configurable measurement client** that records everything we could need in one
go. All algorithm design then happens **on the server / offline against recorded
data**, with no further rebuilds until the final cutover.

This means exactly **two** app rebuilds for the whole project, in the best case:

1. The **instrumentation build** (measure everything).
2. The **cutover build** (MCorp removed, proven clock in).

### 6.1 The instrumentation build — capture everything, decide nothing

Design it as a dumb recorder + raw-data uplink, *not* as a sync implementation:

- **Record raw, timestamped traces per device** and stream them to the server (or
  buffer + upload), so the full performance can be **replayed offline**:
  - every ping/pong sample: `t0_local`, `t_server_recv`, `t_server_send`, `t3_local`
    (→ RTT + raw offset, the inputs every estimator needs)
  - `MCorp motion.pos` sampled alongside `ctx.currentTime` (the current baseline)
  - `ctx.currentTime`, `ctx.outputLatency`/`baseLatency`, `performance.now()`
  - device metadata: model, OS/version, `outputLatencyOffset` calibration value
  - coarse network type (wifi/cellular) if cheaply available
- **Take no algorithmic decisions on-device.** No filtering, no skew fit — just emit
  raw samples. The estimator is developed later, server-side, against these traces.
- **Make on-device behavior server-configurable** so we never rebuild to change it:
  ping cadence, sample burst size, which signals to log, and whether the applied
  clock follows MCorp or the server estimate — all pushed from the server over the
  existing WS. One build, many experiments.
- **Keep MCorp live and in control of playback.** The instrumentation rides
  alongside; the performance still runs on MCorp. Zero risk to the show.

The payoff: after **one** instrumented rehearsal we own a real
50-device / 15-min / mixed-WiFi-4G dataset. Every estimator, filter, and slewing
strategy can then be built and A/B'd **offline by replaying that dataset** — no
phones, no MacBook, no rebuild.

### 6.2 Offline: design and prove the estimator against the recording

- Replay the raw traces through candidate estimators (lowest-RTT selection, outlier
  rejection, offset+skew fit, slewing) and compute, per device, what the synced clock
  *would* have been vs. MCorp — across the full 15 minutes, including the 4G tail.
- This is where the real engineering and iteration happen, at zero rebuild cost.
- Optionally validate the chosen estimator **live but still non-destructively** by
  flipping the server-config flag so the instrumentation build *computes* the new
  clock and logs `mcorpClock − serverClock`, while MCorp still drives playback.

### 6.3 Cutover — only on the data

If the chosen estimator tracks MCorp within budget across **all** devices on the
recording (and the optional live check), do the second rebuild: remove MCorp (script
tag, API key, [useMCorp.ts](../app/src/composables/useMCorp.ts)), point the player at
the server clock via the existing `setMotionRef`, ship. If the tail diverges, we
found it in the data — not on stage.

## 7. Risks & open questions

- **4G asymmetry bias** — no amount of averaging removes a systematic offset;
  lowest-RTT selection is the main mitigation. Verify on real cellular.
- **Long-run drift** — only visible at minute 8–15; never trust short bench tests.
- **Correction discontinuities** — must slew, not snap (§5 gotchas).
- **Filter quality vs MCorp** — MCorp's maturity is in the filter. If a simple
  estimator drifts, escalate to `timesync`'s filtering or a median/Kalman filter on
  samples before considering it a dead end.
- **Open:** what real-world accuracy does MCorp currently give us? (Answered by
  step 1.) Co-location is *not* assumed — mixed WiFi/4G means internet-routed.

## 8. Next deliverable

The **instrumentation build** (§6.1) — the one thing that must run on real devices
before anything else, designed so it's the *only* pre-cutover rebuild:

- **Server:** a clock/ping endpoint over the existing WS that echoes receive/send
  timestamps, plus a sink that records each device's raw trace for offline replay.
- **App (one rebuild):** a thin recorder that pings, samples MCorp `pos` +
  `ctx.currentTime` + audio-latency + device/network metadata, and streams raw
  samples up — **no estimation logic**, all cadence/behavior server-configurable.
- **Keep MCorp driving playback.** Non-destructive; the show still runs on MCorp.

Everything after this — estimator, filtering, slewing, A/B — is built **offline
against the recorded dataset** (§6.2), needing no phones and no further rebuild until
cutover. Server and web work happen on Linux; the MacBook is only needed for the
iOS build of this instrumentation app (Android builds on Linux).
