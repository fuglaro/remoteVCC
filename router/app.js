const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const server = require('http').createServer();

/**
 * Configurable parameters.
 */
const PORT = process.env.PORT || 8080;
const ICE_SERVERS = process.env.ICE_SERVERS || 'stun:stun.example.org';


// Start the router service
const wss = new WebSocket.Server({ server: server });
// Broadcast all messages to everyone else.
wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(data) {
    console.log(`\n${data}\n`);
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });
});

// Serve the client app.
var www = express();
www.get('/', function (req, res) {
  res.sendFile('./client/client.html', { root: __dirname });
})
www.use(express.static(path.join(__dirname, './client')));
// Direct the client at the websocket port.
www.get('/socket', function (req, res) {
  res.send(JSON.stringify(PORT));
})
// Give the client at the rtc config.
www.get('/rtcconfig', function (req, res) {
  res.send(JSON.stringify({iceServers: [{urls: ICE_SERVERS}]}));
})
// Register http responses.
server.on('request', www);

// Ready
server.listen(PORT);
console.log('Started...');
