import express from 'express';
import { createServer } from 'node:https';
import { WebSocketServer } from 'ws';
import { loadOrCreateCertificates } from './cert.js';
import { createAudioPipe } from './audio.js';

const certs = loadOrCreateCertificates();
const app = express();
const server = createServer({ key: certs.key, cert: certs.cert }, app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));

const port = parseInt(process.env.PORT || '3000', 10);

wss.on('connection', (ws) => {
  console.log('Phone connected');
  const audio = createAudioPipe();

  ws.on('message', (data) => {
    if (Buffer.isBuffer(data)) {
      audio.write(data);
    }
  });

  ws.on('close', () => {
    console.log('Phone disconnected');
    audio.close();
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`darkmic server running at https://0.0.0.0:${port}`);
  console.log('Open this URL in Chrome on your phone (accept the self-signed cert warning)');
});
