import { createMeasurementService, systemClock } from './measurementService'
import { JsonlTraceRecorder } from '../lib/traceRecorder'

/**
 * The composed, application-wide measurement service: real system clock, durable
 * JSONL recorder, configuration sourced from the environment. Behaviour is
 * tunable at runtime via `measurementService.setConfig(...)` and pushed to
 * devices, so cadence/enablement can change without an app rebuild.
 */
const measurementsDir = process.env.MEASUREMENTS_DIR || 'measurements'
const enabled = process.env.MEASUREMENT_ENABLED !== 'false'
const intervalMs = Number(process.env.MEASUREMENT_INTERVAL_MS) || 3000

export const measurementService = createMeasurementService({
  clock: systemClock,
  recorder: new JsonlTraceRecorder(measurementsDir),
  config: { enabled, intervalMs }
})
