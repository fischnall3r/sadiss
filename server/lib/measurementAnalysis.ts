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

export interface DeviceStats {
  clientId: string
  samples: number
  /** This device's mean server-vs-MCorp offset (s) over the window. */
  meanDivergenceSec: number
  /** This device's own residual noise (ms). */
  residualStdMs: number
}

export interface DeviceStatsWithHealth extends DeviceStats {
  /** False when this device's MCorp clock is a gross outlier (e.g. frozen during suspension). */
  mcorpHealthy: boolean
}

export interface CrossDeviceResult {
  devices: DeviceStatsWithHealth[]
  /** Devices whose MCorp clock was a gross outlier and excluded from the fleet metric. */
  outliers: number
  /** Range (max-min) of the healthy devices' offsets (ms) — the systematic fleet spread. */
  crossDeviceSpreadMs: number
  /** Std of the healthy devices' offsets (ms). */
  crossDeviceStdMs: number
}

/** Seconds a device's MCorp offset may sit from the fleet median before it's an outlier. */
const MCORP_OUTLIER_TOLERANCE_SEC = 5

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Cross-device fleet agreement. Each device recovers a shared clock via NTP to
 * the same server; MCorp is a reference synced across all of them, so each
 * device's mean server-vs-MCorp offset should be identical. The spread of those
 * offsets across devices is how far apart the phones would drift if driven off
 * the server clock — the "worst device" number that actually decides a
 * performance. Per-device stats use the lowest-RTT samples.
 *
 * Robust to a device whose MCorp clock has gone stale (frozen during background/
 * screen-off): such a device is a gross outlier from the fleet median and is
 * flagged unhealthy and excluded from the spread, rather than destroying it.
 */
export const analyzeCrossDevice = (byDevice: Map<string, AnalyzedSample[]>, keepFraction = 0.5): CrossDeviceResult => {
  const stats: DeviceStats[] = []
  for (const [clientId, samples] of byDevice) {
    const s = summarize(filterByRtt(samples, keepFraction))
    stats.push({ clientId, samples: s.count, meanDivergenceSec: s.meanDivergenceSec, residualStdMs: s.stdResidualMs })
  }

  if (!stats.length) return { devices: [], outliers: 0, crossDeviceSpreadMs: 0, crossDeviceStdMs: 0 }

  const med = median(stats.map((d) => d.meanDivergenceSec))
  const devices: DeviceStatsWithHealth[] = stats.map((d) => ({
    ...d,
    mcorpHealthy: Math.abs(d.meanDivergenceSec - med) < MCORP_OUTLIER_TOLERANCE_SEC
  }))

  const healthy = devices.filter((d) => d.mcorpHealthy).map((d) => d.meanDivergenceSec)
  const outliers = devices.length - healthy.length
  if (healthy.length < 1) return { devices, outliers, crossDeviceSpreadMs: 0, crossDeviceStdMs: 0 }

  const spread = (Math.max(...healthy) - Math.min(...healthy)) * 1000
  const mean = healthy.reduce((a, b) => a + b, 0) / healthy.length
  const std = Math.sqrt(healthy.reduce((a, c) => a + (c - mean) ** 2, 0) / healthy.length) * 1000

  return { devices, outliers, crossDeviceSpreadMs: spread, crossDeviceStdMs: std }
}
