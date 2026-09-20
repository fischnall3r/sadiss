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

Until an app release that speaks the current version reaches the stores and the
phones in the room, every client reports the version below it, so the bar reads
as a mismatch for the whole fleet. That is the display working, not a fault: the
server is deliberately a version ahead of the apps it serves.

## The support window

The server and the admin interface are deployed ahead of the app: a new server
goes live while the builds it serves are still the ones in the stores and on
people's phones. The window is therefore not "current and the one below" but
every version a build still in someone's hands might speak.
`SUPPORTED_PROTOCOL_VERSIONS` in `server/types/Protocol.ts` is that list, and a
version leaves it only when no build speaking it can still be in use.

Admission is not what the window governs — nothing is ever refused for its
version, because turning a phone away during a live event is worse than serving
it. What the window governs is what the server may *change*. Every version in the
list keeps playing against every later server.

`server/tests/wireContract.spec.ts` holds the server to that. For each version it
drives a real socket through a whole track and pins the frames that come back.
Those tests are end to end on purpose: an old build breaks by no longer being
*served* — a stricter parse turning its handshake away, a filter dropping it from
the audience — and none of that is visible to a test that calls the message
builders directly. The shapes those builders emit are pinned separately, without
sockets, in `server/tests/playbackSessionOutput.spec.ts`.

A build below the current version may still mishandle a message whose shape
changed after it was built. The admin's per-version counts are the mitigation:
the operator sees the outdated devices before starting and can have them updated.

## Version history

| Version | Change |
| ------- | ------ |
| 1 | The unversioned handshake. Everything shipped before protocol versioning. |
| 2 | `clientInfo` carries `protocolVersion`. No playback message changed. |
