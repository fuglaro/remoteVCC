/**
 * Connection logic for the keyboard.
 */

async function attachKeyboard(connection, canvas) {

  // Ready the send of keyboard events.
  connection.ondatachannel = (event) => {
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