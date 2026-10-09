<script setup lang="ts">
import { computed, nextTick, reactive, ref, Ref } from "vue"
import { useQrCodeGenerator } from "../composables/useQrCodeGenerator"
import { useRouter } from "vue-router"
import { usePerformanceStore } from "../stores/usePerformanceStore"
import QrcodeVue from "qrcode.vue"
import HeadlineWithCancelButton from "../components/HeadlineWithCancelButton.vue"

const {
  generateQrCodes,
  setQrCodeContainerRef,
  downloadPartialQrCodes,
  qrCodeData,
} = useQrCodeGenerator()

const props = defineProps<{
  performanceId: string
}>()

const performanceStore = usePerformanceStore()
const performanceName = computed(() => {
  const performance = performanceStore.performances.find(
    p => p._id === props.performanceId
  )
  return performance ? performance.name : ""
})

const formData = reactive({
  voiceCount: 1,
  voiceNames: [""],
  ttsLangs: "",
  defaultLanguage: "",
  expertMode: false,
})

const router = useRouter()

const qrCodeContainer: Ref<HTMLDivElement[]> = ref([])

const handleGenerateQrCodes = async () => {
  console.log(qrCodeContainer.value)
  if (!qrCodeContainer.value) return

  await generateQrCodes(
    formData.voiceCount,
    formData.voiceNames,
    performanceName.value,
    formData.expertMode,
    props.performanceId,
    formData.ttsLangs,
    formData.defaultLanguage
  )
  setQrCodeContainerRef(qrCodeContainer.value)
  await nextTick()
  await downloadPartialQrCodes()

  await router.push({
    name: "PerformanceDetail",
    params: { id: props.performanceId },
  })
}
</script>
<template>
  <div class="pb-10 md:w-full">
    <HeadlineWithCancelButton
      :text="$t('generate_qr_codes')"
      :to="{ name: 'PerformanceDetail', params: { id: performanceId } }" />
    <form>
      <!-- Voice count -->
      <div class="label-and-input">
        <label>{{ $t("voice_count") }}</label>
        <input v-model="formData.voiceCount" type="number" min="1" />
      </div>

      <!-- Voice names -->
      <div v-for="voice in formData.voiceCount" class="label-and-input">
        <label>{{ $t("name_for_voice") }} {{ voice - 1 }}</label>
        <input v-model="formData.voiceNames[voice - 1]" />
      </div>
      <div class="label-and-input">
        <label for="ttsLangs">{{ $t("tts_languages") }}</label>
        <input
          v-model="formData.ttsLangs"
          type="text"
          name="ttsLangs"
          placeholder="en-US, de-DE" />
      </div>
      <div v-if="formData.ttsLangs.length" class="label-and-input">
        <label for="defaultLang">{{ $t("default_language") }}</label>
        <input
          v-model="formData.defaultLanguage"
          type="text"
          name="defaultLang"
          placeholder="en-US" />
      </div>

      <!-- Expert mode checkbox -->
      <div class="flex gap-2 items-center">
        <div class="flex items-center justify-center">
          <input
            v-model="formData.expertMode"
            type="checkbox"
            id="expertMode"
            name="expertMode" />
        </div>
        <label for="expertMode">Expert mode</label>
      </div>
      <div class="flex justify-end">
        <button
          type="submit"
          class="button-primary"
          @click.prevent="handleGenerateQrCodes">
          {{ $t("generate_qr_codes") }}
        </button>
      </div>
    </form>

    <!-- TTS languages -->
  </div>

  <!-- QR Codes (not visible to user) -->
  <div class="flex flex-wrap gap-2" style="display: none">
    <div v-for="qrCode of qrCodeData">
      <div ref="qrCodeContainer">
        <qrcode-vue
          :value="JSON.stringify(qrCode)"
          :size="200"
          :margin="4"
          :render-as="'svg'"
          level="H" />
      </div>
    </div>
  </div>
</template>
