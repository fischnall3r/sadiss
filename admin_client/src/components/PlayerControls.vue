<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import type { Track } from "../types"
import { loadTrackForPlayback, startTrack, stopTrack } from "../api"
import { formatTime } from "../utils/formatTime"
import PlayIcon from "../assets/play.svg"
import PauseIcon from "../assets/pause.svg"
import ResetIcon from "../assets/reset.svg"
import IconLoop from "../assets/loop.svg"
import { useWebSocket } from "../composables/useWebSocket"

const { addMessageListener } = useWebSocket()

const props = defineProps<{
  performanceId: string
  selectedTrack: Track
  nextTrack?: Track
  trackLoaded: boolean
  selectedTrackLengthInChunks: number
}>()

const emit = defineEmits<{
  (e: "nextTrackStarted"): void
  (e: "setCurrentTrack", trackId: string): void
}>()

const playingTrackId = ref<string>("")
const trackIsRunning = computed(() => playingTrackId.value !== "")

const handleStartTrack = async (trackId: string) => {
  await startTrack(trackId, props.performanceId, shouldLoop.value)
  playingTrackId.value = trackId
}

const handleStopTrack = async () => {
  const res = await stopTrack(props.performanceId)
  if (res) {
    shouldGoToNextTrack.value = false
    playingTrackId.value = ""
  }
}

const shouldLoop = ref(false)
const toggleLoop = () => {
  if (trackIsRunning.value) {
    alert("Cannot toggle loop while track is playing")
    return
  }
  shouldLoop.value = !shouldLoop.value
}

const shouldGoToNextTrack = ref(false)
const toggleShouldGoToNextTrack = () => {
  shouldGoToNextTrack.value = !shouldGoToNextTrack.value
}

const progress = ref<number>(0)
const currentChunkIndex = ref<number>(0)
const totalChunks = ref<number>(0)

const currentChunkTimeFormatted = computed(() =>
  formatTime(currentChunkIndex.value)
)
const totalChunkTimeFormatted = computed(() => {
  if (props.selectedTrackLengthInChunks === -1) return "0.00"
  const valueToFormat = props.selectedTrackLengthInChunks || totalChunks.value
  return formatTime(valueToFormat)
})

const webSocketMessageListener = async (data: any) => {
  if (data.start) {
    // Nothing to do at start.
  }

  if (data.stop) {
    if (shouldGoToNextTrack.value && props.nextTrack) {
      const trackLoadedSuccessfully = await loadTrackForPlayback(
        props.nextTrack._id,
        props.performanceId
      )
      if (!trackLoadedSuccessfully) {
        alert("Failed to load next track. Stopping.")
        playingTrackId.value = ""
        return
      }
      handleStartTrack(props.nextTrack._id)
      emit("nextTrackStarted")
    } else {
      playingTrackId.value = ""
    }
    progress.value = 0
    currentChunkIndex.value = 0
    totalChunks.value = 0
    return
  }

  if (data.trackId) {
    playingTrackId.value = data.trackId
    progress.value = Math.floor((data.chunkIndex / data.totalChunks) * 100)
    currentChunkIndex.value = data.chunkIndex
    totalChunks.value = data.totalChunks
    shouldLoop.value = data.loop

    if (playingTrackId.value !== props.selectedTrack._id) {
      emit("setCurrentTrack", playingTrackId.value)
    }
  }
}

onMounted(async () => {
  addMessageListener(webSocketMessageListener)
})
</script>

<template>
  <div class="flex flex-col items-center justify-between gap-3 py-3">
    <div class="grid grid-cols-3 gap-3 w-full px-5">
      <div>
        <!-- Spacer -->
      </div>
      <div>
        <button
          @click="handleStopTrack"
          class="btn--main-control"
          :title="$t('stop_track')">
          <ResetIcon />
        </button>
        <button
          v-if="!trackIsRunning"
          @click="handleStartTrack(selectedTrack._id)"
          :title="$t('start_track')">
          <PlayIcon />
        </button>
        <button
          v-else
          @click="handleStopTrack"
          :title="$t('stop_track')"
          class="btn--main-control">
          <PauseIcon />
        </button>
      </div>
      <div class="flex items-center justify-end">
        <button
          @click="toggleShouldGoToNextTrack"
          class="mr-4"
          :class="{ 'text-highlight': shouldGoToNextTrack }"
          :title="$t('toggle_auto_play')">
          <!-- <font-awesome-icon icon="fa-forward-fast" size="lg" /> -->
          Auto play
        </button>
        <button @click="toggleLoop" :title="$t('toggle_loop')">
          <IconLoop :class="{ '[&>*]:stroke-highlight': shouldLoop }" />
        </button>
      </div>
    </div>
    <div class="w-full px-5">
      <div class="flex justify-between">
        <p class="text-center">{{ currentChunkTimeFormatted }}</p>
        <p class="text-center">{{ totalChunkTimeFormatted }}</p>
      </div>
      <div class="relative h-[20px] bg-[#D9D9D9] w-full">
        <div
          class="absolute h-full bg-secondary"
          :style="{ width: progress + '%' }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn--main-control {
  @apply h-[48px] w-[48px];
}

.btn--main-control svg {
  @apply w-full h-full;
}
</style>
