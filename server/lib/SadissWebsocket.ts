import { Server, WebSocketServer, ServerOptions, WebSocket } from 'ws'
import { Types } from 'mongoose'
import { logger } from '../tools'

export class SadissWebSocket extends WebSocket {
  id = ''
  choirId = -1
  ttsLang = { iso: '', lang: '' }
  isAdmin = false
  lastSentTime = 1
  performanceId = new Types.ObjectId()
  isActive = true

  safeSend(data: string) {
    try {
      if (this.readyState === WebSocket.OPEN) {
        this.send(data, (err) => {
          if (err) {
            logger.error('Send failed:', err.message)
            this.terminate()
          } else {
            this.lastSentTime = Date.now()
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

export class SadissWebSocketServer extends WebSocketServer<SadissWebSocket> {
  constructor(options: ServerOptions) {
    super({
      ...options,
      WebSocket: SadissWebSocket
    })
  }
  clients: Set<SadissWebSocket> = new Set()
}
