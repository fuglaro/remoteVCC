// Copied from https://github.com/centricular/webrtcsink-custom-signaller/blob/ed950a4297d872a91f330dc67d0d436140ece59b/src/signaller/mod.rs
// Expanded minimally.
use crate::RVCCError;
use gst::glib;
use gst::subclass::prelude::ObjectSubclassExt;
use gst_webrtc::WebRTCSessionDescription;
use std::error::Error;
use webrtcsink::webrtcsink::{Signallable, WebRTCSink};

mod imp;

glib::wrapper! {
    pub struct Signaller(ObjectSubclass<imp::Signaller>);
}

unsafe impl Send for Signaller {}
unsafe impl Sync for Signaller {}

impl Signallable for Signaller {
    fn start(&mut self, element: &WebRTCSink) -> Result<(), Box<dyn Error>> {
        imp::Signaller::from_instance(self).start(element);
        Ok(())
    }

    fn handle_sdp(&mut self, element: &WebRTCSink, peer_id: &str, sdp: &WebRTCSessionDescription)
    -> Result<(), Box<dyn Error>> {
        imp::Signaller::from_instance(self).handle_sdp(element, peer_id, sdp);
        Ok(())
    }

    fn handle_ice(&mut self, element: &WebRTCSink, peer_id: &str, candidate: &str,
                  sdp_mline_index: Option<u32>, sdp_mid: Option<String>)
    -> Result<(), Box<dyn Error>> {
        imp::Signaller::from_instance(self).handle_ice(
            element, peer_id, candidate, sdp_mline_index, sdp_mid);
        Ok(())
    }

    fn stop(&mut self, element: &WebRTCSink) {
        imp::Signaller::from_instance(self).stop(element);
    }

    fn consumer_removed(&mut self, element: &WebRTCSink, peer_id: &str) {
        imp::Signaller::from_instance(self).consumer_removed(element, peer_id);
    }
}

impl Signaller {
    pub fn new() -> Self {
        glib::Object::new(&[]).unwrap()
    }

    pub fn connect(&self, url: &str) -> Result<(), RVCCError> {
        imp::Signaller::from_instance(self).connect(url)
    }
}
