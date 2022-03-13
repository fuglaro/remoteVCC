
// Signalling router for peer-to-peer connection negotiation.
var router;


/**
 * Register with the router (websocket signalling system) and
 * then connect the peer-to-peer stream with the host including
 * display, audio, and input channels.
 */
async function connect() {
  setStatus("Connecting...");

  // Close any existing router connections
  if (router) router.close();

  // Prepare a callback counting waiting connections,
  // so we can let the user know its all ready to go
  // and clean things up when finished connecting.
  var connectionsWaiting = 2;
  function connectionDone() {
    connectionsWaiting--;
    if (connectionsWaiting) return;
    setStatus();
    router.close();
    document.querySelector('#display').focus()
  }

  // Prepare the peer-to-peer stream connection,
  // using the router configs (including stun and turn services).
  const config = await fetch(`${window.location.protocol}//${
    window.location.host}/api/config`).then(r => r.json());
  const stream = new PeerStream((m)=>router.send(m), config.rtc);
  // When remote track media arrives, display it on screen.
  stream.connection.ontrack = (event) => {
    document.querySelector('#display').srcObject = event.streams[0];
    connectionDone();
  };
  // Hook up attaching the input event handlers to the data stream.
  stream.connection.ondatachannel = (inputChannel) => {
    inputChannel.channel.onopen = (e) => {
      attachInput(document.querySelector('#display'), inputChannel.channel);
      connectionDone()
    }
    // Try to reconnect through the router if we lose the
    // peer-to-peer stream connection.
    inputChannel.channel.onclose = (e) => {connect()};
  }

  // Connect to the router, authenticating in the query parameters.
  router = new WebSocket(`wss://${window.location.host}/signal/client?auth=${
    document.getElementById("secret").value}`);
  // Ready router message handling for peer-to-peer stream connection.
  router.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    // If the host comes online, attempt connection.
    if (msg.type == 'host-ready')
      router.send(JSON.stringify({type: 'request'}));
    // Otherwise its a signalling message establishing the websocket stream.
    else stream.handleMessage(msg);
  }
  router.onopen = (event) => {
    document.getElementById("loginForm").style.display = "none";
    // Request connection in case the host is already waiting.
    router.send(JSON.stringify({type: 'request'}));
  };
  // Add a message for when the router connection fails
  router.onerror = (event) => {setStatus("Connection Failed.", 2)};
}
document.querySelector('#start').onclick = connect;


/**
 * Manages the RTC negotiation logic to establish
 * WebRTC connections with the host (via a router}.
 **/
class PeerStream {
  constructor(send, config) {
    this.connection = new RTCPeerConnection(config);
    // Ready send of ICE Candidate details.
    this.connection.onicecandidate = ({candidate}) => {
      if (!candidate) return;
      this.send(JSON.stringify({type: 'ice-candidate', payload: candidate}));
    };
    this.send = send;
  }

  // Respond to host messages.
  async handleMessage(msg) {
    if (msg.type == 'offer') {
      await this.connection.setRemoteDescription(msg.payload);
      await this.connection.setLocalDescription(
        await this.connection.createAnswer());
      this.send(JSON.stringify({
        type: 'answer',
        payload: this.connection.localDescription
      }));
    }
    if (msg.type == 'ice-candidate')
      this.connection.addIceCandidate(msg.payload);
  }
}


/**
 * Make the pointer and keyboard events triggered
 * from the provided canvas emit input events on the
 * provided data channel (to the host).
 *
 * @param {HTMLElement} canvas Where to listen for events.
 * @param {RTCDataChannel} dataChannel Where to send input event messages.
 */
