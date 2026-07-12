import { PartialChunk } from './types'

export interface PartialMap {
  [partialId: string]: string[]
}

export interface DistributionResult {
  /** Partials each client should receive this frame, keyed by client id. */
  allocation: Record<string, PartialChunk[]>
  /** Assignment to carry into the next frame (partial index -> client ids). */
  nextMap: PartialMap
}

/**
 * Pure allocation of a frame's partials to the connected clients (nonChoir mode).
 *
 * Rules, in order:
 *  - A partial that was distributed last frame stays with the same client(s) if
 *    they are still connected; otherwise it is handed to the client with the
 *    fewest partials.
 *  - A partial that is new (or whose previous holders all left) goes to the
 *    client with the fewest partials, capped at `maxPartialsPerClient` — if every
 *    client is at the cap the partial is dropped.
 *  - Finally, any client still holding nothing is given the least-distributed
 *    partial so no device is left silent.
 *
 * @param clientIds Connected client ids, in priority order (ties break toward the front).
 * @param partials  The current frame's partials.
 * @param previousMap Last frame's assignment. Not mutated.
 */
export const distributePartials = (
  clientIds: string[],
  partials: PartialChunk[],
  previousMap: PartialMap,
  maxPartialsPerClient: number
): DistributionResult => {
  const allocation: Record<string, PartialChunk[]> = {}
  for (const id of clientIds) allocation[id] = []
  const nextMap: PartialMap = {}
  const connected = new Set(clientIds)

  // The client that should receive the next partial, or null if every client is
  // already at the cap.
  const clientWithFewestPartials = (): string | null => {
    for (const id of clientIds) {
      if (!allocation[id].length) return id
    }
    const sorted = [...clientIds].sort((a, b) => allocation[a].length - allocation[b].length)
    if (!sorted.length) return null
    if (allocation[sorted[0]].length >= maxPartialsPerClient) return null
    return sorted[0]
  }

  if (clientIds.length && partials.length) {
    for (const partial of partials) {
      nextMap[partial.index] = []

      const assignToFewest = (): boolean => {
        const id = clientWithFewestPartials()
        if (!id) return false
        nextMap[partial.index].push(id)
        allocation[id].push(partial)
        return true
      }

      if (partial.index in previousMap) {
        // Partial was distributed last frame — keep it with the same clients that
        // are still connected. If none of them are, hand it to the fewest-loaded.
        const stillConnected = previousMap[partial.index].filter((clientId) => connected.has(clientId))
        for (const clientId of stillConnected) {
          nextMap[partial.index].push(clientId)
          allocation[clientId].push(partial)
        }
        if (!stillConnected.length && !assignToFewest()) break
      } else if (!assignToFewest()) {
        break
      }
    }

    // Any client that ended up with nothing gets the least-distributed partial.
    const clientsWithout = clientIds.filter((id) => !allocation[id].length)
    for (const id of clientsWithout) {
      const leastDistributedIndex = Object.keys(nextMap).sort((a, b) => nextMap[a].length - nextMap[b].length)[0]
      const partial = partials.find((p) => p.index === +leastDistributedIndex)
      if (partial) {
        nextMap[leastDistributedIndex].push(id)
        allocation[id].push(partial)
      }
    }
  }

  return { allocation, nextMap }
}
