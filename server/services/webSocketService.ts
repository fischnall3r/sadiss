import WebSocket from 'ws'
import { runningSessionCount } from './playbackService'
import { logger } from '../tools'
import { ClientInfoMessage, CURRENT_PROTOCOL_VERSION, Message, MeasureMessage, readProtocolVersion } from '../types'
import { measurementService } from './measurement'
import { v4 as uuidv4 } from 'uuid'
import { Types } from 'mongoose'
import { SadissWebSocketServer, SadissWebSocket } from '../lib/SadissWebsocket'

/**
 * Starts a WebSocket server on the specified port.
 * @param port The port number to listen on. If not provided, a random port will be used.
 * @returns The WebSocket server instance.
 */
export const startWebSocketServer = (port = 0) => {
  const wss = new SadissWebSocketServer({ port })

  startWebsocketHeartbeatAndUpdates(wss)

  wss.on('connection', (client, request) => {
    request.socket.setKeepAlive(true, 60000) // Might help with idle connections. Main mechanism is the ping pong interval.

    // Assign id to new connection, needed for nonChoir partial distribution
    client.id = uuidv4()
    logger.info(`New client connected! Assigned id: ${client.id} Total clients: ${wss.clients.size}`)

    setupClientEventHandlers(wss, client)
  })

  return wss
}

const setupClientEventHandlers = (wss: SadissWebSocketServer, client: SadissWebSocket) => {
  client.on('pong', handlePong(client))
  client.onclose = handleClose(client)
  client.onmessage = handleMessage(wss, client)
}

const handleMessage = (wss: SadissWebSocketServer, client: SadissWebSocket) => (event: WebSocket.MessageEvent) => {
  const parsed: Message = JSON.parse(event.data.toString())
  logger.debug(`Received message from ws client: ${parsed.message}`)
  if (parsed.message === 'clientInfo') {
    client.choirId = parsed.clientId
    client.ttsLang = parsed.ttsLang
    client.performanceId = parsed.performanceId
    client.protocolVersion = readProtocolVersion(parsed as ClientInfoMessage)
    logger.info(
      `Performance ${client.performanceId}: Client ${client.id} registered with choir id ${client.choirId}, TTS lang ${client.ttsLang.iso} and protocol version ${client.protocolVersion}`
    )
    client.send('clientInfoReceived')
    // Tell the device how often to run the clock-sync round trip.
    client.send(JSON.stringify(measurementService.buildConfigMessage()))
  } else if (parsed.message === 'measure') {
    measurementService.handleMeasure(client, parsed as MeasureMessage)
  } else if (parsed.message === 'isAdmin') {
    client.isAdmin = true

    let message

    if (parsed.performanceId) {
      message = createAdminInfoMessage(wss, parsed.performanceId)
      client.performanceId = parsed.performanceId
      logger.info(`Performance ${client.performanceId}: Client ${client.id} is admin`)
    } else {
      message = createAdminInfoMessage(wss)
    }

    client.send(JSON.stringify(message))
  }
}

const handleClose = (client: SadissWebSocket) => () => {
  logger.info(`Client has disconnected! id: ${client.id}`)
  client.isActive = false
}

const handlePong = (client: SadissWebSocket) => () => {
  client.lastSentTime = Date.now()
  client.isActive = true
}

const startWebsocketHeartbeatAndUpdates = (wss: SadissWebSocketServer) => {
  const intervalLength = 5000 // 5 seconds
  const idleTimeout = 30000 // 30 seconds

  const heartbeat = setInterval(() => {
    if (!wss.clients.size) return

    for (const client of wss.clients) {
      if (!(client instanceof SadissWebSocket)) {
        logger.error('Invalid WebSocket client instance')
        continue
      }

      handlePingPong(client, idleTimeout)
      handleAdminInfo(wss, client)
    }
  }, intervalLength)

  // Don't let the heartbeat alone keep the process alive: in production the HTTP/WS
  // server holds it open, but once those close (e.g. after a test run) the process
  // should be free to exit instead of hanging on this timer.
  heartbeat.unref()
}

const handlePingPong = (client: SadissWebSocket, idleTimeout: number) => {
  const now = Date.now()

  if (!client.lastSentTime || now - client.lastSentTime > idleTimeout) {
    if (client.isActive === false) {
      client.terminate()
      const clientOrAdmin = client.isAdmin ? 'Admin' : 'Client'
      logger.info(`${clientOrAdmin} was terminated because it was idle! id: ${client.id}`)
    }

    client.isActive = false
    client.ping()
  }
}

const handleAdminInfo = (wss: SadissWebSocketServer, client: SadissWebSocket) => {
  if (client.isAdmin) {
    const adminInfo = createAdminInfoMessage(wss, client.performanceId)
    client.safeSend(JSON.stringify(adminInfo))
  }
}

const createAdminInfoMessage = (wss: SadissWebSocketServer, adminPerformanceId?: Types.ObjectId) => {
  interface AdminInfo {
    activePerformancesCount: number
    connectedClientsCount: number
    serverProtocolVersion: number
    clientsConnectedToPerformanceByChoirId?: Record<string, number>
    clientsConnectedToPerformanceByProtocolVersion?: Record<string, number>
  }

  const adminInfo: AdminInfo = {
    activePerformancesCount: runningSessionCount(),
    connectedClientsCount: wss.clients.size,
    serverProtocolVersion: CURRENT_PROTOCOL_VERSION
  }

  if (adminPerformanceId) {
    const clientsConnectedToPerformance = Array.from(wss.clients).filter(
      (client) => client.performanceId === adminPerformanceId && client.choirId >= 0
    )

    adminInfo.clientsConnectedToPerformanceByChoirId = countBy(clientsConnectedToPerformance, (client) => client.choirId)
    adminInfo.clientsConnectedToPerformanceByProtocolVersion = countBy(
      clientsConnectedToPerformance,
      (client) => client.protocolVersion
    )
  }

  return {
    message: 'adminInfo',
    adminInfo
  }
}

/** Groups clients by a key and returns how many fall into each. */
const countBy = (clients: SadissWebSocket[], key: (client: SadissWebSocket) => number) =>
  clients.reduce((acc, client) => {
    acc[key(client)] = (acc[key(client)] || 0) + 1
    return acc
  }, {} as Record<string, number>)
