/**
 * Device side of the clock-synchronization protocol. Mirrors the server
 * contracts in server/types/Measurement.ts. The device derives the shared clock
 * from each round trip; the server only stamps and echoes.
 */

/** Server-pushed clock-sync behaviour (cadence). */
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

/** Any inbound message the controller may receive over the socket. */
export type InboundMeasurementMessage = MeasureResponseMessage | MeasureConfigMessage
