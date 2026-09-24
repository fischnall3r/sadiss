import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createResilientSocket,
  reconnectDelay,
  SILENCE_LIMIT_MS,
} from "../src/composables/resilientSocket"
import { FakeWebSocket, latestSocket } from "./fakeWebSocket"

/**
 * These drive a stand-in WebSocket by hand and move the clock by hand, so a
 * dropped connection or a stretch of silence costs a line rather than seconds.
 */

const latest = latestSocket

/** Longer than any delay a reconnect can be scheduled with. */
const LONGEST_RECONNECT_MS = 10_000

const connect = () => {
  const received: string[] = []
  const liveness: boolean[] = []

  const socket = createResilientSocket({
    url: "wss://example/ws/",
    onOpen: (send) => send("hello"),
    onMessage: (data) => received.push(data),
    onLiveChange: (live) => liveness.push(live),
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  })

  return { socket, received, liveness }
}

describe("a socket that keeps itself connected", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.opened = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("says what it was told to say every time it opens", () => {
    connect()
    latest().open()

    expect(latest().sent).toEqual(["hello"])
  })

  it("passes on what it receives", () => {
    const { received } = connect()
    latest().open()
    latest().receive("state")

    expect(received).toEqual(["state"])
  })

  it("opens again after the connection drops, and says it again", () => {
    connect()
    latest().open()
    latest().drop()

    vi.advanceTimersByTime(reconnectDelay(0, () => 1))

    expect(FakeWebSocket.opened).toHaveLength(2)
    latest().open()
    expect(latest().sent).toEqual(["hello"])
  })

  it("gives up on a connection that has gone quiet, and opens another", () => {
    connect()
    latest().open()
    latest().receive("state")
    const quiet = latest()

    vi.advanceTimersByTime(SILENCE_LIMIT_MS + LONGEST_RECONNECT_MS)

    expect(quiet.closed).toBe(true)
    expect(FakeWebSocket.opened.length).toBeGreaterThan(1)
  })

  it("does not give up on a connection that keeps talking", () => {
    connect()
    latest().open()

    for (let i = 0; i < 10; i++) {
      latest().receive("state")
      vi.advanceTimersByTime(1000)
    }

    expect(FakeWebSocket.opened).toHaveLength(1)
  })

  it("counts as live only once something has been heard", () => {
    const { liveness } = connect()
    latest().open()

    expect(liveness).toEqual([])

    latest().receive("state")

    expect(liveness).toEqual([true])
  })

  it("stops counting as live when the connection drops", () => {
    const { liveness } = connect()
    latest().open()
    latest().receive("state")
    latest().drop()

    expect(liveness).toEqual([true, false])
  })

  it("stops counting as live when the connection goes quiet", () => {
    const { liveness } = connect()
    latest().open()
    latest().receive("state")

    vi.advanceTimersByTime(SILENCE_LIMIT_MS)

    expect(liveness).toEqual([true, false])
  })

  it("stays down once it has been closed on purpose", () => {
    const { socket } = connect()
    latest().open()
    socket.close()
    latest().drop()

    vi.advanceTimersByTime(LONGEST_RECONNECT_MS * 10)

    expect(FakeWebSocket.opened).toHaveLength(1)
  })

  it("waits longer each time it reconnects without hearing anything", () => {
    connect()

    vi.advanceTimersByTime(30_000)

    const gaps = FakeWebSocket.opened
      .slice(1)
      .map((socket, i) => socket.createdAt - FakeWebSocket.opened[i].createdAt)
    expect(gaps.length).toBeGreaterThan(2)
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]).toBeGreaterThan(gaps[i - 1])
    }
  })

  it("goes back to reconnecting quickly once it has heard something", () => {
    connect()
    vi.advanceTimersByTime(30_000)

    latest().open()
    latest().receive("state")
    latest().drop()
    const droppedAt = Date.now()

    vi.advanceTimersByTime(reconnectDelay(0, () => 1))

    expect(latest().createdAt - droppedAt).toBeLessThanOrEqual(
      reconnectDelay(0, () => 1)
    )
  })
})

describe("how long to wait before reconnecting", () => {
  it("grows with each attempt", () => {
    const fixed = () => 1
    expect(reconnectDelay(1, fixed)).toBeGreaterThan(reconnectDelay(0, fixed))
    expect(reconnectDelay(2, fixed)).toBeGreaterThan(reconnectDelay(1, fixed))
  })

  it("stops growing, so an operator is never left waiting minutes", () => {
    expect(reconnectDelay(50, () => 1)).toBeLessThanOrEqual(LONGEST_RECONNECT_MS)
  })

  it("is spread, not the same for every admin", () => {
    expect(reconnectDelay(3, () => 0)).toBeLessThan(reconnectDelay(3, () => 1))
  })
})
