<script setup lang="ts">
import { computed, ref } from "vue"
import { useAdminInfo } from "../composables/useAdminInfo"

const { info } = useAdminInfo()

const usersLoggedInCount = ref(-1)
const clientsLoggedInCount = computed(() => info.value?.connectedClientsCount ?? -1)
const performancesCount = computed(() => info.value?.activePerformancesCount ?? -1)
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
