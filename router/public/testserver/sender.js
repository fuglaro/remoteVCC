
// Signalling server for connection negotiation.
var router = null;

// Peer to peer streams.
var streams = {};

/**
 * Register with the signalling system and
 * listen for client connections to then
 * connect all streams.
 */
async function connect() {
  // Ensure we have cleaned up any existing connections
  // since we may be reconnecting.
  if (router) router.close();
  Object.values(streams).forEach((stream) => {
    stream.connection.close();
  });

  // Get the RTC Configs.
  const baseURL = `${window.location.protocol}//${window.location.host}`;
  const config = await fetch(
    `${baseURL}/api/config`).then(r => r.json());
  

  // Ready display media.
  await readyScreen();







  // Attempt to log in with  basic authentication.
  loginWithBasicAuth("client", document.getElementById("password").value);








  // Connect up the the signalling server.
  const socketProtocol = (
    (window.location.protocol == 'http:') ? 'ws:' : 'wss:');
  router = new WebSocket(
    `${socketProtocol}//${window.location.host}/signal/server`);

  // Initialise the signal message handlers.
  router.onmessage = async (event) => {
    // Unwrap the message from the router
    // to keep track of the client ID.
    const packagedMsg = JSON.parse(event.data);
    const clientId = packagedMsg['client-id'];
    const signal = `${clientId}:signal`;
    const msg = JSON.parse(packagedMsg['message']);
    // Get ready to re-wrap the message with details
    // about which client to send back to.
    var routerSend = (message) => {
      router.send(JSON.stringify({
        'client-id': clientId,
        'message': message
      }));
    }

    // Signal stream.
    if (msg.type == 'request') {
      // Create signal channel to create other peer-to-peer connections.
      streams[signal] = new PeerStream('signal', routerSend, config.rtc);
      var signalChannel = streams[signal].connection
        .createDataChannel("signal");

      // Handle signal messages
      var signalSend = (message) => {signalChannel.send(message)};
      signalChannel.onmessage = (message) => {
        const data = JSON.parse(message.data);

        // Handle creation and connection of media and data streams.
        if (data.type == 'request') {
          // Create the RTC connection
          var stream = new PeerStream(data.stream, signalSend, config.rtc);
          // Ready the connection of the data.
          switch (data.stream) {
            case 'pointer':
              attachPointer(stream.connection);
              break;
            case 'keyboard':
              attachKeyboard(stream.connection);
              break;
            case 'screen':
              attachScreen(stream.connection);
              break;
          }
          // Store the connection.
          streams[`${clientId}:${data.stream}`] = stream;
        }
        else if (`${clientId}:${data.stream}` in streams) {
          // Handle connection establishment negotiation.
          streams[`${clientId}:${data.stream}`].handleMessage(data);
        }
      }
    }
    else if (signal in streams) {
      // Handle connection establishment negotiation.
      streams[signal].handleMessage(msg);
    }
  }

  router.onopen = async () => {
    // Send "server-alive" ping in case any client has been waiting.
    router.send(JSON.stringify({
      'client-id': 'broadcast',
      'message': JSON.stringify({ type: 'server-alive' })
    }));
  }
}
document.querySelector('#start').onclick = connect;









/**
 * Logs in with Basic Authentication using the supplied credentials.
 * 
 * This does not handle success or failure.
 * 
 * @param {string} username The username to authenticate with.
 * @param {string} password The password to authenticate with.
 * 
 * Please note the SECURITY IMPLICATIONS in untrusted
 * environments.
 */
function loginWithBasicAuth(username, password) {
  const baseURL = `${window.location.protocol}//${window.location.host}`;
  const request = new XMLHttpRequest();
  request.withCredentials = true;
  request.open("GET", `${baseURL}/login`, true, username, password);
  request.onerror = (event) => {console.log(event)};
  request.send();
}











/**
 * ******************
 * Pointer Connection
 * ******************
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
  var xWheel = 0;
  var yWheel = 0;
  // Listen to mouse events and dispay virtual mouse.
  var pointerStream = connection.createDataChannel("pointer");
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
    else if (data.type == 'release-all-buttons') {
      btn1 = 0;
      btn2 = 0;
      btn3 = 0;
    }
    else if (data.type == 'wheel') {
      var step = 1;
      if (data.step == 'lines') {
        step = 0.01;
      }
      // Update position
      xWheel += data.x * step;
      yWheel -= data.y * step;
      // Snap position to valid range
      xWheel = Math.min(1, Math.max(0, xWheel));
      yWheel = Math.min(1, Math.max(0, yWheel));
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
    // Wheel position.
    ctx.strokeStyle = 'blue';
    ctx.beginPath();
    ctx.arc(xWheel*canvas.clientWidth, yWheel*canvas.clientHeight,
      5, 0, 2*Math.PI);
    ctx.stroke();
  };
}


/**
 * ******************
 * Keyboard Connection
 * ******************
 * Attach the virtual keyboard for incoming events.
 */
function attachKeyboard(connection) {
  const keyLabel = document.querySelector('#keys');
  // Virtual Keyboard Parameters
  let keysDown = new Set();

  // Listen to mouse events and dispay virtual mouse.
  var keyboardStream = connection.createDataChannel("keyboard");
  keyboardStream.onmessage = (message) => {
    const data = JSON.parse(message.data);

    /**
     * Handle keyboard events.
     */
    if (data.type == 'key-down') {
      keysDown.add(data.code);
    }
    else if (data.type == 'key-up') {
      keysDown.delete(data.code);
    }
    else if (data.type == 'release-all-keys') {
      keysDown.clear();
    }

    // Display pressed keys on the virtual keyboard
    keyLabel.innerHTML = Array.from(keysDown).join(' ');
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
async function readyScreen() {
  const realData = document.querySelector('#realData').checked;
  if (!realData) {
    // Prepare the fake video data for sending.
    var fakeScreenInit = false;
    if (!fakeScreenInit) {
      fakeScreenInit = true;
      // Generate fake video data.
      var drawVid = () => {
        const canvas = document.querySelector('#fakeDisplay');
        const ctx = canvas.getContext('2d');
        const time = (new Date()).getTime()
        ctx.strokeStyle = `rgb(${time/50 % 255},0,0)`;
        ctx.beginPath();
        ctx.arc((time/100) % canvas.clientWidth, time/9 % canvas.clientHeight,
          5, 0, 2*Math.PI);
        ctx.stroke();
      }
      drawVid();
      setInterval(drawVid, 30);
    }
    // Connect up the fake video.
    const canvas = document.querySelector('#fakeDisplay');
    screenStream = canvas.captureStream(30);
    document.querySelector('#display').srcObject = screenStream;
  }
  else {
    // Prepare the screenshare display for sending.
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia(
        {video: true, frameRate: 30});
      document.querySelector('#display').srcObject = screenStream;
    } catch(err) {


      console.log(err)
      alert("Could not activate screen.");
    }
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
 * via the singalling service.
 * 
 * This also includes enough hooks to attach logic
 * for what to do with the data going across the stream.
 **/

class PeerStream {
  constructor(streamName, routerSend, config) {
    this.connection = new RTCPeerConnection(config);
    // Ready the send of ICE Candidate details.
    this.connection.onicecandidate = ({candidate}) => {
      if (!candidate) return;
      routerSend(JSON.stringify({
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
          routerSend(JSON.stringify({
          type: 'offer',
          stream: streamName,
          payload: this.connection.localDescription
        }));
      } catch (err) { console.error(err); }
    }
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