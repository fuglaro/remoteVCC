// Copied from https://github.com/centricular/webrtcsink-custom-signaller/blob/8b42b45c2b73277e300bbae14f5a94cee229c1f4/src/signaller/imp.rs
// Modified for implementation for RemoteVCC
//! Manages connection establishement messages between a RemoteVCC router and a webrtcsink.
//!
//! This progives a Signaller which manages the WebSocket connections and communication between
//! a RemoteVCC router and a webrtcsink gstreamer node within a gsreamer pipeline. It is designed
//! to be extended as a g_object and managed by gstreamer across threads and is therefore built to
//! be thread safe when given Send and Sync traits.
//!
//! This will also spawn its own thread to hold open a WebSocket connection to the RemoteVCC
//! router to listen for proxied client connection messgages.
//!
//! It is the webrtcsink gstreamer node itself that creates and connectes the WebRTC
//! connections with the clients after sufficient connection establishment messages bave been
//! funneled through the Signaller. The messaging required is typical of WebRTC connection
//! establishment messaging and follows the RemoteVCC router messaging protocol.
//!
//! If the WebSocket connection to the RemoteVCC router is lost, this will wait a short
//! moment before attempting a reconnection, while maintaining any already established WebRTC
//! based Peer-to-Peer connections with a client. Connections that were still in the process
//! of being connected could resume connection, but are unlikely to if the RemoteVCC router
//! was restarted, and could end up being a small memory leak.

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
use simple_mdns::OneShotMdnsResolver;
use std::{thread::sleep, time};
use std::sync::{Arc, Mutex};
use webrtcsink::webrtcsink::WebRTCSink;
use url::Url;

/// The state of the Signaller including the connection to the RemoteVCC router,
/// but not including the state within the webrtcsink gstreamer node itself.
/// This is intended to be managed within a mutex inside the Signaller, making the overal
/// state of the Signaller thread safe.
/// This also includes the functionality for connecting to the RemoteVCC router.
#[derive(Default)]
struct State {
    /// Holds the receiver listening for messages from the RemoteVCC router WebSocket connection.
    /// This is contained within it's own mutex so that a thread lock can be held specifically on
    /// this alone, rather than the entire state. This is needed when there is an async wait held
    /// on listening for further messages, which is long running and would cause a deadlock
    /// if the thread lock is held on the entire state.
    receiver: Arc<Mutex<Option<Box<dyn Stream<Item=Result<Message, WSError>> + Send + Unpin>>>>,

    /// Sender for websocket messages
    sender: Option<Box<dyn FnMut(Message) -> () + Send>>,
 
    /// The URL of the router service to connect through. This must be set before calling connect.
    url: String
}
impl State {
    /// Connect, or reconnect, to the RemoteVCC router specified by the url in the State.
    /// The url must be specified on the State before this method is called.
    /// This will populate the receiver and the sender of the State for subsequent use.
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

/// Manages connection establishement messages between a RemoteVCC router and a webrtcsink.
#[derive(Default)]
pub struct Signaller {
    state: Arc<Mutex<State>>
}
impl Signaller {
    /// Connect to the RemoteVCC Router with the given url.
    pub fn connect(&self, url: &str) -> Result<(), RVCCError> {
        let mut state = self.state.lock().unwrap();
        state.url = url.to_string();
        state.connect()
    }

