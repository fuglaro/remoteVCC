
const RTC_CONF = {iceServers: [{urls: 'stun:stun.example.org'}]};
const ROUTER = 'ws://localhost:7993';


// Signalling server for connection negotiation.
var router;
// Reciever for peer to peer display stream.
var screenConn;


/**
 * Register with the signalling system and
 * connect all streams with the server including
 * display, audio, mic, and inputs.
 */
async function connect() {
  // Connect up the the signalling server.
  router = new WebSocket(ROUTER);

  // Prepare the display connection.
  screenConn = new RTCPeerConnection(RTC_CONF);
  /* Send ICE Candidate details for screen. */
  screenConn.onicecandidate = ({candidate}) => {
    if (!candidate) return;
    router.send(JSON.stringify({
      type: 'ice_candidate',
      stream: 'screen',
      payload: candidate
    }));
  }
  // Once remote track media arrives, display it on screen.
  screenConn.ontrack = (event) => {
    document.querySelector('#display').srcObject = event.streams[0];
  };

  // Initialise the signal message handlers.
  router.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    // Display stream negotiation.
    if (msg.type == 'offer' && msg.stream == 'screen') {
      await screenConn.setRemoteDescription(msg.payload);
      await screenConn.setLocalDescription(await screenConn.createAnswer());
      router.send(JSON.stringify({
        type: 'answer',
        stream: 'screen',
        payload: screenConn.localDescription
      }));
    }
    if (msg.type == 'ice_candidate' && msg.stream == 'screen') {
      await screenConn.addIceCandidate(msg.payload);
    }
  }

  // Request the streams from the server.
  router.onopen = async ({event}) => {
    router.send(JSON.stringify({
      type: 'request',
      stream: 'screen'
    }));
  };
}
connect();

