import { Server, WebSocketServer, ServerOptions, WebSocket } from 'ws'
import { Types } from 'mongoose'
import { logger } from '../tools'
import { UNVERSIONED_PROTOCOL_VERSION } from '../types'

export class SadissWebSocket extends WebSocket {
  id = ''
  choirId = -1
  ttsLang = { iso: '', lang: '' }
  /** The wire protocol this connection speaks, announced in its handshake. */
  protocolVersion = UNVERSIONED_PROTOCOL_VERSION
  isAdmin = false
  performanceId = new Types.ObjectId()
  /** When this peer was last heard from. See lib/heartbeat.ts. */
  lastSeenAt = Date.now()

  safeSend(data: string) {
    try {
      if (this.readyState === WebSocket.OPEN) {
        this.send(data, (err) => {
          if (err) {
            logger.error('Send failed:', err.message)
            this.terminate()
          }
        })
      } else {
        logger.warn('Socket is not open. Cannot send message.')
      }
    } catch (err) {
      logger.error('Error while sending:', err)
      this.terminate()
    }
  }
}

export class SadissWebSocketServer extends WebSocketServer<typeof SadissWebSocket> {
  constructor(options: ServerOptions) {
    super({
      ...options,
      WebSocket: SadissWebSocket
    })
  }
  clients: Set<SadissWebSocket> = new Set()
}
