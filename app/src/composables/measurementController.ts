import {
  DeviceSignals,
  InboundMeasurementMessage,
  MeasurementConfig,
  MeasurementSample,
  MeasureMessage,
  MeasureResponseMessage,
  MeasureSampleMessage
} from '@/types/measurement'

/**
 * Dependencies the controller needs, all injected so the logic stays pure and
 * framework-agnostic (and unit-testable without a socket, audio context, or timers).
 */
export interface MeasurementControllerDeps {
  /** Local clock in milliseconds (e.g. performance.now()). */
  now(): number
  /** Send an assembled protocol message to the server. */
  send(message: MeasureMessage | MeasureSampleMessage): void
  /** Read the device's clock signals at this instant. */
  readSignals(): DeviceSignals
}

export interface MeasurementController {
  /** Apply a new measurement configuration. */
  setConfig(config: MeasurementConfig): void
  isEnabled(): boolean
  getIntervalMs(): number
  /** Send one measurement ping (no-op while disabled). */
  ping(): void
  /** React to an inbound measurement message (config update or server response). */
  handleMessage(message: InboundMeasurementMessage): void
}

/**
 * Narrows an arbitrary parsed socket payload to a measurement message at the
 * untyped boundary, so the rest of the code works with precise types and no casts.
 */
export const isInboundMeasurementMessage = (payload: { message?: unknown }): payload is InboundMeasurementMessage =>
  payload.message === 'measureConfig' || payload.message === 'measureResponse'

const assembleSample = (response: MeasureResponseMessage, t3: number, signals: DeviceSignals): MeasurementSample => ({
  t0: response.t0,
  serverRecv: response.serverRecv,
  serverSend: response.serverSend,
  t3,
  ...signals
})

/**
 * Drives the device side of the measurement protocol: pings on demand and
 * answers each server response with an assembled raw sample. It performs no
 * estimation — it only forwards timestamps and local clock signals. Cadence and
 * enablement come from the server via `measureConfig`, so behaviour is tunable
 * without an app rebuild. See docs/sync-replacement-plan.md (§6.1).
 */
export const createMeasurementController = ({ now, send, readSignals }: MeasurementControllerDeps): MeasurementController => {
  let config: MeasurementConfig = { enabled: false, intervalMs: 0 }

  return {
    setConfig(next) {
      config = next
    },

    isEnabled() {
      return config.enabled
    },

    getIntervalMs() {
      return config.intervalMs
    },

    ping() {
      if (!config.enabled) return
      send({ message: 'measure', t0: now() })
    },

    handleMessage(message) {
      if (message.message === 'measureConfig') {
        config = message.config
        return
      }

      if (message.message === 'measureResponse') {
        if (!config.enabled) return
        const t3 = now()
        send({ message: 'measureSample', sample: assembleSample(message, t3, readSignals()) })
      }
    }
  }
}
