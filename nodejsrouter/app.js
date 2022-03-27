#!/usr/bin/node

const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const abort = (msg) => {console.log(msg); process.exit(-1)};

// Configurable parameters.
var PORT = process.env.VIA_PORT || '43775';
var TLS_PFX_FILE = process.env.TLS_PFX;
// Update from command line arguments.
process.argv.slice(2).forEach((arg) => {
  if (arg.startsWith('--tls-pfx=')) TLS_PFX_FILE = arg.slice(10);
  else if (arg.startsWith('--via-port=')) PORT = arg.slice(11);
  else abort(
`Negotiate connectivity between clients and hosts establishing the streams
even when the Client can't directly access the Host.

Example:
    remoteVCCrouter --tls-pfx=rVCC.pfx

--via-port=[port number] (default:43755): Listens for client and host
    connections through this port.

--tls-pfx=[tls cert/key file]: (required) Uses this
    certificate when establishing encrypted communication. The certificate
    should be registered with a certificate authority or with the client.

Equivalent environment variables can alternatively be specified:
  VIA_PORT
  TLS_PFX
`);
});

// Check TLS credential configuraion
if (!TLS_PFX_FILE) abort(
`Requires a TLS certificate (e.g: --tls-pfx=.rVCC.pfx).
Remember to register the certificate with an authority,
or with the client itself (e.g: .rVCCcert.pem).
You can obtain a self-signed TLS certificate with openssl, e.g:
  openssl req -x509 -newkey rsa:2048 -keyout .rVCCkey.pem -out .rVCCcert.pem -nodes -subj /CN=rVCC -addext subjectAltName=DNS:localhost,DNS:$(hostname),IP:127.0.0.1; openssl pkcs12 -export -in .rVCCcert.pem -inkey .rVCCkey.pem -out .rVCC.pfx -passout pass:
`);
var tlspfx = fs.readFileSync(path.resolve(TLS_PFX_FILE));

// Set the current working directory relative to this app.
process.chdir(__dirname);


/**
 * Webpage service
 */
var app = express();
// Serve the client app and web host.
app.get('/', (req, res) => {res.sendFile(
  path.join(__dirname, '..', 'webclient', 'client.html'))});
app.use(express.static(path.join('..', 'webclient')));
app.use(express.static(path.join('..', 'webhost')));



// TODO fix this for privacy, and etter configurations
const ICE_SERVERS = 'stun:stun.example.org';
// TODO move to host response to first payload response or something
// Give the client the config.
app.get('/api/config', (req, res) => {
  res.send(JSON.stringify({
    rtc: { iceServers: [{urls: ICE_SERVERS}] }
  }));
});


/**
 * Routing and WebSocket management.
 */
const wss = new WebSocket.Server({ noServer: true });
var connectionCount = 0;
var hosts = {};
var clients = {};
wss.on('connection', (ws, req) => {
  var host = req.query.host

  // Establish connection for the host.
  if (req.url.startsWith("/host")) {
    hosts[host] = ws;
    ws.on('close', (event) => {delete hosts[host]});
    ws.on('message', (message) => {
      // Unwrap the message and send to the appropriate clients.
      try { var data = JSON.parse(message); }
      catch (e) /*ignore invalid json*/ { return }
      if (!clients[host]) return;
      if (data['client-id'] == 'broadcast')
        Object.values(clients[host]).forEach(
          (client) => {client.send(JSON.stringify(data))});
      else if (data['client-id'] in clients[host])
        clients[host][data['client-id']].send(JSON.stringify(data));
    });
  }

  // Establish connection for a client.
  else if (req.url.startsWith("/client")) {
    if (!clients[host]) clients[host] = {};
    var connectionNumber = host + '.' + connectionCount++;
    clients[host][connectionNumber] = ws;
    ws.on('close', (event) => {delete clients[host][connectionNumber]});
    ws.on('message', (message) => {
      if (hosts[host]) {
        // Lace the message so the host knows which client
        // to respond back to.
        try { var data = JSON.parse(message); }
        catch (e) /*ignore invalid json*/ { return }
        data['client-id'] = `${connectionNumber}`;
        hosts[host].send(JSON.stringify(data));
      }
    });
  }
});

// Connect websockets up
app.get(['/client', '/host'], (req, res) => {
  if (req.headers.upgrade == 'websocket')
    wss.handleUpgrade(req, req.socket, '', socket => {
      wss.emit('connection', socket, req)});
});


/**
 * Serve.
 */
// Use provided TLS credentials.
console.log(`Serving on port: ${PORT}`);
https.createServer({pfx: tlspfx}, app).listen(PORT);

