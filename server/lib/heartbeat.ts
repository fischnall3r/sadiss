/**
 * Liveness for websocket connections.
 *
 * A connection counts as alive while its peer has been heard from recently,
 * which is the only evidence available: a socket whose peer has vanished — a
 * phone that lost signal, a laptop that slept, a proxy that dropped the tunnel —
 * keeps accepting writes without complaint.
 *
 * A connection that has gone quiet is prodded with a ping, and given up on if it
 * stays quiet.
 */

export interface HeartbeatTimings {
  /** How often the connections are looked at. */
  tickMs: number
  /** Silence after which a connection is prodded with a ping. */
  pingAfterMs: number
  /** Silence after which a connection is given up on. */
  idleTimeoutMs: number
}

/** The timings used unless the caller picks others. */
export const DEFAULT_HEARTBEAT_TIMINGS: HeartbeatTimings = {
  tickMs: 2000,
  pingAfterMs: 10000,
  idleTimeoutMs: 25000
}

/** A connection the heartbeat watches. */
export interface WatchedConnection {
  readonly id: string
  /** When the peer was last heard from, on the same clock as `now`. */
  readonly lastSeenAt: number
  ping(): void
  terminate(): void
}

/** One pass over the connections. Returns the ones hung up on, for the caller to report. */
export const heartbeatTick = <T extends WatchedConnection>(
  connections: Iterable<T>,
  now: number,
  { pingAfterMs, idleTimeoutMs }: HeartbeatTimings
) => {
  const hungUpOn: T[] = []

  for (const connection of connections) {
    const silentFor = now - connection.lastSeenAt

    if (silentFor > idleTimeoutMs) {
      connection.terminate()
      hungUpOn.push(connection)
    } else if (silentFor > pingAfterMs) {
      connection.ping()
    }
  }

  return hungUpOn
}

/** Watches the given connections for as long as the returned timer runs. */
export const startHeartbeat = <T extends WatchedConnection>(
  connections: () => Iterable<T>,
  onHungUpOn: (connection: T) => void,
  timings: HeartbeatTimings = DEFAULT_HEARTBEAT_TIMINGS
) => {
  const timer = setInterval(() => {
    for (const connection of heartbeatTick(connections(), Date.now(), timings)) {
      onHungUpOn(connection)
    }
  }, timings.tickMs)

  // Don't let the heartbeat alone keep the process alive: in production the HTTP/WS
  // server holds it open, but once those close (e.g. after a test run) the process
  // should be free to exit instead of hanging on this timer.
  timer.unref()

  return timer
}
