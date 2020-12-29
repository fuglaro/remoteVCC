/**
 * Connection logic for the pointer.
 * This include, touch pads, touch screens and mouse.
 */

async function attachPointer(connection, canvas) {

  // Ready the send of pointer events.
  connection.ondatachannel = (event) => {
    var dataChannel = event.channel;

    dataChannel.onopen = (event) => {

      // TODO: scrolling

      /**
       * Mouse movement (warp).
       * Repositioning of the pointer.
       */
      canvas.addEventListener('mousemove', e => {
        var timestamp = Date.now();
        // Get the position of the mouse position relative
        // the to remote display.
        // This does a bunch of calculations to estimate
        // the effect of the auto-sizing logic of the video
        // element. Ideally the resulting video display
        // positions could be retrieved.
        // (0-1 from top left)
        const vw = display.videoWidth;
        const vh = display.videoHeight;
        const cw = display.clientWidth;
        const ch = display.clientHeight;
        const ox = e.offsetX;
        const oy = e.offsetY;
        const va = vw / vh;
        const ca = cw / ch;
        // Real visual width and height of the video (after auto-sizing)
        var rw;
        var rh;
        if (va > ca) {
          // Video is width constrained.
          rw = cw;
          rh = cw / va;
          var xPos = ox / cw;
          var yPos = (oy - ((ch - rh) / 2)) / rh;
        } else {
          // Video is height constrained.
          rw = ch * va;
          rh = ch;
          var xPos = (ox - ((cw - rw) / 2)) / rw;
          var yPos = oy / ch;
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
            time: timestamp,
            xMov: xMov,
            yMov: yMov
          }));
        }
        else {
          // Warp pointer.
          dataChannel.send(JSON.stringify({
            type: 'motion-warp',
            time: timestamp,
            xPos: xPos,
            yPos: yPos,
          }));
        }
      });


      /**
       * Mouse down.
       * A button was pressed.
       */
      canvas.addEventListener('mousedown', e => {
        var timestamp = Date.now();

        // Capture the mouse if it hasn't been already.
        if (!document.pointerLockElement) canvas.requestPointerLock();

        // Send the mouse-move information.
        dataChannel.send(JSON.stringify({
          type: 'button-down',
          time: timestamp,
          button: e.button
        }));
      });


      /**
       * Mouse up.
       * A button was released.
       */
      canvas.addEventListener('mouseup', e => {
        var timestamp = Date.now();

        // Send the mouse-move information.
        dataChannel.send(JSON.stringify({
          type: 'button-up',
          time: timestamp,
          button: e.button
        }));
      });
    };
  };
}

export {attachPointer}