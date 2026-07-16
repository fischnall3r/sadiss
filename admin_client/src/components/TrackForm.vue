<script setup lang="ts">
import HeadlineWithCancelButton from "../components/HeadlineWithCancelButton.vue"
import FileUploadInput from "../components/FileUploadInput.vue"
import { computed, onMounted, reactive, ref } from "vue"
import { StoreTrack, TtsFileDownloadInformation } from "../types"
import { useI18n } from "vue-i18n"
import { useTrackStore } from "../stores/useTrackStore"
import { downloadTrack } from "../api/trackService"
import IconChoir from "../assets/choir.svg"

const { t } = useI18n()

const props = defineProps<{
  isEditMode?: boolean
  isViewMode?: boolean
  trackId?: string
}>()

defineEmits<{
  (event: "storeTrack", track: StoreTrack): void
  (event: "editTrack", track: StoreTrack): void
}>()

const formData = reactive<StoreTrack>({
  name: "",
  partialFile: null as File | null,
  mode: "nonChoir",
  ttsFiles: {} as Record<number, Record<string, File>>,
  notes: "",
  waveform: "sine",
  ttsRate: 1,
  isPublic: false,
})

const handlePartialFileSelected = (file: File | null) => {
  if (!file) {
    return
  }
  formData.partialFile = file
}

// #region Text to Speech
const handleTtsFileSelected = async (
  file: File | null,
  voice: number,
  lang: string
) => {
  if (!file) {
    return
  }
  if (!formData.ttsFiles[voice]) {
    formData.ttsFiles[voice] = {}
  }
  formData.ttsFiles[voice][lang] = file
}

const ttsLanguages = ref("en-US, de-DE")
const numberOfVoices = ref(1)

const voiceLangCombinations = computed(() => {
  // If nonChoir, only allow 1 voice
  const allowedNumberOfVoices =
    formData.mode === "choir" ? numberOfVoices.value : 1
  const combinations = []
  for (let i = 0; i < allowedNumberOfVoices; i++) {
    for (const lang of ttsLanguages.value.split(",")) {
      const combination = <
        { voice: number; lang: string; file?: TtsFileDownloadInformation }
      >{
        voice: i,
        lang: lang.trim(),
      }

      combinations.push(combination)
    }
  }

  return combinations
})
// #endregion

const title = computed(() => {
  if (props.isEditMode && formData.name) {
    return t("edit_track") + ": " + formData.name
  }
  if (props.isViewMode && formData.name) {
    return formData.name
  }
  return t("add_track")
})

const track = computed(() => {
  if (!props.trackId) {
    return null
  }
  const trackStore = useTrackStore()
  return trackStore.getTrackById(props.trackId)
})

const partialFileName = computed(() => {
  if (track.value) {
    return track.value.partialFile?.origName ?? ""
  }
  return ""
})

const ttsFileNames = computed(() => {
  if (track.value) {
    return track.value.ttsFiles?.map(file => file.origName) ?? []
  }
  return []
})

onMounted(() => {
  if (!props.trackId) {
    return
  }

  if (track.value) {
    formData.name = track.value.name
    formData.mode = track.value.mode
    formData.notes = track.value.notes ?? ""
    formData.waveform = track.value.waveform

    if (track.value.ttsRate) {
      formData.ttsRate = track.value.ttsRate
    }
  }
})
</script>

