<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import IconChevronDown from "../assets/chevron_down.svg"
import IconChevronUp from "../assets/chevron_up.svg"
import IconClientsCount from "../assets/clients_count.svg"
import IconConflictingClientsCount from "../assets/conflicting_clients_count.svg"

const props = defineProps<{
  connectedClients: Record<string, number>
  // Connected clients per wire protocol version. See docs/wire-protocol.md.
  protocolVersions: Record<string, number>
  serverProtocolVersion: number
}>()

const protocolVersionEntries = computed(() =>
  Object.entries(props.protocolVersions).sort(
    ([a], [b]) => Number(a) - Number(b)
  )
)

// A room is sound only when every client speaks the version the server speaks.
const hasProtocolMismatch = computed(() =>
  protocolVersionEntries.value.some(
    ([version]) => Number(version) !== props.serverProtocolVersion
  )
)

// All current: name the version. Otherwise name each with its client count,
// because then the operator has to decide whether to start the performance.
const protocolVersionSummary = computed(() =>
  protocolVersionEntries.value
    .map(([version, count]) =>
      hasProtocolMismatch.value ? `v${version}: ${count}` : `v${version}`
    )
    .join(" / ")
)

const clientListDisplayed = ref(false)

const totalConnectedClients = computed(() =>
  Object.values(props.connectedClients).reduce((acc, curr) => acc + curr, 0)
)

const voicesWithoutClientsCount = computed(() => {
  return Object.values(props.connectedClients).filter(v => v === 0).length
})

const toggleClientList = () => {
  clientListDisplayed.value = !clientListDisplayed.value

  if (clientListDisplayed.value) {
    // generateFakeVoicesAndClients()
  }
}

// const generateFakeVoicesAndClients = () => {
//   connectedClients.value = {}
//   const voices = Math.floor(Math.random() * 16) + 4
//   for (let i = 0; i < voices; i++) {
//     connectedClients.value[i.toString()] = Math.floor(
//       Math.random() * 12
//     ).toString()
//   }
// }

onMounted(() => {
  // generateFakeVoicesAndClients()
})
</script>

<template>
  <div
    class="w-full text-white md:flex md:items-end md:flex-col"
    :class="{ 'bg-secondary': clientListDisplayed }">
    <!-- Always visible bar content -->
    <div
      class="flex items-center justify-between w-full z-50 h-[32px] md:w-[340px] md:h-[60px] bg-secondary px-2 md:pr-5 md:justify-end">
      <span class="text-xs md:hidden">Time Sync</span>
      <div class="flex gap-2 md:gap-4">
        <div class="flex items-center gap-1 md:gap-2 md:w-[70px]">
          <IconClientsCount class="h-[17px] w-[17px] md:h-[31px] md:w-[31px]" />
          <span class="text-sm md:text-lg">{{ totalConnectedClients }}</span>
        </div>
        <div class="flex items-center gap-1 md:gap-2 md:w-[70px]">
          <IconConflictingClientsCount
            class="h-[16px] w-[16px] md:h-[31px] md:w-[31px]" />
          <span class="text-sm md:text-lg text-silver">{{
            voicesWithoutClientsCount
          }}</span>
        </div>
        <span
          v-if="protocolVersionEntries.length"
          class="text-xs md:text-sm self-center whitespace-nowrap"
          :class="hasProtocolMismatch ? 'text-danger' : 'text-silver'"
          :data-test="hasProtocolMismatch ? 'protocol-mismatch' : 'protocol-version'">
          {{ protocolVersionSummary }}
        </span>
        <button @click="toggleClientList">
          <IconChevronDown
            v-if="!clientListDisplayed"
            class="h-[13px] w-[13px] icon md:h-[24px] md:w-[24px]" />
          <IconChevronUp
            v-else
            class="h-[13px] w-[13px] md:h-[24px] md:w-[24px]" />
        </button>
      </div>
    </div>

    <!-- Client list, unfolded on button click -->
    <div
      class="grid grid-cols-[repeat(auto-fill,_70px)] gap-2 bg-secondary md:w-full px-2 md:px-10 md:py-4 justify-center absolute top-[32px] md:top-[60px] left-0 right-0 z-40"
      v-show="clientListDisplayed">
      <span
        v-for="client in Object.keys(connectedClients)"
        :key="client"
        :class="{ 'text-silver': connectedClients[client] === 0 }">
        {{ client }}: {{ connectedClients[client] }}
      </span>
    </div>
  </div>
</template>
