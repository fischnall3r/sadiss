<script setup lang="ts">
import { ref } from "vue"
import { VueFinalModal } from "vue-final-modal"
import { setStartTime } from "../../api"
import { formattedTimeToChunks } from "../../utils/formatTime"

const props = defineProps<{
  trackperformanceId: string
  title?: string
}>()

const emit = defineEmits<{
  (e: "confirm", startTimeInChunks: number): void
}>()

const startTime = ref("")
const errorMessage = ref("")

const handleSetStartTimeClick = async () => {
  if (!startTime.value) {
    errorMessage.value = "Please enter a start time."
    return
  }

  const [minutes, seconds] = startTime.value.split(".")
  if (isNaN(Number(minutes)) || isNaN(Number(seconds))) {
    errorMessage.value = "Please enter a valid start time."
    return
  }

  const startTimeInChunks = formattedTimeToChunks(startTime.value)

  try {
    const response = await setStartTime(
      props.trackperformanceId,
      startTimeInChunks
    )

    if (response.status === 200) {
      errorMessage.value = ""
      emit("confirm", startTimeInChunks)
      return
    }

    console.log(response.data)
  } catch (error: any) {
    console.log(error)
    errorMessage.value = error.response.data.error
  }
}
</script>

<template>
  <VueFinalModal
    class="flex justify-center items-center"
    content-class="bg-white p-6 flex flex-col items-center gap-6 w-11/12">
    <h1 class="m-0">
      {{ title }}
    </h1>
    <form>
      <div>
        <input
          id="track-length"
          v-model="startTime"
          placeholder="Enter start time, e.g. 01.02" />
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      </div>
    </form>
    <button class="button-primary" @click="handleSetStartTimeClick">
      Confirm
    </button>
  </VueFinalModal>
</template>
