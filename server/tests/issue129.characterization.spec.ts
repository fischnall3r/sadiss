import { TrackPerformance } from '../models/trackPerformance'
import { createTestTrackPerformance } from './testUtils'
import { describe, it, expect } from 'vitest'
import { agent } from './setupTests'

/**
 * Characterization test for issue #129 (setting a track's start time).
 * It asserts the behaviour a user expects, so a failure here is the bug.
 */
describe('issue #129: setting track start time', () => {
  it('allows resetting a start time back to 0', async () => {
    const { trackPerformances } = await createTestTrackPerformance()
    const { _id: trackPerformanceId } = trackPerformances[0]

    // Set a non-zero start time first, so that resetting it to 0 is a real change.
    await agent.post('/api/track-performance/set-start-time').send({ trackPerformanceId, startTime: 10 }).expect(200)
    expect((await TrackPerformance.findById(trackPerformanceId))!.startTime).toBe(10)

    // Now clear it again.
    await agent.post('/api/track-performance/set-start-time').send({ trackPerformanceId, startTime: 0 }).expect(200)
    expect((await TrackPerformance.findById(trackPerformanceId))!.startTime).toBe(0)
  })
})
