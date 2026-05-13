import express from 'express';
import { createServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { WebSocketServer } from 'ws';
import { loadOrCreateCertificates } from './cert.js';

const certs = loadOrCreateCertificates();
const app = express();
const server = createServer({ key: certs.key, cert: certs.cert }, app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));

const port = parseInt(process.env.PORT || '3000', 10);

wss.on('connection', (ws) => {
  let chunkCount = 0;
  let totalBytes = 0;

  console.log('Phone connected');

  ws.on('message', (data) => {
    if (Buffer.isBuffer(data)) {
      chunkCount++;
      totalBytes += data.length;
      console.log(
        `Received chunk #${chunkCount}: ${data.length} bytes (total: ${totalBytes} bytes)`,
      );
    }
  });

  ws.on('close', () => {
    console.log(
      `Phone disconnected — ${chunkCount} chunks, ${totalBytes} bytes total`,
    );
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`darkmic server running at https://0.0.0.0:${port}`);
  console.log('');

  // Show actual LAN IPs for phone to connect
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  ➜  Phone: open https://${iface.address}:${port} in Chrome`);
      }
    }
  }

  console.log('');
  console.log('  First time? Accept the self-signed cert warning in Chrome.');
  console.log(
    '  If the page shows nothing, check your Windows firewall (port 3000).',
  );
  console.log('');
});