function attachInput(canvas, dataChannel) {

  // Reset all buttons and keys to "up" on focus and unfocus.
  const releaseAllButtons = (event) => {
    dataChannel.send(JSON.stringify({type: 'all-up'}))};
  document.addEventListener('pointerlockchange', releaseAllButtons);
  canvas.addEventListener('focusin', releaseAllButtons);
  canvas.addEventListener('focusout', releaseAllButtons);


  // Key down (pressed) event.
  canvas.addEventListener('keydown', e => {
    dataChannel.send(JSON.stringify({
      type: 'key-down',
      code: e.code
    }));
  });


  // Key up (released) event.
  canvas.addEventListener('keyup', e => {
    dataChannel.send(JSON.stringify({
      type: 'key-up',
      code: e.code
    }));
  });


  // Mouse movement (motion and warp).
  canvas.addEventListener('mousemove', e => {
    // Get the position of the mouse position relative
    // the to remote display.
    // This does a bunch of calculations to estimate
    // the effect of the auto-sizing logic of the video
    // element. Ideally the resulting video display
    // positions could be retrieved.
    // (0-1 from top left)
    const cw = display.clientWidth;
    const ch = display.clientHeight;
    const videoAspect = display.videoWidth / display.videoHeight;
    // Real visual width and height of the video (after auto-sizing)
    var rw = cw;
    var rh = ch;
    if (videoAspect > cw / ch) {
      // Video is width constrained.
      rh = cw / videoAspect;
      var xPos = e.offsetX / cw;
      var yPos = (e.offsetY - ((ch - rh) / 2)) / rh;
    } else {
      // Video is height constrained.
      rw = ch * videoAspect;
      var xPos = (e.offsetX - ((cw - rw) / 2)) / rw;
      var yPos = e.offsetY / ch;
    }
    // Get the mouse movement relative to the display.
    // (right and down are positive directions
    // and length is the proportion of the screen 0-1).
    var xMov = e.movementX / rw;
    var yMov = e.movementY / rh;

    // Send the mouse-move information.
    if (document.pointerLockElement) {
      // Send movement without position.
      dataChannel.send(JSON.stringify({
        type: 'motion-move',
        xMov: xMov,
        yMov: yMov
      }));
    } else {
      // Warp pointer.
      dataChannel.send(JSON.stringify({
        type: 'motion-warp',
        xPos: xPos,
        yPos: yPos,
      }));
    }
  });


  // Mouse down (a button was pressed).
  canvas.addEventListener('mousedown', e => {
    // Capture the mouse if it hasn't been already.
    if (!document.pointerLockElement) canvas.requestPointerLock();
    // Send the mouse-move information.
    dataChannel.send(JSON.stringify({
      type: 'button-down',
      button: e.button
    }));
  });


  // Mouse up (a button was released).
  canvas.addEventListener('mouseup', e => {
    // Send the mouse-move information.
    dataChannel.send(JSON.stringify({
      type: 'button-up',
      button: e.button
    }));
  });


  // Mouse wheel (a scroll wheel movement occurred).
  canvas.addEventListener('wheel', e => {
    // Ignore page wheels.
    if (e.deltaMode == 2) return;

    var x = e.deltaX;
    var y = e.deltaY;
    var z = e.deltaZ;

    // Pixel steps are sent relative to the screen size.
    if (e.deltaMode == 0) {
      // Calulate the real video side in the client display
      const cw = display.clientWidth;
      const ch = display.clientHeight;
      const videoAspect = display.videoWidth / display.videoHeight;
      // Real visual width and height of the video (after auto-sizing)
      var realWidth = cw;
      var realHeight = ch;
      if (videoAspect > cw / ch) {
        // Video is width constrained.
        realHeight = cw / videoAspect;
      } else {
        // Video is height constrained.
        realWidth = ch * videoAspect;
      }
      // Now adjust the pixel proportions.
      x = x / realWidth;
      y = y / realHeight;
      z = z / ((realWidth + realHeight) / 2)
    }

    // Send the wheel movement information.
    dataChannel.send(JSON.stringify({
      type: 'wheel',
      step: ((e.deltaMode == 0) ? 'pixels' : 'lines'),
      x: x,
      y: y,
      z: z
    }));
  });
}


/**
 * Display a status message
 * or hide it by omitting a value.
 * @param {string} message The message to display.
 * @param {int} timeout A timeout in seconds to hide the message.
 */
async function setStatus(message="", timeout=null) {
  const statusMessage = document.getElementById("statusMessage");
  statusMessage.style.display = message ? "block" : "none";
  statusMessage.innerHTML = message;
  if (timeout) setTimeout(setStatus, timeout*1000);
}
