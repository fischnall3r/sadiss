/**
 * Who a playback session is sending to.
 *
 * A session needs to know which connections belong to its performance and what
 * each of them wants to hear. It does not need the websocket server, and holding
 * one would mean every chunk it sends could only be observed through a real
 * socket.
 */

import { SadissWebSocketServer } from './SadissWebsocket'

/** One connection a session sends to. */
export interface Recipient {
  readonly id: string
  /** The voice this device was assigned, or -1 if it has not registered. */
  readonly choirId: number
  readonly ttsLang: { iso: string; lang: string }
  send(data: string): void
}

/**
 * Reads the devices playing one performance off the websocket server.
 *
 * An admin watching the performance is not among them: it is told where the
 * performance has got to by its own push. See docs/wire-protocol.md.
 */
export const webSocketAudience =
  (wss: SadissWebSocketServer, performanceKey: string) => (): Recipient[] =>
    Array.from(wss.clients)
      .filter((client) => String(client.performanceId) === performanceKey && !client.isAdmin)
      .map((client) => ({
        id: client.id,
        choirId: client.choirId,
        ttsLang: client.ttsLang,
        send: (data) => client.safeSend(data)
      }))
