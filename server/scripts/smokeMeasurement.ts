/**
 * Local end-to-end smoke test for the clock-sync measurement pipeline. No
 * devices, no Mongo: it boots
 * the WebSocket server, drives one client through the full protocol
 * (clientInfo -> measureConfig -> measure -> measureResponse -> measureSample),
 * and verifies a JSONL record is written with sane fields.
 *
 * Run: npx ts-node --transpile-only scripts/smokeMeasurement.ts
 */
import fs from 'fs'
import path from 'path'
import WebSocket from 'ws'
import { startWebSocketServer } from '../services/webSocketService'

const MEAS_DIR = process.env.MEASUREMENTS_DIR || 'measurements'
const PERF_ID = 'smoke-perf-1'
const file = path.join(MEAS_DIR, `measurements-${PERF_ID}.jsonl`)

// Start clean so we only see this run's record.
fs.rmSync(file, { force: true })

const wss = startWebSocketServer(0)
const port = (wss.address() as WebSocket.AddressInfo).port
const ws = new WebSocket(`ws://localhost:${port}/`)

let done = false
const finish = (code: number, message: string) => {
  if (done) return
  done = true
  console.log(message)
  ws.close()
  wss.close()
  process.exit(code)
}

const timeout = setTimeout(() => finish(1, 'TIMEOUT: no sample recorded within 8s'), 8000)
timeout.unref?.()

ws.on('open', () => {
  console.log(`→ clientInfo (performanceId=${PERF_ID})`)
  ws.send(JSON.stringify({ message: 'clientInfo', clientId: 0, ttsLang: { iso: 'en-US', lang: 'English' }, performanceId: PERF_ID }))
})

ws.on('message', (data) => {
  let msg: { message?: string; [k: string]: unknown }
  try {
    msg = JSON.parse(data.toString())
  } catch {
    return // 'clientInfoReceived' is a plain string, not JSON
  }

  if (msg.message === 'measureConfig') {
    console.log('← measureConfig', JSON.stringify(msg.config))
    console.log('→ measure')
    ws.send(JSON.stringify({ message: 'measure', t0: Date.now() }))
  } else if (msg.message === 'measureResponse') {
    console.log('← measureResponse', JSON.stringify(msg))
    console.log('→ measureSample')
    ws.send(
      JSON.stringify({
        message: 'measureSample',
        sample: {
          t0: msg.t0,
          serverRecv: msg.serverRecv,
          serverSend: msg.serverSend,
          t3: Date.now(),
          motionPos: 123.456,
          ctxTime: 1.23,
          perfNow: 1000,
          audioOutputLatency: 0.02,
          outputLatencyOffset: 0.1
        }
      })
    )
    setTimeout(verify, 300) // let the recorder flush to disk
  }
})

const verify = () => {
  if (!fs.existsSync(file)) return finish(1, `FAIL: ${file} was not written`)
  const lines = fs.readFileSync(file, 'utf-8').trim().split('\n')
  const record = JSON.parse(lines[lines.length - 1])
  console.log('\nrecorded JSONL:\n' + JSON.stringify(record, null, 2) + '\n')

  const checks: [string, boolean][] = [
    ['performanceId matches', record.performanceId === PERF_ID],
    ['serverRecv <= serverSend', record.serverRecv <= record.serverSend],
    ['t0 <= t3', record.t0 <= record.t3],
    ['recordedAt present', typeof record.recordedAt === 'number'],
    ['device signals present', record.motionPos === 123.456 && record.ctxTime === 1.23]
  ]
  for (const [label, ok] of checks) console.log(`  ${ok ? '✓' : '✗'} ${label}`)

  finish(checks.every(([, ok]) => ok) ? 0 : 1, checks.every(([, ok]) => ok) ? '\nPASS: end-to-end measurement pipeline works' : '\nFAIL: some checks failed')
}
