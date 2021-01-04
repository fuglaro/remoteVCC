import {PeerStream} from './peerstream.js';
import {attachScreen} from './clientscreen.js';
import {attachPointer} from './clientpointer.js';
import {attachKeyboard} from './clientkeyboard.js';

const display = document.querySelector('#display');

// Signalling server for connection negotiation.
var router;

/**
 * Register with the signalling system (router) and
 * connect all streams with the server including
 * display, audio, mic, and inputs.
 */
async function connect() {
  setStatus("<b>Connecting</b><br>Please wait...");

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
  const signal = new PeerStream('signal', routerSend, RTCConfig);
  var signalStream;
  signal.connection.ondatachannel = (event) => {
    signalStream = event.channel;
    signalStream.onopen = (openEvent) => {
      // Close the websocket connection and login system
      // when it is no longer needed.
      router.close();
      document.getElementById("loginForm").style.display = "none";
      // Prepare a callback for when all connections are established.
      var connectionsWaiting = 0;
      var pushCallbackWaiting = () => {
        connectionsWaiting++;
        return () => {
          connectionsWaiting--;
          if (!connectionsWaiting) {
            // Everything has connected!
            setStatus('');
          }
        }
      }

      // Ready connections.
      var signalSend = (message) => {signalStream.send(message)};
      const screen = new PeerStream('screen', signalSend, RTCConfig);
      const pointer = new PeerStream('pointer', signalSend, RTCConfig);
      const keyboard = new PeerStream('keyboard', signalSend, RTCConfig);

      attachScreen(screen.connection, display, pushCallbackWaiting());
      attachPointer(pointer.connection, display, pushCallbackWaiting());
      attachKeyboard(keyboard.connection, display, pushCallbackWaiting());

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
  router.onopen = (event) => { signal.request(); };
}


/**
 * Set the status message
 * or hide it by passing an empty string.
 */
function setStatus(message) {
  const statusMessage = document.getElementById("statusMessage");
  if (!message) {
    statusMessage.style.display = "none";
  }
  else {
    statusMessage.innerHTML = message;
    statusMessage.style.display = "block";
  }
}

export {connect};