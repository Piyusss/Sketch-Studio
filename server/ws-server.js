#!/usr/bin/env node
/**
 * y-websocket server for Sketch collaboration.
 * Run: node server/ws-server.js
 * Default port: 1234  (set PORT env var to override)
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = Number(process.env.PORT) || 1234;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Sketch WebSocket server');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req);
});

server.listen(PORT, () => {
  console.log(`Sketch WS server running on ws://localhost:${PORT}`);
});
