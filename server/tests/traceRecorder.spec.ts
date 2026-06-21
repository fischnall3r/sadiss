import fs from 'fs'
import os from 'os'
import path from 'path'
import { InMemoryTraceRecorder, JsonlTraceRecorder } from '../lib/traceRecorder'
import { MeasurementRecord } from '../types'

const makeRecord = (overrides: Partial<MeasurementRecord> = {}): MeasurementRecord => ({
  t0: 1000,
  serverRecv: 1010,
  serverSend: 1011,
  t3: 1025,
  motionPos: 42.5,
  ctxTime: 12.3,
  clientId: 'client-a',
  choirId: 0,
  performanceId: 'perf-1',
  recordedAt: 1011,
  ...overrides
})

describe('InMemoryTraceRecorder', () => {
  it('keeps recorded measurements in order', async () => {
    const recorder = new InMemoryTraceRecorder()
    const first = makeRecord({ t0: 1 })
    const second = makeRecord({ t0: 2 })

    await recorder.record(first)
    await recorder.record(second)

    expect(recorder.records).toEqual([first, second])
  })
})

describe('JsonlTraceRecorder', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sadiss-trace-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('appends one JSON line per record, partitioned by performance', async () => {
    const recorder = new JsonlTraceRecorder(dir)
    const a = makeRecord({ performanceId: 'perf-1', t0: 1 })
    const b = makeRecord({ performanceId: 'perf-1', t0: 2 })

    await recorder.record(a)
    await recorder.record(b)

    const file = path.join(dir, 'measurements-perf-1.jsonl')
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n')

    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual(a)
    expect(JSON.parse(lines[1])).toEqual(b)
  })

  it('writes records for different performances to separate files', async () => {
    const recorder = new JsonlTraceRecorder(dir)

    await recorder.record(makeRecord({ performanceId: 'perf-1' }))
    await recorder.record(makeRecord({ performanceId: 'perf-2' }))

    expect(fs.existsSync(path.join(dir, 'measurements-perf-1.jsonl'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'measurements-perf-2.jsonl'))).toBe(true)
  })

  it('creates the output directory if it does not exist', async () => {
    const nested = path.join(dir, 'does', 'not', 'exist')
    const recorder = new JsonlTraceRecorder(nested)

    await recorder.record(makeRecord({ performanceId: 'perf-1' }))

    expect(fs.existsSync(path.join(nested, 'measurements-perf-1.jsonl'))).toBe(true)
  })
})
