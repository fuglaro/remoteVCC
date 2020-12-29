# REMOVID

Remote desktop solution - building on WebRTC, modern media codecs, hardware encoders, and gstreamer for an open source, fast and secure interface to remote workstations. A simple reuse of already advancing technologies. It is unlikely that this can compete with video-game streaming solutions for quite a while but it should still be considered a goal.

## References

* [Signaling service protocol](docs/routerMessages.md)

## Goals

### Fundamental Ideals and Goals

This project aims to find an opportunity for repurposing existing technology to solve remote desktop access. This doesn't aim to provide a solution at all costs. This will never have enough of its own backing to solve challenges with realtime access and security so it must be disciplined in it's approach.
* Complexity must justify itself - this project needs to be simple and lightweight. Whereever there is a need for large or complex code, it must find and repurpose other solutions that have their own momentum. This includes modules, data formats and communication protocols.
* Push upstream - where existing solutions do not have full support of requirements, contribute to them to enhance them. The assumption of this project is that solutions in other key opensource technologies will eventually outcompete the competition; it might be worth helping out with that.
* Don't attempt custom security - security is hard. Harder than you think. Where hard equals costly and where nothing is truly secure unless it is externally audited. For this reason, security critical components of this system should hinge upon other solutions that are secure and the customisations of them should be as small and as simple as possible.
* Keep a tight stack - Use as small and as trustworthy a software stack as possible. This may seem counter intuitive with this project hinging upon external solutions but it still shouldn't end up being a tower of dependencies. Every additional dependency is a security vulnerability, and a mess of dependencies is as much of a complexity problem as spaghetti code.
* Open source is good - obviously.

### Advantages
* WebRTC is designed from the ground up as a low latency peer-to-peer media streaming system with security, open standards and compatibility with a wide range of codecs. WebRTC implementations and its associated codecs will continue to improve for needs that overlap with this project. Video conferencing shares some of the main challenges with remote desktop access including screen sharing. WebRTC and its associated codecs have major backers heavily motivated to improve it under open standards and hinging upon that progress gives this project a good chance of outpacing solutions such as VNC, RDP, and proprietary solutions.
* WebRTC is designed to allow for secure communication of sensitive content over the open internet using well established encryption technology. This is a major advantage for this project as it allows for the potential for remote access across untrusted networks. There are also established solutions to securely tunneling through strict firewalls, such as with corporate networks.

### Challenges
* Security is hard. Although WebRTC provides proven secure channels once peer-to-peer connections have been established between the client and the server, secure establishment of the client and server connections still needs to be implemented. While security across a range of personal and corporate scenarios is one of the aims of this project, until this project has enough backing that it is regularly reviewed and audited by security experts, it should not, in any way, be trusted as secure.
  * This project should, whereever reasonable, piggyback on other solutions that have the backing to ensure security. An example of this could be to use an existing chat messaging system with security inbuilt for the WebRTC signalling service component. This needs to be balanced with avoiding unneccessary complexity.
* Codecs may currently be optimised for media compression rather than tuned to take advantage of typical desktop video. While media playback is important, are there video codecs that can take advantage of patterns like static regions, text areas, or vertically scrolling regions? Does common hardware include these encoders?
  * Possibly send two video streams, one for compressed fast, and one for slow high quality. Then in another data channel send regions that change so as to build a pixel mask for which stream to display for each pixel. That said, it is likely that there are exisiting video encoders that do a suitable job of taking advantage of simplification patters with typical desktop access. Anything custom here will probably be of a complexity such that it should be found or pushed into other projects.
* Hardware encoder support is limitted. Which devices need specific implementations? Are there implications to reserving the device from other applications? Which codecs are supported? Can this be simplified into a simple gstreamer plugin that can be combined with framebuffer capture on the same device without overheads of memory copies? Which devices support this? Does a fallback to software allow for low enough latency and resource consumption?
* Do WebRTC implementations allow for latencies low enough for user interaction? Video conferencing requires sub-second latency but smooth user interaction may have higher demands.