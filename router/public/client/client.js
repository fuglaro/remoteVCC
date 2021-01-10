import {PeerStream} from './peerstream.js';
import {attachScreen} from './clientscreen.js';
import {attachPointer} from './clientpointer.js';
import {attachKeyboard} from './clientkeyboard.js';


// Signalling server for connection negotiation.
var router;


/**
 * Register with the signalling system (router) and
 * connect all streams with the server including
 * display, audio, mic, and inputs.
 */
async function connect() {
  setStatus("<b>Connecting</b><br>Please wait...");

  // Close any existing router connections
  if (router) router.close();


  // Get the server configs.
  const baseURL = `${window.location.protocol}//${window.location.host}`;
  const config = await fetch(
    `${baseURL}/api/config`).then(r => r.json());


  // Connect up the the signalling server,
  // authenticating in the query parameters.
  router = new WebSocket(
    `wss://${window.location.host}/signal/client?auth=${
      document.getElementById("secret").value
    }`);
  // Connect a temporary Connection Failed message
  router.onerror = (event) => {setStatus("Connection Failed.", 2);};
  // Ready router message handling.
  router.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    // If the server came online, attempt connection.
    if (msg.type == 'server-alive') signal.request();
    // Otherwise its a signalling message.
    else signal.handleMessage(msg);
  }
  // Request connection in case the server is already waiting.
  router.onopen = (event) => {
    signal.request();
    setStatus("<b>Connecting</b><br>Waiting for server...");
  };


  // Swap to a peer-to-peer signal stream to
  // negotiate other peer-to-peer connetions.
  const routerMsg = (message) => {router.send(message)};
  const signal = new PeerStream('signal', routerMsg, config.rtc);
  signal.connection.ondatachannel = (signalling) => {
    signalling.channel.onopen = (e) => {
      setStatus("<b>Connecting</b><br>Please wait...");

      // Close the websocket connection and login system
      // when it is no longer needed.
      router.close();
      document.getElementById("loginForm").style.display = "none";


      // Prepare a callback counting waiting connections,
      // so we can let the user know its all ready to go.
      var connectionsWaiting = 0;
      var pushWaitingCallback = () => {
        connectionsWaiting++;
        return () => {
          connectionsWaiting--;
          // Let the user know when everything has connected.
          if (!connectionsWaiting) setStatus('');
        }
      }

      // Ready streams for connection.
      const signalMsg = (message) => {signalling.channel.send(message)};
      const screen = new PeerStream('screen', signalMsg, config.rtc);
      const pointer = new PeerStream('pointer', signalMsg, config.rtc);
      const keyboard = new PeerStream('keyboard', signalMsg, config.rtc);

      // Attach the stream handlers.
      const display = document.querySelector('#display');
      attachScreen(screen.connection, display, pushWaitingCallback());
      attachPointer(pointer.connection, display, pushWaitingCallback());
      attachKeyboard(keyboard.connection, display, pushWaitingCallback());

      // Ready signalling message handling.
      signalling.channel.onmessage = async (event) => {
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

      // Request to establish the connections.
      screen.request();
      pointer.request();
      keyboard.request();
    }

    // Try to reconnect through the router if we lose the
    // peer-to-peer signal connection.
    signalling.channel.onclose = (e) => {connect();};
  }
}


/**
 * Display a status message
 * or hide it by omitting a value.
 * @param {string} message The message to display.
 * @param {int} timeout A timeout in seconds to hide the message.
 */
async function setStatus(message="", timeout=null) {
  const statusMessage = document.getElementById("statusMessage");
  if (!message) {
    statusMessage.style.display = "none";
  }
  else {
    statusMessage.innerHTML = message;
    statusMessage.style.display = "block";
    if (timeout) setTimeout(setStatus, timeout * 1000);
  }
}


export {connect};