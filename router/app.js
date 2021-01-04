const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const service = require('http').createServer();


/**
 * Configurable parameters.
 */
const PORT = process.env.PORT || 8080;
const ICE_SERVERS = process.env.ICE_SERVERS || 'stun:stun.example.org';


/**
 * Router service.
 */
// Start the router service
const wss = new WebSocket.Server({ server: service });
var connectionCount = 0;
var getConnectionNumber = () => { return connectionCount++; };
var server = null;
var clients = {};
wss.on('connection', (ws, request) => {
  var connectionNumber = getConnectionNumber();

  // Establish connection for the server.
  if (request.url.startsWith("/server/")) {
    server = ws;
    ws.on('close', (event) => { server = null; });
    ws.on('message', (message) => {
      console.log(`\nServer(${connectionNumber}): ${message}\n`);
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
  else {
    clients[connectionNumber] = ws;
    ws.on('close', (event) => { delete clients[connectionNumber]; });
    ws.on('message', (message) => {
      console.log(`\nClient(${connectionNumber}): ${message}\n`);
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


/**
 * Webpage service
 */
// Serve the client app.
var www = express();
www.get('/', (req, res) => {
  res.sendFile('./client/client.html', { root: __dirname });
})
www.use(express.static(path.join(__dirname, './client')));
// Give the client the rtc config.
www.get('/rtcconfig', (req, res) => {
  res.send(JSON.stringify({iceServers: [{urls: ICE_SERVERS}]}));
})
// Register http responses.
service.on('request', www);


/**
 * Serve all.
 */
// Ready
service.listen(PORT);
console.log('Started...');
