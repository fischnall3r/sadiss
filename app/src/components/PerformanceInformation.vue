<script setup lang="ts">
import { useMainStore } from '@/stores/MainStore'
import { useRoute } from 'vue-router'

const mainStore = useMainStore()
const route = useRoute()
console.log(route.name)
defineProps<{
  textColorDanger?: boolean
}>()
</script>

<template>
  <div class="flex flex-col items-center">
    <h1
      class="text-center text-xl"
      :class="textColorDanger ? 'text-danger' : 'text-highlight'">
      {{ mainStore.performanceName }}
    </h1>
    <h2
      class="text-center text-lg"
      :class="textColorDanger ? 'text-danger' : 'text-highlight'">
      {{ mainStore.roleName }}
    </h2>
    <h2
      v-if="mainStore.selectedLanguage.lang && $route.name === 'Main'"
      class="text-center text-lg"
      :class="textColorDanger ? 'text-danger' : 'text-highlight'">
      Language: {{ mainStore.selectedLanguage.lang }}
    </h2>
  </div>
</template>
