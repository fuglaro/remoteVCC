/**
 * Connection logic for the display.
 */

async function attachScreen(connection, display) {
  // Once remote track media arrives, display it on screen.
  connection.ontrack = (event) => {
    display.srcObject = event.streams[0];
  };
}

export {attachScreen}