<template>
  <div class="pb-10 w-full">
    <HeadlineWithCancelButton :to="{ name: 'Tracks' }" :text="title" />

    <form>
      <div class="space-y-default md:space-y-0 md:flex md:justify-between">
        <!-- Choir mode -->
        <div class="flex gap-2">
          <!-- Checkbox -->
          <div>
            <input
              type="checkbox"
              id="isChoir"
              :checked="formData.mode === 'choir'"
              :disabled="isViewMode"
              @change="(event: Event) => {
                const target = event.target as HTMLInputElement;
                formData.mode = target.checked ? 'choir' : 'nonChoir';
              }" />
          </div>

          <!-- Choir mode label -->
          <div class="flex flex-col">
            <label for="isChoir" class="text-black">{{
              $t("choir_mode")
            }}</label>
            <span>{{ $t("choir_mode_description") }}</span>
          </div>

          <IconChoir class="ml-5 h-[30px] w-[30px] md:h-[31px] md:w-[38px]" />
        </div>

        <!-- Public track -->
        <div class="flex gap-2">
          <div>
            <input
              type="checkbox"
              id="isPublic"
              v-model="formData.isPublic"
              :disabled="isViewMode" />
          </div>
          <div class="flex flex-col">
            <label for="isPublic" class="text-black">{{
              $t("public_track")
            }}</label>
            <span class="max-w-[240px]">{{
              $t("public_track_description")
            }}</span>
          </div>
        </div>
      </div>

      <!-- Title -->
      <div class="label-and-input">
        <label for="title">{{ $t("title") }}</label>
        <input
          type="text"
          id="title"
          v-model="formData.name"
          :disabled="isViewMode" />
      </div>

      <!-- Partial File Upload -->
      <div v-if="!isEditMode" class="label-and-input">
        <label for="partialFile">{{ $t("partial_file") }}</label>
        <FileUploadInput
          v-if="!isViewMode"
          :buttonText="$t('partial_file_upload_button')"
          :selectedFileName="partialFileName"
          accept="*.txt"
          @fileSelected="handlePartialFileSelected" />
        <div v-else>
          <span>{{ partialFileName }}</span>
        </div>
      </div>

      <!-- Waveform -->
      <div class="label-and-input">
        <label for="waveform">{{ $t("waveform") }}</label>
        <select
          id="waveform"
          v-model="formData.waveform"
          class="input"
          :disabled="isViewMode">
          <option value="sine">{{ $t("waveforms.sine") }}</option>
          <option value="square">{{ $t("waveforms.square") }}</option>
          <option value="sawtooth">{{ $t("waveforms.sawtooth") }}</option>
          <option value="triangle">{{ $t("waveforms.triangle") }}</option>
        </select>
      </div>

      <!-- TTS Rate -->
      <div class="label-and-input">
        <label for="ttsRate">{{ $t("tts_rate") }}</label>
        <input
          type="number"
          id="ttsRate"
          v-model="formData.ttsRate"
          min="0.2"
          max="1.5"
          step="0.1"
          :disabled="isViewMode" />
      </div>

      <div
        v-if="isEditMode && trackId"
        class="text-danger flex flex-col items-center gap-4 p-4 border border-danger">
        <p>
          Partials and TTS files are currently not editable. You can download
          the track as a ZIP and then edit and reupload it instead.
        </p>
        <button
          class="button-primary"
          @click.prevent="downloadTrack(trackId, formData.name)">
          Download ZIP
        </button>
      </div>

      <!-- Text to Speech -->
      <div
        v-if="
          (!isEditMode && !isViewMode) ||
          (isViewMode && ttsFileNames.length > 0)
        "
        class="space-y-2 md:space-y-6">
        <p class="text-lg md:text-xl">{{ $t("text_to_speech") }}</p>

        <!-- Languages -->
        <div class="label-and-input">
          <label for="ttsLanguages" class="md:!text-lg">{{
            $t("languages")
          }}</label>
          <input
            type="text"
            id="ttsLanguages"
            v-model="ttsLanguages"
            placeholder="e.g. en-US"
            :disabled="isViewMode" />
        </div>

        <!-- Number of Voices -->
        <div v-if="formData.mode === 'choir'" class="label-and-input">
          <label for="numberOfVoices" class="md:!text-lg">{{
            $t("voice_count")
          }}</label>
          <input
            type="number"
            id="numberOfVoices"
            v-model="numberOfVoices"
            min="1"
            :disabled="isViewMode" />
        </div>

        <!-- TTS File Upload -->
        <div class="space-y-2">
          <div
            v-for="(combination, index) in voiceLangCombinations"
            :key="index">
            <div class="label-and-input mb-4">
              <label
                :for="`ttsFile-${combination.voice}-${combination.lang}`"
                class="md:!text-lg">
                {{ $t("voice") }} {{ combination.voice + 1 }} -
                {{ combination.lang }}
              </label>
              <FileUploadInput
                v-if="!isViewMode"
                :buttonText="$t('tts_file_upload_button')"
                :selectedFileName="ttsFileNames[index]"
                accept="*.srt, *.txt"
                @fileSelected="
                  handleTtsFileSelected(
                    $event,
                    combination.voice,
                    combination.lang
                  )
                " />
              <div v-else>
                <span>{{ ttsFileNames[index] }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="label-and-input">
        <label for="notes" class="md:self-start">{{ $t("notes") }}</label>
        <textarea
          id="notes"
          v-model="formData.notes"
          class="input"
          rows="4"
          :disabled="isViewMode" />
      </div>

      <!-- Submit button -->
      <div class="flex justify-end">
        <button
          v-if="!isViewMode && !isEditMode"
          type="submit"
          class="button-primary"
          @click.prevent="$emit('storeTrack', formData)">
          {{ $t("add_track") }}
        </button>

        <RouterLink
          v-if="isViewMode"
          :to="{ name: 'EditTrack', params: { trackId: trackId } }"
          class="button-primary">
          {{ $t("edit_track") }}
        </RouterLink>

        <div v-if="isEditMode" class="flex gap-2">
          <RouterLink :to="{ name: 'Tracks' }" class="button-secondary">
            {{ $t("cancel") }}
          </RouterLink>
          <button
            type="submit"
            class="button-primary"
            @click.prevent="$emit('editTrack', formData)">
            {{ $t("save_changes") }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
