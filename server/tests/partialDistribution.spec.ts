/**
 * Unit tests for the pure distributePartials() extracted from
 * ActivePerformance.startSendingInterval. These exercise the allocation
 * algorithm directly — no ws clients, no timers.
 */
import { distributePartials, PartialMap } from '../partialDistribution'
import { PartialChunk } from '../types'

const partial = (index: number): PartialChunk => ({
  index,
  startTime: 0,
  endTime: 1,
  breakpoints: [{ time: 0, freq: 440 + index, amp: 1 }]
})

const indicesOf = (ps: PartialChunk[] = []): number[] => ps.map((p) => p.index).sort((a, b) => a - b)

describe('distributePartials', () => {
  it('keeps a partial with a still-connected holder when a co-holder disconnects, without dropping its other partials', () => {
    // Last frame: partial 5 was held by B and A; partial 7 by A alone. Now B leaves.
    const previous: PartialMap = { 5: ['B', 'A'], 7: ['A'] }

    const { allocation } = distributePartials(['A'], [partial(5), partial(7)], previous, 16)

    // A held both 5 and 7 and is still connected, so it must keep both.
    expect(indicesOf(allocation['A'])).toEqual([5, 7])
  })

  it('does not mutate the previousMap it is given', () => {
    const previous: PartialMap = { 5: ['B', 'A'] }

    distributePartials(['A'], [partial(5)], previous, 16)

    expect(previous).toEqual({ 5: ['B', 'A'] })
  })
})
