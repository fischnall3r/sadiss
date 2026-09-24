/**
 * How many devices are registered on each voice, as the connected-clients bar
 * shows it.
 *
 * Every voice the loaded tracks call for appears, so an empty one reads as zero
 * rather than being missing. A device registered on a voice outside that range
 * is shown under an `X` key: it is a phone that will hear nothing, and the
 * operator has to find it before the performance starts.
 */
export const voiceCounts = (
  connectedByChoirId: Record<string, number>,
  voicesInTracks: number
) => {
  const counts: Record<string, number> = {}

  for (let voice = 0; voice < voicesInTracks; voice++) {
    counts[`${voice}`] = 0
  }

  for (const choirId in connectedByChoirId) {
    const devices = connectedByChoirId[choirId]
    if (!devices) continue

    counts[choirId in counts ? choirId : `X ${choirId}`] = devices
  }

  return counts
}
