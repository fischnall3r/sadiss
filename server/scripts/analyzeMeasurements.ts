/**
 * Replays a measurements JSONL recording and reports how closely a self-hosted
 * server clock (derived via NTP from the raw timestamps) would track MCorp's
 * shared clock. See docs/sync-replacement-plan.md §6.2.
 *
 * Run: npx ts-node --transpile-only scripts/analyzeMeasurements.ts <file.jsonl>
 */
import fs from 'fs'
import { analyzeSample, summarize, filterByRtt, RawSample } from '../lib/measurementAnalysis'

const file = process.argv[2]
if (!file) {
  console.error('usage: analyzeMeasurements.ts <measurements.jsonl>')
  process.exit(1)
}

const samples: RawSample[] = fs
  .readFileSync(file, 'utf-8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))

const analyzed = samples.map(analyzeSample)
const withMcorp = analyzed.filter((a) => a.mcorpSharedTime > 0) // motionPos = -1 means MCorp wasn't running

console.log(`file: ${file}`)
console.log(`samples: ${analyzed.length}  (with MCorp clock: ${withMcorp.length})\n`)

console.log('per sample:')
for (const a of analyzed) {
  console.log(
    `  rtt=${a.rtt.toFixed(1).padStart(7)}ms   ntpOffset=${(a.ntpOffset / 1000).toFixed(3)}s   ` +
      `serverShared=${a.serverSharedTime.toFixed(3)}s   mcorp=${a.mcorpSharedTime.toFixed(3)}s`
  )
}

if (!withMcorp.length) {
  console.log('\nNo MCorp clock in this recording (motionPos = -1); cannot compare. Capture with the MCorp key set.')
  process.exit(0)
}

const all = summarize(withMcorp)
const halfRtt = summarize(filterByRtt(withMcorp, 0.5))
const bestRtt = summarize(filterByRtt(withMcorp, 0.25))

console.log('\nHow far our server-derived clock disagrees with MCorp (residual after removing the constant epoch gap):')
console.log(`  all samples          n=${String(all.count).padStart(3)}   std=${all.stdResidualMs.toFixed(1)}ms   max=${all.maxResidualMs.toFixed(1)}ms`)
console.log(`  lowest-RTT half      n=${String(halfRtt.count).padStart(3)}   std=${halfRtt.stdResidualMs.toFixed(1)}ms   max=${halfRtt.maxResidualMs.toFixed(1)}ms`)
console.log(`  lowest-RTT quarter   n=${String(bestRtt.count).padStart(3)}   std=${bestRtt.stdResidualMs.toFixed(1)}ms   max=${bestRtt.maxResidualMs.toFixed(1)}ms`)
console.log('\n(Lower std = our clock tracks MCorp more tightly. RTT filtering should reduce it.)')
