/**
 * Connection logic for the keyboard.
 */

/**
 * Connect the keyboard input events associated
 * with the provided canvas to the data stream
 * when it is ready.
 *
 * @param {RTCPeerConnection} connection The connection that will
 *                                       get a data channel.
 * @param {HTMLElement} canvas Where to listen for events.
 * @param {function} onconnected Callback that is called when the
 *                               data channel is established.
 */
function attachKeyboard(connection, canvas, onconnected) {

  // Ready the send of keyboard events.
  connection.ondatachannel = (event) => {
    onconnected();
    var dataChannel = event.channel;

    dataChannel.onopen = (event) => {

      /**
       * Reset all keys to "up" on focus and unfocus.
       **/
      const releaseAllKeys = (event) => {
        var timestamp = Date.now();

        dataChannel.send(JSON.stringify({
          type: 'release-all-keys',
          time: timestamp
        }));
      }
      document.addEventListener('pointerlockchange', releaseAllKeys);
      canvas.addEventListener('focusin', releaseAllKeys);
      canvas.addEventListener('focusout', releaseAllKeys);

      /**
       * Key down (pressed) event.
       */
      canvas.addEventListener('keydown', e => {
        var timestamp = Date.now();

        dataChannel.send(JSON.stringify({
          type: 'key-down',
          time: timestamp,
          code: e.code
        }));
      });


      /**
       * Key up (released) event.
       */
      canvas.addEventListener('keyup', e => {
        var timestamp = Date.now();

        dataChannel.send(JSON.stringify({
          type: 'key-up',
          time: timestamp,
          code: e.code
        }));
      });
    };
  };
}

export {attachKeyboard}