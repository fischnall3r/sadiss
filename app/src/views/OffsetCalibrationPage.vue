<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <BasePage>
        <div class="flex h-full flex-col items-center justify-around">
          <PerformanceInformation />

          <div class="flex w-full justify-center gap-10">
            <button
              @touchstart="startChangingOutputLatencyOffset(-0.01)"
              @touchend="stopChangingOutputLatencyOffset()">
              <img
                src="../../public/assets/arrow-left.svg"
                class="h-[40px]" />
            </button>
            <div class="w-32 whitespace-nowrap text-center text-4xl font-bold text-highlight">{{ outputLatencyOffset }}s</div>
            <button
              @touchstart="startChangingOutputLatencyOffset(0.01)"
              @touchend="stopChangingOutputLatencyOffset()">
              <img
                src="../../public/assets/arrow-right.svg"
                class="h-[40px]" />
            </button>
          </div>
          <p class="text-sm leading-4">
            You should be hearing a regular click while this screen is displayed. To adjust the timing of your device to match
            others more closely click the arrows above. Your device will remember this setting.
          </p>
          <button
            @click="goForward()"
            class="h-[80px] w-[80px] text-2xl">
            <img src="../../public/assets/button-next.svg" />
          </button>
        </div>
      </BasePage>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage, useIonRouter } from '@ionic/vue'
import { onMounted, ref } from 'vue'
import BasePage from '@/components/BasePage.vue'
import { usePlayer } from '@/composables/usePlayer'
import { useMainStore } from '@/stores/MainStore'
import { Preferences } from '@capacitor/preferences'
import { useWebsocketConnection } from '@/composables/useWebsocketConnection'
import PerformanceInformation from '@/components/PerformanceInformation.vue'

const ionRouter = useIonRouter()
const mainStore = useMainStore()
const { establishWebsocketConnection } = useWebsocketConnection()
const { setOutputLatencyOffset } = usePlayer()

const outputLatencyOffset = ref(0)
const maxOutputLatencyOffset = 0.4
const minOutputLatencyOffset = -0.4
const changeOutputLatencyOffset = (changeBy: number) => {
  const newOffset = outputLatencyOffset.value + changeBy
  if (newOffset > maxOutputLatencyOffset || newOffset < minOutputLatencyOffset) {
    return
  }
  outputLatencyOffset.value = +newOffset.toFixed(2)
  setOutputLatencyOffset(outputLatencyOffset.value)
}

let intervalId: ReturnType<typeof setInterval> | null
function startChangingOutputLatencyOffset(changeBy: number) {
  if (intervalId) return
  changeOutputLatencyOffset(changeBy)
  intervalId = setInterval(() => {
    changeOutputLatencyOffset(changeBy)
  }, 100)
}

function stopChangingOutputLatencyOffset() {
  if (!intervalId) return
  clearInterval(intervalId)
  intervalId = null
}

const goForward = async () => {
  await Preferences.set({ key: 'outputLatencyOffset', value: outputLatencyOffset.value.toString() })

  // Set output latency offset again in case user clicks through without changing it
  setOutputLatencyOffset(outputLatencyOffset.value)

  if (mainStore.availableLanguages.length && mainStore.availableLanguages.length > 1) {
    ionRouter.navigate('/language-selection', 'forward', 'push')
  } else {
    ionRouter.navigate('/main', 'forward', 'push')
  }
}

onMounted(async () => {
  const offsetResult = await Preferences.get({ key: 'outputLatencyOffset' })
  if (offsetResult.value) {
    outputLatencyOffset.value = +offsetResult.value
  }
  establishWebsocketConnection()
})
</script>
