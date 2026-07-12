/**
 * Reads a multi-device measurements JSONL (several phones on one performance)
 * and reports how far apart the phones would drift if driven off the self-hosted
 * server clock — the fleet-sync / "worst device" number. See
 * docs/sync-replacement-plan.md §6.2.
 *
 * Run: npx ts-node --transpile-only scripts/analyzeCrossDevice.ts <file.jsonl>
 */
import fs from 'fs'
import { analyzeSample, analyzeCrossDevice, AnalyzedSample, RawSample } from '../lib/measurementAnalysis'

const file = process.argv[2]
if (!file) {
  console.error('usage: analyzeCrossDevice.ts <measurements.jsonl>')
  process.exit(1)
}

const byDevice = new Map<string, AnalyzedSample[]>()
for (const line of fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean)) {
  const record: RawSample & { clientId: string; motionPos: number } = JSON.parse(line)
  if (record.motionPos <= 0) continue // skip samples taken before MCorp initialised
  const list = byDevice.get(record.clientId) ?? []
  list.push(analyzeSample(record))
  byDevice.set(record.clientId, list)
}

console.log(`file: ${file}`)
console.log(`devices: ${byDevice.size}\n`)

const result = analyzeCrossDevice(byDevice, 0.5) // lowest-RTT half per device

console.log('per device (lowest-RTT half):')
for (const d of result.devices) {
  const tag = d.mcorpHealthy ? '' : '  [MCorp stale/frozen — excluded]'
  console.log(`  ${d.clientId.slice(0, 8)}  n=${String(d.samples).padStart(3)}  residualStd=${d.residualStdMs.toFixed(1)}ms${tag}`)
}

console.log(`\nFleet agreement if driven off the server clock (healthy devices; ${result.outliers} excluded as stale MCorp):`)
console.log(`  cross-device spread (max-min): ${result.crossDeviceSpreadMs.toFixed(1)} ms`)
console.log(`  cross-device std:              ${result.crossDeviceStdMs.toFixed(1)} ms`)
console.log('\n(Small spread => phones would stay tightly synced to each other. This is the number that decides a performance.)')
