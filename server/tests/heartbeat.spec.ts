import {
  heartbeatTick,
  limitsForReportingEvery,
  LIMITS_FOR_A_QUIET_PEER,
  LivenessLimits,
  WatchedConnection
} from '../lib/heartbeat'

const LIMITS: LivenessLimits = { pingAfterMs: 10000, idleTimeoutMs: 25000 }

const NOW = 100000

/** A connection that records what the heartbeat did to it. */
const fakeConnection = (id: string, silentFor: number) => ({
  id,
  lastSeenAt: NOW - silentFor,
  pings: 0,
  terminated: false,
  ping() {
    this.pings++
  },
  terminate() {
    this.terminated = true
  }
})

const tick = (...connections: ReturnType<typeof fakeConnection>[]) => heartbeatTick(connections, NOW, () => LIMITS)

describe('heartbeatTick', () => {
  it('leaves a connection alone while it has been heard from recently', () => {
    const connection = fakeConnection('fresh', LIMITS.pingAfterMs)

    expect(tick(connection)).toEqual([])
    expect(connection).toMatchObject({ pings: 0, terminated: false })
  })

  it('pings a connection that has gone quiet', () => {
    const connection = fakeConnection('quiet', LIMITS.pingAfterMs + 1)

    expect(tick(connection)).toEqual([])
    expect(connection).toMatchObject({ pings: 1, terminated: false })
  })

  it('keeps pinging up to the idle timeout', () => {
    const connection = fakeConnection('nearly-gone', LIMITS.idleTimeoutMs)

    tick(connection)

    expect(connection).toMatchObject({ pings: 1, terminated: false })
  })

  it('hangs up on a connection that stayed quiet past the idle timeout', () => {
    const connection = fakeConnection('gone', LIMITS.idleTimeoutMs + 1)

    expect(tick(connection)).toEqual([connection])
    expect(connection).toMatchObject({ pings: 0, terminated: true })
  })

  it('judges each connection separately in one pass', () => {
    const fresh = fakeConnection('fresh', 1000)
    const quiet = fakeConnection('quiet', 15000)
    const gone = fakeConnection('gone', 30000)

    expect(tick(fresh, quiet, gone)).toEqual([gone])
    expect(fresh).toMatchObject({ pings: 0, terminated: false })
    expect(quiet).toMatchObject({ pings: 1, terminated: false })
    expect(gone.terminated).toBe(true)
  })

  /**
   * The property the module exists for: liveness is read from `lastSeenAt`, so a
   * connection the server writes to constantly is judged exactly as a quiet one.
   */
  it('hangs up on a silent peer however much the server has been sending it', () => {
    const busy: WatchedConnection & { terminated: boolean } = {
      id: 'busy',
      lastSeenAt: NOW - 30000,
      terminated: false,
      ping() {},
      terminate() {
        this.terminated = true
      }
    }

    heartbeatTick([busy], NOW, () => LIMITS)

    expect(busy.terminated).toBe(true)
  })

  it('gives each connection the limits chosen for it', () => {
    const strict = fakeConnection('strict', 15000)
    const lenient = fakeConnection('lenient', 15000)

    const hungUpOn = heartbeatTick([strict, lenient], NOW, (connection) =>
      connection.id === 'strict' ? { pingAfterMs: 6000, idleTimeoutMs: 12000 } : LIMITS
    )

    // Silent for exactly as long, judged differently.
    expect(hungUpOn).toEqual([strict])
    expect(lenient).toMatchObject({ pings: 1, terminated: false })
  })
})

/**
 * A device running clock sync reports on a cadence the server itself set, so its
 * silence means something precise. A connection that only answers pings says
 * nothing until it is asked, and has to be given far longer.
 */
describe('the limits a connection is held to', () => {
  it('gives a peer that only answers pings room to be asked twice over', () => {
    expect(LIMITS_FOR_A_QUIET_PEER.pingAfterMs).toBeLessThan(LIMITS_FOR_A_QUIET_PEER.idleTimeoutMs / 2)
  })

  it('gives up on a reporting peer after four missed reports', () => {
    expect(limitsForReportingEvery(3000)).toEqual({ pingAfterMs: 6000, idleTimeoutMs: 12000 })
  })

  it('follows the cadence it was given rather than assuming one', () => {
    expect(limitsForReportingEvery(5000)).toEqual({ pingAfterMs: 10000, idleTimeoutMs: 20000 })
  })

  it('reaps a reporting peer sooner than a quiet one', () => {
    expect(limitsForReportingEvery(3000).idleTimeoutMs).toBeLessThan(LIMITS_FOR_A_QUIET_PEER.idleTimeoutMs)
  })
})
