# REMOVID

Remote desktop solution - building on WebRTC, modern media codecs, hardware encoders, and gstreamer for an open source, fast and secure interface to remote workstations. A simple reuse of already advancing technologies. It is unlikely that this can compete with video-game streaming solutions for quite a while but it should still be considered a goal.


## Modes
** TODO ** Document and implement.
### WebMode
* TLS only **TODO**
* OAuth

## Protocols

* [Signaling protocol](docs/routerMessages.md)

## Communication Security

**TODO**
Note this is still in development and would then need full regression tests and a security audit before it could be considered secure in any way.

### Direct Mode

This connection mode relies on the ablity of the client and the server to securely echange a shared key separately to this protocol. This avoids the need for registering digital certificates for TLS or having an OAuth2 service.

Please note that, while this connection mode is intended for use within a trusted network that is behind a firewall, we should still strive to make this connection mode as secure as possible. The Web Mode is recommended for situations that require security.

Communication is established as follows:
* Stetch the connection key or password (which must have already been securely shared with the router) using PBKDF2 creating a secret key for encryption via AES-GCM-256. The number of PBKDF2 iterations (default 100000) and the salt (32 bits) is retrieved from the router in plaintext. The router similarly generates a matching secret key and securely holds onto this instead of the connection key or password.
* Retrieve the Next Valid Authentication Key (96 bits) from the router in plaintext. This is reset by the server on each valid authentication so as to avoid replay attacks that could establish WebSocket connections and force the router to consume memory.
* Create an authentication token by encrypting the Next Valid Authentication Key via AES-GCM-256, using the secret key and a random initialisation vector(96 bits), and concatenating the result with the initialisation vector in plaintext.
* Authenticate WebSocket connection establishment (before the connection upgrade) by sending the authentication token in the WebSocket request URL.
* All communication in either direction over the established WebSocket connection is encrypted via AES-GCM-256 using the secret key and an initialisation vector that is randomly recreated for each message. Each initialisation vector is sent in plaintext along with the encrypted message. This WebSocket connection is used to establish a single WebRTC connection.
* All further communication occurs over WebRTC connections and it's inbuilt security.

### Web Mode

This connection mode relies on registering digital certificates for TLS to the router and an OAuth2 service.

Communication is established as follows:
* Connect to the router via HTTPS and WSS.
* Authenticate WebSocket connection establishment (before the connection upgrade) via OAuth2 by sending tokens in the WSS request URL.
* Communicate with the router over WSS to establish a single WebRTC connection.
* All further communication occurs over WebRTC connections and it's inbuilt security.

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