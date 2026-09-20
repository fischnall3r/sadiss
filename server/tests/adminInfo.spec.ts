import WebSocket from 'ws'
import { Types } from 'mongoose'
import { afterEach, describe, expect, it } from 'vitest'
import { startWebSocketServer } from '../services/webSocketService'
import { SadissWebSocketServer } from '../lib/SadissWebsocket'

/**
 * What the server keeps telling an admin about the room.
 *
 * The push that matters here is the repeating one, not the reply to the
 * handshake, so these tests run their own server with the interval turned
 * down far enough to see several pushes.
 */

const PUSH_INTERVAL_MS = 30

let servers: SadissWebSocketServer[] = []
let sockets: WebSocket[] = []

afterEach(() => {
  sockets.forEach((socket) => socket.close())
  servers.forEach((server) => server.close())
  sockets = []
  servers = []
})

/** A server pushing admin updates fast enough for a test to watch. */
const fastPushingServer = () => {
  const server = startWebSocketServer(0, { adminInfoIntervalMs: PUSH_INTERVAL_MS })
  servers.push(server)
  return server
}

/** Connects as an admin and collects the admin updates it is pushed. */
const watchAsAdmin = async (server: SadissWebSocketServer, performanceId?: string) => {
  const port = (server.address() as WebSocket.AddressInfo).port
  const socket = new WebSocket(`ws://localhost:${port}/`)
  sockets.push(socket)

  const updates: any[] = []
  socket.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString())
      if (parsed.message === 'adminInfo') updates.push(parsed.adminInfo)
    } catch {
      // Non-JSON control frames are irrelevant here.
    }
  })

  await new Promise((resolve) => socket.on('open', resolve))
  socket.send(JSON.stringify(performanceId ? { message: 'isAdmin', performanceId } : { message: 'isAdmin' }))

  return {
    /** The updates pushed after the reply to the handshake. */
    repeated: async () => {
      await new Promise((resolve) => setTimeout(resolve, PUSH_INTERVAL_MS * 4))
      return updates.slice(1)
    }
  }
}

describe('the updates an admin is pushed', () => {
  /**
   * An admin on the dashboard has no performance. Answering it with the counts
   * for one would say there are no devices, which is a different claim.
   */
  it('says nothing about a performance to an admin that named none', async () => {
    const admin = await watchAsAdmin(fastPushingServer())

    const updates = await admin.repeated()

    expect(updates.length).toBeGreaterThan(0)
    for (const update of updates) {
      expect(update).not.toHaveProperty('clientsConnectedToPerformanceByChoirId')
      expect(update).not.toHaveProperty('clientsConnectedToPerformanceByProtocolVersion')
    }
  })

  it('keeps reporting the room to an admin that named a performance', async () => {
    const admin = await watchAsAdmin(fastPushingServer(), new Types.ObjectId().toString())

    const updates = await admin.repeated()

    expect(updates.length).toBeGreaterThan(0)
    for (const update of updates) {
      expect(update).toHaveProperty('clientsConnectedToPerformanceByChoirId')
      expect(update).toHaveProperty('clientsConnectedToPerformanceByProtocolVersion')
    }
  })

  it('counts the devices that registered for the admin’s performance', async () => {
    const server = fastPushingServer()
    const performanceId = new Types.ObjectId().toString()
    const port = (server.address() as WebSocket.AddressInfo).port

    const device = new WebSocket(`ws://localhost:${port}/`)
    sockets.push(device)
    await new Promise((resolve) => device.on('open', resolve))
    device.send(
      JSON.stringify({ message: 'clientInfo', clientId: 3, ttsLang: { iso: 'en-US', lang: 'English' }, performanceId })
    )

    const admin = await watchAsAdmin(server, performanceId)
    const updates = await admin.repeated()

    expect(updates.at(-1).clientsConnectedToPerformanceByChoirId).toEqual({ 3: 1 })
  })
})
