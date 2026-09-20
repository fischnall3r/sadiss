import WebSocket from 'ws'
import { Types } from 'mongoose'
import { startWebSocketServer } from '../services/webSocketService'
import { SadissWebSocketServer } from '../lib/SadissWebsocket'
import { measurementService } from '../services/measurement'

/** The cadence devices are told to report at outside these tests. */
const REPORTING_INTERVAL_MS = Number(process.env.MEASUREMENT_INTERVAL_MS) || 3000

/**
 * The heartbeat over real sockets, run far faster than in production so that the
 * suite stays quick and the admin updates overlap the liveness checks.
 */
const OPTIONS = {
  heartbeat: { tickMs: 20, quiet: { pingAfterMs: 60, idleTimeoutMs: 200 } },
  adminInfoIntervalMs: 30
}

let wss: SadissWebSocketServer
let sockets: WebSocket[] = []

beforeEach(() => {
  wss = startWebSocketServer(0, OPTIONS)
})

afterEach(() => {
  for (const socket of sockets) socket.close()
  sockets = []
  wss.close()
  measurementService.setConfig({ intervalMs: REPORTING_INTERVAL_MS })
})

/** Opens a client socket to the test server. `autoPong: false` plays a peer that has gone away. */
const connect = (options: WebSocket.ClientOptions = {}) =>
  new Promise<WebSocket>((resolve) => {
    const port = (wss.address() as WebSocket.AddressInfo).port
    const socket = new WebSocket(`ws://localhost:${port}/`, options)
    sockets.push(socket)
    socket.on('error', () => {
      /* being hung up on surfaces as an error on the client */
    })
    socket.on('open', () => resolve(socket))
  })

/** Counts the ping frames the server sends to this socket. */
const countPings = (socket: WebSocket) => {
  const pings = { count: 0 }
  socket.on('ping', () => pings.count++)
  return pings
}

const closedWithin = (socket: WebSocket, ms: number) =>
  new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), ms)
    socket.on('close', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('WebSocket heartbeat', () => {
  it('pings a client that has gone quiet', async () => {
    const socket = await connect()
    const pings = countPings(socket)

    await wait(150)

    expect(pings.count).toBeGreaterThan(0)
  })

  it('keeps pinging an admin that is being sent a steady stream of updates', async () => {
    const socket = await connect()
    const pings = countPings(socket)

    socket.send(JSON.stringify({ message: 'isAdmin', performanceId: new Types.ObjectId().toString() }))

    await wait(400)

    expect(pings.count).toBeGreaterThan(1)
  })

  it('hangs up on a client that stops answering pings', async () => {
    const socket = await connect({ autoPong: false })

    expect(await closedWithin(socket, 1000)).toBe(true)
  })

  it('leaves a client that answers pings alone', async () => {
    const socket = await connect()

    expect(await closedWithin(socket, 500)).toBe(false)
  })

  it('leaves a client that keeps sending messages alone, even if it never pongs', async () => {
    const socket = await connect({ autoPong: false })
    const chatter = setInterval(() => socket.send(JSON.stringify({ message: 'measure', t0: 1 })), 40)

    const closed = await closedWithin(socket, 500)
    clearInterval(chatter)

    expect(closed).toBe(false)
  })

  /**
   * A device that has reported once is expected to keep reporting, so its silence
   * is read against that cadence instead of the far longer grace a connection
   * gets when the only thing it ever answers is a ping.
   */
  it('gives up sooner on a device that stopped reporting than on one that never did', async () => {
    // A reporter is then given up on after 60ms, a quiet peer after the 200ms above.
    measurementService.setConfig({ intervalMs: 15 })
    const reporter = await connect({ autoPong: false })
    const neverReported = await connect({ autoPong: false })

    const bothJudged = 140
    const reporterClosed = closedWithin(reporter, bothJudged)
    const neverReportedClosed = closedWithin(neverReported, bothJudged)
    reporter.send(JSON.stringify({ message: 'measure', t0: 1 }))

    expect(await reporterClosed).toBe(true)
    expect(await neverReportedClosed).toBe(false)
  })
})
