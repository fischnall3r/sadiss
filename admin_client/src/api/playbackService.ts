import { Track } from "../types"
import apiClient from "./axiosInstance"

/**
 * Loads a track for playback.
 * @param {string} trackId - The track ID.
 * @param {string} performanceId - The performance ID.
 * @return {Promise<number>} The track length in chunks.
 */
export async function loadTrackForPlayback(
  trackId: string,
  performanceId: string
) {
  const response = await apiClient.post<{ trackLengthInChunks: number }>(
    `/api/track/load`,
    { trackId, performanceId }
  )

  return response.data.trackLengthInChunks
}

export async function startTrack(
  trackId: string,
  performanceId: string,
  loop = false
) {
  const response = await apiClient.post<{ track: Track }>(`/api/track/start`, {
    trackId,
    performanceId,
    loop,
  })

  return response.data
}

export async function stopTrack(performanceId: string) {
  const response = await apiClient.post<{ track: Track }>(`/api/track/stop`, {
    performanceId,
  })

  return response.data!
}
