import { usePlayer } from './usePlayer'
import { createMeasurementController, isInboundMeasurementMessage, MeasurementController } from './measurementController'
import { ServerClock } from './serverClock'
import { MeasureMessage, MeasureSampleMessage } from '@/types/measurement'

const { readClockSignals, setMotionRef } = usePlayer()

/**
 * Glue that drives clock-sync over the existing WebSocket. It owns the ping
 * timer, wires the real device dependencies into the pure measurementController,
 * and feeds each round trip into the ServerClock — which the player reads through
 * `setMotionRef` as the shared clock.
 */
export function useClockMeasurement() {
  let controller: MeasurementController | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null

  const start = (send: (message: MeasureMessage | MeasureSampleMessage) => void) => {
    const clock = new ServerClock()
    setMotionRef({
      get pos() {
        return clock.posAt(performance.now())
      }
    })
    controller = createMeasurementController({
      now: () => performance.now(),
      send,
      readSignals: readClockSignals,
      onRoundTrip: (roundTrip) => clock.add(roundTrip)
    })
  }

  /**
   * Routes an inbound socket payload. Returns true if it was a measurement
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
    if (controller && controller.isEnabled() && controller.getIntervalMs() > 0) {
      pingInterval = setInterval(() => controller?.ping(), controller.getIntervalMs())
    }
  }

  const stopPinging = () => {
    if (pingInterval) {
      clearInterval(pingInterval)
      pingInterval = null
    }
  }

  const stop = () => {
    stopPinging()
    controller = null
  }

  return { start, handleMessage, stop }
}
