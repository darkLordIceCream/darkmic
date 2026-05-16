import { exec } from 'node:child_process';
import express from 'express';
import { createServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { WebSocketServer, WebSocket } from 'ws';
import { loadOrCreateCertificates } from './cert.js';
import { createAudioPipe, type AudioPipeMode, type AudioPipeState, type AudioPipe } from './audio.js';
import { checkVBCable } from './wasapi.js';

function appRoot(): string {
  if (import.meta.url.includes('/snapshot/')) return dirname(process.execPath);
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

const publicDir = join(appRoot(), 'public');

const certs = loadOrCreateCertificates();
const app = express();
const server = createServer({ key: certs.key, cert: certs.cert }, app);
const wss = new WebSocketServer({ server, maxPayload: 100 * 1024 });

const port = parseInt(process.env.PORT || '3000', 10);

const audioMode = (process.env.AUDIO_PIPE_MODE || 'file') as AudioPipeMode;

const vbcableInstalled = checkVBCable();

console.log(`Audio pipe mode: ${audioMode}`);
if (audioMode !== 'file') {
  console.log(`  (set AUDIO_PIPE_MODE=file for safe logging only)`);
}
if (!vbcableInstalled) {
  console.warn('VB-Cable not detected — install from https://vb-audio.com/Cable/');
}

// ── Routing (before static to take priority) ───────────────────────

app.get('/', (_req, res) => {
  res.sendFile('pc.html', { root: publicDir });
});

app.get('/phone', (_req, res) => {
  res.sendFile('index.html', { root: publicDir });
});

// ── LAN URL ────────────────────────────────────────────────────────

// Virtual adapter name patterns to exclude (case-insensitive)
const VIRTUAL_IFACE = /^(utun|docker|veth|br-|vEthernet|Hyper-V|VirtualBox|VMware|tun|tap|teredo|isatap|Loopback|Wintun)/i;

function getLanUrl(): string | null {
  const ifaces = networkInterfaces();
  const candidates: { name: string; addr: string }[] = [];

  for (const name of Object.keys(ifaces)) {
    if (VIRTUAL_IFACE.test(name)) continue;
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({ name, addr: iface.address });
      }
    }
  }

  // Prefer real private LAN ranges; return the first match
  for (const c of candidates) {
    if (isPrivateLan(c.addr)) return `https://${c.addr}:${port}/phone`;
  }

  // Fall back to any non-internal address
  if (candidates.length > 0) {
    return `https://${candidates[0].addr}:${port}/phone`;
  }

  return null;
}

function isPrivateLan(addr: string): boolean {
  const [a, b] = addr.split('.').map(Number);
  // 192.168.x.x
  if (a === 192 && b === 168) return true;
  // 10.x.x.x
  if (a === 10) return true;
  // 172.16.x.x – 172.31.x.x
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

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

// Static files (after routes — fallback for /client.js, etc.)
app.use(express.static(publicDir));

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

  // Send LAN URL and VB-Cable status immediately
  const lanUrl = getLanUrl();
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'url', url: lanUrl || '' }));
    ws.send(JSON.stringify({ type: 'vbcable', installed: vbcableInstalled }));
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

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      // First binary message = mobile client → create audio pipe on demand
      if (!audioPipe) {
        audioPipe = ensureAudioPipe();
        if (!audioPipe) return;
      }

      chunkCount++;
      totalBytes += (data as Buffer).length;
      audioPipe.write(data as Buffer);
      console.log(
        `Chunk #${chunkCount}: ${(data as Buffer).length} bytes (total ${totalBytes})`,
      );
      broadcast({ type: 'stats', bytes: totalBytes, chunks: chunkCount });
    } else {
      // Text messages: ping/pong relay for latency measurement
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
        } else if (msg.type === 'latency') {
          broadcast({ type: 'latency', ms: msg.ms });
        }
      } catch { /* ignore malformed JSON */ }
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
  console.log('  First time? Accept the self-signed cert warning in your browser.');
  console.log('');

  if (process.platform === 'win32') {
    exec(`start ${localUrl}`, { windowsHide: true });
  } else if (process.platform === 'darwin') {
    exec(`open ${localUrl}`);
  } else {
    exec(`xdg-open ${localUrl}`);
  }
});
