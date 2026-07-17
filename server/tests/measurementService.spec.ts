import { createMeasurementService } from '../services/measurementService'
import { MeasurementConfig } from '../types'

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

const defaultConfig: MeasurementConfig = { intervalMs: 3000 }

describe('measurementService', () => {
  describe('handleMeasure', () => {
    it('responds with the ping echoed and stamped by the server clock', () => {
      const service = createMeasurementService({ clock: fakeClock([100, 101]), config: defaultConfig })
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

    it('always answers: the round trip is the shared clock, so it has no off switch', () => {
      const service = createMeasurementService({ clock: fakeClock([1, 2]), config: { intervalMs: 0 } })
      const client = fakeClient()

      service.handleMeasure(client, { message: 'measure', t0: 9 })

      expect(client.send).toHaveBeenCalledTimes(1)
    })
  })

  describe('config', () => {
    it('exposes the active config as a pushable message', () => {
      const service = createMeasurementService({ clock: fakeClock([0]), config: defaultConfig })

      expect(service.buildConfigMessage()).toEqual({ message: 'measureConfig', config: defaultConfig })
    })

    it('can be reconfigured at runtime without rebuilding the service', () => {
      const service = createMeasurementService({ clock: fakeClock([0]), config: defaultConfig })

      service.setConfig({ intervalMs: 5000 })

      expect(service.buildConfigMessage()).toEqual({
        message: 'measureConfig',
        config: { intervalMs: 5000 }
      })
    })
  })
})
