
const RTC_CONF = {iceServers: [{urls: 'stun:stun.example.org'}]}; // TODO config
const ROUTER = 'ws://localhost:7993'; // TODO config
const FRAME_RATE = 30; // TODO config


// Signalling server for connection negotiation.
var router;


var screen;
var pointer;


/**
 * Register with the signalling system and
 * listen for client connections to then
 * connect all streams.
 */
async function connect() {
  // Connect up the the signalling server.
  router = new WebSocket(ROUTER);

  // Ready connections.
  await readyScreen(FRAME_RATE);
  await readyPointer();

  // Initialise the signal message handlers.
  router.onmessage = async (event) => {
    console.log(event.data);
    const msg = JSON.parse(event.data);

    // Screen stream negotiation.
    if (msg.stream == 'screen') {

      if (msg.type == 'request') {
        screen = new PeerStream('screen', router, RTC_CONF);
        attachScreen(screen.connection);
      }
      else {
        screen.handleMessage(msg);
      }
    }

    // Pointer stream negotiation.
    if (msg.stream == 'pointer') {

      if (msg.type == 'request') {
        pointer = new PeerStream('pointer', router, RTC_CONF);
        attachPointer(pointer.connection);
      }
      else {
        pointer.handleMessage(msg);
      }

    }
  }

  // Send "server-alive" ping in case any client has been waiting.
  router.onopen = async ({event}) => {
    router.send(JSON.stringify({
      type: 'server-alive'
    }));
  }
}
document.querySelector('#start').onclick = connect;




/**
 * ******************
 * Pointer Connection
 * ******************
 */

// Stream connection to the client for recieving the pointer.
var pointerConn;
var pointerStream;

/**
 * Prepare pointer to receive.
 */
async function readyPointer() {


}

/**
 * Attach the virtual pointer for incoming events.
 */
function attachPointer(connection) {
  pointerStream = connection.createDataChannel("pointer");
  pointerStream.onmessage = (message) => {
    console.log(message.data);
  }; // TODO
}





/**
 * *****************
 * Screen Connection
 * *****************
 */

// Stream connection for the display.
var screenStream;

/**
 * Prepare screen sharing to send.
 */
async function readyScreen(frameRate) {
  // Prepare the display for sending.
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia(
      {video: true, frameRate: frameRate});
    document.querySelector('#display').srcObject = screenStream;
  } catch(err) {
    console.log(err)
    alert("Could not activate screen.");
  }
}

/**
 * Attach the display to the stream connection.
 */
function attachScreen(connection) {
  screenStream.getTracks().forEach(
    (track) => connection.addTrack(track, screenStream));
}


/**
 * ****************
 * Peer Negotiation
 * ****************
 */

/**
 * Establish a data stream between peers.
 * This is typically between the client and server.
 * 
 * This contains the negotiation logic to establish
 * any type of WebRTC connection with the client
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
    // Ready the send of ICE Candidate details.
    this.connection.onicecandidate = ({candidate}) => {
      if (!candidate) return;
      router.send(JSON.stringify({
        type: 'ice-candidate',
        stream: streamName,
        payload: candidate
      }));
    }
    // Ready the send of the Local Description details.
    this.connection.onnegotiationneeded = async () => {
      try {
        await this.connection.setLocalDescription(
          await this.connection.createOffer());
        router.send(JSON.stringify({
          type: 'offer',
          stream: streamName,
          payload: this.connection.localDescription
        }));
      } catch (err) { console.error(err); }
    }
    this.streamName = streamName;
    this.router = router;
  }

  /**
   * Respond to client messages.
   */
  async handleMessage(msg) {

    // Store any sent remote ice candidates.
    if (msg.type == 'ice_candidate') {
      this.connection.addIceCandidate(msg.payload || {});
    }
    // Store any sent remote descriptions.
    if (msg.type == 'answer') {
      this.connection.setRemoteDescription(msg.payload);
    }
  }
}