/** A WebSocket driven by hand: the test plays the server and the network. */
export class FakeWebSocket {
  static opened: FakeWebSocket[] = []

  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  closed = false
  createdAt = Date.now()

  constructor(readonly url: string) {
    FakeWebSocket.opened.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
  }

  open() {
    this.onopen?.()
  }

  receive(data: string) {
    this.onmessage?.({ data })
  }

  drop() {
    this.onclose?.()
  }
}

export const latestSocket = () => FakeWebSocket.opened.at(-1)!
