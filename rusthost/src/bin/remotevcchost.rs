
use clap::{Arg, Command};
use gst::ElementFactory;
use gst::prelude::*;
use remotevcchost::router_signaller::Signaller as RouterSignaller;
use remotevcchost::RVCCError;
use webrtcsink::webrtcsink::WebRTCSink;

// TODO properly doc all
// TODO add gstreamer plugins version checking.


fn main() -> Result<(), RVCCError> {
    // Command line arguments and help
    let matches = Command::new("remotevcchost")
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

    gst::init().map_err(RVCCError::GST)?;

    // Mode: via router
    // TODO handle router config of ice servers
    let url = match matches.value_of("router_url") {
        None => panic!("Only router connections are currently supported."),
        Some(url) => url
    };



    // TODO - switch to wss regardless
    // TODO - add random hostID if not included

    let signaller = RouterSignaller::new();
    signaller.connect(url)?;
    let webrtcsink = WebRTCSink::with_signaller(Box::new(signaller));


    // Ready the gstreamer pipeline for handling media and input
    let source = ElementFactory::make("videotestsrc", None)
        .map_err(|_| RVCCError::Fail(format!("Install gstreamer plugin: videotestsrc")))?;
    // TODO do-retransmission = false???
    let webrtc = webrtcsink.upcast_ref();
    // TODO hardware encoder help clues here: https://github.com/centricular/webrtcsink/blob/main/plugins/examples/webrtcsink-stats-server.rs
    let pipe = gst::Pipeline::new(None);
    pipe.add_many(&[&source, webrtc]).unwrap();
    gst::Element::link_many(&[&source, webrtc]).unwrap();
    let bus = pipe.bus().unwrap();





    pipe.set_state(gst::State::Playing).map_err(RVCCError::GSTState)?;

// TODO tide erc
    for msg in bus.iter_timed(gst::ClockTime::NONE) {
        use gst::MessageView;

        match msg.view() {
            MessageView::Eos(..) => break,
            MessageView::Error(err) => {
                println!(
                    "Error from {:?}: {} ({:?})",
                    err.src().map(|s| s.path_string()),
                    err.error(),
                    err.debug()
                );
                break;
            }
            _ => (),
        }
    }


    Ok(())
}
