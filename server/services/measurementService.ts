import { MeasureMessage, MeasureSampleMessage, MeasureConfigMessage, MeasurementConfig, MeasurementRecord } from '../types'
import { TraceRecorder } from '../lib/traceRecorder'

/** Source of the server's wall-clock time, injected so tests can be deterministic. */
export interface Clock {
  now(): number
}

export const systemClock: Clock = { now: () => Date.now() }

/** The connection fields the service needs — satisfied by SadissWebSocket. */
export interface MeasurementClient {
  id: string
  choirId: number
  performanceId: { toString(): string }
  send(data: string): void
}

export interface MeasurementServiceDeps {
  clock: Clock
  recorder: TraceRecorder
  config: MeasurementConfig
}

export interface MeasurementService {
  /** Answer a client's `measure` ping, stamping it with the server clock. */
  handleMeasure(client: MeasurementClient, message: MeasureMessage): void
  /** Persist an assembled sample, enriched with connection context. */
  handleMeasureSample(client: MeasurementClient, message: MeasureSampleMessage): Promise<void>
  /** The active config wrapped as a server→client message. */
  buildConfigMessage(): MeasureConfigMessage
  /** Replace the active config at runtime (tunable without an app rebuild). */
  setConfig(config: MeasurementConfig): void
}

/**
 * Records raw clock-sync measurements from devices. It performs no estimation,
 * filtering or drift modelling — it only completes the round-trip protocol and
 * hands raw, context-enriched samples to a recorder for offline replay.
 */
export const createMeasurementService = ({ clock, recorder, config }: MeasurementServiceDeps): MeasurementService => {
  let activeConfig = config

  return {
    handleMeasure(client, message) {
      const serverRecv = clock.now()
      const response = {
        message: 'measureResponse' as const,
        t0: message.t0,
        serverRecv,
        serverSend: clock.now()
      }
      client.send(JSON.stringify(response))
    },

    async handleMeasureSample(client, message) {
      if (!activeConfig.enabled) return

      const record: MeasurementRecord = {
        ...message.sample,
        clientId: client.id,
        choirId: client.choirId,
        performanceId: client.performanceId.toString(),
        recordedAt: clock.now()
      }
      await recorder.record(record)
    },

    buildConfigMessage() {
      return { message: 'measureConfig', config: activeConfig }
    },

    setConfig(config) {
      activeConfig = config
    }
  }
}
