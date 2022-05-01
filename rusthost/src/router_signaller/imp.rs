// Copied from https://github.com/centricular/webrtcsink-custom-signaller/blob/8b42b45c2b73277e300bbae14f5a94cee229c1f4/src/signaller/imp.rs
// Modified for implementation
// TODO document more scope and role of this module
use async_std::{stream::Stream, task::spawn};
use async_tungstenite::async_std::connect_async;
use async_tungstenite::tungstenite::{Error as WSError, Message};
use crate::RVCCError;
use futures::executor::block_on;
use futures_util::{StreamExt, SinkExt};
use gst::glib;
use gst::prelude::*;
use gst::subclass::prelude::*;
use gst_webrtc::{WebRTCSessionDescription, WebRTCSDPType};
use gst_sdp::sdp_message::SDPMessage;
use serde_json::{from_str, json, Value};
use std::{thread::sleep, time};
use std::sync::{Arc, Mutex};
use webrtcsink::webrtcsink::WebRTCSink;
use url::Url;

// TODO doc all

#[derive(Default)]
struct State {
    // TODO doc
    receiver: Arc<Mutex<Option<Box<dyn Stream<Item=Result<Message, WSError>> + Send + Unpin>>>>,
    // Sender for websocket messages
    sender: Option<Box<dyn FnMut(Message) -> () + Send>>,
    // The URL of the router service to connect through
    url: String
}
impl State {
    pub fn connect(&mut self) -> Result<(), RVCCError> {
        // Connect to the router via WebSocket
        let (wss, _) = match block_on(connect_async(Url::parse(&self.url).unwrap())) {
            Ok(s) => s,
            Err(e) => match e {
                WSError::Tls(e) => return Err(RVCCError::Fail(format!(
                        "Router TLS error >>> if using a Self Signed Certificate on the router, \
                        ensure this is installed on the system <<< ({e})"
                    ))),
                e => return Err(RVCCError::RouterComms(e))
            }
        };
        eprintln!("Router connection established.");
        // Save the WebSocket streams for connecting up in other methods
        let (mut ws_sink, ws_stream) = wss.split();
        self.sender = Some(Box::new(move |msg| block_on(ws_sink.send(msg)).unwrap_or_default()));
        *self.receiver.lock().unwrap() = Some(Box::new(ws_stream.fuse()));
        Ok(())
    }
}

#[derive(Default)]
pub struct Signaller {
    state: Arc<Mutex<State>>
}

impl Signaller {
    pub fn connect(&self, url: &str) -> Result<(), RVCCError> {
        let mut state = self.state.lock().unwrap();
        state.url = url.to_string();
        state.connect()
    }


    pub fn start(&self, element: &WebRTCSink) {
        // Launch a thread to handle received router messages
        let thread_state = Arc::clone(&self.state);
        let webrtcsink = element.downgrade();
        spawn(async move {
            let webrtcsink = webrtcsink.upgrade().unwrap();

            // Router message handler
            let handle_message = |msg: Message| {
                eprintln!("{msg}"); // TODO remove debug
                // Only handle text based messages
                if !msg.is_text() { return }

                // Handle different message types
                let data: Value = from_str(&msg.into_text().unwrap()).unwrap_or_default();
                let client_id = data["client-id"].as_str().unwrap_or_default();
                if client_id == "" { return }
                match data["type"].as_str() {
                    Some("request") => {
                        // TODO - figure out something sensible with access key
                        // TODO - note security vulm if reconnecting to WS router, and that peerIDs
                        // can get reused!!! Someone else could pass access key, but still lose
                        // connection. Should we access key on every message?
                        if let Err(e) = webrtcsink.add_consumer(client_id) {
                            eprintln!("Bad Router Message: couldn't register {}", e)
                        }
                    },
                    Some("answer") => {
                        let sdp = data["payload"]["sdp"].as_str().unwrap_or_default().as_bytes();
                        if let Err(e) = webrtcsink.handle_sdp(
                            client_id,
                            &WebRTCSessionDescription::new(
                                WebRTCSDPType::Answer,
                                SDPMessage::parse_buffer(sdp).unwrap_or_default())
                        ) {
                            eprintln!("Bad Router Message: couldn't handle sdp answer, {}", e)
                        }
                    },
                    Some("ice-candidate") => {
                        if let Err(e) = webrtcsink.handle_ice(
                            client_id,
                            Some(data["sdpMLineIndex"].as_u64().unwrap_or_default()
                                 .try_into().unwrap_or_default()),
                            Some(data["sdpMid"].as_str().unwrap_or_default().to_string()),
                            &data["candidate"].as_str().unwrap_or_default().to_string()
                        ) {
                            eprintln!("Bad Router Message: couldn't handle ice candidate, {}", e)
                        }
                    },
                    v => eprintln!("Bad Router Message: type '{}' not supported", v.unwrap())
                }
            };

            // Forever handle all the recieved messages, reconnecting as needed
            loop {
                {
                    // Unpack the thread safe receiver not without the full state lock
                    let receiver_handle = Arc::clone(&thread_state.lock().unwrap().receiver);
                    let mut receiver = receiver_handle.lock().unwrap();
                    // Handle each recieved message from the router
                    while let Some(msg) = block_on(receiver.as_mut().unwrap().next()) {
                        match msg {
                            Ok(msg) => handle_message(msg),
                            _ => break
                        };
                    }
                }
                // Try to reconnect to the router
                sleep(time::Duration::from_millis(1000));
                eprintln!("Attempting reconnection to router...");
                thread_state.lock().unwrap().connect().unwrap_or_default();
            }
        });

        // Inform the router we are ready to recieve connections
        (self.state.lock().unwrap().sender.as_mut().unwrap())(Message::Text(json!({
            "client-id": "broadcast",
            "type": "host-ready"
        }).to_string()));
    }

    pub fn handle_sdp(&self, _element: &WebRTCSink, peer_id: &str, sdp: &WebRTCSessionDescription) {
        (self.state.lock().unwrap().sender.as_mut().unwrap())(Message::Text(json!({
            "client-id": peer_id.to_string(),
            "type": "offer",
            "payload": {
                "type": "offer",
                "sdp": sdp.sdp().as_text().unwrap()
            }
        }).to_string()));
    }

    pub fn handle_ice(&self, _element: &WebRTCSink, peer_id: &str, candidate: &str,
                      sdp_mline_index: Option<u32>, sdp_mid: Option<String>) {
        (self.state.lock().unwrap().sender.as_mut().unwrap())(Message::Text(json!({
            "client-id": peer_id.to_string(),
            "type": "ice-candidate",
            "payload": {
                "candidate": candidate.to_string(),
                "sdpMid": sdp_mid.unwrap_or_default().to_string(),
                "sdpMLineIndex": sdp_mline_index.unwrap_or_default()
            }
        }).to_string()));
    }

    pub fn stop(&self, _element: &WebRTCSink) {
    }

    pub fn consumer_removed(&self, _element: &WebRTCSink, _peer_id: &str) {
    }
}

#[glib::object_subclass]
impl ObjectSubclass for Signaller {
    const NAME: &'static str = "SimpleRTCSinkSignaller";
    type Type = super::Signaller;
    type ParentType = glib::Object;
}

impl ObjectImpl for Signaller {}
