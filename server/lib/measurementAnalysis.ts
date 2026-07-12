/**
 * Offline analysis of recorded clock-sync measurements
 * (docs/sync-replacement-plan.md §6.2). Given raw samples, derive our own server
 * clock via the NTP four-timestamp method and compare it against MCorp's shared
 * clock — to see how closely a self-hosted clock would track MCorp, and how much
 * RTT filtering helps. No devices needed: this runs against a recording.
 *
 * Clocks involved per sample:
 *   t0/t3        client `performance.now()` (ms, relative)
 *   serverRecv/serverSend  server `Date.now()` (ms, epoch)
 *   motionPos    MCorp shared clock (s)
 *   ctxTime      AudioContext clock (s)
 */

/** The timing fields analysis needs from a recorded sample. */
export interface RawSample {
  t0: number
  serverRecv: number
  serverSend: number
  t3: number
  perfNow?: number
  motionPos: number
  ctxTime: number
}

export interface AnalyzedSample {
  /** Round-trip time (ms), excluding server processing. */
  rtt: number
  /** NTP offset (ms): server clock minus client performance.now. */
  ntpOffset: number
  /** Our candidate shared clock at read time (s, server epoch). */
  serverSharedTime: number
  /** MCorp's shared clock at read time (s). */
  mcorpSharedTime: number
  /** serverSharedTime - mcorpSharedTime (s); a constant epoch gap plus disagreement. */
  divergence: number
}

/** Derive RTT, NTP offset and both shared-clock values for one sample. */
export const analyzeSample = (s: RawSample): AnalyzedSample => {
  const rtt = s.t3 - s.t0 - (s.serverSend - s.serverRecv)
  const ntpOffset = (s.serverRecv - s.t0 + (s.serverSend - s.t3)) / 2
  const clientAtRead = s.perfNow ?? s.t3
  const serverSharedTime = (clientAtRead + ntpOffset) / 1000
  const mcorpSharedTime = s.motionPos
  return { rtt, ntpOffset, serverSharedTime, mcorpSharedTime, divergence: serverSharedTime - mcorpSharedTime }
}

export interface DivergenceSummary {
  count: number
  /** Mean divergence (s) — dominated by the constant epoch gap between the clocks. */
  meanDivergenceSec: number
  /** Std of the divergence residual (ms) — the real disagreement, once the gap is removed. */
  stdResidualMs: number
  /** Worst-case residual (ms). */
  maxResidualMs: number
}

/**
 * The two clocks sit on different epochs, so their divergence has a large
 * constant offset. Removing the mean leaves the residual — how much our server
 * clock and MCorp actually *disagree* over the recording. That residual is the
 * accuracy signal.
 */
export const summarize = (analyzed: AnalyzedSample[]): DivergenceSummary => {
  const n = analyzed.length
  if (!n) return { count: 0, meanDivergenceSec: 0, stdResidualMs: 0, maxResidualMs: 0 }

  const mean = analyzed.reduce((acc, s) => acc + s.divergence, 0) / n
  const residualsMs = analyzed.map((s) => (s.divergence - mean) * 1000)
  const variance = residualsMs.reduce((acc, r) => acc + r * r, 0) / n

  return {
    count: n,
    meanDivergenceSec: mean,
    stdResidualMs: Math.sqrt(variance),
    maxResidualMs: Math.max(...residualsMs.map(Math.abs))
  }
}

/**
 * Drift between the two clocks, as the linear slope of divergence over time
 * (ms per minute). Near-zero means an offset-only model suffices; a large value
 * means a skew (rate) term is needed. Uses serverSharedTime as the time axis.
 */
export const driftSlopeMsPerMin = (analyzed: AnalyzedSample[]): number => {
  const n = analyzed.length
  if (n < 2) return 0
  const xs = analyzed.map((a) => a.serverSharedTime) // seconds
  const ys = analyzed.map((a) => a.divergence) // seconds
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return 0
  return (num / den) * 60000 // (s/s) -> ms per minute
}

/**
 * Keep the lowest-RTT `keepFraction` of samples. On 4G the fastest round trips
 * are the least asymmetric, so filtering by RTT is the main tool for trimming
 * offset-estimate noise (and bias). Always keeps at least one sample.
 */
export const filterByRtt = (analyzed: AnalyzedSample[], keepFraction: number): AnalyzedSample[] => {
  const sorted = [...analyzed].sort((a, b) => a.rtt - b.rtt)
  const keep = Math.max(1, Math.floor(sorted.length * keepFraction))
  return sorted.slice(0, keep)
}
