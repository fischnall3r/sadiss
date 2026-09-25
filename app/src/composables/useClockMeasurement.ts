import { usePlayer } from './usePlayer'
import { createMeasurementController, isInboundMeasurementMessage, MeasurementController } from './measurementController'
import { ServerClock } from './serverClock'
import { MeasureMessage } from '@/types/measurement'

const { setMotionRef } = usePlayer()

/**
 * Glue that drives clock-sync over the existing WebSocket. It owns the ping
 * timer, wires the real device dependencies into the pure measurementController,
 * and feeds each round trip into the ServerClock — which the player reads through
 * `setMotionRef` as the shared clock.
 */
export function useClockMeasurement() {
  let controller: MeasurementController | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null

  // One clock for every connection. The server's clock does not change when the
  // connection does, and the estimate is built from a minute of round trips, so
  // starting it over would leave a reconnected phone silent until the first
  // reply and imprecise until the window refills.
  const clock = new ServerClock()
  setMotionRef({
    get pos() {
      return clock.posAt(performance.now())
    }
  })

  /** Begins clock sync over a connection, replacing any earlier one. */
  const start = (send: (message: MeasureMessage) => void) => {
    controller = createMeasurementController({
      now: () => performance.now(),
      send,
      onRoundTrip: (roundTrip) => clock.add(roundTrip)
    })
  }

  /**
   * Routes an inbound socket payload. Returns true if it was a clock-sync
   * message (and was handled), so the caller can skip its own processing.
   */
  const handleMessage = (payload: { message?: unknown }): boolean => {
    if (!controller || !isInboundMeasurementMessage(payload)) return false
    controller.handleMessage(payload)
    syncPingSchedule()
    return true
  }

  const syncPingSchedule = () => {
    stopPinging()
    if (controller && controller.getIntervalMs() > 0) {
      pingInterval = setInterval(() => controller?.ping(), controller.getIntervalMs())
    }
  }

  const stopPinging = () => {
    if (pingInterval) {
      clearInterval(pingInterval)
      pingInterval = null
    }
  }

  /** How often the server has asked for a round trip, or 0 before it has said. */
  const intervalMs = () => controller?.getIntervalMs() ?? 0

  return { start, handleMessage, intervalMs }
}
