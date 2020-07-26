
const RTC_CONF = {iceServers: [{urls: 'stun:stun.example.org'}]};
const ROUTER = 'ws://localhost:7993';
const FRAME_RATE = 30;


// Signalling server for connection negotiation.
var router;
// Stream connection to the client for the display.
var screenConn;


/**
 * Register with the signalling system and
 * listen for client connections to then
 * connect all streams.
 */
async function connect() {
  // Connect up the the signalling server.
  router = new WebSocket(ROUTER);

  // Prepare the display for sending.
  try {
    var screenStream = await navigator.mediaDevices.getDisplayMedia(
      {video: true, frameRate: FRAME_RATE});
    document.querySelector('#display').srcObject = screenStream;
  } catch(err) {
    console.log(err)
    alert("Could not activate Webcam.");
  }

  // Initialise the signal message handlers.
  router.onmessage = async (event) => {
    console.log(event.data);
    const msg = JSON.parse(event.data);

    // Display stream negotiation.
    if (msg.type == 'request' && msg.stream == 'screen') {
      if (screenConn) screenConn.close();
      screenConn = new RTCPeerConnection(RTC_CONF);
      // Send Local Description details for screen.
      screenConn.onnegotiationneeded = async () => {
        try {
          await screenConn.setLocalDescription(await screenConn.createOffer());
          router.send(JSON.stringify({
            type: 'offer',
            stream: 'screen',
            payload: screenConn.localDescription
          }));
        } catch (err) { console.error(err); }
      }
      // Send ICE Candidate details for screen.
      screenConn.onicecandidate = ({candidate}) => {
        if (!candidate) return;
        router.send(JSON.stringify({
          type: 'ice_candidate',
          stream: 'screen',
          payload: candidate
        }));
      }
      // Connect the display to the stream being negotiated.
      screenStream.getTracks().forEach(
        (track) => screenConn.addTrack(track, screenStream));
    }
    if (msg.type == 'answer' && msg.stream == 'screen') {
      await screenConn.setRemoteDescription(msg.payload);
    }
    if (msg.type == 'ice_candidate' && msg.stream == 'screen') {
      await screenConn.addIceCandidate(msg.payload || {});
    }
  }
}
document.querySelector('#start').onclick = connect;



