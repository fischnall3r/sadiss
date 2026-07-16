import { getTrackDataForDownload, loadTrackForPlayback } from '../services/trackService'
import { createTestTrack, createTestTrackPerformance } from './testUtils'
import { Types } from 'mongoose'
import { getActivePerformance } from '../services/activePerformanceService'
import { describe, it, expect } from 'vitest'

describe('trackService', () => {
  it('should return a track with the correct fields for download', async () => {
    const track = await createTestTrack()

    const result = await getTrackDataForDownload(track._id)

    expect(result.toObject()).toMatchObject({
      name: track.name,
      mode: track.mode,
      notes: track.notes,
      ttsLangs: track.ttsLangs,
      waveform: track.waveform,
      ttsRate: track.ttsRate,
      ttsFiles: track.ttsFiles,
      partialFile: track.partialFile,
      isPublic: track.isPublic,
      creator: new Types.ObjectId(track.creator)
    })
  })

  describe('loadTrackForPlayback', () => {
    it('should load a track into an active performance', async () => {
      const { tracks, performanceId } = await createTestTrackPerformance()
      const track = tracks[0]

      // No active performance should exist yet
      expect(getActivePerformance(performanceId)?.hasLoadedTrack()).toBe(undefined)

      const result = await loadTrackForPlayback(track._id, performanceId)

      expect(result).toBeDefined()
      expect(getActivePerformance(performanceId)?.hasLoadedTrack()).toBe(true)
    })
  })
})
