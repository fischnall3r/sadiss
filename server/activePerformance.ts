import { PartialChunk, TrackMode, Frame } from './types'
import { Types } from 'mongoose'
import { logger } from './tools'
import { SadissWebSocketServer } from './lib/SadissWebsocket'
import { distributePartials, PartialMap } from './partialDistribution'

const MAX_PARTIALS_PER_CLIENT = 16

export class ActivePerformance {
  private loadedTrack: Frame[] = []
  public trackMode: TrackMode = 'choir'
  public trackWaveform: OscillatorType = 'sine'
  public trackTtsRate: string = '1'
  private sendingIntervalRunning = false
  private startAtChunk = 0

  constructor(readonly id: Types.ObjectId) {}

  // More or less accurate timer taken from https://stackoverflow.com/a/29972322/16725862
  startSendingInterval = (startTime: number, wss: SadissWebSocketServer, loopTrack: boolean, trackId: string) => {
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

    if (this.sendingIntervalRunning) {
      return false
    }

    this.sendingIntervalRunning = true

    for (const client of wss.clients) {
      if (client.performanceId !== this.id) continue
      client.send(JSON.stringify({ start: true }))
    }

    const interval = 1000 // ms
    let expected = Date.now() + interval
    let chunkIndex = this.startAtChunk

    // This makes it so that we start at the chosen chunk position immediately after starting the track
    // This works because chunks are 1s long.
    let actualStartTime = startTime - this.startAtChunk

    // nonChoir mode: Stores partialIds and array of client ids that were given
    // the respective partial in the last iteration
    let partialMap: PartialMap = {}

    const step = () => {
      logger.info(`Performing ${this.id} @ chunk ${chunkIndex}`)
      if (!this.sendingIntervalRunning) {
        logger.info('Sending interval stopped.')
        reset()
        return
      }

      const shouldContinue = handleTrackEnd()
      if (!shouldContinue) return

      const dt = Date.now() - expected
      if (dt > interval) {
        logger.warn('Sending interval somehow broke. Stopping.')
        this.sendingIntervalRunning = false
        reset()
        return
      }

      if (wss.clients.size) {
        // Distribute partials among clients and send them to clients
        const currentFrame = this.loadedTrack[chunkIndex]

        if (currentFrame) {
          if (this.trackMode === 'choir') {
            handleChoirDistribution(currentFrame)
          } else {
            handleNonChoirDistribution(currentFrame)
          }
        }
      } else {
        logger.info('No clients to distribute to.')
      }

      const admins = Array.from(wss.clients).filter((client) => client.isAdmin && client.performanceId === this.id)
      for (const admin of admins) {
        admin.send(JSON.stringify({ chunkIndex, totalChunks: this.loadedTrack.length, trackId, loop: loopTrack }))
      }

      chunkIndex++

      expected += interval
      setTimeout(step, Math.max(0, interval - dt))
    }

    // Start
    setTimeout(step, interval)

    const handleChoirDistribution = (currentFrame: Frame) => {
      for (const client of wss.clients) {
        if (client.isAdmin || client.performanceId !== this.id) continue

        const dataToSend: DataToSend = {
          startTime: actualStartTime + 2,
          waveform: this.trackWaveform,
          ttsRate: this.trackTtsRate,
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
      const clients = Array.from(wss.clients).filter((client) => !client.isAdmin && client.performanceId === this.id)
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
            waveform: this.trackWaveform,
            ttsRate: this.trackTtsRate,
            chunk
          })
          client.send(json)
          client.lastSentTime = Date.now()
        }
      }

      partialMap = nextMap
    }

    const reset = () => {
      partialMap = {}
      chunkIndex = 0

      // Notify all clients of track end
      for (const client of wss.clients) {
        if (client.performanceId !== this.id) continue
        client.send(JSON.stringify({ stop: true }))
      }
    }

    const handleTrackEnd = () => {
      if (chunkIndex >= this.loadedTrack.length) {
        if (loopTrack) {
          logger.info('No more chunks. Looping.')
          actualStartTime += this.loadedTrack.length
          chunkIndex = 0
          return true
        } else {
          logger.info('No more chunks. Stopping.')
          this.sendingIntervalRunning = false
          reset()
          return false
        }
      }
      return true
    }

    return true
  }

  stopSendingInterval = () => (this.sendingIntervalRunning = false)

  loadTrack = (track: Frame[], mode: TrackMode, waveform: OscillatorType, ttsRate: string, startAtChunk: number) => {
    this.loadedTrack = track
    this.trackMode = mode
    this.trackWaveform = waveform
    this.trackTtsRate = ttsRate
    this.startAtChunk = startAtChunk
  }

  unloadTrack = () => (this.loadedTrack = [])

  hasLoadedTrack = () => this.loadedTrack.length > 0

  isRunning = () => this.sendingIntervalRunning
}
