use async_tungstenite::tungstenite::Error as WSError;
use gst::StateChangeError as GSTStateError;
use gst::glib::Error as GSTError;
use thiserror::Error;

pub mod router_signaller;

#[derive(Error, Debug)]
pub enum RVCCError {
    #[error("Error: {0}")]
    Fail(String),
    #[error("Media and Input Streaming (WebRTC/GStreamer) Error: {0}")]
    GST(#[from] GSTError),
    #[error("Media and Input Streaming (WebRTC/GStreamer) Error: {0}")]
    GSTState(#[from] GSTStateError),
    #[error("Router Connection (WebSocket) Error: {0}")]
    RouterComms(#[from] WSError)
}

