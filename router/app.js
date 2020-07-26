const WebSocket = require('ws');
const PORT = process.env.PORT || 7993

const wss = new WebSocket.Server({ port: PORT });

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

console.log('Listening...')
