import { createMeasurementService } from '../services/measurementService'
import { InMemoryTraceRecorder } from '../lib/traceRecorder'
import { MeasurementConfig, MeasurementSample } from '../types'

/** A clock that returns successive values from a fixed queue, for determinism. */
const fakeClock = (values: number[]) => {
  let i = 0
  return { now: () => values[Math.min(i++, values.length - 1)] }
}

const fakeClient = () => ({
  id: 'client-a',
  choirId: 3,
  performanceId: { toString: () => 'perf-1' },
  send: vi.fn()
})

const sample = (overrides: Partial<MeasurementSample> = {}): MeasurementSample => ({
  t0: 1000,
  serverRecv: 1010,
  serverSend: 1011,
  t3: 1025,
  motionPos: 42.5,
  ctxTime: 12.3,
  ...overrides
})

const defaultConfig: MeasurementConfig = { enabled: true, intervalMs: 3000 }

describe('measurementService', () => {
  describe('handleMeasure', () => {
    it('responds with the ping echoed and stamped by the server clock', () => {
      const service = createMeasurementService({
        clock: fakeClock([100, 101]),
        recorder: new InMemoryTraceRecorder(),
        config: defaultConfig
      })
      const client = fakeClient()

      service.handleMeasure(client, { message: 'measure', t0: 55 })

      expect(client.send).toHaveBeenCalledTimes(1)
      expect(JSON.parse(client.send.mock.calls[0][0])).toEqual({
        message: 'measureResponse',
        t0: 55,
        serverRecv: 100,
        serverSend: 101
      })
    })
  })

  describe('handleMeasureSample', () => {
    it('persists the sample enriched with connection context and a record timestamp', async () => {
      const recorder = new InMemoryTraceRecorder()
      const service = createMeasurementService({
        clock: fakeClock([777]),
        recorder,
        config: defaultConfig
      })

      await service.handleMeasureSample(fakeClient(), { message: 'measureSample', sample: sample() })

      expect(recorder.records).toEqual([
        {
          ...sample(),
          clientId: 'client-a',
          choirId: 3,
          performanceId: 'perf-1',
          recordedAt: 777
        }
      ])
    })

    it('does not record when measurement is disabled', async () => {
      const recorder = new InMemoryTraceRecorder()
      const service = createMeasurementService({
        clock: fakeClock([1]),
        recorder,
        config: { enabled: false, intervalMs: 3000 }
      })

      await service.handleMeasureSample(fakeClient(), { message: 'measureSample', sample: sample() })

      expect(recorder.records).toHaveLength(0)
    })
  })

  describe('config', () => {
    it('exposes the active config as a pushable message', () => {
      const service = createMeasurementService({
        clock: fakeClock([0]),
        recorder: new InMemoryTraceRecorder(),
        config: defaultConfig
      })

      expect(service.buildConfigMessage()).toEqual({ message: 'measureConfig', config: defaultConfig })
    })

    it('can be reconfigured at runtime without rebuilding the service', () => {
      const service = createMeasurementService({
        clock: fakeClock([0]),
        recorder: new InMemoryTraceRecorder(),
        config: defaultConfig
      })

      service.setConfig({ enabled: false, intervalMs: 5000 })

      expect(service.buildConfigMessage()).toEqual({
        message: 'measureConfig',
        config: { enabled: false, intervalMs: 5000 }
      })
    })
  })
})
