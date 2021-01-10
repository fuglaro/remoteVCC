const https = require('https');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const forge = require('node-forge');
process.chdir(__dirname); // Server relative to this file.

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
  // Automatically generate TLS credentials.
  function createSelfSignedCertAndKey() {
    // generate a keypair and create an X.509v3 certificate
    const keys = forge.pki.rsa.generateKeyPair(2048);
    var cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = `00${crypto.randomBytes(18).toString('hex')}`;
    // Expire it in a year.
    cert.validity.notAfter.setFullYear(
      cert.validity.notBefore.getFullYear() + 1);
    var attrs = [
      {name: 'commonName', value: `AutoCertRemovid-${
        crypto.randomBytes(256).toString('hex')
      }`},
      {name: 'organizationName', value: 'Unknown'},
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    return [forge.pki.certificateToPem(cert),
      forge.pki.privateKeyToPem(keys.privateKey)];
  }
  [tlsCert, tlsKey] = createSelfSignedCertAndKey();
  console.log(`Using automatically made TLS certificate:\n${tlsCert}`);
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
  res.sendFile('public/client/client.html', { root: __dirname });
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
var server = null;
var clients = {};
wss.on('connection', (ws, request) => {
  var connectionNumber = getConnectionNumber();

  // Establish connection for the server.
  if (request.url.startsWith("/signal/server")) {
    server = ws;
    ws.on('close', (event) => { server = null; });
    ws.on('message', (message) => {
      // Unwrap the message and send to the appropriate clients.
      var data = JSON.parse(message);
      if (data['client-id'] == 'broadcast') {
        Object.values(clients).forEach(
          (client) => { client.send(data['message']); });
      }
      else if (data['client-id'] in clients) {
        clients[data['client-id']].send(data['message']);
      }
    });
  }

  // Establish connection for a client.
  else if (request.url.startsWith("/signal/client")) {
    clients[connectionNumber] = ws;
    ws.on('close', (event) => { delete clients[connectionNumber]; });
    ws.on('message', (message) => {
      if (server) {
        // Wrap the message so the server knows which client
        // to respond back to.
        server.send(JSON.stringify({
          'client-id': connectionNumber,
          'message': message
        }));
      }
    });
  }

});
// Connect it up for serving
app.get(['/signal/client', '/signal/server'],
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