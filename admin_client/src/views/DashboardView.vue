<script setup lang="ts">
import { ref } from "vue"
import { useWebSocket } from "../composables/useWebSocket"

const { addMessageListener } = useWebSocket()

const usersLoggedInCount = ref(-1)
const clientsLoggedInCount = ref(-1)
const performancesCount = ref(-1)

addMessageListener(data => {
  if (data.message === "adminInfo") {
    // usersLoggedInCount.value = data.adminInfo.usersLoggedInCount
    clientsLoggedInCount.value = data.adminInfo.connectedClientsCount
    performancesCount.value = data.adminInfo.activePerformancesCount
  }
})
</script>

<template>
  <h1>{{ $t("dashboard") }}</h1>

  <div class="space-y-default">
    <!-- Users logged in count -->
    <div class="infobox">
      <span>{{ $t("users_logged_in") }}:</span>
      <span class="text-danger">{{ usersLoggedInCount }}</span>
    </div>
    <!-- Clients logged in count -->
    <div class="infobox">
      <span>{{ $t("clients_logged_in") }}:</span>
      <span>{{ clientsLoggedInCount }}</span>
    </div>
    <!-- Performances running -->
    <div class="infobox">
      <span>{{ $t("performances_running") }}:</span>
      <span>{{ performancesCount }}</span>
    </div>
  </div>
</template>

<style scoped>
.infobox {
  @apply flex gap-2 text-sm w-[300px] md:w-[460px] justify-center border border-silver py-2;
}
</style>
