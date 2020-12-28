# REMOVID

Remote desktop solution - building on WebRTC, modern media codecs, hardware encoders, and gstreamer for an open source, fast and secure interface to remote workstations. A simple reuse of already advancing technologies.

## Advantages
* WebRTC is designed from the ground up as a low latency peer-to-peer media streaming system with security, open standards and compatibility with a wide range of codecs. WebRTC implementations and its associated codecs will continue to improve for needs that overlap with this project. Video conferencing shares some of the main challenges with remote desktop access including screen sharing. WebRTC and its associated codecs have major backers heavily motivated to improve it under open standards and hinging upon that progress gives this project a good chance of outpacing solutions such as VNC, RDP, and proprietary solutions.
* WebRTC is designed to allow for secure communication of sensitive content over the open internet using well established encryption technology. This is a major advantage for this project as it allows for the potential for remote access across untrusted networks. There are also likely to be solutions to securely tunneling through strict firewalls, such as with corporate networks.

## Challenges
* Security is hard. Although WebRTC provides proven secure channels once peer-to-peer connections have been established between the client and the server, secure establishment of the client and server connections still needs to be implemented. While security across a range of personal and corporate scenarios is one of the aims of this project, until this project has enough backing that it is regularly reviewed and audited by security experts, it should not, in any way, be trusted as secure.
* Codecs may currently be optimised for media compression rather than tuned to take advantage of typical desktop video. While media playback is important, are there video codecs that can take advantage of patterns like static regions, text areas, or vertically scrolling regions? Does common hardware include these encoders?
  * Send 2 video streams, one for compressed fast, and one for slow high quality. Then in another data channel send regions that change so as to build a pixel mask for which stream to display for each pixel.
* Hardware encoder support is limitted. Which devices need specific implementations? Are there implications to reserving the device from other applications? Which codecs are supported? Can this be simplified into a simple gstreamer plugin that can be combined with framebuffer capture on the same device without overheads of memory copies? Which devices support this? Does a fallback to software allow for low enough latency and resource consumption?
* Do WebRTC implementations allow for latencies low enough for user interaction? Video conferencing requires sub-second latency but smooth user interaction may have higher demands.