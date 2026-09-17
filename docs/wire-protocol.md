# The SADISS wire protocol and its versions

App builds live on audience phones and lag behind the server: at any performance
the room is a mix of app generations. So every device announces the protocol
version it speaks, and the server records it per connection.

## How a device announces its version

The device sends `protocolVersion` in the `clientInfo` handshake it makes when
its socket opens:

```json
{ "message": "clientInfo", "clientId": 3, "ttsLang": { "iso": "en-US", "lang": "English" },
  "performanceId": "…", "protocolVersion": 2 }
```

Apps built before versioning existed send the same handshake without that field.
**A handshake without a `protocolVersion` is protocol version 1.**

The version the server itself speaks is `CURRENT_PROTOCOL_VERSION` in
`server/types/Protocol.ts`; the app's is `PROTOCOL_VERSION` in
`app/src/composables/protocol.ts`. Both must be raised together whenever a
message on the wire changes shape.

## Seeing the room before it plays

The server counts the connected clients of a performance per protocol version
and sends the counts to the admin interface in `adminInfo`, together with the
version it speaks itself (`clientsConnectedToPerformanceByProtocolVersion` and
`serverProtocolVersion`). The connected-clients bar in the performance view
shows them, and marks the room whenever a client speaks anything other than the
server's version — including the case where every phone in the room agrees on an
outdated one. A mismatch is therefore visible before playback is started, which
is the point: a performance is a one-shot live event.

## The support window

The server supports the current protocol version and the one below it — today
that is version 2 and version 1, the unversioned handshake. There is no gate:
a client below the window is still accepted, still registered and still sent
everything a performance sends, because refusing a phone in the room during a
live event is worse than serving it. What it loses is the guarantee that it
understands what it receives, so it may mishandle or ignore messages whose shape
changed after its build. The admin's per-version counts are the mitigation: the
operator sees the outdated devices before starting and can have them updated.

## Version history

| Version | Change |
| ------- | ------ |
| 1 | The unversioned handshake. Everything shipped before protocol versioning. |
| 2 | `clientInfo` carries `protocolVersion`. No playback message changed. |
