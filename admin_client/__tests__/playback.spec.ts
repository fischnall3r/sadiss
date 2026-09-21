import { describe, expect, it } from "vitest"
import {
  NOT_PLAYING,
  percentPlayed,
  trackEnded,
  trackToSelect,
} from "../src/utils/playback"
import PlaybackProgress from "../src/types/PlaybackProgress"

const playing = (
  overrides: Partial<Extract<PlaybackProgress, { playing: true }>> = {}
): PlaybackProgress => ({
  playing: true,
  trackId: "track-1",
  chunkIndex: 0,
  totalChunks: 100,
  loop: false,
  ...overrides,
})

describe("how far through the track the bar is drawn", () => {
  it("is nothing before anything is playing", () => {
    expect(percentPlayed(NOT_PLAYING)).toBe(0)
  })

  it("is the position as a share of the length", () => {
    expect(percentPlayed(playing({ chunkIndex: 25, totalChunks: 100 }))).toBe(25)
  })

  // A track whose length has not been read yet would otherwise divide by zero
  // and draw a bar of width NaN, which renders as full.
  it("is nothing when the track has no length", () => {
    expect(percentPlayed(playing({ chunkIndex: 5, totalChunks: 0 }))).toBe(0)
  })
})

describe("noticing that the track has come to an end", () => {
  it("is the moment a playing performance stops", () => {
    expect(trackEnded(playing(), NOT_PLAYING)).toBe(true)
  })

  // Every push says the same thing while a track runs; only the change counts.
  it("is not every push that says a track is playing", () => {
    expect(trackEnded(playing({ chunkIndex: 1 }), playing({ chunkIndex: 2 }))).toBe(false)
  })

  // The page can be opened while nothing is on. Treating that as an ending would
  // start the next track by itself.
  it("is not the first push after the page was opened", () => {
    expect(trackEnded(NOT_PLAYING, NOT_PLAYING)).toBe(false)
  })

  it("is not a performance that has only just started", () => {
    expect(trackEnded(NOT_PLAYING, playing())).toBe(false)
  })
})

describe("following what is actually playing", () => {
  // Opening the page while another track runs, or auto-play moving on: the list
  // should show the track the server is playing, not the one last clicked.
  it("names the playing track when it is not the one selected", () => {
    expect(trackToSelect(playing({ trackId: "track-9" }), "track-1")).toBe("track-9")
  })

  it("names nothing when the selected track is the one playing", () => {
    expect(trackToSelect(playing({ trackId: "track-1" }), "track-1")).toBeUndefined()
  })

  it("names nothing when there is no performance running", () => {
    expect(trackToSelect(NOT_PLAYING, "track-1")).toBeUndefined()
  })
})
