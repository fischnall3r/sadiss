import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { effectScope } from "vue"
import { useAdminInfo } from "../src/composables/useAdminInfo"
import { FakeWebSocket, latestSocket } from "./fakeWebSocket"
import AdminInfo from "../src/types/AdminInfo"

/**
 * These stand in for the browser's WebSocket and move the clock by hand, so a
 * reconnect costs a line rather than seconds.
 */

const adminInfo = (overrides: Partial<AdminInfo> = {}): AdminInfo => ({
  activePerformancesCount: 0,
  connectedClientsCount: 3,
  serverProtocolVersion: 2,
  ...overrides,
})

const push = (info: AdminInfo) =>
  latestSocket().receive(JSON.stringify({ message: "adminInfo", adminInfo: info }))

let mounted: ReturnType<typeof effectScope>[] = []

/**
 * Runs a consumer the way a component would. Anything still mounted is taken
 * down after each test, so a failing assertion cannot leave a connection open
 * for the next one to find.
 */
const consumer = (performanceId?: string) => {
  const scope = effectScope()
  mounted.push(scope)
  const result = scope.run(() => useAdminInfo(performanceId))!
  return { ...result, unmount: () => scope.stop() }
}

describe("keeping the state of the room current", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.opened = []
    vi.stubGlobal("WebSocket", FakeWebSocket)
  })

  afterEach(() => {
    mounted.forEach(scope => scope.stop())
    mounted = []
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("registers for the performance it was asked about", () => {
    const admin = consumer("performance-1")
    latestSocket().open()

    expect(JSON.parse(latestSocket().sent[0])).toEqual({
      message: "isAdmin",
      performanceId: "performance-1",
    })
  })

  it("registers for the room when asked about no performance", () => {
    const admin = consumer()
    latestSocket().open()

    expect(JSON.parse(latestSocket().sent[0])).toEqual({ message: "isAdmin" })
  })

  // The registration is not something a view sends once; it is what following a
  // performance means, so every new connection makes it again.
  it("registers again on a connection that replaced a dropped one", () => {
    const admin = consumer("performance-1")
    latestSocket().open()
    latestSocket().drop()

    vi.advanceTimersByTime(10_000)
    latestSocket().open()

    expect(JSON.parse(latestSocket().sent[0])).toEqual({
      message: "isAdmin",
      performanceId: "performance-1",
    })
  })

  it("holds the state the server last pushed", () => {
    const admin = consumer("performance-1")
    latestSocket().open()
    push(adminInfo({ connectedClientsCount: 7 }))

    expect(admin.info.value?.connectedClientsCount).toBe(7)
  })

  it("keeps the last state it heard when the connection goes", () => {
    const admin = consumer("performance-1")
    latestSocket().open()
    push(adminInfo({ connectedClientsCount: 7 }))
    latestSocket().drop()

    expect(admin.live.value).toBe(false)
    expect(admin.info.value?.connectedClientsCount).toBe(7)
  })

  it("is not live until the server has said something", () => {
    const admin = consumer("performance-1")
    latestSocket().open()

    expect(admin.live.value).toBe(false)

    push(adminInfo())

    expect(admin.live.value).toBe(true)
  })

  it("ignores anything that is not the state of the room", () => {
    const admin = consumer("performance-1")
    latestSocket().open()
    push(adminInfo({ connectedClientsCount: 7 }))

    latestSocket().receive("not json at all")
    latestSocket().receive(JSON.stringify({ message: "somethingElse" }))

    expect(admin.info.value?.connectedClientsCount).toBe(7)
  })

  // A view and the controls inside it follow the same performance.
  it("opens one connection however many are following the same performance", () => {
    const view = consumer("performance-1")
    const controls = consumer("performance-1")

    expect(FakeWebSocket.opened).toHaveLength(1)

    latestSocket().open()
    push(adminInfo({ connectedClientsCount: 7 }))

    expect(view.info.value?.connectedClientsCount).toBe(7)
    expect(controls.info.value?.connectedClientsCount).toBe(7)
  })

  it("keeps the connection while anything is still following", () => {
    const view = consumer("performance-1")
    const controls = consumer("performance-1")
    const socket = latestSocket()

    controls.unmount()

    expect(socket.closed).toBe(false)

    view.unmount()

    expect(socket.closed).toBe(true)
  })

  it("opens a fresh connection for whoever comes next", () => {
    consumer("performance-1").unmount()
    const later = consumer("performance-1")

    expect(FakeWebSocket.opened).toHaveLength(2)
    expect(latestSocket().closed).toBe(false)
  })

  it("follows the room and a performance on separate connections", () => {
    consumer()
    consumer("performance-1")

    expect(FakeWebSocket.opened).toHaveLength(2)
  })
})
