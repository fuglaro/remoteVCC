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
  constructor(streamName, routerSend, config) {
    this.connection = new RTCPeerConnection(config);
    /* Ready send of ICE Candidate details. */
    this.connection.onicecandidate = ({candidate}) => {
      if (!candidate) return;
      this.routerSend(JSON.stringify({
        type: 'ice-candidate',
        stream: this.streamName,
        payload: candidate
      }));
    };
    this.streamName = streamName;
    this.routerSend = routerSend;
  }

  /**
  * Ask the server to establish the connection.
  */
  request() {
    // Send request to re-establish connection.
    this.routerSend(JSON.stringify({
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
      this.routerSend(JSON.stringify({
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