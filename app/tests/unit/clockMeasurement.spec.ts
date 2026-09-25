import { MeasureMessage } from '@/types/measurement'

vi.mock('@/composables/usePlayer', () => ({
  usePlayer: () => ({ setMotionRef: () => {} })
}))

const configuredEvery = (intervalMs: number) => ({ message: 'measureConfig', config: { intervalMs } })

describe('clock sync across connections', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('pings only over the newest connection, once per interval', async () => {
    const { useClockMeasurement } = await import('@/composables/useClockMeasurement')
    const measurement = useClockMeasurement()
    const first: MeasureMessage[] = []
    const second: MeasureMessage[] = []

    measurement.start((message) => first.push(message))
    measurement.handleMessage(configuredEvery(3000))
    measurement.start((message) => second.push(message))
    measurement.handleMessage(configuredEvery(3000))

    vi.advanceTimersByTime(3000)

    expect(first).toHaveLength(0)
    expect(second).toHaveLength(1)
  })
})
