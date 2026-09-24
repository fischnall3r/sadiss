import PlaybackProgress from "./PlaybackProgress"

/**
 * The state of the room, as the server pushes it to an admin once a second. The
 * per-performance fields are present only when this admin named a performance.
 */
export default interface AdminInfo {
  activePerformancesCount: number
  connectedClientsCount: number
  serverProtocolVersion: number
  clientsConnectedToPerformanceByChoirId?: Record<string, number>
  clientsConnectedToPerformanceByProtocolVersion?: Record<string, number>
  playback?: PlaybackProgress
}
