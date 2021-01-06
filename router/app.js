const WebSocket = require('ws');
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');







/**
 * Configurable parameters.
 */
const PORT = process.env.PORT || "8080";
const ICE_SERVERS = process.env.ICE_SERVERS || 'stun:stun.example.org';
const PBKDF2_ITERATIONS = parseInt(process.env.PBKDF2_ITERATIONS) || 100000;
const CRYPTO_SALT = crypto.randomBytes(4);





/**
 * Authentication preparation.
 * 
 * This just uses Basic Digest Authentication
 * and is therefore only suitable in a trusted
 * environment where the shared key (password)
 * can be manually given to the client.
 */
const secretKey = crypto.randomBytes(12).toString('hex');
console.log(`Please connect using Connection Key: ${secretKey}`);



console.log(jwt.sign('"TEST"', "MYSECRETKEY"));









/*passport.use(new passportHttp.DigestStrategy({ qop: 'auth' },
  (username, done) => {
    return done(null, "client", secretKey);
  }
));
*/









/**
 * Webpage service
 */
// Serve the client app.
var app = express();
app.get('/', (req, res) => {
  res.sendFile('./public/client/client.html', { root: __dirname });
});
app.use(express.static('./public'));
// Give the client the config.
app.get('/api/config', (req, res) => {
  res.send(JSON.stringify({
    rtc: { iceServers: [{urls: ICE_SERVERS}] },
    pbkdf2_iters: PBKDF2_ITERATIONS,
    crypto_salt: [...CRYPTO_SALT]
  }));
});






/*

// Provide and endpoint for authenticating.
app.get('/login', 
  passport.authenticate('digest', { session: false }),
  (req, res) => { res.send("OK"); }
);
*/







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






/*
  // Authenticate with basic digest auth.
  passport.authenticate('digest', { session: false }),

*/




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