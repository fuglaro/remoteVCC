import * as peerstream from './peerstream.js';
import * as clientscreen from './clientscreen.js';
import * as clientpointer from './clientpointer.js';
import * as clientkeyboard from './clientkeyboard.js';


const RTC_CONF = {iceServers: [{urls: 'stun:stun.example.org'}]}; //TODO config
const ROUTER = 'ws://localhost:7993'; //TODO config

const display = document.querySelector('#display');

// Signalling server for connection negotiation.
var router;

/**
 * Register with the signalling system (router) and
 * connect all streams with the server including
 * display, audio, mic, and inputs.
 */
async function connect() {
  // Connect up the the signalling server.
  router = new WebSocket(ROUTER);

  // Ready connections.
  const screen = new peerstream.PeerStream('screen', router, RTC_CONF);
  const pointer = new peerstream.PeerStream('pointer', router, RTC_CONF);
  const keyboard = new peerstream.PeerStream('keyboard', router, RTC_CONF);
  clientscreen.attachScreen(screen.connection, display);
  clientpointer.attachPointer(pointer.connection, display);
  clientkeyboard.attachKeyboard(keyboard.connection, display);
  var requestConnection = () => {
    screen.request();
    pointer.request();
    keyboard.request();
  };

  // Handle signalling server messages (router).
  router.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    // The server came online, connect!
    if (msg.type == 'server_alive') {
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