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

  // Ready connections.
  const screen = new peerstream.PeerStream('screen', router, RTCConfig);
  const pointer = new peerstream.PeerStream('pointer', router, RTCConfig);
  const keyboard = new peerstream.PeerStream('keyboard', router, RTCConfig);
  clientscreen.attachScreen(screen.connection, display);
  clientpointer.attachPointer(pointer.connection, display);
  clientkeyboard.attachKeyboard(keyboard.connection, display);
  var requestConnection = () => {
    screen.request();
    pointer.request();
    keyboard.request();
  };

  // Ready signalling server messages (router).
  router.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    // The server came online, reconnect!
    if (msg.type == 'server-alive') {
      requestConnection();
    }

    // Could be a message for a stream.
    // Distribute the messages to the appropriate stream handler.
    else {
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
  };

  // Request connection in case the server is already online.
  router.onopen = async ({event}) => {
    requestConnection();
  };
}
connect();