import { initializeActivePerformance } from '../services/activePerformanceService'
import { createTestTrackPerformance, createWebSocketClient } from './testUtils'
import { readAndParseChunkFile } from '../services/fileService'
import { Types } from 'mongoose'

describe('activePerformance test', () => {
  describe('startSendingInterval', () => {
    it('choir mode: correctly distributes chunks', async () => {
      //TODO: This is unfinished
      expect(true).toBe(true)

      return

      const { performanceId, tracks } = await createTestTrackPerformance()
      const activePerformance = initializeActivePerformance(performanceId)
      activePerformance.trackMode = 'nonChoir'

      const track = tracks[0]
      const chunks = await readAndParseChunkFile(track)

      const wsClient1 = await createWebSocketClient(performanceId.toString())
      const wsClient2 = await createWebSocketClient(performanceId.toString(), 1)

      activePerformance.loadTrack(chunks!, track.mode, track.waveform, track.ttsRate, 0)
      activePerformance.startSendingInterval(0, global.testWss, false, track._id.toString())

      vi.advanceTimersByTime(10000)
    })
  })

  it('should unload the track from an active performance', () => {
    const performanceId = new Types.ObjectId()
    const activePerformance = initializeActivePerformance(performanceId)
    activePerformance.loadTrack([], 'nonChoir', 'sine', '1', 0)
    activePerformance.unloadTrack()
    expect(activePerformance.hasLoadedTrack()).toBe(false)
  })

  it('should return false if the track is not loaded', () => {
    const performanceId = new Types.ObjectId()
    const activePerformance = initializeActivePerformance(performanceId)
    expect(activePerformance.hasLoadedTrack()).toBe(false)
  })
})
