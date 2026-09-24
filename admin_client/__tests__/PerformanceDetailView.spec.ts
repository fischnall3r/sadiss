import { mount, flushPromises } from "@vue/test-utils"
import { describe, it, expect, vi, beforeEach } from "vitest"
import i18n from "../src/i18n.config"
import PerformanceDetailView from "../src/views/PerformanceDetailView.vue"
import ModalSetStartTime from "../src/components/modals/ModalSetStartTime.vue"
import { getPerformanceWithTracks, loadTrackForPlayback } from "../src/api"
import { FakeWebSocket } from "./fakeWebSocket"

vi.mock("../src/api", () => ({
  getPerformanceWithTracks: vi.fn(),
  loadTrackForPlayback: vi.fn(),
  updateTrackPerformanceOrder: vi.fn(),
  deleteTrackFromPerformance: vi.fn(),
  setStartTime: vi.fn(),
}))

vi.stubGlobal("WebSocket", FakeWebSocket)

const buildTrack = () => ({
  _id: "track-1",
  name: "Test Track",
  isPublic: true,
  mode: "choir" as const,
  waveform: "sine" as const,
  creator: { _id: "user-1", username: "tester" },
  trackPerformanceId: "tp-1",
  sortOrder: 1,
  startTime: 0,
  trackLengthInChunks: 120,
  partialsCount: 2,
})

const mountView = async () => {
  const wrapper = mount(PerformanceDetailView, {
    props: { performanceId: "performance-1" },
    global: {
      plugins: [i18n],
      stubs: { RouterLink: true, ActionButtonLink: true, VueDraggable: false },
    },
  })
  await flushPromises()
  return wrapper
}

describe("PerformanceDetailView: start time display", () => {
  beforeEach(() => {
    vi.mocked(getPerformanceWithTracks).mockResolvedValue({
      _id: "performance-1",
      name: "Test Performance",
      creator: { _id: "user-1", username: "tester" },
      isPublic: true,
      tracks: [buildTrack()],
      trackCount: 1,
    } as any)
    vi.mocked(loadTrackForPlayback).mockResolvedValue(120)
  })

  it("shows the saved start time without refetching the performance", async () => {
    const wrapper = await mountView()

    // The modal only exists once a track is selected.
    await wrapper.find(".list-entry").trigger("click")
    await flushPromises()

    expect(wrapper.text()).toContain("00.00")

    const modal = wrapper.findComponent(ModalSetStartTime)
    expect(modal.exists()).toBe(true)

    // Saving reports the stored value back to the view.
    modal.vm.$emit("confirm", 42)
    await flushPromises()

    expect(wrapper.text()).toContain("00.42")
    // The list must update from the emitted value alone, not another round trip.
    expect(vi.mocked(getPerformanceWithTracks)).toHaveBeenCalledTimes(1)
  })
})
