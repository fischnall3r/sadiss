import { mount } from "@vue/test-utils"
import { describe, it, expect } from "vitest"
import ConnectedClientsList from "../src/components/ConnectedClientsList.vue"

const mountList = (
  protocolVersions: Record<string, number>,
  serverProtocolVersion = 2
) =>
  mount(ConnectedClientsList, {
    props: {
      connectedClients: { "0": 2, "1": 1 },
      protocolVersions,
      serverProtocolVersion,
    },
  })

describe("ConnectedClientsList: protocol versions", () => {
  it("names the version when every client speaks the server's", () => {
    const wrapper = mountList({ "2": 3 })

    expect(wrapper.text()).toContain("v2")
    expect(wrapper.find("[data-test=protocol-mismatch]").exists()).toBe(false)
  })

  it("flags a mismatch and counts the clients per version", () => {
    const wrapper = mountList({ "1": 2, "2": 1 })

    expect(wrapper.find("[data-test=protocol-mismatch]").exists()).toBe(true)
    const text = wrapper.text()
    expect(text).toContain("v1: 2")
    expect(text).toContain("v2: 1")
  })

  it("flags a room that agrees on a version the server has moved past", () => {
    const wrapper = mountList({ "1": 3 })

    expect(wrapper.find("[data-test=protocol-mismatch]").exists()).toBe(true)
    expect(wrapper.text()).toContain("v1: 3")
  })
})
