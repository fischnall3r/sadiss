import { describe, expect, it } from "vitest"
import { voiceCounts } from "../src/utils/voiceCounts"

describe("counting the devices in each voice", () => {
  it("shows a zero for every voice the tracks call for", () => {
    expect(voiceCounts({}, 3)).toEqual({ "0": 0, "1": 0, "2": 0 })
  })

  it("fills in the voices devices registered for", () => {
    expect(voiceCounts({ "0": 2, "2": 1 }, 3)).toEqual({ "0": 2, "1": 0, "2": 1 })
  })

  // A device on a voice no track has is a phone the operator needs to find, so
  // it is marked rather than folded in or dropped.
  it("marks a voice no track calls for", () => {
    expect(voiceCounts({ "0": 1, "7": 1 }, 2)).toEqual({
      "0": 1,
      "1": 0,
      "X 7": 1,
    })
  })

  it("leaves out a voice nothing is registered on beyond those called for", () => {
    expect(voiceCounts({ "7": 0 }, 1)).toEqual({ "0": 0 })
  })
})
