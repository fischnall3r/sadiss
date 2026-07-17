import WebSocket from 'ws'
import { Types } from 'mongoose'

/** Opens a raw client socket to the test WS server. */
const connect = () =>
  new Promise<WebSocket>((resolve) => {
    const port = (global.testWss.address() as WebSocket.AddressInfo).port
    const ws = new WebSocket(`ws://localhost:${port}/`)
    ws.on('open', () => resolve(ws))
  })

/** Resolves with the first JSON message whose `message` field matches. */
const waitForMessage = (ws: WebSocket, message: string) =>
  new Promise<any>((resolve) => {
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString())
        if (parsed.message === message) resolve(parsed)
      } catch {
        /* non-JSON control messages (e.g. 'clientInfoReceived') are ignored */
      }
    })
  })

describe('webSocketService measurement wiring', () => {
  it('answers a measure ping with a server-stamped measureResponse', async () => {
    const ws = await connect()
    const response = waitForMessage(ws, 'measureResponse')

    ws.send(JSON.stringify({ message: 'measure', t0: 12345 }))

    const msg = await response
    expect(msg.t0).toBe(12345)
    expect(typeof msg.serverRecv).toBe('number')
    expect(typeof msg.serverSend).toBe('number')
    ws.close()
  })

  it('pushes the clock-sync config when a client registers', async () => {
    const ws = await connect()
    const config = waitForMessage(ws, 'measureConfig')

    ws.send(
      JSON.stringify({
        message: 'clientInfo',
        clientId: 0,
        ttsLang: { iso: 'en-US', lang: 'English' },
        performanceId: new Types.ObjectId().toString()
      })
    )

    const msg = await config
    expect(typeof msg.config.intervalMs).toBe('number')
    ws.close()
  })
})
