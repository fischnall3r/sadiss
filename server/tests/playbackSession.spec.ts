import WebSocket from 'ws'
import { createTestPerformance, createTestTrack } from './testUtils'
import { describe, it, expect } from 'vitest'
import { agent, authCookie } from './setupTests'
import { Types } from 'mongoose'
import { TrackDocument } from '../types'

/**
 * Playback is started as one complete command: everything a run needs is read
 * when it starts, not captured earlier by loading a track. These tests describe
 * that contract through the API.
 */

const createAdminWebSocketClient = (performanceId: string) => {
  const wssPort = (global.testWss.address() as WebSocket.AddressInfo).port
  const messages: any[] = []

  return new Promise<{ ws: WebSocket; messages: any[] }>((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${wssPort}/`, { headers: { cookie: authCookie } })
    ws.onopen = function () {
      this.send(JSON.stringify({ message: 'isAdmin', performanceId }))
      setTimeout(() => resolve({ ws, messages }), 50)
    }
    ws.onmessage = (event) => {
      try {
        messages.push(JSON.parse(event.data.toString()))
      } catch {
        // Non-JSON frames are irrelevant here.
      }
    }
    ws.onerror = reject
  })
}

/** Waits for the first push to the admin saying the performance is playing, and reads what it plays. */
const waitForFirstPlaybackMessage = async (messages: any[], timeoutMs = 8000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const msg = messages.find((m) => m?.message === 'adminInfo' && m.adminInfo.playback?.playing)
    if (msg) return msg.adminInfo.playback
    await new Promise((r) => setTimeout(r, 50))
  }
  return undefined
}

/** A performance holding two tracks of deliberately different lengths. */
const createPerformanceWithTwoTracks = async () => {
  const trackA: TrackDocument = await createTestTrack('partials')
  const trackB: TrackDocument = await createTestTrack('tts')
  const performanceId = await createTestPerformance()

  const res = await agent
    .post('/api/add-tracks-to-performance')
    .send({ trackIds: [trackA._id, trackB._id], performanceId })
    .expect(201)

  const trackPerformanceIdFor = (trackId: Types.ObjectId | string) =>
    res.body.trackPerformances.find((tp: any) => String(tp.track) === String(trackId))._id

  return { trackA, trackB, performanceId, trackPerformanceIdFor }
}

describe('playback session', () => {
  it('plays the track that was requested, not one loaded earlier', { timeout: 20000 }, async () => {
    const { trackA, trackB, performanceId } = await createPerformanceWithTwoTracks()

    const lengthA = (await agent.post('/api/track/load').send({ trackId: trackA._id, performanceId }).expect(200)).body
      .trackLengthInChunks
    const lengthB = (await agent.post('/api/track/load').send({ trackId: trackB._id, performanceId }).expect(200)).body
      .trackLengthInChunks

    // The two tracks must be distinguishable for this test to mean anything.
    expect(lengthA).not.toBe(lengthB)

    // Load A, then start B without loading it again.
    await agent.post('/api/track/load').send({ trackId: trackA._id, performanceId }).expect(200)

    const { ws, messages } = await createAdminWebSocketClient(performanceId.toString())
    try {
      await agent.post('/api/track/start').send({ trackId: trackB._id, performanceId }).expect(200)

      const message = await waitForFirstPlaybackMessage(messages)
      expect(message?.trackId).toBe(trackB._id.toString())
      // totalChunks reveals which track's frames are actually being sent.
      expect(message?.totalChunks).toBe(lengthB)
    } finally {
      await agent.post('/api/track/stop').send({ performanceId })
      ws.close()
    }
  })

  it('plays a track that was never loaded beforehand', { timeout: 20000 }, async () => {
    const { trackA, performanceId } = await createPerformanceWithTwoTracks()

    const { ws, messages } = await createAdminWebSocketClient(performanceId.toString())
    try {
      await agent.post('/api/track/start').send({ trackId: trackA._id, performanceId }).expect(200)

      const message = await waitForFirstPlaybackMessage(messages)
      expect(message).toBeDefined()
      expect(message?.trackId).toBe(trackA._id.toString())
    } finally {
      await agent.post('/api/track/stop').send({ performanceId })
      ws.close()
    }
  })

  it('starts from the stored start time again after being stopped', { timeout: 30000 }, async () => {
    const { trackA, performanceId, trackPerformanceIdFor } = await createPerformanceWithTwoTracks()

    const trackPerformanceId = trackPerformanceIdFor(trackA._id)
    await agent.post('/api/track-performance/set-start-time').send({ trackPerformanceId, startTime: 3 }).expect(200)

    for (const attempt of [1, 2]) {
      const { ws, messages } = await createAdminWebSocketClient(performanceId.toString())
      try {
        await agent.post('/api/track/start').send({ trackId: trackA._id, performanceId }).expect(200)
        const message = await waitForFirstPlaybackMessage(messages)
        expect(message?.chunkIndex, `attempt ${attempt}`).toBe(3)
      } finally {
        await agent.post('/api/track/stop').send({ performanceId })
        ws.close()
      }
    }
  })
})
