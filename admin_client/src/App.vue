<script setup lang="ts">
import TopBar from "./components/TopBar.vue"
import { ModalsContainer } from "vue-final-modal"
</script>

<template>
  <div class="flex h-screen flex-col">
    <TopBar class="fixed top-0 left-0 w-full z-50 h-[130px] md:h-[70px]" />
    <main :class="`flex flex-col items-center pt-[130px] md:pt-[70px]`">
      <RouterView />
    </main>
  </div>
  <ModalsContainer />
</template>
