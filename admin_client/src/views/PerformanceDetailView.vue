<script setup lang="ts">
import { computed, onMounted, ref, Ref, watch, useTemplateRef } from "vue"
import { VueDraggable } from "vue-draggable-plus"
import {
  SadissPerformance,
  Track,
  TrackPerformanceIdAndSortOrder,
} from "../types"
import {
  deleteTrackFromPerformance,
  getPerformanceWithTracks,
  loadTrackForPlayback,
  updateTrackPerformanceOrder,
} from "../api"
import ConnectedClientsList from "../components/ConnectedClientsList.vue"
import PlayerControls from "../components/PlayerControls.vue"
import { formatTime } from "../utils/formatTime"
import WaveformIcon from "../assets/waveform.svg"
import TtsRateIcon from "../assets/tts_rate.svg"
import ClockIcon from "../assets/clock.svg"
import IconTrash from "../assets/trash.svg"
import IconQrCode from "../assets/qr_code.svg"
import ModalSetStartTime from "../components/modals/ModalSetStartTime.vue"
import ActionButtonLink from "../components/ActionButtonLink.vue"
import { useI18n } from "vue-i18n"
import { useWebSocket } from "../composables/useWebSocket"
import { useElementSize } from "@vueuse/core"

const { t } = useI18n()

const props = defineProps<{ performanceId: string }>()

const { sendMessage, addMessageListener } = useWebSocket()

const header = useTemplateRef<HTMLDivElement>("header")
const { height: headerHeight } = useElementSize(header)

const performance: Ref<SadissPerformance | null> = ref(null)
const tracks: Ref<Track[] | null> = ref(null)

const selectedTrackIndex = ref(-1)
const selectedTrackLengthInChunks = ref(-1)

const nextTrack = computed(() => {
  if (selectedTrackIndex.value === -1 || !tracks.value) return
  return tracks.value[selectedTrackIndex.value + 1]
})

const onSortOrderUpdate = async () => {
  if (!tracks.value) return

  const trackPerformanceIdsAndSortOrders: TrackPerformanceIdAndSortOrder[] = []

  for (const [index, track] of tracks.value.entries()) {
    trackPerformanceIdsAndSortOrders.push({
      trackPerformanceId: track.trackPerformanceId as string,
      sortOrder: index + 1,
    })
  }

  // Make no track selected to prevent a visual issue where the selected track
  // changes to the one taking its place after it was dragged.
  selectedTrackIndex.value = -1

  await updateTrackPerformanceOrder(trackPerformanceIdsAndSortOrders)
}

const handleTrackSelect = async (index: number) => {
  if (selectedTrackIndex.value === index || !tracks.value) return

  selectedTrackLengthInChunks.value = -1

  try {
    selectedTrackIndex.value = index
    selectedTrackLengthInChunks.value = await loadTrackForPlayback(
      tracks.value[index]._id,
      props.performanceId
    )
  } catch (error) {
    selectedTrackIndex.value = -1
    selectedTrackLengthInChunks.value = -1
  }
}

const setStartTimeModalDisplayed = ref(false)
const showModalSetStartTime = () => {
  setStartTimeModalDisplayed.value = true
}

// The track list is only fetched on mount, so the saved value has to be applied
// to the loaded track as well, or the list keeps showing the old start time.
const handleStartTimeSet = (startTimeInChunks: number) => {
  const track = tracks.value?.[selectedTrackIndex.value]
  if (track) {
    track.startTime = startTimeInChunks
  }
  setStartTimeModalDisplayed.value = false
}

const handleDeleteTrackFromPerformance = async (trackPerformanceId: string) => {
  if (!confirm(t("confirm_delete_track_from_performance"))) return

  if (!trackPerformanceId) return

  try {
    await deleteTrackFromPerformance(trackPerformanceId)
    tracks.value?.splice(selectedTrackIndex.value, 1)
  } catch (error) {
    console.error(error)
  }
}

// We calculate here instead of on the server because we don't fetch the performance with tracks
// again when deleting a track from the performance.
const maxVoiceCount = computed(() => {
  if (!tracks.value) return 0

  return Math.max(
    ...tracks.value.flatMap(track => [
      track.partialsCount ?? 0,
      track.ttsFiles?.length ?? 0,
    ])
  )
})

const clientsConnectedToPerformanceByChoirId: Ref<Record<string, number>> = ref(
  {}
)

const clientsConnectedToPerformanceByProtocolVersion: Ref<
  Record<string, number>
> = ref({})

const serverProtocolVersion = ref(0)

addMessageListener(data => {
  if (
    data.message === "adminInfo" &&
    data.adminInfo.clientsConnectedToPerformanceByChoirId
  ) {
    clientsConnectedToPerformanceByProtocolVersion.value =
      data.adminInfo.clientsConnectedToPerformanceByProtocolVersion
    serverProtocolVersion.value = data.adminInfo.serverProtocolVersion
    clientsConnectedToPerformanceByChoirId.value = {}

    for (let i = 0; i < maxVoiceCount.value; i++) {
      clientsConnectedToPerformanceByChoirId.value[`${i}`] = 0
    }

    for (const choirId in data.adminInfo
      .clientsConnectedToPerformanceByChoirId) {
      const voiceCount =
        data.adminInfo.clientsConnectedToPerformanceByChoirId[choirId]
      if (voiceCount) {
        const key = Object.keys(
          clientsConnectedToPerformanceByChoirId.value
        ).includes(choirId)
          ? choirId
          : `X ${choirId}`
        clientsConnectedToPerformanceByChoirId.value[key] = voiceCount
      }
    }
  }
})

