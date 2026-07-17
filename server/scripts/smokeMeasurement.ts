/**
 * Local end-to-end smoke test for clock sync. No devices, no Mongo: it boots the
 * WebSocket server and drives one client through the full protocol
 * (clientInfo -> measureConfig -> measure -> measureResponse), checking that the
 * server stamps the round trip with sane, monotonic timestamps.
 *
 * This exercises the mechanism the whole performance depends on: the round trip
 * IS the shared clock every device schedules audio against.
 *
 * Run: npx ts-node --transpile-only scripts/smokeMeasurement.ts
 */
import WebSocket from 'ws'
import { startWebSocketServer } from '../services/webSocketService'

const PORT = Number(process.env.WS_SERVER_PORT) || 40001
const PERF_ID = 'smoke-perf-1'

const fail = (msg: string): never => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

const main = async () => {
  const wss = startWebSocketServer(PORT)
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`)

  const done = new Promise<void>((resolve) => {
    ws.on('open', () => {
      console.log('→ clientInfo')
      ws.send(
        JSON.stringify({
          message: 'clientInfo',
          clientId: 0,
          ttsLang: { iso: 'en-US', lang: 'English' },
          performanceId: PERF_ID
        })
      )
    })

    ws.on('message', (data) => {
      const raw = data.toString()
      if (raw === 'clientInfoReceived') return

      const msg = JSON.parse(raw)

      if (msg.message === 'measureConfig') {
        console.log(`← measureConfig ${JSON.stringify(msg.config)}`)
        if (typeof msg.config?.intervalMs !== 'number') fail('measureConfig carried no numeric intervalMs')
        console.log('→ measure')
        ws.send(JSON.stringify({ message: 'measure', t0: Date.now() }))
        return
      }

      if (msg.message === 'measureResponse') {
        console.log(`← measureResponse ${JSON.stringify(msg)}`)
        const { t0, serverRecv, serverSend } = msg
        if (typeof serverRecv !== 'number' || typeof serverSend !== 'number') fail('response lacked server stamps')
        if (serverSend < serverRecv) fail('serverSend precedes serverRecv — the server clock ran backwards')
        if (t0 !== msg.t0) fail('the client ping timestamp was not echoed back')
        resolve()
      }
    })
  })

  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out after 5s')), 5000))

  try {
    await Promise.race([done, timeout])
    console.log('\n✓ clock-sync round trip completed with sane stamps')
  } catch (err) {
    fail(String(err))
  } finally {
    ws.close()
    wss.close()
  }
}

main()
