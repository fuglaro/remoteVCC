# REMOVID

Remote desktop solution - building on WebRTC, modern media codecs, hardware encoders, and gstreamer for an open source, fast and secure interface to remote workstations. A simple reuse of already advancing technologies. It is unlikely that this can compete with video-game streaming solutions for quite a while but it should still be considered a goal.

1. **todo** have a server with virtual devices to control the remote machine.

## Protocols

* [Signaling protocol](docs/routerMessages.md)

## Communication Security

**Note that this is still in development and would then need full regression tests and a security audit before it could be considered secure in any way. Imagine one person implemented this when at home feeling really unwell. Also note the need for a security audit of the whole dependency chain.**

Communication between the client and server is first established through the router service. This relies on WSS connections and therefore has a need for digital certificates. When the router is running in Web Mode and isn't just using its own host as the server, this should be via a certificate authority. When running Direct Mode, and you have control of both your client and your server, or you are inside a trusted network, you can have the router create your own self-signed certificate (SHA256 signed, 2048 bit RSA cert, valid for a year).

Communication is established as follows:
* In Web Mode, the router is set up with a digital certificate registered with a certificate authority. In Direct Mode, inside a secure environment, the router can alternatively be set up with a self signed certificate.
* Connections to the router are made via HTTPS and WSS. Connections without TLS are denied by the router.
* A JSON Web Token (created with HMAC-SHA512 using a 2048 bit random key) is obtained. Web Mode requires an OAuth2 service for authentication, before returning a short lived JWT, while Direct Mode outputs to the console a permanent JWT for manual collection at launch.
* A new WSS WebSocket connection is authenticated as it is establised (before the connection upgrade) by sending the JSON Web Token as the access_token.
* This WSS connection is used to establish a single WebRTC connection between server and client.
* All further communication occurs over WebRTC connections and it's inbuilt security.

 1. **todo** figure out the best way for host servers to connect to WebMode Routers to serve their data; authentication is still needed here.
 1. **todo** design and implement WebMode.

## Goals

### Fundamental Ideals and Goals

This project aims to find an opportunity for repurposing existing technology to solve remote desktop access. This doesn't aim to provide a solution at all costs. This will never have enough of its own backing to solve challenges with realtime access and security so it must be disciplined in it's approach.
* Complexity must justify itself - this project needs to be simple and lightweight. Whereever there is a need for large or complex code, it must find and repurpose other solutions that have their own momentum. This includes modules, data formats and communication protocols.
* Push upstream - where existing solutions do not have full support of requirements, contribute to them to enhance them. The assumption of this project is that solutions in other key opensource technologies will eventually outcompete the competition; it might be worth helping out with that.
* Don't attempt custom security - security is hard. Harder than you think. Where hard equals costly and where nothing is truly secure unless it is externally audited. For this reason, security critical components of this system should hinge upon other solutions that are secure and the customisations of them should be as small and as simple as possible.
* Keep a tight stack - Use as small and as trustworthy a software stack as possible. This may seem counter intuitive with this project hinging upon external solutions but it still shouldn't end up being a tower of dependencies. Every additional dependency is a security vulnerability, and a mess of dependencies is as much of a complexity problem as spaghetti code.
* Open source is good - obviously.

### Advantages
* WebRTC is designed from the ground up as a low latency peer-to-peer media streaming system with security, open standards, and compatibility with a wide range of codecs. WebRTC implementations and its associated codecs will continue to improve for needs that overlap with this project. Video conferencing shares some of the main challenges with remote desktop access including screen sharing. WebRTC and its associated codecs have major backers heavily motivated to improve it under open standards and hinging upon that progress gives this project a good chance of outpacing solutions such as VNC, RDP, and proprietary solutions.
* WebRTC is designed to allow for secure communication of sensitive content over the open internet using well established encryption technology. This is a major advantage for this project as it allows for the potential for remote access across untrusted networks. There are also established solutions to securely tunneling through strict firewalls, such as with corporate networks.

### Challenges
* Security is hard. Although WebRTC provides proven secure channels once peer-to-peer connections have been established between the client and the server, secure establishment of the client and server connections still needs to be implemented. While security across a range of personal and corporate scenarios is one of the aims of this project, until this project has enough backing that it is regularly reviewed and audited by security experts, it should not, in any way, be trusted as secure.
  * This project should, wherever reasonable, piggyback on other solutions that have the backing to ensure security, using systems like HTTPS, WSS, JWT, OAuth2 and the like in the most simple ways possible.
  * Since this will establish WebRTC connections to an application that can control your machine remotely, this type of application is about as dangerous as it can get. Can this ever be safe enough? VPNs can help avoid the risks but secrurity should always be considered.
* Codecs may currently be optimised for media compression rather than tuned to take advantage of typical desktop video. While media playback is important, are there video codecs that can take advantage of patterns like static regions, text areas, or vertically scrolling regions? Does common hardware include these encoders? Systems like VNC and RDP deeply inspect graphics contexts for optimisations rather than just streaming final images. This will need to outpace that without those complexities.
* Hardware encoder support is limitted. Which devices need specific implementations? Are there implications to reserving the device from other applications? Which codecs are supported? Can this be simplified into a simple gstreamer plugin that can be combined with framebuffer capture on the same device without overheads of memory copies? Which devices support this? Does a fallback to software allow for low enough latency and resource consumption?
* Do WebRTC implementations allow for latencies low enough for user interaction? Video conferencing requires sub-second latency but smooth user interaction may have higher demands.