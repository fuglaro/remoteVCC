
# Router Messaging and Signalling Protocol

Communication protocol for establishing the peer-to-peer streem between the client and host. This is communicated via the router over WebSocket connections from both the Host and Clients.

1. Host -> Router -> Client (optionally if the client is already waiting):
```json
{
    "client-id": "broadcast"
    "type": "host-ready",
}
```
2. Client -> Router -> Host (client requests the stream):
```json
{
    "client-id": "1", // Added by router
    "type": "request",
    "payload": ...(access key)...
}
```

3. Host -> Router -> Client (host offers WebRTC ICE Candidate connection information):
```json
{
    "client-id": "1",
    "type": "ice-candidate",
    "payload": ...(ICE candidate details)...
}
```

4. Client -> Router -> Host (client relies with WebRTC ICE Candidate connection information):
```json
{
    "client-id": "1", // Added by router
    "type": "ice-candidate",
    "payload": ...(ICE candidate details)...
}
```
5. Host -> Router -> Client (host offers am SDP description for the stream):
```json
{
    "client-id": "1",
    "type": "offer",
    "payload": ...(SDP description details)...
}
```
6. Client -> Router -> Host (client responds with its own SDP description):
```json
{
    "client-id": "1", // Added by router
    "type": "answer",
    "payload": ...(SDP description details)...
}
```

This establishes the Client <-> Host peer-to-peer WebRTC communication stream carrying display and audio media streams, and also input device events.

## Access Denied

If connection credetials are invalid, the router, or host, will respond
to the client appropriately:

```json
{
    "client-id": "1",
    "type": "denied"
}
```

# Input Device Events Protocol

The input device events are sent over the "input" data channel of the peer-to-peer WebRTC stream between the Client and Host. All input events are sent from the Client to the Host.

 Indicate that all buttons and keys should release. 
```json
{
    "type": "all-up"
}
```
* Keyboard key has been pressed down. _Key codes follow Firefox's specifications: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values._
```json
{
    "type": "key-down",
    "code": "KeyQ"
}
```
* Keyboard key has been released. _See above for key code details_
```json
{
    "type": "key-down",
    "code": "KeyQ"
}
```
* Mouse movement occurs by an x and y amount.
```json
{
    "type": "motion-move",
    "xmov": 2,
    "ymov": -1
}
```
* Mouse pointer is placed at new coordinates. _Coordinate values are provided as fractions of the display window width and height from the top left position._
```json
{
    "type": "motion-warp",
    "xmov": 0.25,
    "ymov": 0.5
}
```
* Mouse button has been pressed down. _Button values are numbers starting at 0._

```json
{
    "type": "button-down",
    "button": 0
}
```
* Mouse button has been released. _Button values are numbers starting at 0._

```json
{
    "type": "button-up",
    "button": 0
}
```
* Mouse wheel movement occurs over 3 axis. _Motion can occur in steps of either *pixels* or *lines*._

```json
{
    "type": "wheel",
    "step": "lines",
    "x": 0,
    "y": 1,
    "z": 0
}
```
