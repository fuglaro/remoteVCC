/**
 * Establish a data stream between peers.
 * This is typically between the client and server.
 * 
 * This contains the negotiation logic to establish
 * any type of WebRTC connection with the server
 * via the router.
 * 
 * This also includes enough hooks to attach logic
 * for what to do with the data going across the stream.
 **/

class PeerStream {
  connection;
  streamName;
  constructor(streamName, router, config) {
    this.connection = new RTCPeerConnection(config);
    /* Ready send of ICE Candidate details. */
    this.connection.onicecandidate = ({candidate}) => {
      if (!candidate) return;
      this.router.send(JSON.stringify({
        type: 'ice-candidate',
        stream: this.streamName,
        payload: candidate
      }));
    };
    this.streamName = streamName;
    this.router = router;
  }

  /**
  * Ask the server to establish the connection.
  */
  async request() {
    this.router.send(JSON.stringify({
      type: 'request',
      stream: this.streamName
    }));
  }

  /**
   * Respond to server messages.
   */
  async handleMessage(msg) {
    if (msg.type == 'offer') {
      await this.connection.setRemoteDescription(msg.payload);
      await this.connection.setLocalDescription(
        await this.connection.createAnswer());
      this.router.send(JSON.stringify({
        type: 'answer',
        stream: this.streamName,
        payload: this.connection.localDescription
      }));
    }
    if (msg.type == 'ice-candidate') {
      this.connection.addIceCandidate(msg.payload);
    }
  }
}

 export {PeerStream};