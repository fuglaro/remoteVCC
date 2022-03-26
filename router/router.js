const https = require('https');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');

// Configurable parameters.
const PORT = process.env.PORT || "43775";
const ICE_SERVERS = process.env.ICE_SERVERS || 'stun:stun.example.org'; // TODO fix this for privacy
const TLS_PFX_FILE = process.env.TLS_PFX;


/**
 * Webpage service
 */
var app = express();
// Serve the client app.
app.get('/', (req, res) => {
  res.sendFile('public/client.html', { root: __dirname })});
app.use(express.static('public'));



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
      if (data['client-id'] == 'broadcast') {
        /* We don't need to tell the client who they are. */
        delete data['client-id'];
        Object.values(clients[host]).forEach(
          (client) => {client.send(JSON.stringify(data))});
      }
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
 * Try to serve.
 */
if (!TLS_PFX_FILE) {
  console.log(`
Please obtain a TLS certificate, e.g:
  openssl req -x509 -newkey rsa:2048 -keyout .rVCCkey.pem -out .rVCCcert.pem -nodes -subj /CN=rVCC -addext subjectAltName=DNS:localhost,DNS:$(hostname),IP:127.0.0.1; openssl pkcs12 -export -in .rVCCcert.pem -inkey .rVCCkey.pem -out .rVCC.pfx -passout pass:

Provide in the environment:
  TLS_PFX=.rVCC.pfx

Register the certificate with the client or authority:
  .rVCCcert.pem
  `);
} else {
  // Use provided TLS credentials.
  var tlspfx = fs.readFileSync(TLS_PFX_FILE);
  console.log(`Serving on port: ${PORT}`);
  https.createServer({pfx: tlspfx}, app).listen(PORT);
}

