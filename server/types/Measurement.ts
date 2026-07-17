/**
 * Clock-synchronization protocol.
 *
 * The server is the clock authority. Every device derives the shared clock from
 * it by round-tripping over the existing WebSocket, following the classic NTP
 * four-timestamp scheme:
 *
 *   t0         client sends `measure`
 *   serverRecv server receives it          ┐ server clock
 *   serverSend server replies              ┘
 *   t3         client receives the reply
 *
 * From {t0, serverRecv, serverSend, t3} the device derives its offset from the
 * server clock and schedules audio against it. The server keeps no per-device
 * state: it only stamps and echoes. All estimation lives on the device.
 */

/**
 * Server-pushed clock-sync behaviour. Pushing it over the wire keeps the
 * device's round-trip cadence tunable without rebuilding the app.
 */
export interface MeasurementConfig {
  /** Target interval (ms) between clock-sync round trips. */
  intervalMs: number
}

/** Client → server: a clock-sync ping carrying the client send timestamp. */
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

/** Server → client: the active clock-sync configuration. */
export interface MeasureConfigMessage {
  message: 'measureConfig'
  config: MeasurementConfig
}
