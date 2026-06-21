import fs from 'fs'
import path from 'path'
import { MeasurementRecord } from '../types'

/**
 * Durable sink for raw measurement records. Kept behind an interface so the
 * storage backend (file, database, object store) can change without touching
 * the measurement service, and so tests can substitute an in-memory fake.
 */
export interface TraceRecorder {
  record(record: MeasurementRecord): Promise<void>
}

/** Non-persistent recorder for tests and ephemeral inspection. */
export class InMemoryTraceRecorder implements TraceRecorder {
  readonly records: MeasurementRecord[] = []

  async record(record: MeasurementRecord): Promise<void> {
    this.records.push(record)
  }
}

/**
 * Appends records as newline-delimited JSON, one file per performance. JSONL is
 * append-only and trivially streamable, which suits replaying a whole
 * performance offline. The directory is created on first write.
 */
export class JsonlTraceRecorder implements TraceRecorder {
  constructor(private readonly dir: string) {}

  async record(record: MeasurementRecord): Promise<void> {
    await fs.promises.mkdir(this.dir, { recursive: true })
    await fs.promises.appendFile(this.filePathFor(record.performanceId), JSON.stringify(record) + '\n')
  }

  private filePathFor(performanceId: string): string {
    // Guard against path traversal from a client-supplied performance id.
    const safeId = performanceId.replace(/[^A-Za-z0-9_-]/g, '_')
    return path.join(this.dir, `measurements-${safeId}.jsonl`)
  }
}
