const WebSocket = require('ws');
const express = require('express');
const path = require('path');

const ROUTER_PORT = process.env.ROUTER_PORT || 7993 // TODO configure
const CLIENT_PORT = process.env.CLIENT_PORT || 8080 // TODO configure

// Start the router service
const wss = new WebSocket.Server({ port: ROUTER_PORT });
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
www.listen(CLIENT_PORT);

// Ready
console.log('Started...')
