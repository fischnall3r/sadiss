import { PartialChunk, TrackMode, Frame } from './types'
import { Types } from 'mongoose'
import { logger } from './tools'
import { SadissWebSocketServer, SadissWebSocket } from './lib/SadissWebsocket'
import { distributePartials, PartialMap } from './partialDistribution'

const MAX_PARTIALS_PER_CLIENT = 16
const CHUNK_INTERVAL_MS = 1000

export interface TrackSettings {
  mode: TrackMode
  waveform: OscillatorType
  ttsRate: string
}

/**
 * One run of one track for one performance.
 *
 * A session is complete the moment it is constructed: the frames it sends, the
 * chunk it starts from and the settings it sends them with are all fixed here
 * and never reassigned. A run is therefore always internally consistent, and a
 * change to the stored start time takes effect on the next session rather than
 * on the one already playing.
 */
export class PlaybackSession {
  private running = false
  readonly performanceKey: string

  constructor(
    readonly performanceId: Types.ObjectId | string,
    readonly trackId: string,
    readonly frames: Frame[],
    readonly startAtChunk: number,
    readonly loop: boolean,
    readonly settings: TrackSettings
  ) {
    this.performanceKey = String(performanceId)
  }

  isRunning = () => this.running

  stop = () => (this.running = false)

  /** True if this websocket client belongs to the performance being played. */
  private belongsToPerformance = (client: SadissWebSocket) => String(client.performanceId) === this.performanceKey

  /**
   * Begins sending chunks, one per second. `startTime` is the server's own clock
   * in seconds; devices schedule playback against it.
   *
   * More or less accurate timer taken from https://stackoverflow.com/a/29972322/16725862
   */
  start = (startTime: number, wss: SadissWebSocketServer) => {
    interface DataToSend {
      startTime: number
      waveform: string
      ttsRate: string
      chunk: Chunk
    }

    interface Chunk {
      partials?: PartialChunk[]
      ttsInstructions?: { time: number; phrase: string }
    }

    if (this.running) {
      return false
    }

    this.running = true

    for (const client of wss.clients) {
      if (!this.belongsToPerformance(client)) continue
      client.send(JSON.stringify({ start: true }))
    }

    let expected = Date.now() + CHUNK_INTERVAL_MS
    let chunkIndex = this.startAtChunk

    // Offsetting by the start position makes playback begin at the chosen chunk
    // immediately, rather than after a silent run-up. This works because chunks
    // are 1s long. Looping advances it by a whole track length, so repeats keep
    // scheduling into the future.
    let actualStartTime = startTime - this.startAtChunk

    // nonChoir mode: Stores partialIds and array of client ids that were given
    // the respective partial in the last iteration
    let partialMap: PartialMap = {}

    const step = () => {
      logger.info(`Performing ${this.performanceKey} @ chunk ${chunkIndex}`)
      if (!this.running) {
        logger.info('Sending interval stopped.')
        reset()
        return
      }

      const shouldContinue = handleTrackEnd()
      if (!shouldContinue) return

      const dt = Date.now() - expected
      if (dt > CHUNK_INTERVAL_MS) {
        logger.warn('Sending interval somehow broke. Stopping.')
        this.running = false
        reset()
        return
      }

      if (wss.clients.size) {
        // Distribute partials among clients and send them to clients
        const currentFrame = this.frames[chunkIndex]

        if (currentFrame) {
          if (this.settings.mode === 'choir') {
            handleChoirDistribution(currentFrame)
          } else {
            handleNonChoirDistribution(currentFrame)
          }
        }
      } else {
        logger.info('No clients to distribute to.')
      }

      const admins = Array.from(wss.clients).filter((client) => client.isAdmin && this.belongsToPerformance(client))
      for (const admin of admins) {
        admin.send(
          JSON.stringify({ chunkIndex, totalChunks: this.frames.length, trackId: this.trackId, loop: this.loop })
        )
      }

      chunkIndex++

      expected += CHUNK_INTERVAL_MS
      setTimeout(step, Math.max(0, CHUNK_INTERVAL_MS - dt))
    }

    // Start
    setTimeout(step, CHUNK_INTERVAL_MS)

    const handleChoirDistribution = (currentFrame: Frame) => {
      for (const client of wss.clients) {
        if (client.isAdmin || !this.belongsToPerformance(client)) continue

        const dataToSend: DataToSend = {
          startTime: actualStartTime + 2,
          waveform: this.settings.waveform,
          ttsRate: this.settings.ttsRate,
          chunk: {}
        }

        const partialById = currentFrame.partials.find((chunk) => chunk.index === client.choirId)
        if (partialById) {
          dataToSend.chunk.partials = [partialById]
        }

        if (currentFrame.ttsInstructions) {
          const ttsInstructionForClientId = currentFrame.ttsInstructions[client.choirId]
          if (ttsInstructionForClientId) {
            dataToSend.chunk.ttsInstructions = {
              time: ttsInstructionForClientId.time,
              phrase: ttsInstructionForClientId.langs[client.ttsLang.iso]
            }
          }
        }

        if (dataToSend.chunk.partials || dataToSend.chunk.ttsInstructions) {
          client.send(JSON.stringify(dataToSend))
        }
      }
    }

    const handleNonChoirDistribution = (currentFrame: Frame) => {
      const clients = Array.from(wss.clients).filter((client) => !client.isAdmin && this.belongsToPerformance(client))
      const clientIds = clients.map((client) => String(client.id))

      const { allocation, nextMap } = distributePartials(
        clientIds,
        currentFrame.partials ?? [],
        partialMap,
        MAX_PARTIALS_PER_CLIENT
      )

      for (const client of clients) {
        const chunk: Chunk = {
          partials: allocation[String(client.id)]
        }

        if (currentFrame.ttsInstructions) {
          const firstTtsInstruction = Object.values(currentFrame.ttsInstructions)[0]
          if (firstTtsInstruction) {
            chunk.ttsInstructions = { time: firstTtsInstruction.time, phrase: firstTtsInstruction.langs[client.ttsLang.iso] }
          }
        }

        if (chunk.partials?.length || chunk.ttsInstructions) {
          const json = JSON.stringify({
            startTime: actualStartTime + 2,
            waveform: this.settings.waveform,
            ttsRate: this.settings.ttsRate,
            chunk
          })
          client.send(json)
        }
      }

      partialMap = nextMap
    }

    const reset = () => {
      partialMap = {}
      chunkIndex = 0

      // Notify all clients of track end
      for (const client of wss.clients) {
        if (!this.belongsToPerformance(client)) continue
        client.send(JSON.stringify({ stop: true }))
      }
    }

    const handleTrackEnd = () => {
      if (chunkIndex >= this.frames.length) {
        if (this.loop) {
          logger.info('No more chunks. Looping.')
          actualStartTime += this.frames.length
          chunkIndex = 0
          return true
        } else {
          logger.info('No more chunks. Stopping.')
          this.running = false
          reset()
          return false
        }
      }
      return true
    }

    return true
  }
}
