import { getTrackDataForDownload, loadTrackForPlayback } from '../services/trackService'
import { createTestTrack, createTestTrackPerformance } from './testUtils'
import { Types } from 'mongoose'
import { getSession } from '../services/playbackService'
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
    it('reports the track length without starting playback', async () => {
      const { tracks, performanceId } = await createTestTrackPerformance()
      const track = tracks[0]

      expect(getSession(performanceId)).toBeUndefined()

      const result = await loadTrackForPlayback(track._id, performanceId)

      expect(result.trackLengthInChunks).toBeGreaterThan(0)
      // Loading prepares nothing that playback later depends on.
      expect(getSession(performanceId)).toBeUndefined()
    })
  })
})
