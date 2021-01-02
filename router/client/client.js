import * as peerstream from './peerstream.js';
import * as clientscreen from './clientscreen.js';
import * as clientpointer from './clientpointer.js';
import * as clientkeyboard from './clientkeyboard.js';

const display = document.querySelector('#display');

// Signalling server for connection negotiation.
var router;

/**
 * Register with the signalling system (router) and
 * connect all streams with the server including
 * display, audio, mic, and inputs.
 */
async function connect() {
  // Get the RTC Configs.
  const baseURL = `${window.location.protocol}//${window.location.host}`;
  const RTCConfig = await fetch(`${baseURL}/rtcconfig`).then(r => r.json());

  // Connect up the the signalling server.
  const socketProtocol = (
    (window.location.protocol == 'http:') ? 'ws:' : 'wss:');
  router = new WebSocket(`${socketProtocol}//${window.location.host}`);
  var routerSend = (message) => {router.send(message)};

  // Swap to a peer-to-peer signal stream to
  // negotiate other peer-to-peer connetions.
  const signal = new peerstream.PeerStream('signal', routerSend, RTCConfig);
  var signalStream;
  signal.connection.ondatachannel = (event) => {
    signalStream = event.channel;
    signalStream.onopen = (openEvent) => {
      // Close the websocket connection when it is no longer needed.
      router.close();

      // Ready connections.
      var signalSend = (message) => {signalStream.send(message)};
      const screen = new peerstream.PeerStream('screen', signalSend, RTCConfig);
      const pointer = new peerstream.PeerStream('pointer', signalSend, RTCConfig);
      const keyboard = new peerstream.PeerStream('keyboard', signalSend, RTCConfig);

      clientscreen.attachScreen(screen.connection, display);
      clientpointer.attachPointer(pointer.connection, display);
      clientkeyboard.attachKeyboard(keyboard.connection, display);

      // Ready signalling message handling.
      signalStream.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.stream) {
          case 'screen':
            screen.handleMessage(msg);
            break;
          case 'pointer':
            pointer.handleMessage(msg);
            break;
          case 'keyboard':
            keyboard.handleMessage(msg);
            break;
        }
      }

      // Establish the connections.
      screen.request();
      pointer.request();
      keyboard.request();
    }
    signalStream.onclose = (event) => { connect(); };
  }

  // Ready router server messages (initial signalling).
  router.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    // The server came online, reconnect!
    if (msg.type == 'server-alive') {
      signal.request();
    }
    else {
      signal.handleMessage(msg);
    }
  }

  // Request connection in case the server is already online.
  router.onopen = async ({event}) => {
    signal.request();
  }
}
connect();