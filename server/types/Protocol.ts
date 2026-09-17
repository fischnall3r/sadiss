/** Wire protocol versioning, server side. See docs/wire-protocol.md. */

/** The protocol version the server itself speaks. */
export const CURRENT_PROTOCOL_VERSION = 2

/** The version a handshake without a `protocolVersion` field is taken to speak. */
export const UNVERSIONED_PROTOCOL_VERSION = 1

/** Client → server: the handshake identifying a device and what it speaks. */
export interface ClientInfoMessage {
  message: 'clientInfo'
  clientId: number
  ttsLang: { iso: string; lang: string }
  performanceId: string
  protocolVersion?: number
}

/** The protocol version a handshake announces, defaulting to the unversioned one. */
export const readProtocolVersion = (clientInfo: Pick<ClientInfoMessage, 'protocolVersion'>) =>
  clientInfo.protocolVersion ?? UNVERSIONED_PROTOCOL_VERSION
