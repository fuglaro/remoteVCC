/**
 * Connection logic for the pointer.
 * This include, touch pads, touch screens and mouse.
 */




async function attachPointer(connection, canvas) {

  // Ready the send of pointer events.
  connection.ondatachannel = (event) => {
    var receiveChannel = event.channel;
    //receiveChannel.onmessage = (message) => {
    //  console.log(message.data);
    //};
    receiveChannel.onopen = (event) => {
      

      canvas.addEventListener('mousemove', e => {

        // Get the position of the mouse position relative
        // the to remote display.
        // (0-1 from top left)
        const vw = display.videoWidth;
        const vh = display.videoHeight;
        const cw = display.clientWidth;
        const ch = display.clientHeight;
        const ox = e.offsetX;
        const oy = e.offsetY;
        const va = vw / vh;
        const ca = cw / ch;
        if (va > ca) {
          // Video is width constrained.
          var xPos = ox / cw;
          const rh = cw / va;
          var yPos = (oy - ((ch - rh) / 2)) / rh;
        } else {
          // Video is height constrained.
          const rw = ch * va;
          var xPos = (ox - ((cw - rw) / 2)) / rw;
          var yPos = oy / ch;
        }
      
        // Get the mouse movement relative to the display.
        // (right and down are positive directions
        // and length is the proportion of the screen 0-1).
        var xMov = e.movementX / vw * cw;
        var yMov = e.movementY / vh * ch;
      
        console.log(`Pointer1: ${xMov}x${yMov} @ ${xPos}x${yPos}`);
        receiveChannel.send(`Pointer1: ${xMov}x${yMov} @ ${xPos}x${yPos}`);
      });










    }; // TODO
    //receiveChannel.onclose = handleReceiveChannelStatusChange; // TODO
  };


}

export {attachPointer}