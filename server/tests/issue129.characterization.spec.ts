import WebSocket from 'ws'
import { TrackPerformance } from '../models/trackPerformance'
import { createTestTrackPerformance } from './testUtils'
import { describe, it, expect } from 'vitest'
import { agent } from './setupTests'

/** Connects an admin websocket for a performance and collects its messages. */
const createAdminWebSocketClient = (performanceId: string) => {
  const wssPort = (global.testWss.address() as WebSocket.AddressInfo).port
  const messages: any[] = []

  return new Promise<{ ws: WebSocket; messages: any[] }>((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${wssPort}/`)
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

/** Waits for the first playback message carrying a chunk index. */
const waitForFirstChunkIndex = async (messages: any[], timeoutMs = 8000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const msg = messages.find((m) => typeof m?.chunkIndex === 'number')
    if (msg) return msg.chunkIndex
    await new Promise((r) => setTimeout(r, 50))
  }
  return undefined
}

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

  it('starts at a start time changed after the track was selected', async () => {
    const { tracks, performanceId, trackPerformances } = await createTestTrackPerformance()
    const trackId = tracks[0]._id
    const { _id: trackPerformanceId } = trackPerformances[0]

    // The admin selects a track, which loads it for playback.
    await agent.post('/api/track-performance/set-start-time').send({ trackPerformanceId, startTime: 5 }).expect(200)
    await agent.post('/api/track/load').send({ trackId, performanceId }).expect(200)

    // Then changes its start time, without reselecting the track.
    await agent.post('/api/track-performance/set-start-time').send({ trackPerformanceId, startTime: 2 }).expect(200)

    const { ws, messages } = await createAdminWebSocketClient(performanceId.toString())

    try {
      await agent.post('/api/track/start').send({ trackId, performanceId }).expect(200)
      expect(await waitForFirstChunkIndex(messages)).toBe(2)
    } finally {
      await agent.post('/api/track/stop').send({ performanceId })
      ws.close()
    }
  })
})
