import { SadissPerformance, Track } from '../models'
import { TrackPerformance } from '../models/trackPerformance'
import { createTestPerformance, createTestTrack, createTestTrackPerformance } from './testUtils'
import { describe, it, expect, vi } from 'vitest'
import { agent } from './setupTests'
import { mockUser } from './setupTests'

describe('trackPerformanceController test', () => {
  describe('addTracksToPerformance function', () => {
    it('should return a 201 status and the saved TrackPerformance data on success', async () => {
      const { _id: trackId } = await createTestTrack()
      const performanceId = await createTestPerformance()

      const trackPerformanceData = { trackIds: [trackId], performanceId }
      await agent.post('/api/add-tracks-to-performance').send(trackPerformanceData).expect(201)

      const savedTrackPerformance = await TrackPerformance.findOne({ track: trackId, performance: performanceId })
      expect(savedTrackPerformance).toBeDefined()
      expect(savedTrackPerformance!.sortOrder).toBe(1)
    })

    it('should set the sortOrder of the TrackPerformance to the number of TrackPerformances in the performance + 1', async () => {
      const { _id: trackId } = await createTestTrack()
      const performanceId = await createTestPerformance()

      const trackPerformanceData = { trackIds: [trackId], performanceId }
      const res = await agent.post('/api/add-tracks-to-performance').send(trackPerformanceData).expect(201)

      const savedTrackPerformance = await TrackPerformance.findOne({ track: trackId, performance: performanceId })
      expect(savedTrackPerformance).toBeDefined()
      expect(savedTrackPerformance!.sortOrder).toBe(1)

      const { _id: trackId2 } = await createTestTrack()
      const trackPerformanceData2 = { trackIds: [trackId2], performanceId }
      const res2 = await agent.post('/api/add-tracks-to-performance').send(trackPerformanceData2).expect(201)

      const savedTrackPerformance2 = await TrackPerformance.findOne({ track: trackId2, performance: performanceId })
      expect(savedTrackPerformance2).toBeDefined()
      expect(savedTrackPerformance2!.sortOrder).toBe(2)
    })

    it('should set the startTime of the TrackPerformance to 0', async () => {
      const { _id: trackId } = await createTestTrack()
      const performanceId = await createTestPerformance()

      const trackPerformanceData = { trackIds: [trackId], performanceId }
      const res = await agent.post('/api/add-tracks-to-performance').send(trackPerformanceData).expect(201)

      const savedTrackPerformance = await TrackPerformance.findOne({ track: trackId, performance: performanceId })
      expect(savedTrackPerformance).toBeDefined()
      expect(savedTrackPerformance!.startTime).toBe(0)
    })

    it('can take an array of trackIds, create a trackPerformance for each of them, and set the sort order correctly', async () => {
      const { _id: trackId1 } = await createTestTrack()
      const { _id: trackId2 } = await createTestTrack()
      const performanceId = await createTestPerformance()

      const trackPerformanceData = { trackIds: [trackId1, trackId2], performanceId }
      const res = await agent.post('/api/add-tracks-to-performance').send(trackPerformanceData).expect(201)

      const savedTrackPerformance1 = await TrackPerformance.findOne({ track: trackId1, performance: performanceId })
      expect(savedTrackPerformance1).toBeDefined()
      expect(savedTrackPerformance1!.sortOrder).toBe(1)
      expect(savedTrackPerformance1!.startTime).toBe(0)

      const savedTrackPerformance2 = await TrackPerformance.findOne({ track: trackId2, performance: performanceId })
      expect(savedTrackPerformance2).toBeDefined()
      expect(savedTrackPerformance2!.sortOrder).toBe(2)
      expect(savedTrackPerformance2!.startTime).toBe(0)
    })

    it('should return a 400 error if no performanceId is provided', async () => {
      const track = await createTestTrack()
      const trackPerformanceData = { track: track }
      const res = await agent.post('/api/add-tracks-to-performance').send(trackPerformanceData)
      expect(res.status).toBe(400)
    })

    it('should return a 400 error if no trackIds are provided', async () => {
      const performanceId = await createTestPerformance()
      const trackPerformanceData = { performanceId }
      const res = await agent.post('/api/add-tracks-to-performance').send(trackPerformanceData)
      expect(res.status).toBe(400)
    })

    it('should return a 400 error if a non-public track is added to a public performance', async () => {
      const performance = await SadissPerformance.create({
        name: 'Test performance',
        isPublic: true,
        creator: mockUser.id
      })
      const track = await Track.create({
        name: 'Test track',
        isPublic: false,
        creator: mockUser.id,
        mode: 'choir',
        waveform: 'sine'
      })
      const trackPerformanceData = { trackIds: [track._id], performanceId: performance._id }
      const res = await agent.post('/api/add-tracks-to-performance').send(trackPerformanceData)
      expect(res.status).toBe(400)
      expect(res.body.message).toBeTruthy()
    })

    it('should return a 500 error if there is an error while creating a TrackPerformance record', async () => {
      vi.spyOn(TrackPerformance, 'insertMany').mockImplementationOnce(() => {
        throw new Error('Server error')
      })

      const { _id: trackId } = await createTestTrack()
      const performanceId = await createTestPerformance()

      const trackPerformanceData = { trackIds: [trackId], performanceId }
      await agent.post('/api/add-tracks-to-performance').send(trackPerformanceData).expect(500)
    })
  })

  describe('POST /api/track-performance/update-order', () => {
    it('Should update the order of all TrackPerformances of the performance and return 200', async () => {
      const { trackPerformances } = await createTestTrackPerformance(2)

      const { _id: id1, sortOrder: sortOrder1 } = trackPerformances[0]
      const { _id: id2, sortOrder: sortOrder2 } = trackPerformances[1]

      const reSortRequestObject = {
        trackPerformances: [
          { trackPerformanceId: id1, sortOrder: sortOrder2 },
          { trackPerformanceId: id2, sortOrder: sortOrder1 }
        ]
      }

      await agent.post('/api/track-performance/update-order').send(reSortRequestObject).expect(200)

      const trackPerformance1 = await TrackPerformance.find({ _id: id1 })
      const trackPerformance2 = await TrackPerformance.find({ _id: id2 })

      expect(trackPerformance1[0].sortOrder).toBe(sortOrder2)
      expect(trackPerformance2[0].sortOrder).toBe(sortOrder1)
    })

    it('Should return 400 if the request body contains invalid data', async () => {
      const performanceId = await createTestPerformance()
      const { _id: trackId } = await createTestTrack()
      const { _id: trackId2 } = await createTestTrack()

      await agent
        .post('/api/add-tracks-to-performance')
        .send({ trackIds: [trackId, trackId2], performanceId })
        .expect(201)

      const res = await agent.get(`/api/performance/${performanceId}/with-tracks`).expect(200)

      const reSortRequestObject = {
        trackPerformances: [
          { trackPerformanceId: res.body.performance.tracks[0].trackPerformanceId, sortOrder: 2 },
          { trackPerformanceId: res.body.performance.tracks[1].trackPerformanceId }
        ]
      }

      await agent.post('/api/track-performance/update-order').send(reSortRequestObject).expect(400)
    })
  })

  describe('POST /api/track-performance/set-start-time', () => {
    it('should set the startTime of the TrackPerformance to the provided value', async () => {
      const { trackPerformances } = await createTestTrackPerformance()
      const { _id: trackPerformanceId } = trackPerformances[0]

      const trackPerformance = await TrackPerformance.findById(trackPerformanceId)
      expect(trackPerformance).toBeDefined()
      expect(trackPerformance!.startTime).toBe(0)

      const startTime = 10
      await agent
        .post('/api/track-performance/set-start-time')
        .send({ trackPerformanceId: trackPerformanceId, startTime })
        .expect(200)

      const updatedTrackPerformance = await TrackPerformance.findById(trackPerformanceId)
      expect(updatedTrackPerformance!.startTime).toBe(startTime)
    })

    it('should return 400 if the provided startTime is less than 0', async () => {
      const { trackPerformances } = await createTestTrackPerformance()
      const { _id: trackPerformanceId } = trackPerformances[0]

      const trackPerformance = await TrackPerformance.findById(trackPerformanceId)
      expect(trackPerformance).toBeDefined()
      expect(trackPerformance!.startTime).toBe(0)

      const startTime = -1
      await agent
        .post('/api/track-performance/set-start-time')
        .send({ trackPerformanceId: trackPerformanceId, startTime })
        .expect(400)
    })

    it('should return 400 if the provided trackPerformanceId is not a valid ObjectId', async () => {
      const { trackPerformances } = await createTestTrackPerformance()

      const { _id: trackPerformanceId } = trackPerformances[0]

      const trackPerformance = await TrackPerformance.findById(trackPerformanceId)
      expect(trackPerformance).toBeDefined()
      expect(trackPerformance!.startTime).toBe(0)

      const startTime = 10
      await agent
        .post('/api/track-performance/set-start-time')
        .send({ trackPerformanceId: 'invalidObjectId', startTime })
        .expect(400)
    })

    it('should return 400 if the provided data is invalid', async () => {
      const { trackPerformances } = await createTestTrackPerformance()
      const { _id: trackPerformanceId } = trackPerformances[0]

      await agent
        .post('/api/track-performance/set-start-time')
        .send({ trackPerformanceId, startTime: 'invalidStartTime' })
        .expect(400)
    })
  })
})

export {}
