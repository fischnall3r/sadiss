import { usePlayer } from './usePlayer'
import { createMeasurementController, isInboundMeasurementMessage, MeasurementController } from './measurementController'
import { MeasureMessage, MeasureSampleMessage } from '@/types/measurement'

const { readClockSignals } = usePlayer()

/**
 * Glue that drives clock-sync measurement over the existing WebSocket. It owns
 * the ping timer and wires the real device dependencies (monotonic clock, socket
 * send, live clock signals) into the pure measurementController. All protocol
 * logic lives in the controller; this layer only handles timing and transport.
 */
export function useClockMeasurement() {
  let controller: MeasurementController | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null

  const start = (send: (message: MeasureMessage | MeasureSampleMessage) => void) => {
    controller = createMeasurementController({
      now: () => performance.now(),
      send,
      readSignals: readClockSignals
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
