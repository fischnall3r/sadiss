/**
 * Liveness for websocket connections.
 *
 * A connection counts as alive while its peer has been heard from recently,
 * which is the only evidence available: a socket whose peer has vanished — a
 * phone that lost signal, a laptop that slept, a proxy that dropped the tunnel —
 * keeps accepting writes without complaint.
 *
 * A connection that has gone quiet is prodded with a ping, and given up on if it
 * stays quiet. How long "quiet" is allowed to last depends on the peer, because
 * silence from one that reports on a cadence means something silence from one
 * that only answers pings does not.
 */

/** How long a connection may be silent before it is prodded, then given up on. */
export interface LivenessLimits {
  /** Silence after which a connection is prodded with a ping. */
  pingAfterMs: number
  /** Silence after which a connection is given up on. */
  idleTimeoutMs: number
}

/** How often the connections are looked at, unless the caller picks otherwise. */
export const DEFAULT_TICK_MS = 2000

/**
 * The limits for a peer that says nothing of its own accord.
 *
 * Its silence is not evidence of anything until it has been asked, so the grace
 * has to cover several unanswered pings.
 */
export const LIMITS_FOR_A_QUIET_PEER: LivenessLimits = {
  pingAfterMs: 10000,
  idleTimeoutMs: 25000
}

/** Missed reports a peer is allowed before it is treated as gone. */
const REPORTS_MISSED_BEFORE_GIVING_UP = 4

/**
 * The limits for a peer that reports every `intervalMs`, as devices running clock
 * sync do. Its silence is measured against the cadence the server itself set, so
 * it can be given up on much sooner than a peer that never volunteers anything.
 */
export const limitsForReportingEvery = (intervalMs: number): LivenessLimits => ({
  pingAfterMs: intervalMs * 2,
  idleTimeoutMs: intervalMs * REPORTS_MISSED_BEFORE_GIVING_UP
})

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
  limitsFor: (connection: T) => LivenessLimits
) => {
  const hungUpOn: T[] = []

  for (const connection of connections) {
    const silentFor = now - connection.lastSeenAt
    const { pingAfterMs, idleTimeoutMs } = limitsFor(connection)

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
  limitsFor: (connection: T) => LivenessLimits,
  tickMs: number = DEFAULT_TICK_MS
) => {
  const timer = setInterval(() => {
    for (const connection of heartbeatTick(connections(), Date.now(), limitsFor)) {
      onHungUpOn(connection)
    }
  }, tickMs)

  // Don't let the heartbeat alone keep the process alive: in production the HTTP/WS
  // server holds it open, but once those close (e.g. after a test run) the process
  // should be free to exit instead of hanging on this timer.
  timer.unref()

  return timer
}
