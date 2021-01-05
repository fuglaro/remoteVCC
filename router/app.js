const WebSocket = require('ws');
const express = require('express');
const passport = require('passport');
const passportHttp = require('passport-http')
const crypto = require('crypto');


/**
 * Configurable parameters.
 */
const PORT = process.env.PORT || 8080;
const ICE_SERVERS = process.env.ICE_SERVERS || 'stun:stun.example.org';


/**
 * Authentication preparation.
 * 
 * This just uses Basic Digest Authentication
 * and is therefore only suitable in a trusted
 * environment where the shared key (password)
 * can be manually given to the client.
 */
const secretKey = crypto.randomBytes(64).toString('hex');
console.log(`Please connect using password: ${secretKey}`);
passport.use(new passportHttp.DigestStrategy({ qop: 'auth' },
  (username, done) => {
    return done(null, "client", secretKey);
  }
));


/**
 * Webpage service
 */
// Serve the client app.
var app = express();
app.get('/', (req, res) => {
  res.sendFile('./public/client/client.html', { root: __dirname });
});
app.use(express.static('./public'));
// Give the client the rtc config.
app.get('/api/rtcconfig', (req, res) => {
  res.send(JSON.stringify({iceServers: [{urls: ICE_SERVERS}]}));
});
// Provide and endpoint for authenticating.
app.get('/login', 
  passport.authenticate('digest', { session: false }),
  (req, res) => { res.send("OK"); }
);


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
  // Authenticate with basic digest auth.
  passport.authenticate('digest', { session: false }),
  // Handle websocket upgrade.
  (request, res, next) => {
    if (request.headers.upgrade == 'websocket') {
      wss.handleUpgrade(request, request.socket, '', socket => {
        wss.emit('connection', socket, request);
      });
    }
    else next();
  }
);


/**
 * Done and listening.
 */
app.listen(PORT);