/**
 * A websocket that keeps itself connected.
 *
 * The caller says what to send each time the connection opens and what to do with
 * each message, and never sees a connection come or go: dropping, reconnecting
 * and giving up on a connection that has died without closing all happen in
 * here. This knows nothing about what the messages mean.
 *
 * A connection counts as live only while it is being heard from. The browser
 * does not expose pings, and it can report a connection as open long after the
 * network under it has gone, so silence is the signal: a peer that has said
 * nothing for `SILENCE_LIMIT_MS` is given up on and replaced. Open is not enough
 * either — a server that refuses a connection can leave it open and silent.
 */

/** How long a connection may say nothing before it is treated as dead. */
export const SILENCE_LIMIT_MS = 3000

const FIRST_RECONNECT_MS = 500
const LONGEST_RECONNECT_MS = 10_000

/**
 * How long to wait before reconnecting, after `attempt` tries that heard nothing.
 *
 * Doubles each time, so a server that keeps refusing is not asked every few
 * seconds, up to a cap, so an operator is never left waiting minutes. Spread by
 * up to half, so every admin losing a restarting server does not come back at
 * the same instant.
 */
export const reconnectDelay = (
  attempt: number,
  random: () => number = Math.random
) => {
  const ceiling = Math.min(
    LONGEST_RECONNECT_MS,
    FIRST_RECONNECT_MS * 2 ** attempt
  )
  return ceiling * (0.5 + random() / 2)
}

export interface ResilientSocketOptions {
  url: string
  /** Called each time a connection opens, with a way to send on it. */
  onOpen: (send: (data: string) => void) => void
  onMessage: (data: string) => void
  /** Called when the connection starts or stops being heard from. */
  onLiveChange: (live: boolean) => void
  WebSocketImpl?: typeof WebSocket
}

export const createResilientSocket = ({
  url,
  onOpen,
  onMessage,
  onLiveChange,
  WebSocketImpl = WebSocket,
}: ResilientSocketOptions) => {
  let socket: WebSocket | undefined
  let silence: ReturnType<typeof setTimeout> | undefined
  let reconnect: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let live = false
  let closed = false

  const setLive = (value: boolean) => {
    if (live === value) return
    live = value
    onLiveChange(value)
  }

  const expectToHear = () => {
    clearTimeout(silence)
    silence = setTimeout(abandon, SILENCE_LIMIT_MS)
  }

  /** Lets go of the current connection, whatever state it is in, and replaces it. */
  const abandon = () => {
    clearTimeout(silence)

    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null
      socket.close()
      socket = undefined
    }

    setLive(false)

    if (!closed) {
      reconnect = setTimeout(connect, reconnectDelay(attempt))
      attempt++
    }
  }

  const connect = () => {
    const current = new WebSocketImpl(url)
    socket = current

    // Started before the connection opens, so one that never opens is given up
    // on the same way as one that stops talking.
    expectToHear()

    current.onopen = () => onOpen(data => current.send(data))

    current.onmessage = event => {
      attempt = 0
      setLive(true)
      expectToHear()
      onMessage(event.data)
    }

    current.onclose = abandon
  }

  connect()

  return {
    /** Closes the connection for good. */
    close: () => {
      closed = true
      clearTimeout(reconnect)
      abandon()
    },
  }
}
