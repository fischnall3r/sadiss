<script setup lang="ts">
import { editTrack } from "../api"
import TrackForm from "../components/TrackForm.vue"
import { StoreTrack } from "../types"
import { useRouter } from "vue-router"

const { trackId } = defineProps<{ trackId: string }>()

const router = useRouter()

const handleEditTrack = async (track: StoreTrack) => {
  try {
    await editTrack(trackId, track)
    router.push({ name: "Tracks" })
  } catch (error) {
    console.error(error)
  }
}
</script>
<template>
  <TrackForm
    :isEditMode="true"
    :trackId="trackId"
    @editTrack="handleEditTrack" />
</template>
