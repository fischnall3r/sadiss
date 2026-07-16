import { Types } from 'mongoose'
import { initializeActivePerformance, initializeActivePerformanceAndLoadTrack } from '../services/activePerformanceService'
import { createTestTrackPerformance } from './testUtils'
import { readAndParseChunkFile } from '../services/fileService'
import { describe, it, expect } from 'vitest'

describe('activePerformanceService test', () => {
  it("should initialize an active performance if it doesn't already exist", () => {
    const performanceId = new Types.ObjectId()
    const activePerformance = initializeActivePerformance(performanceId)
    expect(activePerformance).toBeDefined()
  })

  it('should return the same active performance if it already exists', () => {
    const performanceId = new Types.ObjectId()
    const activePerformance1 = initializeActivePerformance(performanceId)
    const activePerformance2 = initializeActivePerformance(performanceId)
    expect(activePerformance1).toBe(activePerformance2)
  })

  it('should load a track into an active performance', async () => {
    const { tracks, performanceId } = await createTestTrackPerformance()
    const track = tracks[0]
    const chunks = await readAndParseChunkFile(track)
    if (!chunks) {
      throw new Error('Failed to read and parse chunk file')
    }

    const activePerformanceWithLoadedTrack = initializeActivePerformanceAndLoadTrack(
      performanceId,
      chunks,
      track.mode,
      track.waveform,
      track.ttsRate,
      0
    )

    expect(activePerformanceWithLoadedTrack.hasLoadedTrack()).toBe(true)
  })
})
