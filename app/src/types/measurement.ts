/**
 * Device side of the clock-synchronization measurement protocol. Mirrors the
 * server contracts in server/types/Measurement.ts. The device only gathers and
 * forwards raw timing data — no estimation happens here.
 */

/** Local clock signals the device reads at the moment it pings (t0). */
export interface DeviceSignals {
  /** Shared clock position (seconds) at t0 — the current baseline clock. */
  motionPos: number
  /** `AudioContext.currentTime` (seconds). */
  ctxTime: number
  /** `performance.now()` (ms) — a monotonic local reference. */
  perfNow?: number
  /** `AudioContext.outputLatency` (seconds), where the platform exposes it. */
  audioOutputLatency?: number
  /** User-calibrated output latency offset (seconds), if set on the device. */
  outputLatencyOffset?: number
}

/** Timing signals for one round trip, assembled by the device and uploaded verbatim. */
export interface MeasurementSample extends DeviceSignals {
  /** Client clock (ms) when the `measure` ping was sent. */
  t0: number
  /** Server clock (ms) when it received the ping. */
  serverRecv: number
  /** Server clock (ms) when it sent the response. */
  serverSend: number
  /** Client clock (ms) when the response arrived. */
  t3: number
}

/** Server-pushed measurement behaviour (cadence/enablement). */
export interface MeasurementConfig {
  enabled: boolean
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

/** Any inbound message the controller may receive over the socket. */
export type InboundMeasurementMessage = MeasureResponseMessage | MeasureConfigMessage
