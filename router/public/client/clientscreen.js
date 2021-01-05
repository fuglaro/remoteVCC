/**
 * Connection logic for the display.
 */

function attachScreen(connection, display, onconnected) {
  // Once remote track media arrives, display it on screen.
  connection.ontrack = (event) => {
    onconnected();
    display.srcObject = event.streams[0];
  };
}

export {attachScreen}