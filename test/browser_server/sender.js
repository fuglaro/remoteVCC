
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

  // Initialise the signal message handlers.
  router.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    // Screen stream.
    if (msg.stream == 'screen') {
      if (msg.type == 'request') {
        screen = new PeerStream('screen', router, RTC_CONF);
        attachScreen(screen.connection);
      }
      else {
        screen.handleMessage(msg);
      }
    }

    // Pointer stream.
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
 * Attach the virtual pointer for incoming events.
 */
function attachPointer(connection) {
  const canvas = document.querySelector('#canvas');
  // Virtual Mouse Parameters
  var xPos = 0;
  var yPos = 0;
  var xMov = 0;
  var yMov = 0;
  var btn1 = 0;
  var btn2 = 0;
  var btn3 = 0;
  // Listen to mouse events and dispay virtual mouse.
  pointerStream = connection.createDataChannel("pointer");
  pointerStream.onmessage = (message) => {
    const data = JSON.parse(message.data);

    /**
     * Handle pointer events.
     */
    if (data.type == 'motion-warp') {
      xPos = data.xPos;
      yPos = data.yPos;
      xMov = 0;
      yMov = 0;
    }
    else if (data.type == 'motion-move') {
      // Update position
      xPos += data.xMov;
      yPos += data.yMov;
      // Snap position to valid range
      xPos = Math.min(1, Math.max(0, xPos));
      yPos = Math.min(1, Math.max(0, yPos));
      // Update movement
      xMov = data.xMov;
      yMov = data.yMov;
    }
    else if (data.type == 'button-down') {
      if (data.button == 0) btn1 = 1;
      if (data.button == 1) btn2 = 1;
      if (data.button == 2) btn3 = 1;
    }
    else if (data.type == 'button-up') {
      if (data.button == 0) btn1 = 0;
      if (data.button == 1) btn2 = 0;
      if (data.button == 2) btn3 = 0;
    }

    /**
     * Draw virtual pointer.
     */
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    // Pointer movement shadow.
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.arc((xPos-xMov)*canvas.clientWidth, (yPos-yMov)*canvas.clientHeight,
      5, 0, 2*Math.PI);
    ctx.stroke(); 
    // Pointer position.
    ctx.strokeStyle = 'lightgreen';
    ctx.beginPath();
    ctx.arc(xPos*canvas.clientWidth, yPos*canvas.clientHeight,
      5, 0, 2*Math.PI);
    ctx.stroke();
    // Pointer buttons.
    ctx.strokeStyle = 'black';
    // Left
    if (btn1) {
      ctx.beginPath();
      ctx.arc(xPos*canvas.clientWidth, yPos*canvas.clientHeight,
        5, 3/4*Math.PI, 5/4*Math.PI);
      ctx.stroke();
    }
    // Middle
    if (btn2) {
      ctx.beginPath();
      ctx.arc(xPos*canvas.clientWidth, yPos*canvas.clientHeight,
        5, 5/4*Math.PI, 7/4*Math.PI);
      ctx.stroke();
    }
    // Right
    if (btn3) {
      ctx.beginPath();
      ctx.arc(xPos*canvas.clientWidth, yPos*canvas.clientHeight,
        5, 7/4*Math.PI, 9/4*Math.PI);
      ctx.stroke();
    }
  };
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