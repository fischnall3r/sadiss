/**
 * Clock-synchronization measurement protocol.
 *
 * This subsystem records raw timing data from every device so that clock-sync
 * accuracy can be analysed and replayed offline. It deliberately captures raw
 * samples only — no estimation, filtering or drift modelling happens here or on
 * the device.
 *
 * One sample is a single round trip plus the device's local clock signals,
 * following the classic NTP four-timestamp scheme:
 *
 *   t0         client sends `measure`
 *   serverRecv server receives it          ┐ server clock
 *   serverSend server replies              ┘
 *   t3         client receives the reply
 *
 * From {t0, serverRecv, serverSend, t3} the round-trip time and clock offset can
 * be derived offline; `motionPos`/`ctxTime` capture the current MCorp baseline
 * against the device audio clock at t0.
 */

/** Timing signals the device gathers for one round trip and uploads verbatim. */
export interface MeasurementSample {
  /** Client clock (ms) when the `measure` ping was sent. */
  t0: number
  /** Server clock (ms) when it received the ping. */
  serverRecv: number
  /** Server clock (ms) when it sent the response. */
  serverSend: number
  /** Client clock (ms) when the response arrived. */
  t3: number
  /** MCorp shared `motion.pos` (seconds) sampled at t0 — the current baseline clock. */
  motionPos: number
  /** `AudioContext.currentTime` (seconds) sampled at t0. */
  ctxTime: number
  /** `performance.now()` (ms) at t0 — a monotonic local reference. */
  perfNow?: number
  /** `AudioContext.outputLatency` (seconds), where the platform exposes it. */
  audioOutputLatency?: number
  /** User-calibrated output latency offset (seconds), if set on the device. */
  outputLatencyOffset?: number
}

/** A sample enriched with server-side connection context, as persisted for replay. */
export interface MeasurementRecord extends MeasurementSample {
  /** WebSocket connection id of the reporting client. */
  clientId: string
  /** Choir id the client registered with. */
  choirId: number
  /** Performance the client is connected to. */
  performanceId: string
  /** Server clock (ms) when the record was persisted — for ordering. */
  recordedAt: number
}

/**
 * Server-pushed measurement behaviour. Pushing this over the wire keeps device
 * cadence/enablement tunable without rebuilding the app.
 */
export interface MeasurementConfig {
  /** Whether devices should take measurements at all. */
  enabled: boolean
  /** Target interval (ms) between measurement round trips. */
  intervalMs: number
}

/** Client → server: a measurement ping carrying the client send timestamp. */
export interface MeasureMessage {
  message: 'measure'
  t0: number
}

/** Server → client: the ping echoed back with server clock stamps. */
export interface MeasureResponseMessage {
  message: 'measureResponse'
  t0: number
  serverRecv: number
  serverSend: number
}

/** Client → server: the assembled sample for durable recording. */
export interface MeasureSampleMessage {
  message: 'measureSample'
  sample: MeasurementSample
}

/** Server → client: the active measurement configuration. */
export interface MeasureConfigMessage {
  message: 'measureConfig'
  config: MeasurementConfig
}
