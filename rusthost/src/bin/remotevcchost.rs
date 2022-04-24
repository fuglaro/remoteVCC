
use clap::{Arg, Command};
use futures::select;
use futures_util::{StreamExt, SinkExt};
use gst::ElementFactory;
use gst::StateChangeError as GSTStateError;
use gst::glib::Error as GSTError;
use gst::prelude::{ElementExt, GstBinExtManual};
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::{Error as WSError, Message};
use url::Url;






#[derive(Error, Debug)]
enum RVCCError {
    #[error("Error: {0}")]
    Fail(String),
    #[error("Media and Input Streaming (WebRTC/GStreamer) Error: {0}")]
    GST(#[from] GSTError),
    #[error("Media and Input Streaming (WebRTC/GStreamer) Error: {0}")]
    GSTState(#[from] GSTStateError),
    #[error("Router Connection (WebSocket) Error: {0}")]
    RouterComms(#[from] WSError)
}


#[derive(Serialize, Deserialize)]
struct RouterMessage {
    #[serde(rename="client-id")]
    client_id: String,
    #[serde(rename="type")]
    mtype: String,
    payload: Option<String>
}




async fn handle_router(url: &str) -> Result<(), RVCCError> {

    // TODO - switch to wss regardless
    // TODO - add random hostID if not included

    // Connect to the router via WebSocket
    let (wss, _) = match connect_async(Url::parse(url).unwrap()).await {
        Ok(s) => s,
        Err(e) => {
            match e {
                WSError::Tls(e) => {
                    return Err(RVCCError::Fail(format!(
                        "Router TLS error >>> if using a Self Signed Certificate on the router, \
                        ensure this is installed on the system <<< ({e})"
                    )))
                },
                e => return Err(RVCCError::RouterComms(e))
            }
        }
    };
    eprintln!("Router connection established.");
    let (mut ws_sink, ws_stream) = wss.split();

    // Inform the router we are ready to recieve connections
    ws_sink.send(Message::Text(json!({
        "client-id": "broadcast",
        "type": "host-ready"
    }).to_string())).await.map_err(RVCCError::RouterComms)?;

    // Router message handler
    fn handle_message(msg: Message) -> () {
        eprintln!("{msg}"); // TODO remove debug

        // Only handle text based messages
        if !msg.is_text() { return }

        // Parse the json message
        let data: RouterMessage = match serde_json::from_str(&msg.into_text().unwrap()) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Bad Router Message: {e}");
                return;
            }
        };

        // Handle different message types
        match data.mtype.as_str() {
            "request" => {
                eprintln!("{}", data.payload.unwrap()); // TODO remove debug
                // TODO - figure out something sensible with access key

            },
            v => eprintln!("Bad Router Message: type '{}' not supported", v)
        }

    }

    // Loop router messages, handling each one
    let mut ws_stream = ws_stream.fuse();
    loop {
        select! {
            msg = ws_stream.select_next_some() =>
                handle_message(msg.map_err(RVCCError::RouterComms)?)
        }
    }
}

#[tokio::main(flavor="current_thread")]
async fn main() -> Result<(), RVCCError> {
    // Command line arguments and help
    let matches = Command::new("remoteVCChost")
        .about("Serves a remoteVCC host for clients to connect to.")
        .arg(
            Arg::new("router_url")
                .long("via-router")
                .takes_value(true)
                .help(
                    "Connect through a remotevcc router service via a given URL. If a host \
                    identifier is not included in the URL, a persistent and unguessable one will \
                    be made. Note that the router service needs to be trusted",
                ),
        )
        .get_matches();

    // Ready the gstreamer pipeline for handling media and input
    gst::init().map_err(RVCCError::GST)?;
    let source = ElementFactory::make("videotestsrc", None)
        .map_err(|_| RVCCError::Fail(format!("Install gstreamer plugin: videotestsrc")))?;
    let webrtc = ElementFactory::make("webrtcsink", None)
        .map_err(|_| RVCCError::Fail(format!("Install gstreamer plugin: webrtcsink")))?;
    let pipe = gst::Pipeline::new(None);
    pipe.add_many(&[&source, &webrtc]).unwrap();
    gst::Element::link_many(&[&source, &webrtc]).unwrap();
    pipe.set_state(gst::State::Playing).map_err(RVCCError::GSTState)?;



    // Mode: via router
    // TODO handle router config of ice servers
    match matches.value_of("router_url") {
        None => panic!("Only router connections are currently supported."),
        Some(url) => handle_router(url, webrtc).await?,
    }

    Ok(())
}
