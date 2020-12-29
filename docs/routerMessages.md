
# Signalling Serivice Protocol

Communication protocol for negotiating and establishing the data streams between the client and server. This is communicated via the signalling server (router).

This protocol is considered simple enough to avoid adopting an external protocol.x

## Establishing Any Data Stream

Here is the flow of communcation between a client and the server for any type of data stream exchange. This uses the example of the pointer stream which handles mouse input.

1. Client requests the data stream:
```json
{
    type: 'request',
    stream: 'pointer'
}
```
2. Server and Client exchange ICE Candidates until a WebRTC communication can be established:
```json
{
    type: 'ice_candidate',
    stream: 'pointer',
    payload: ...(ICE candidate details)...
}
```
3. Server offers a SDP description for the stream:
```json
{
    type: 'offer',
    stream: 'pointer',
    payload: ...(SDP description details)...
}
```
4. Client responds with its own SDP description:
```json
{
    type: 'answer',
    stream: 'pointer',
    payload: ...(SDP description details)...
}
```

This enables the communication stream to be established and further communication occurs across this new peer-to-peer stream.