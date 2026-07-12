<script setup lang="ts">
import { RouterLink, useRoute } from "vue-router"
import SadissLogo from "../assets/sadiss_logo.svg"
import IconUser from "../assets/user.svg"

const route = useRoute()
</script>

<template>
  <div
    class="flex flex-col md:flex-row items-center justify-center md:border-b md:border-silver bg-white">
    <RouterLink
      to="/"
      class="my-[30px] md:mt-[30px] md:ml-[60px]"
      :class="{ 'md:mr-[60px]': route.meta.hideNavbar }">
      <SadissLogo />
    </RouterLink>
    <div
      v-if="!route.meta.hideNavbar"
      class="w-full text-xs flex flex-col items-end md:pr-6 pr-4 gap-3">
      <nav
        class="text-sm grid grid-cols-[1fr_1fr_1fr] md:flex md:justify-end md:h-full md:items-end w-full text-secondary">
        <div class="md:hidden">
          <!-- Spacer for left column of grid on mobile -->
        </div>
        <!-- Main links -->
        <div class="flex gap-8 md:gap-4">
          <RouterLink to="/performances">Performances</RouterLink>
          <RouterLink to="/tracks">Tracks</RouterLink>
        </div>
        <!-- User link -->
        <div class="flex justify-center md:pl-8">
          <RouterLink to="/user" class="flex gap-2">
            <span>Usr</span>
            <IconUser />
          </RouterLink>
        </div>
      </nav>
    </div>
  </div>
</template>
