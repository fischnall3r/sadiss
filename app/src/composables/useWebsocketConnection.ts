import { useMainStore } from '@/stores/MainStore'
import { onUnmounted, ref } from 'vue'
import { usePlayer } from './usePlayer'
import { useClockMeasurement } from './useClockMeasurement'
import { Capacitor } from '@capacitor/core'

const { handleChunkData, setOffset, stopPlayback, setStartTime, setTrackSettings } = usePlayer()
const measurement = useClockMeasurement()

const isRegistered = ref(false)
let attemptingToRegister = false
export function useWebsocketConnection() {
  const mainStore = useMainStore()
  const ws = ref<WebSocket>()

  const establishWebsocketConnection = async () => {
    if (attemptingToRegister || isRegistered.value) return
    attemptingToRegister = true
    while (!mainStore.wsUrl) {
      console.log('waiting for ws url')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    console.log('ws url: ', mainStore.wsUrl)
    ws.value = new WebSocket(mainStore.wsUrl)

    ws.value.onopen = function () {
      isRegistered.value = true
      attemptingToRegister = false
      measurement.start((message) => this.send(JSON.stringify(message)))
      this.send(
        JSON.stringify({
          message: 'clientInfo',
          clientId: mainStore.choirId,
          ttsLang: mainStore.selectedLanguage,
          performanceId: mainStore.performanceId
        })
      )
    }

    ws.value.onclose = () => {
      isRegistered.value = false
      attemptingToRegister = false
      stopPlayback()
      measurement.stop()
      // Trying to reconnect here while App is in background does not work.
    }

    ws.value.onerror = (error) => {
      isRegistered.value = false
      attemptingToRegister = false
      stopPlayback()
      console.error(JSON.stringify(error))
    }

    ws.value.onmessage = (event) => {
      if (!event.data) {
        return
      }

      console.log(event.data)

      let data
      try {
        data = JSON.parse(event.data)
        console.log(data)
      } catch (error) {
        // Data is not JSON, ignore it
        return
      }

      // Clock-sync measurement messages are handled separately and must not fall
      // through to playback processing.
      if (measurement.handleMessage(data)) {
        return
      }

      if (data.start) {
        setOffset()
      }

      if (data.stop) {
        stopPlayback()
        return
      }

      // We need to set globalStartTime every time we receive data and not just at the start of the track because clients can join late.
      setStartTime(data.startTime)

      // TODO: This can be moved into usePlayer.ts, doesn't need to happen here.
      let ttsRate = data.ttsRate

      if (Capacitor.getPlatform() === 'ios') {
        ttsRate = ttsRateCorrection(ttsRate)
      }

      setTrackSettings(data.waveform, ttsRate)

      // TODO: This can be moved into usePlayer.ts, doesn't need to happen here.
      if (data.chunk && Object.keys(data.chunk).length) {
        handleChunkData(data.chunk)
      }
    }

    onUnmounted(() => {
      ws.value?.close()
    })
  }

  return { establishWebsocketConnection, attemptingToRegister, isRegistered }
}

const ttsRateCorrection = (ttsRate: number) => {
  const ttsRateLookupTable = {
    0.2: 0.15,
    0.3: 0.2,
    0.4: 0.3,
    0.5: 0.5,
    0.6: 0.6,
    0.7: 0.8,
    0.8: 0.92,
    0.9: 1.05,
    1.0: 1.06,
    1.1: 1.07,
    1.2: 1.08,
    1.3: 1.1,
    1.4: 1.12,
    1.5: 1.15
  }

  return ttsRateLookupTable[ttsRate as keyof typeof ttsRateLookupTable] || ttsRate
}
