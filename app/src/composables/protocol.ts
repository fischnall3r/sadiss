/** Wire protocol versioning, device side. See docs/wire-protocol.md. */

/** The protocol version this app build speaks. */
export const PROTOCOL_VERSION = 2

/** Client → server: the handshake identifying this device and what it speaks. */
export interface ClientInfoMessage {
  message: 'clientInfo'
  clientId: number
  ttsLang: { iso: string; lang: string }
  performanceId: string
  protocolVersion: number
}

/** Builds the handshake this build sends when the socket opens. */
export const buildClientInfoMessage = (
  client: Omit<ClientInfoMessage, 'message' | 'protocolVersion'>
): ClientInfoMessage => ({
  message: 'clientInfo',
  ...client,
  protocolVersion: PROTOCOL_VERSION
})
