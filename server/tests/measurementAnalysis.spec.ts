import { analyzeSample, summarize, filterByRtt, AnalyzedSample } from '../lib/measurementAnalysis'

const mk = (over: Partial<AnalyzedSample> = {}): AnalyzedSample => ({
  rtt: 10,
  ntpOffset: 0,
  serverSharedTime: 0,
  mcorpSharedTime: 0,
  divergence: 0,
  ...over
})

describe('measurementAnalysis', () => {
  describe('analyzeSample', () => {
    it('computes NTP rtt/offset and the server-vs-MCorp clock divergence', () => {
      const a = analyzeSample({ t0: 1000, serverRecv: 5000, serverSend: 5010, t3: 1030, perfNow: 1030, motionPos: 4.0, ctxTime: 1.0 })
      // rtt = (t3-t0) - (serverSend-serverRecv) = 30 - 10 = 20
      expect(a.rtt).toBe(20)
      // offset = ((serverRecv-t0)+(serverSend-t3))/2 = (4000+3980)/2 = 3990 ms
      expect(a.ntpOffset).toBe(3990)
      // serverShared = (perfNow + offset)/1000 = 5020/1000 = 5.02 s
      expect(a.serverSharedTime).toBeCloseTo(5.02, 6)
      expect(a.mcorpSharedTime).toBe(4.0)
      // divergence = 5.02 - 4.0
      expect(a.divergence).toBeCloseTo(1.02, 6)
    })

    it('falls back to t3 when perfNow is absent', () => {
      const a = analyzeSample({ t0: 1000, serverRecv: 5000, serverSend: 5010, t3: 1030, motionPos: 0, ctxTime: 0 })
      expect(a.serverSharedTime).toBeCloseTo((1030 + 3990) / 1000, 6)
    })
  })

  describe('summarize', () => {
    it('reports residual std/max in ms after removing the constant epoch offset', () => {
      const s = summarize([mk({ divergence: 1.0 }), mk({ divergence: 1.02 })])
      expect(s.count).toBe(2)
      expect(s.meanDivergenceSec).toBeCloseTo(1.01, 6)
      // residuals are ±10 ms; population std = 10, max = 10
      expect(s.stdResidualMs).toBeCloseTo(10, 3)
      expect(s.maxResidualMs).toBeCloseTo(10, 3)
    })

    it('handles the empty case', () => {
      expect(summarize([])).toEqual({ count: 0, meanDivergenceSec: 0, stdResidualMs: 0, maxResidualMs: 0 })
    })
  })

  describe('filterByRtt', () => {
    it('keeps the lowest-RTT fraction (best-quality samples)', () => {
      const out = filterByRtt([mk({ rtt: 50 }), mk({ rtt: 10 }), mk({ rtt: 30 }), mk({ rtt: 20 })], 0.5)
      expect(out.map((a) => a.rtt)).toEqual([10, 20])
    })

    it('always keeps at least one sample', () => {
      expect(filterByRtt([mk({ rtt: 5 }), mk({ rtt: 9 })], 0.01)).toHaveLength(1)
    })
  })
})
