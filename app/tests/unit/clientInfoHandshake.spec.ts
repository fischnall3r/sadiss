import { createTestingPinia } from '@pinia/testing'
import { useMainStore } from '@/stores/MainStore'
import { PROTOCOL_VERSION } from '@/composables/protocol'

vi.mock('@/composables/usePlayer', () => ({
  usePlayer: () => ({
    handleChunkData: vi.fn(),
    setOffset: vi.fn(),
    stopPlayback: vi.fn(),
    setStartTime: vi.fn(),
    setTrackSettings: vi.fn()
  })
}))

vi.mock('@/composables/useClockMeasurement', () => ({
  useClockMeasurement: () => ({ start: vi.fn(), stop: vi.fn(), handleMessage: () => false })
}))

/** Stands in for the browser WebSocket and records what the app sends on open. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  sent: string[] = []
  onopen: ((this: FakeWebSocket) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((error: unknown) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {}
}

createTestingPinia({ stubActions: false })
vi.stubGlobal('WebSocket', FakeWebSocket)

/** Connects and returns the clientInfo payload the app sent on open. */
const handshakePayload = async () => {
  const store = useMainStore()
  store.wsUrl = 'ws://localhost:8080'
  store.choirId = 3
  store.selectedLanguage = { iso: 'en-US', lang: 'English' }
  store.performanceId = 'performance-1'

  const { useWebsocketConnection } = await import('@/composables/useWebsocketConnection')
  await useWebsocketConnection().establishWebsocketConnection()

  const socket = FakeWebSocket.instances[0]
  socket.onopen!.call(socket)

  return socket.sent.map((message) => JSON.parse(message)).find((message) => message.message === 'clientInfo')
}

describe('clientInfo handshake', () => {
  it('tells the server which protocol version this app speaks', async () => {
    expect(await handshakePayload()).toEqual({
      message: 'clientInfo',
      clientId: 3,
      ttsLang: { iso: 'en-US', lang: 'English' },
      performanceId: 'performance-1',
      protocolVersion: PROTOCOL_VERSION
    })
  })

  it('speaks a protocol version above the unversioned one', () => {
    expect(PROTOCOL_VERSION).toBeGreaterThan(1)
  })
})
