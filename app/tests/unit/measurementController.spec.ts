import { createMeasurementController } from '@/composables/measurementController'
import { DeviceSignals } from '@/types/measurement'

const defaultSignals: DeviceSignals = {
  motionPos: 42.5,
  ctxTime: 12.3,
  perfNow: 999,
  audioOutputLatency: 0.02,
  outputLatencyOffset: 0.1
}

/** Builds a controller with a scripted clock and captured outbound messages. */
const setup = (opts: { nowSeq?: number[]; signals?: DeviceSignals } = {}) => {
  const sent: any[] = []
  const roundTrips: any[] = []
  let tick = 0
  const nowSeq = opts.nowSeq ? [...opts.nowSeq] : null
  const controller = createMeasurementController({
    now: () => (nowSeq ? nowSeq.shift()! : ++tick),
    send: (message) => sent.push(message),
    readSignals: () => opts.signals ?? defaultSignals,
    onRoundTrip: (rt) => roundTrips.push(rt)
  })
  return { controller, sent, roundTrips }
}

describe('measurementController', () => {
  it('does not ping until enabled by config', () => {
    const { controller, sent } = setup()
    controller.ping()
    expect(sent).toHaveLength(0)
  })

  it('adopts cadence and enablement from a measureConfig message', () => {
    const { controller } = setup()
    controller.handleMessage({ message: 'measureConfig', config: { enabled: true, intervalMs: 4000 } })
    expect(controller.isEnabled()).toBe(true)
    expect(controller.getIntervalMs()).toBe(4000)
  })

  it('pings with a server-bound measure message stamped by the local clock', () => {
    const { controller, sent } = setup({ nowSeq: [500] })
    controller.handleMessage({ message: 'measureConfig', config: { enabled: true, intervalMs: 3000 } })
    controller.ping()
    expect(sent).toEqual([{ message: 'measure', t0: 500 }])
  })

  it('answers a measureResponse with an assembled measureSample', () => {
    const { controller, sent } = setup({ nowSeq: [800] }) // 800 = t3 read on response
    controller.handleMessage({ message: 'measureConfig', config: { enabled: true, intervalMs: 3000 } })

    controller.handleMessage({ message: 'measureResponse', t0: 500, serverRecv: 510, serverSend: 511 })

    expect(sent).toEqual([
      {
        message: 'measureSample',
        sample: {
          t0: 500,
          serverRecv: 510,
          serverSend: 511,
          t3: 800,
          motionPos: 42.5,
          ctxTime: 12.3,
          perfNow: 999,
          audioOutputLatency: 0.02,
          outputLatencyOffset: 0.1
        }
      }
    ])
  })

  it('reports the round trip (for the clock) when handling a measureResponse', () => {
    const { controller, roundTrips } = setup({ nowSeq: [800] }) // 800 = t3
    controller.handleMessage({ message: 'measureConfig', config: { enabled: true, intervalMs: 3000 } })

    controller.handleMessage({ message: 'measureResponse', t0: 500, serverRecv: 510, serverSend: 511 })

    expect(roundTrips).toEqual([{ t0: 500, serverRecv: 510, serverSend: 511, t3: 800 }])
  })

  it('ignores measureResponse while disabled', () => {
    const { controller, sent } = setup()
    controller.handleMessage({ message: 'measureResponse', t0: 500, serverRecv: 510, serverSend: 511 })
    expect(sent).toHaveLength(0)
  })

  it('ignores unrelated messages', () => {
    const { controller, sent } = setup()
    controller.handleMessage({ message: 'somethingElse' } as any)
    expect(sent).toHaveLength(0)
    expect(controller.isEnabled()).toBe(false)
  })
})
