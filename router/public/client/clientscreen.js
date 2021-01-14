/**
 * Connection logic for the display.
 */

/**
 * Connect the incoming video track to the
 * display element when it is ready.
 *
 * @param {RTCPeerConnection} connection The connection that will
 *                                       get a video track.
 * @param {HTMLVideoElement} display Where show the video.
 * @param {function} onconnected Callback that is called when the
 *                               data channel is established.
 */
function attachScreen(connection, display, onconnected) {
  // Once remote track media arrives, display it on screen.
  connection.ontrack = (event) => {
    onconnected();
    display.srcObject = event.streams[0];
  };
}

export {attachScreen}