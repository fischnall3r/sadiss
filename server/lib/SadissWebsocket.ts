import { Server, WebSocketServer, ServerOptions, WebSocket } from 'ws'
import { logger } from '../tools'
import { UNVERSIONED_PROTOCOL_VERSION } from '../types'

export class SadissWebSocket extends WebSocket {
  id = ''
  choirId = -1
  ttsLang = { iso: '', lang: '' }
  /** The wire protocol this connection speaks, announced in its handshake. */
  protocolVersion = UNVERSIONED_PROTOCOL_VERSION
  isAdmin = false
  /**
   * The performance this connection asked for, as the id string the wire carries.
   * Empty until it says, which is how a connection that belongs to no performance
   * is told apart from one that belongs to another.
   */
  performanceId = ''
  /** When this peer was last heard from. See lib/heartbeat.ts. */
  lastSeenAt = Date.now()
  /**
   * Whether this peer has shown that it reports on the clock-sync cadence.
   * Set by having done it, not by what the handshake claims, so a build that
   * does not run clock sync is never held to a cadence it does not keep.
   */
  reportsRegularly = false

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
