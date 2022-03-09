
// Signalling server for connection negotiation.
var router = null;

// Peer to peer streams.
var streams = {};
// Media stream for the display.
var screenStream;


/**
 * Register with the router system and listen for
 * client connections to then connect a client stream.
 */
async function connect() {
  // Ensure we have cleaned up any existing connections
  // since we may be reconnecting.
  if (router) router.close();
  Object.values(streams).forEach((stream) => {stream.connection.close()});

  // Get the router configs (including stun and turn servers).
  const config = await fetch(`${window.location.protocol}//${
    window.location.host}/api/config`).then(r => r.json());

  // Ready display media.
  const fake = document.querySelector('#fakeDisplay');
  const useReal = document.querySelector('#realData').checked;
  try {
    screenStream = useReal ? await navigator.mediaDevices.getDisplayMedia(
      {video: true, frameRate: 30}) : fake.captureStream(30);
  } catch (err) {alert(`Could not activate screen:\n${err}`)}
  document.querySelector('#display').srcObject = screenStream;

  // Connect up the the routing server, authenticating in the query parameters.
  router = new WebSocket(`wss://${window.location.host}/signal/server?auth=${
    document.getElementById("secret").value}`);
  router.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    // Always reply directly to specific clients.
    function routerSend(message) {
      data = JSON.parse(message);
      data['client-id'] = msg['client-id'];
      router.send(JSON.stringify(data));
    }

    // Handle peer-to-peer stream creation for this client,
    // and connect display sender and input reciever.
    if (msg.type == 'request') {
      streams[msg['client-id']] = new PeerStream(routerSend, config.rtc);
      screenStream.getTracks().forEach((track) =>
        streams[msg['client-id']].connection.addTrack(track, screenStream));
      streams[msg['client-id']].connection.createDataChannel("input")
        .onmessage = getInputHandler();
    } else if (msg['client-id'] in streams) {
      // Handle connection establishment negotiation.
      streams[msg['client-id']].handleMessage(msg);
    }
  }
  router.onopen = async () => {
    // Alert all clients the server is ready in case any have been waiting.
    router.send(JSON.stringify({
      'client-id': 'broadcast',
      'type': 'server-ready'
    }));
  }
}
document.querySelector('#start').onclick = connect;


/**
 * Manages the RTC negotiation logic to establish
 * WebRTC connections with a client (via a router}.
 **/
class PeerStream {
  constructor(routerSend, config) {
    this.connection = new RTCPeerConnection(config);
    // Ready the send of ICE Candidate details.
    this.connection.onicecandidate = ({candidate}) => {
      if (!candidate) return;
      routerSend(JSON.stringify({
        type: 'ice-candidate',
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
          payload: this.connection.localDescription
        }));
      } catch (err) { console.error(err) }
    }
  }

  // Respond to client messages.
  async handleMessage(msg) {
    // Store any sent remote ice candidates.
    if (msg.type == 'ice_candidate')
      this.connection.addIceCandidate(msg.payload || {});
    // Store any sent remote descriptions.
    if (msg.type == 'answer')
      this.connection.setRemoteDescription(msg.payload);
  }
}


/**
 * Attach the virtual pointer and keyboard for incoming events.
 * This doesn't actually move the real pointer or trigger
 * real keypresses, this just displays the mouse pointer
 * and pressed keys for testing and debugging.
 */
function getInputHandler() {
  const c = document.querySelector('#canvas');
  const ctx = c.getContext("2d");
  const keyLabel = document.querySelector('#keys');

  // Virtual Keyboard Parameters
  let keysDown = new Set();
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
  return (message) => {
    const data = JSON.parse(message.data);


    // Handle keyboard events.
    if (data.type == 'key-down')
      keysDown.add(data.code);
    else if (data.type == 'key-up')
      keysDown.delete(data.code);
    else if (data.type == 'all-up')
      keysDown.clear();

    // Display pressed keys on the virtual keyboard
    keyLabel.innerHTML = Array.from(keysDown).join(' ');


    // Handle pointer events.
    if (data.type == 'motion-warp') {
      xPos = data.xPos;
      yPos = data.yPos;
      xMov = 0;
      yMov = 0;
    } else if (data.type == 'motion-move') {
      // Update position
      xPos += data.xMov;
      yPos += data.yMov;
      // Snap position to valid range
      xPos = Math.min(1, Math.max(0, xPos));
      yPos = Math.min(1, Math.max(0, yPos));
      // Update movement
      xMov = data.xMov;
      yMov = data.yMov;
    } else if (data.type == 'button-down') {
      if (data.button == 0) btn1 = 1;
      if (data.button == 1) btn2 = 1;
      if (data.button == 2) btn3 = 1;
    } else if (data.type == 'button-up') {
      if (data.button == 0) btn1 = 0;
      if (data.button == 1) btn2 = 0;
      if (data.button == 2) btn3 = 0;
    } else if (data.type == 'all-up') {
      btn1 = 0;
      btn2 = 0;
      btn3 = 0;
    } else if (data.type == 'wheel') {
      var step = data.step=='lines' ? 0.01 : 1;
      // Update position
      xWheel += data.x * step;
      yWheel -= data.y * step;
      // Snap position to valid range
      xWheel = Math.min(1, Math.max(0, xWheel));
      yWheel = Math.min(1, Math.max(0, yWheel));
    }

    // Draw virtual pointer.
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 3;
    // Pointer movement shadow.
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.arc((xPos-xMov)*c.clientWidth, (yPos-yMov)*c.clientHeight, 5, 0, 7);
    ctx.stroke(); 
    // Pointer position.
    ctx.strokeStyle = 'lightgreen';
    ctx.beginPath();
    ctx.arc(xPos*c.clientWidth, yPos*c.clientHeight, 5, 0, 7);
    ctx.stroke();
    // Pointer buttons.
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    if (btn1) ctx.arc(
      xPos*c.clientWidth, yPos*c.clientHeight, 5, 3/4*Math.PI, 5/4*Math.PI);
    if (btn2) ctx.arc(
      xPos*c.clientWidth, yPos*c.clientHeight, 5, 5/4*Math.PI, 7/4*Math.PI);
    if (btn3) ctx.arc(
      xPos*c.clientWidth, yPos*c.clientHeight, 5, 7/4*Math.PI, 9/4*Math.PI);
    ctx.stroke();
    // Wheel position.
    ctx.strokeStyle = 'blue';
    ctx.beginPath();
    ctx.arc(xWheel*c.clientWidth, yWheel*c.clientHeight, 5, 0, 7);
    ctx.stroke();
  };
}


