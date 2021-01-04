
# Signalling Protocols

Communication protocol for negotiating and establishing the data streams between the client and server. This is communicated via the signalling server (router).

This protocol is considered simple enough to avoid adopting an external protocol.

## Establishing Any Data Or Media Stream

Here is the flow of communcation between a client and the server for any type of data stream exchange. This uses the example of the pointer stream which handles mouse input.

1. Client requests the data stream:
    ```json
    {
        type: "request",
        stream: "pointer"
    }
    ```
2. Server and Client exchange ICE Candidates until a WebRTC communication can be established:
    ```json
    {
        type: "ice-candidate",
        stream: "pointer",
        payload: ...(ICE candidate details)...
    }
    ```
3. Server offers a SDP description for the stream:
    ```json
    {
        type: "offer",
        stream: "pointer",
        payload: ...(SDP description details)...
    }
    ```
4. Client responds with its own SDP description:
    ```json
    {
        type: "answer",
        stream: "pointer",
        payload: ...(SDP description details)...
    }
    ```

This enables the communication stream to be established and further communication occurs across this new peer-to-peer stream.

### Additional Router Messaging

The very first connection between a client and the server runs through the router and the router handles additional messaging for authentication and authorisation. The client and server then uses that connection as the signalling server to establish a peer-to-peer data stream to act as a trusted signalling channel for any further peer-to-peer connections.

This means that this first connection has additional messages and message packaging:

* When the server first connects to the router, it will send a broadcast message for all clients already waiting (if any) that the server is now ready for requests:
    ```json
    {
        client-id: "broadcast",
        message: "{type:\"server-alive\"}"
    }
    ```
* Whenever the router forwards messages from clients to the server, the router will assign each client a unique identifier and package the client's message with the appropriate client ID:
    * Client asks the router to request the signalling data stream:
        ```json
        {
            type: "request",
            stream: "signal"
        }
        ```
    * Router packages that with the client ID before sending to the server:
        ```json
        {
            client-id: 11,
            message: "{type:\"request\",stream:\"signal\"}"
        }
        ```
    * The server can then upnack the client's message after idenifying the client. Servers then reply to the client via the router by similarly packaging messages.
        ```json
        {
            client-id: 11,
            message: ...Message to client...
        }
        ```
    * The router will unpack the message before sending it to the relevant client.