watch(
  () => performance.value,
  newValue => {
    if (newValue) {
      tracks.value = newValue.tracks
    }
  }
)

onMounted(async () => {
  try {
    const performanceId = props.performanceId as string
    performance.value = await getPerformanceWithTracks(performanceId)
    sendMessage({
      message: "isAdmin",
      performanceId: props.performanceId,
    })
  } catch (error) {
    console.error(error)
  }
})
</script>
<template>
  <div v-if="performance" class="w-full relative">
    <div ref="header" class="fixed left-0 right-0 bg-white shadow-lg">
      <ConnectedClientsList
        ref="connectedClientsList"
        :connected-clients="clientsConnectedToPerformanceByChoirId"
        :protocol-versions="clientsConnectedToPerformanceByProtocolVersion"
        :server-protocol-version="serverProtocolVersion" />
      <h1>{{ performance.name }}</h1>
      <!-- QR Code generation button -->
      <RouterLink
        class="absolute top-12 md:top-6 left-5"
        :to="`/performance/${performanceId}/create-qr-codes`">
        <IconQrCode class="w-[27px] h-[27px]" />
      </RouterLink>
      <p
        v-if="selectedTrackIndex > -1 && tracks && tracks[selectedTrackIndex]"
        class="text-center mb-4">
        {{ selectedTrackIndex + 1 }} {{ tracks[selectedTrackIndex].name }}
        <PlayerControls
          :performance-id="performanceId"
          :selected-track="tracks[selectedTrackIndex]"
          :next-track="nextTrack"
          :track-loaded="selectedTrackLengthInChunks > -1"
          :selected-track-length-in-chunks="selectedTrackLengthInChunks" />
      </p>
    </div>

    <VueDraggable
      v-if="tracks"
      v-model="tracks"
      class="list-container"
      :style="{
        'padding-top': `${headerHeight}px`,
      }"
      handle=".drag-handle"
      :animation="100"
      @update="onSortOrderUpdate">
      <div
        class="list-entry first:border-t-0"
        :class="{ 'bg-secondary text-white': selectedTrackIndex === index }"
        v-for="(track, index) of tracks"
        :key="track._id"
        @click="handleTrackSelect(index)">
        <div class="flex gap-3">
          <!-- Drag handle -->
          <div class="cursor-grab">
            <span class="drag-handle text-2xl">☰</span>
          </div>

          <!-- Track info -->
          <div class="space-y-2">
            <div class="space-x-2 text-md">
              <span>{{ index + 1 }}</span>
              <span>{{ track.name }}</span>
            </div>

            <div class="flex gap-3">
              <!-- Start time -->
              <button class="icon-and-label" @click="showModalSetStartTime()">
                <ClockIcon
                  class="w-[18px] h-[18px]"
                  :class="{
                    '[&>*]:stroke-white': selectedTrackIndex === index,
                  }" />
                <span>{{ formatTime(track.startTime) }}</span>
              </button>

              <!-- Waveform -->
              <div class="icon-and-label">
                <WaveformIcon
                  class="w-[21px]"
                  :class="{
                    '[&>*]:stroke-white': selectedTrackIndex === index,
                  }" />
                <span>{{ $t(`waveforms.${track.waveform}`) }}</span>
              </div>

              <!-- TTS rate -->
              <div v-if="track.ttsRate" class="icon-and-label">
                <TtsRateIcon
                  class="w-[18px] h-[18px]"
                  :class="{
                    '[&>*]:fill-white': selectedTrackIndex === index,
                  }" />
                <span>{{ track.ttsRate }}</span>
              </div>
            </div>
          </div>

          <!-- Delete track from performance -->
          <div class="flex justify-end flex-1">
            <button
              class="button-secondary"
              @click.stop="
                handleDeleteTrackFromPerformance(track.trackPerformanceId)
              ">
              <IconTrash
                :class="{
                  '[&>*]:fill-white': selectedTrackIndex === index,
                }" />
            </button>
          </div>
        </div>
      </div>
    </VueDraggable>

    <ActionButtonLink
      :to="`/performance/${performanceId}/add-tracks`"
      :text="$t('add_tracks_to_performance')" />

    <ModalSetStartTime
      v-if="tracks && selectedTrackIndex > -1"
      v-model="setStartTimeModalDisplayed"
      @confirm="handleStartTimeSet"
      :trackperformance-id="tracks[selectedTrackIndex].trackPerformanceId"
      :title="`Set start time for track ${tracks[selectedTrackIndex].name}`" />
  </div>
</template>

<style scoped>
.icon-and-label {
  @apply flex gap-2 items-center text-silver text-sm;
}
</style>
