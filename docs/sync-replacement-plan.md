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

## 6. Rollout: measure → parallel A/B → cut over

The whole point is to never ship a sync regression.

1. **Baseline.** Instrument the live app to log MCorp's cross-device clock spread on
   real WiFi + 4G devices during an actual performance. This number is the pass/fail
   bar — we currently don't know if MCorp gives us 5 ms or 25 ms in the field.
2. **Run in parallel.** Wire the new server clock in **alongside** MCorp (both active,
   MCorp still drives playback). Log per-device `mcorpClock − serverClock` over a
   **full 15-minute** track on real hardware — long enough for drift to appear, on
   cellular devices specifically. (Convenient: the single unavoidable app rebuild is
   already the A/B-instrumented one.)
3. **Cut over only on the data.** If the replacement tracks MCorp within budget across
   **all** devices including the 4G tail, remove MCorp (script tag, API key,
   composables) and ship. If the tail diverges, we found it in a test, not on stage.

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

The **parallel measurement harness** (step 2): server clock endpoint + estimator,
the dumb on-device `useServerClock` shim alongside MCorp, and per-device drift
logging — so the next rehearsal produces go/no-go data without risking the
performance.
