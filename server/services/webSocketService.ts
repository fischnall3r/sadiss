import WebSocket from 'ws'
import { runningSessionCount } from './playbackService'
import { logger } from '../tools'
import { ClientInfoMessage, CURRENT_PROTOCOL_VERSION, Message, MeasureMessage, readProtocolVersion } from '../types'
import { measurementService } from './measurement'
import { v4 as uuidv4 } from 'uuid'
import { Types } from 'mongoose'
import { SadissWebSocketServer, SadissWebSocket } from '../lib/SadissWebsocket'
import { DEFAULT_HEARTBEAT_TIMINGS, HeartbeatTimings, startHeartbeat } from '../lib/heartbeat'

/** How often each admin is told the state of the room. */
const ADMIN_INFO_INTERVAL_MS = 5000

interface WebSocketServerOptions {
  /** How closely connections are watched for liveness. */
  heartbeat?: HeartbeatTimings
  /** How often each admin is told the state of the room. */
  adminInfoIntervalMs?: number
}

/**
 * Starts a WebSocket server on the specified port.
 * @param port The port number to listen on. If not provided, a random port will be used.
 * @returns The WebSocket server instance.
 */
export const startWebSocketServer = (port = 0, options: WebSocketServerOptions = {}) => {
  const wss = new SadissWebSocketServer({ port })

  watchConnections(wss, options.heartbeat ?? DEFAULT_HEARTBEAT_TIMINGS)
  startAdminInfoUpdates(wss, options.adminInfoIntervalMs ?? ADMIN_INFO_INTERVAL_MS)

  wss.on('connection', (client, request) => {
    request.socket.setKeepAlive(true, 60000) // Might help with idle connections. Main mechanism is the heartbeat.

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
  client.lastSeenAt = Date.now()

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
}

const handlePong = (client: SadissWebSocket) => () => {
  client.lastSeenAt = Date.now()
}

const watchConnections = (wss: SadissWebSocketServer, timings: HeartbeatTimings) =>
  startHeartbeat(
    () => wss.clients,
    (client) => logger.info(`${client.isAdmin ? 'Admin' : 'Client'} went quiet and was given up on! id: ${client.id}`),
    timings
  )

/** Keeps every admin's view of the room up to date. */
const startAdminInfoUpdates = (wss: SadissWebSocketServer, intervalMs: number) => {
  const updates = setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAdmin) {
        client.safeSend(JSON.stringify(createAdminInfoMessage(wss, client.performanceId)))
      }
    }
  }, intervalMs)

  // Don't let these updates alone keep the process alive: in production the HTTP/WS
  // server holds it open, but once those close (e.g. after a test run) the process
  // should be free to exit instead of hanging on this timer.
  updates.unref()

  return updates
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
