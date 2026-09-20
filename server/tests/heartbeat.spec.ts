import { heartbeatTick, WatchedConnection } from '../lib/heartbeat'

const TIMINGS = { tickMs: 2000, pingAfterMs: 10000, idleTimeoutMs: 25000 }

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

const tick = (...connections: ReturnType<typeof fakeConnection>[]) => heartbeatTick(connections, NOW, TIMINGS)

describe('heartbeatTick', () => {
  it('leaves a connection alone while it has been heard from recently', () => {
    const connection = fakeConnection('fresh', TIMINGS.pingAfterMs)

    expect(tick(connection)).toEqual([])
    expect(connection).toMatchObject({ pings: 0, terminated: false })
  })

  it('pings a connection that has gone quiet', () => {
    const connection = fakeConnection('quiet', TIMINGS.pingAfterMs + 1)

    expect(tick(connection)).toEqual([])
    expect(connection).toMatchObject({ pings: 1, terminated: false })
  })

  it('keeps pinging up to the idle timeout', () => {
    const connection = fakeConnection('nearly-gone', TIMINGS.idleTimeoutMs)

    tick(connection)

    expect(connection).toMatchObject({ pings: 1, terminated: false })
  })

  it('hangs up on a connection that stayed quiet past the idle timeout', () => {
    const connection = fakeConnection('gone', TIMINGS.idleTimeoutMs + 1)

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

    heartbeatTick([busy], NOW, TIMINGS)

    expect(busy.terminated).toBe(true)
  })
})
