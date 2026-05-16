import { exec } from 'node:child_process';
import express from 'express';
import { createServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import { WebSocketServer, WebSocket } from 'ws';
import { loadOrCreateCertificates } from './cert.js';
import { createAudioPipe, type AudioPipeMode, type AudioPipeState, type AudioPipe } from './audio.js';

const certs = loadOrCreateCertificates();
const app = express();
const server = createServer({ key: certs.key, cert: certs.cert }, app);
const wss = new WebSocketServer({ server, maxPayload: 100 * 1024 });

app.use(express.static('public'));

const port = parseInt(process.env.PORT || '3000', 10);

const audioMode = (process.env.AUDIO_PIPE_MODE || 'file') as AudioPipeMode;

console.log(`Audio pipe mode: ${audioMode}`);
if (audioMode !== 'file') {
  console.log(`  (set AUDIO_PIPE_MODE=file for safe logging only)`);
}

// ── Routing ────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.sendFile('pc.html', { root: 'public' });
});

app.get('/phone', (_req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// ── QR code endpoint ───────────────────────────────────────────────

app.get('/api/qr', async (_req, res) => {
  try {
    const url = getLanUrl() || `https://localhost:${port}/phone`;
    const svg = await QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      color: { dark: '#a0a0a0', light: '#0f0f0f' },
    });
    res.type('image/svg+xml').send(svg);
  } catch {
    res.status(500).send('QR generation failed');
  }
});

// ── LAN URL ────────────────────────────────────────────────────────

function getLanUrl(): string | null {
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return `https://${iface.address}:${port}/phone`;
      }
    }
  }
  return null;
}

// ── WebSocket broadcast ────────────────────────────────────────────

const clients = new Set<WebSocket>();

function broadcast(msg: Record<string, unknown>) {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// ── WebSocket handler ──────────────────────────────────────────────

wss.on('connection', (ws) => {
  clients.add(ws);

  // Send LAN URL immediately (dashboard needs it for QR code)
  const lanUrl = getLanUrl();
  if (lanUrl && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'url', url: lanUrl }));
  }

  let audioPipeActive = false;
  let chunkCount = 0;
  let totalBytes = 0;

  function ensureAudioPipe(): AudioPipe | null {
    if (audioPipeActive) return null;
    audioPipeActive = true;

    function sendState(state: AudioPipeState | 'connected') {
      broadcast({ type: 'state', state });
    }

    const audioPipe = createAudioPipe({
      mode: audioMode,
      onStateChange: (state) => {
        sendState(state);
      },
    });

    console.log(`Audio streaming started — pipe: ${audioPipe.mode}`);
    sendState('started');

    return audioPipe;
  }

  let audioPipe: AudioPipe | null = null;

  ws.on('message', (data) => {
    if (Buffer.isBuffer(data)) {
      // First binary message = phone client → create audio pipe on demand
      if (!audioPipe) {
        audioPipe = ensureAudioPipe();
        if (!audioPipe) return;
      }

      chunkCount++;
      totalBytes += data.length;
      audioPipe.write(data);
      console.log(
        `Chunk #${chunkCount}: ${data.length} bytes (total ${totalBytes})`,
      );
      broadcast({ type: 'stats', bytes: totalBytes, chunks: chunkCount });
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (audioPipe) {
      audioPipe.close();
    }
    console.log(
      `Client disconnected — ${chunkCount} chunks, ${totalBytes} bytes total`,
    );
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    broadcast({ type: 'state', state: 'error' });
  });
});

// ── Start ──────────────────────────────────────────────────────────

server.listen(port, '0.0.0.0', () => {
  const localUrl = `https://localhost:${port}`;
  const lanUrl = getLanUrl();

  console.log(`darkmic server running at ${localUrl}`);
  console.log('');

  if (lanUrl) {
    console.log(`  ➜  Dashboard: ${localUrl}`);
    console.log(`  ➜  Phone:     ${lanUrl}`);
  } else {
    console.log(`  ➜  Dashboard: ${localUrl}`);
  }

  console.log('');
  console.log('  First time? Accept the self-signed cert warning in Chrome.');
  console.log('');

  if (process.platform === 'win32') {
    exec(`start ${localUrl}`);
  } else if (process.platform === 'darwin') {
    exec(`open ${localUrl}`);
  } else {
    exec(`xdg-open ${localUrl}`);
  }
});
