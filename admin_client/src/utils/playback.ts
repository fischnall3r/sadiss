import PlaybackProgress from "../types/PlaybackProgress"

/**
 * Reading the player's display out of what the server reports.
 *
 * The server sends the whole playback state every second rather than announcing
 * changes, so everything the controls show is worked out from the latest push
 * alone. What used to be an event — a track reaching its end — is a difference
 * between two of them.
 */

/** Nothing has been heard from the server yet. */
export const NOT_PLAYING: PlaybackProgress = { playing: false }

/** How far through the track the progress bar should be drawn, as a percentage. */
export const percentPlayed = (playback: PlaybackProgress) => {
  if (!playback.playing || playback.totalChunks <= 0) return 0

  return Math.floor((playback.chunkIndex / playback.totalChunks) * 100)
}

/**
 * Whether the track that was playing has come to an end.
 *
 * An operator pressing stop produces the same difference as a track running out,
 * so this says only that the run is over. Whether that should start the next
 * track is a separate question the controls answer.
 */
export const trackEnded = (before: PlaybackProgress, now: PlaybackProgress) => before.playing && !now.playing

/** The track the server says is playing, if it is not the one already selected. */
export const trackToSelect = (playback: PlaybackProgress, selectedTrackId: string) =>
  playback.playing && playback.trackId !== selectedTrackId ? playback.trackId : undefined
