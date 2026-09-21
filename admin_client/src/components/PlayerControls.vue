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
import PlaybackProgress from "../types/PlaybackProgress"
import {
  NOT_PLAYING,
  percentPlayed,
  trackEnded,
  trackToSelect,
} from "../utils/playback"

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

/**
 * What the server last said about this performance. It sends the whole state
 * once a second, so this is replaced rather than amended, and a push that goes
 * missing costs a second rather than stranding the controls.
 */
const playback = ref<PlaybackProgress>(NOT_PLAYING)

const progress = computed(() => percentPlayed(playback.value))
const currentChunkIndex = computed(() =>
  playback.value.playing ? playback.value.chunkIndex : 0
)

const currentChunkTimeFormatted = computed(() =>
  formatTime(currentChunkIndex.value)
)
const totalChunkTimeFormatted = computed(() => {
  if (props.selectedTrackLengthInChunks === -1) return "0.00"
  const totalChunks = playback.value.playing ? playback.value.totalChunks : 0
  const valueToFormat = props.selectedTrackLengthInChunks || totalChunks
  return formatTime(valueToFormat)
})

const startNextTrack = async () => {
  if (!props.nextTrack) return

  const trackLoadedSuccessfully = await loadTrackForPlayback(
    props.nextTrack._id,
    props.performanceId
  )
  if (!trackLoadedSuccessfully) {
    alert("Failed to load next track. Stopping.")
    return
  }

  await handleStartTrack(props.nextTrack._id)
  emit("nextTrackStarted")
}

const applyPlayback = async (reported: PlaybackProgress) => {
  const previous = playback.value
  playback.value = reported

  if (reported.playing) {
    playingTrackId.value = reported.trackId
    shouldLoop.value = reported.loop

    const following = trackToSelect(reported, props.selectedTrack._id)
    if (following) emit("setCurrentTrack", following)
    return
  }

  playingTrackId.value = ""

  if (trackEnded(previous, reported) && shouldGoToNextTrack.value) {
    await startNextTrack()
  }
}

const webSocketMessageListener = async (data: any) => {
  if (data.message === "adminInfo" && data.adminInfo?.playback) {
    await applyPlayback(data.adminInfo.playback)
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
