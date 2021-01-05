/**
 * Connection logic for the pointer.
 * This include, touch pads, touch screens and mouse.
 */

function attachPointer(connection, canvas, onconnected) {

  // Ready the send of pointer events.
  connection.ondatachannel = (event) => {
    onconnected();
    var dataChannel = event.channel;

    dataChannel.onopen = (event) => {

      /**
       * Reset all buttons to "up" on focus and unfocus.
       **/
      const releaseAllButtons = (event) => {
        var timestamp = Date.now();

        dataChannel.send(JSON.stringify({
          type: 'release-all-buttons',
          time: timestamp
        }));
      }
      document.addEventListener('pointerlockchange', releaseAllButtons);
      canvas.addEventListener('focusin', releaseAllButtons);
      canvas.addEventListener('focusout', releaseAllButtons);


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
        const cw = display.clientWidth;
        const ch = display.clientHeight;
        const videoAspect = display.videoWidth / display.videoHeight;
        // Real visual width and height of the video (after auto-sizing)
        var rw = cw;
        var rh = ch;
        if (videoAspect > cw / ch) {
          // Video is width constrained.
          rh = cw / videoAspect;
          var xPos = e.offsetX / cw;
          var yPos = (e.offsetY - ((ch - rh) / 2)) / rh;
        } else {
          // Video is height constrained.
          rw = ch * videoAspect;
          var xPos = (e.offsetX - ((cw - rw) / 2)) / rw;
          var yPos = e.offsetY / ch;
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


      /**
       * Mouse wheel.
       * A scroll wheel movement occurred.
       */
      canvas.addEventListener('wheel', e => {
        var timestamp = Date.now();

        // Ignore page wheels.
        if (e.deltaMode == 2) return;

        var x = e.deltaX;
        var y = e.deltaY;
        var z = e.deltaZ;

        // Pixel steps are sent relative to the screen size.
        if (e.deltaMode == 0) {
          // Calulate the real video side in the client display
          const cw = display.clientWidth;
          const ch = display.clientHeight;
          const videoAspect = display.videoWidth / display.videoHeight;
          // Real visual width and height of the video (after auto-sizing)
          var realWidth = cw;
          var realHeight = ch;
          if (videoAspect > cw / ch) {
            // Video is width constrained.
            realHeight = cw / videoAspect;
          } else {
            // Video is height constrained.
            realWidth = ch * videoAspect;
          }
          // Now adjust the pixel proportions.
          x = x / realWidth;
          y = y / realHeight;
          z = z / ((realWidth + realHeight) / 2)
        }

        // Send the wheel movement information.
        dataChannel.send(JSON.stringify({
          type: 'wheel',
          time: timestamp,
          step: ((e.deltaMode == 0) ? 'pixels' : 'lines'),
          x: x,
          y: y,
          z: z
        }));
      });
    };
  };
}

export {attachPointer}