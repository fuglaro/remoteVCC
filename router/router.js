const https = require('https');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { exit } = require('process');
process.chdir(__dirname); // Paths relative to this file.

/**
 * Configurable parameters.
 */
const PORT = process.env.PORT || "4433";
const ICE_SERVERS = process.env.ICE_SERVERS || 'stun:stun.example.org';
const TLS_KEY_FILE = process.env.TLS_KEY;
const TLS_CERT_FILE = process.env.TLS_CERT;


/**
 * TLS (HTTPS & WSS) Encryption preparation.
 */
var tlsKey;
var tlsCert;
if (TLS_KEY_FILE && TLS_CERT_FILE) {
  // Use provided TLS credentials.
  tlsKey = fs.readFileSync(TLS_KEY_FILE);
  tlsCert = fs.readFileSync(TLS_CERT_FILE);
}
else {
  console.log(`
  Please provide a TLS Certificate and Private Key.
  This can be a self signed certificate.
  Here is an example of creating them on Linux using OpenSSL:

    openssl req -x509 -newkey rsa:2048 -keyout ~/.removid_private.pem\
  -out ~/.removid_cert.pem -nodes -subj '/CN=...removid...'\
  -addext "subjectAltName = DNS:localhost, DNS:\`hostname\`,\
  IP:127.0.0.1, IP:\`hostname -I\`"

  Pass the credentials to removid via the environment:

    TLS_KEY=~/.removid_private.pem
    TLS_CERT=~/.removid_cert.pem

  `);
  exit(-1);
}

/**
 * Authentication preparation.
 */
const secretKey = crypto.randomBytes(256);
console.log(`Please connect using Connection Key: ${
  jwt.sign(JSON.stringify({userid: 'anon'}), secretKey, {algorithm: 'HS512'})
}`);


/**
 * Webpage service
 */
var app = express();
// Serve the client app.
app.get('/', (req, res) => {
  res.sendFile('public/client.html', { root: __dirname });
});
app.use(express.static('public'));
// Give the client the config.
app.get('/api/config', (req, res) => {
  res.send(JSON.stringify({
    rtc: { iceServers: [{urls: ICE_SERVERS}] }
  }));
});


/**
 * Serve the router service.
 */
// Start the router service
const wss = new WebSocket.Server({ noServer: true });
var connectionCount = 0;
var getConnectionNumber = () => { return connectionCount++; };
var host = null;
var clients = {};
wss.on('connection', (ws, request) => {
  var connectionNumber = getConnectionNumber();

  // Establish connection for the host.
  if (request.url.startsWith("/signal/host")) {
    host = ws;
    ws.on('close', (event) => { host = null; });
    ws.on('message', (message) => {
      // Unwrap the message and send to the appropriate clients.
      try { var data = JSON.parse(message); }
      catch (e) /*ignore invalid json*/ { return }
      if (data['client-id'] == 'broadcast') {
        /* We don't need to tell the client who they are. */
        delete data['client-id'];
        Object.values(clients).forEach(
          (client) => { client.send(JSON.stringify(data)); });
      }
      else if (data['client-id'] in clients) {
        var clientID = data['client-id'];
        /* We don't need to tell the client who they are. */
        delete data['client-id'];
        clients[clientID].send(JSON.stringify(data));
      }
    });
  }

  // Establish connection for a client.
  else if (request.url.startsWith("/signal/client")) {
    clients[connectionNumber] = ws;
    ws.on('close', (event) => { delete clients[connectionNumber]; });
    ws.on('message', (message) => {
      if (host) {
        // Lace the message so the host knows which client
        // to respond back to.
        try { var data = JSON.parse(message); }
        catch (e) /*ignore invalid json*/ { return }
        data['client-id'] = `${connectionNumber}`;
        host.send(JSON.stringify(data));
      }
    });
  }

});
// Connect it up for serving
app.get(['/signal/client', '/signal/host'],
  // Authenticate.
  (req, res, next) => {
    try {
      var payload = jwt.verify(req.query.auth, secretKey);
      req.userid = payload.userid
      // We are authenticated so continue with connection.
      next();
    } catch(err) {
      // Authentication failed -> 401.
      res.status(401).send(err.message);
    }
  },
  // Handle websocket upgrade.
  (req, res, next) => {
    if (req.headers.upgrade == 'websocket') {
      wss.handleUpgrade(req, req.socket, '', socket => {
        wss.emit('connection', socket, req);
      });
    }
    else next();
  }
);


/**
 * Done and listening.
 */
console.log(`Serving on port: ${PORT}`);
https.createServer({cert: tlsCert, key: tlsKey}, app).listen(PORT);
