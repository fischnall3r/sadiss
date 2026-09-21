/**
 * Where a performance has got to, as the server reports it. Mirrors
 * `PlaybackProgress` in server/playbackSession.ts.
 *
 * This arrives inside every `adminInfo` push, once a second, whenever this admin
 * named a performance. It is the whole answer each time, so nothing here is a
 * change to apply on top of what was known before — see docs/wire-protocol.md.
 */
type PlaybackProgress =
  | { playing: false }
  | {
      playing: true
      trackId: string
      chunkIndex: number
      totalChunks: number
      loop: boolean
    }

export default PlaybackProgress