    /// Get ready to receive client connection establishment messages.
    ///
    /// Called by the gstreamer pipeline when the webrtcsink node is ready for client connections.
    /// This will first launch a thread to listen for messages from the router, to pass the
    /// relevant details to the webrtcsink node. These messages include WebRTC ice-candidates and
    /// sdp answer messages.
    /// Once the listener thread is launched, this will then send a message to the router to
    /// inform all waiting clients that this host is ready for connections.
    pub fn start(&self, element: &WebRTCSink) {
        // Launch a thread to handle received router messages
        let thread_state = Arc::clone(&self.state);
        let webrtcsink = element.downgrade();
        spawn(async move {
            let webrtcsink = webrtcsink.upgrade().unwrap();

            // Router message handler
            let handle_message = |msg: Message| {
                // Only handle text based messages
                if !msg.is_text() { return }

                // Handle different message types
                let data: Value = from_str(&msg.into_text().unwrap()).unwrap_or_default();
                let client_id = data["client-id"].as_str().unwrap_or_default();
                if client_id == "" { return }
                match data["type"].as_str() {
                    // A client wants to start a connection. This will validate access keys (TODO)
                    // as neccessary before beginning the client connection establishment process.
                    Some("request") => {
                        // TODO - figure out something sensible with access key
                        // TODO - figure out something sensible with access key
                        // TODO - figure out something sensible with access key
                        // TODO - figure out something sensible with access key
                        // TODO - figure out something sensible with access key
                        // TODO - figure out something sensible with access key
                        eprintln!("Client connecting: {client_id}");
                        if let Err(e) = webrtcsink.add_consumer(client_id) {
                            eprintln!("Bad Router Message: couldn't register {}", e)
                        }
                    },
                    // SDP details provided in response to the SDP details we previously
                    // offered.
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
                    // ICE candidate details provided by the client to help establish a
                    // peer-to-peer connection.
                    Some("ice-candidate") => {
                        let handle_ice = |candidate: &str|
                            if let Err(e) = webrtcsink.handle_ice(
                                client_id,
                                Some(data["payload"]["sdpMLineIndex"].as_u64().unwrap_or_default()
                                    .try_into().unwrap_or_default()),
                                None,
                                candidate
                            ) {
                                eprintln!("Bad Router Message: invalid ice candidate, {}", e)
                            };

                        if let Some(candidate) = data["payload"]["candidate"].as_str() {
                            handle_ice(&candidate.to_string());

                            // The standard ICE handling called above is usually sufficient
                            // to register the ICE candidates properly, including IP addresses,
                            // domain names, and also multicast DNS (mDNS) addresses
                            // (with recent versions of gst-plugins-bad). Note that modern
                            // browsers will all typically advertise mDNS addresses to keep
                            // local IP addresses private. Unfortunately, musl does not support
                            // mDNS, so musl based OSes with glibc facades will not resolve
                            // the mDNS candidates. The following resolves any mDNS addresses
                            // to additionally register the ICE candidates with resolved IPs.
                            let mut tokens: Vec<&str> = candidate.split(" ").collect();
                            if let Some(host) = tokens.get(4) {
                                if host.ends_with(".local") {
                                    let resolver = OneShotMdnsResolver::new().unwrap();
                                    if let Ok(Some(answer)) = resolver.query_service_address(host) {
                                        let host_ip = answer.to_string();
                                        tokens[4] = host_ip.as_str();
                                        handle_ice(&tokens.join(" "));
                                    }
                                }
                            }
                        }
                    },
                    v => eprintln!("Bad Router Message: type '{}' not supported", v.unwrap())
                }
            };

            // Forever handle all the recieved messages, reconnecting as needed
            loop {
                {
                    // Unpack the thread safe receiver without the full state lock
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
                sleep(time::Duration::from_secs(1));
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

    /// Inform the client (via the router) of SDP media format options.
    /// Called by the gstreamer pipeline when the webrtcsink node has SDP options to offer.
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

    /// Inform the client (via the router) of ICE candidates details for establishing a
    /// peer-to-peer connection with the host. Called by the gstreamer pipeline when the
    /// webrtcsink node has another ICE candidate to offer.
    pub fn handle_ice(&self, _element: &WebRTCSink, peer_id: &str, candidate: &str,
                      sdp_mline_index: Option<u32>, _sdp_mid: Option<String>) {
        (self.state.lock().unwrap().sender.as_mut().unwrap())(Message::Text(json!({
            "client-id": peer_id.to_string(),
            "type": "ice-candidate",
            "payload": {
                "candidate": candidate.to_string(),
                "sdpMLineIndex": sdp_mline_index.unwrap_or_default()
            }
        }).to_string()));
    }
}

#[glib::object_subclass]
impl ObjectSubclass for Signaller {
    const NAME: &'static str = "RemoteVCCRouterWebRTCSinkSignaller";
    type Type = super::Signaller;
    type ParentType = glib::Object;
}

impl ObjectImpl for Signaller {}
