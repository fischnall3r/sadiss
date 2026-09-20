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

/** Everyone listening to one performance at one moment. */
export interface Audience {
  /** The devices playing the performance. */
  devices: Recipient[]
  /** The admins watching it. */
  admins: Recipient[]
}

/**
 * Reads the audience of one performance off the websocket server.
 *
 * Each call walks the connections once and returns both groups together, so
 * everything a session decides within a chunk is decided about the same set of
 * listeners.
 */
export const webSocketAudience =
  (wss: SadissWebSocketServer, performanceKey: string) => (): Audience => {
    const audience: Audience = { devices: [], admins: [] }

    for (const client of wss.clients) {
      if (String(client.performanceId) !== performanceKey) continue

      const recipient: Recipient = {
        id: client.id,
        choirId: client.choirId,
        ttsLang: client.ttsLang,
        send: (data) => client.safeSend(data)
      }

      if (client.isAdmin) {
        audience.admins.push(recipient)
      } else {
        audience.devices.push(recipient)
      }
    }

    return audience
  }
