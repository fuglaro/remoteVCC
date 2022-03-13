# RemoteVCC

Remote Virtually Connected Computing - A simple, secure, featureful, and fast remote desktop solution which leverages WebRTC, modern media codecs, hardware encoders, and gstreamer. A simple repurposing of already advancing technologies.

[![Demo Video](removid_demo_20210107.gif)

*Note that, while security is a top priority for this project, it is still in development and would then need full regression tests and a security audit before it could be considered secure in any way. Also note the need for a security audit of the whole dependency chain.*

## Features

As this is in active development, some features are incomplete. Please see the status tables below for further details.

* **Encryption**:
  * Encryption for all connection establishment and authentication communication between the Client, Router (if used), and Host; utilising TLS with HTTPS and WSS.
  * End-to-end encryption for all data streaming including display and input between Client and Host (DTLS-SRTP with WebRTC). Note that the Router (if used) needs to be trusted for the initiating key exchange.
  * Enforced Digital Certificate based authentication of the Host or Router.

* **Host Login Sxpport**: Optionally allow new login sessions with the host's user login credentials, which must be provided by the client. If the host supports multiple active virtual sessions, these can be requested by the client. Connections to active sessions from different users are denied. Must be run as admin.

* **Access Keys**:
  * A persistent access key is created and must be provided by the client connection to have access granted. This can be provided in the connection URL itself but this may not be secure if connecting from a browser on a public access computer.
  * Users can create alternate access keys with custom restrictions, for use in place of primary access keys. These are tied to specific login users, and are checked against the active login, so also negate the need for providing login credentials. Note that login credentials may still be needed after connection, if there is a session screen lock. Custom restrictions include granting view-only access, limiting to specific input types, and granting time-limited or one-time access. These are revokable, and can be used to allow a user to share their active session, or to create an access URL specific to their login credentials.

* **Network Traversal Options**:
  * **Via a Host Port**: The Host will listen for client connections on the local network on a specified port. This allows connectivity across a local netowrk or through port forwarding.
  * **Via a Router on the Web**: Utilises a Router service running on the internet, accessible to both the Host and Client to allow the Client to connect to the Host over the internet, even if the Host behind a typical firewall. This allows connectivity over the internet without port forwarding. This behaves similar to screen sharing on typical video conferencing solutions but with the additional features of RemoteVCC. The Host will make a persistent, unique and unguessable host identifier, which is registered with the Router, for clients to connect via.

* **Simple Command-Line Tools**:
  * remoteVCChost:
```
Serve a host for clients to connect to.

Example for connecting on a local network:
    remoteVCChost --through-port=43755 --tls-certificate=.local/share/remoteVCC/cert.pem

Example for connecting over the internet:
    remoteVCChost --through-router=https://remotevcc.convex.cc:43755

--with-login: Allow login sessions on the Host. Must be run as admin. 

--via-router=[router url]: Makes a persistent, unique and unguessable host identifier, which is registered with the remoteVCC router, and also printed as a client connection URL for clients to connect via. In some scenarios the router address may be different for the client. Note that the router service needs to be trusted.

--via-port=[port number]: Listens for client connections on the local network through this port. This changes the local network client connection URL that is printed.

--tls-certificate=[certificate file]: (required with --through-port) Use a specific certificate file to establish encrypted communication. This certificate should be registered with a certificate authority or with the client itself.

```
  * remoteVCCrouter:
```
Negotiate connectivity between clients and hosts establishing the streams even when the Client can't directly access the Host. 

Example:
    remoteVCCrouter --tls-certificate=.local/share/remoteVCC/cert.pem

--through-port=[port number] (default:43755): Listens for client connections through this port.

--tls-certificate=[certificate file]: (required) Use a specific certificate file to establish encrypted communication. This certificate should be registered with a certificate authority or with the client itself.
```
  * remoteVCCkeys:
```
Manage customisable user access keys.

TODO TBC
```

### Current Feature Statuses

| | Through<br>Router | Through<br>Port |
|---|---|---|
|**Encrypted<br>Communication**        | ✔ | ✔ |
|**End-to-End<br>Encrypted<br>Streams**| ✔ | ✔ |
|**Full End-to-End<br>Encryption**     | ✘ | ✔ |

#### Host Features

| | Test | Lin | Win | OSX | Pi |
|---|---|---|---|---|---|
|**Video**                | ✔ |   |   |   |   |
|**Keyboard**             | ✔ |   |   |   |   |
|**Mouse**                | ✔ |   |   |   |   |
|**Gamepads**             |   |   |   |   |   |
|**Clipboard**            |   |   |   |   |   |
|**Microphone<br>Input**  |   |   |   |   |   |
|**Camera<br>Input**      |   |   |   |   |   |
|**Wacom**                |   |   |   |   |   |
|**With<br>Login**        | ✘ |   |   |   |   |
|**Virtual<br>Sessions**  | ✘ |   |   |   |   |
|**Shared<br>Access**     | ✔ |   |   |   |   |
|**Through<br>Port**      | ✘ |   |   |   |   |
|**Through<br>Router**    | ✔ |   |   |   |   |

#### Host Security Features

| | Test | Lin | Win | OSX | Pi |
|---|---|---|---|---|---|
|**View Only<br>Access**   |   |   |   |   |   |
|**Input<br>Restrictions** |   |   |   |   |   |
|**One-Time<br>Access**    |   |   |   |   |   |
|**Time-Limited<br>Access**|   |   |   |   |   |
|**Clipboard<br>Limits**   |   |   |   |   |   |
|**Watermarking**          |   |   |   |   |   |

#### Client Features

| | Web | Lin | Win | OSX | Pi |
|---|---|---|---|---|---|
|**Video**              | ✔ |   |   |   |   |
|**Keyboard**           | ✔ |   |   |   |   |
|**Mouse**              | ✔ |   |   |   |   |
|**Gamepads**           |   |   |   |   |   |
|**Copy Buffer**        |   |   |   |   |   |
|**Microphone<br>Input**|   |   |   |   |   |
|**Camera<br>Input**    |   |   |   |   |   |
|**Wacom**              |   |   |   |   |   |


## Communication Security

Communication between the client and Host is first established through the Router service. This relies on a WSS connection for establishing a direct peer-to-peer communication channel between the Client and the Host and therefore has a need for a digital certificate, which must be provided by either the Host, or the Router (if used). When a Router is used, it is recommended that this digital certificate is registed with a certificate authority, but direct connections to Hosts can use your own self-signed certificate, which can be registered with the Client.




Communication is established as follows:
* The router is set up with a TLS digital certificate registered either with a certificate authority, or self signed.
* Connections to the router are made via HTTPS and WSS. Connections without TLS are denied by the router.


* An access key (JSON Web Token created with HMAC-SHA512 using a 2048 bit random key) is obtained. Web Mode requires an OAuth2 service for authentication, before returning an access key, while Direct Mode outputs to the console a permanent JWT for manual collection at launch.


-- TODO is JWT enough? What about logging in from the client? With Direct Mode to a machine that still needs login.

* New WSS WebSocket connections to the router are authenticated when they are establised (before the connection upgrade) by sending the JSON Web Token as the access_token.
* This WSS connection is then used to establish a single WebRTC connection between Host and Client.
* All further communication occurs over WebRTC connections and it's inbuilt security.

## Protocols

* [Signaling protocol](docs/protocols.md#router-messaging-and-signalling-protocol)
* [Input event protocol](docs/protocols.md##input-device-events-protocol)

## Goals

### Strategic Design Principles

This project aims to find an opportunity for repurposing existing technology to improve open source solutions to remote desktop access. It currently adheres to the following strategies:
* Complexity must justify itself - this project needs to be simple and lightweight. Whereever there is a need for large or complex code, it must find and repurpose other solutions that have their own momentum. This includes modules, data formats and communication protocols.
* Push upstream - where existing components do not fully meet requirements, contribute to them to enhance them. The assumption of this project is that solutions in other key opensource technologies will eventually outcompete the competition; it might be worth helping out with that.
* Don't attempt custom security - security is hard. Harder than it can seem. Where hard means expensive and where nothing is truly secure unless it is externally audited. For this reason, security critical components of this system should utilise other solutions that are secure and the customisations of them should be as small and as simple as possible.
* Keep a tight stack - Use as small and as trustworthy a dependency chain as possible. This may seem counter intuitive with this project hinging upon external solutions but it still shouldn't end up being a tower of dependencies. Every additional dependency is a security vulnerability, and a mess of dependencies is as much of a complexity problem as a code tangle.
* Open source is good - if it's good.

### Advantages
* WebRTC is designed from the ground up as a low latency peer-to-peer media streaming system with security, open standards, and compatibility with a wide range of codecs. WebRTC implementations and its associated codecs will continue to improve for needs that overlap with this project. Video conferencing shares some of the main challenges with remote desktop access including screen sharing. WebRTC and its associated codecs have major backers heavily motivated to improve it under open standards and leveraging that progress gives this project a good chance of outpacing solutions such as VNC, RDP, and proprietary solutions.
* WebRTC is designed to allow for secure communication of sensitive content over the open internet using well established encryption technology. This is a major advantage for this project as it allows for the potential for remote access across untrusted networks. There are also established solutions to securely tunneling through strict firewalls, such as with corporate networks.

### Challenges
* Security is hard. Although WebRTC provides proven secure channels once peer-to-peer connections have been established between the client and the host, secure establishment of the client and host connections still needs to be implemented. While security across a range of personal and corporate scenarios is one of the aims of this project, until this project has enough backing that it is regularly reviewed and audited by security experts, it should not, in any way, be trusted as secure.
  * This project should, wherever reasonable, piggyback on other solutions that have the backing to ensure security, using systems like HTTPS, WSS, and the like in the most simple ways possible.
  * Since this will establish WebRTC connections to an application that can control your machine remotely, this type of application is about as dangerous as it can get. Can this ever be safe enough? VPNs can help avoid the risks but secrurity should always be carefully considered.
* Codecs may currently be optimised for media compression rather than tuned to take advantage of typical desktop video. While media playback is important, are there video codecs that can take advantage of patterns like static regions, text areas, or vertically scrolling regions? Does common hardware include these encoders? Systems like VNC and RDP deeply inspect graphics contexts for optimisations rather than just streaming final images. This will need to outpace that without those complexities.
* Hardware encoder support is limitted. Which devices need specific implementations? Are there implications to reserving the device from other applications? Which codecs are supported? Can this be simplified into a simple gstreamer plugin that can be combined with framebuffer capture on the same device without overheads of memory copies? Which devices support this? Does a fallback to software allow for low enough latency and resource consumption?
* Do WebRTC implementations allow for latencies low enough for user interaction? Video conferencing requires sub-second latency but smooth user interaction may have higher demands.
* Small is better. If this is to out compete then it needs to be low overhead. The host needs to run with as little overhead as possible, particularly in regards to memory. Ideally the client can run effectively on something super cheap like the Raspberry Pi Zero but that may be an alternative client rather than the Browser client.


## Dependencies
TODO review
### Included
https://github.com/zserge/jsmn
### Linked
TODO

## TODO
1. include stun service with the router for local connections
1. Think about third party stun services and GDPR
1. Sharing of one window only, but also restricting input events to that window only. Probably want a separate command to remoteVCChost
1. Think about a configurable payload for the Host and Client to send to the Router for alternate Router implementations that have different authentication mechaisms.


