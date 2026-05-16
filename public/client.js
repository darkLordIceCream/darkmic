/**
 * F-002/F-004: Phone audio capture → WebCodecs AudioEncoder → WebSocket
 * F-004 additions: auto-reconnect, permission error handling, state display
 */

const micBtn = document.getElementById('micBtn');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');

let encoder = null;
let ws = null;
let stream = null;
let reader = null;
let chunkCount = 0;
let byteCount = 0;
let isRunning = false;

// ── Reconnect ────────────────────────────────────────────────────

let reconnectAttempts = 0;
const MAX_RECONNECT = 10;
let reconnectTimer = null;

function backoffDelay(attempt) {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT) {
    setStatus('Could not reconnect. Tap to retry.', 'error');
    stop();
    return;
  }
  const delay = backoffDelay(reconnectAttempts);
  reconnectAttempts++;
  setStatus(`Reconnecting in ${Math.round(delay / 1000)}s... (${reconnectAttempts}/${MAX_RECONNECT})`, 'error');
  reconnectTimer = setTimeout(connectAndStream, delay);
}

function cancelReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = 0;
}

// ── Main flow ────────────────────────────────────────────────────

micBtn.addEventListener('click', () => {
  if (isRunning) {
    stop();
  } else {
    start();
  }
});

async function start() {
  cancelReconnect();

  try {
    setStatus('Requesting microphone...', '');

    // 1. Get mic
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // 2. Connect WebSocket + setup encoder, then stream
    await connectAndStream();
  } catch (err) {
    handleStartError(err);
  }
}

async function connectAndStream() {
  // Clean up any previous encoder/ws before reconnect
  cleanupEncoder();

  try {
    setStatus('Connecting to server...', '');

    ws = new WebSocket(`wss://${location.host}`);
    ws.binaryType = 'arraybuffer';

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('WebSocket connection failed'));
      // Timeout after 10s
      setTimeout(() => reject(new Error('Connection timed out')), 10000);
    });

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state') {
            const label = msg.state === 'error' ? 'error' : 'connected';
            setStatus(`Server: ${msg.state}`, label);
          }
        } catch { /* ignore */ }
      }
    };

    ws.onclose = () => {
      if (isRunning) {
        setStatus('Connection lost', 'error');
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };

    setStatus('Starting audio encoder...', '');

    // 3. Create AudioEncoder (opus) — re-create on every reconnect
    chunkCount = 0;
    byteCount = 0;

    encoder = new AudioEncoder({
      output: (chunk) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        ws.send(buf);
        chunkCount++;
        byteCount += buf.length;
        if (chunkCount % 10 === 0) updateStats();
      },
      error: (e) => {
        console.error('AudioEncoder error:', e);
        setStatus(`Encoder error: ${e.message}`, 'error');
        stop();
      },
    });

    await encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 1,
      bitrate: 32000,
    });

    // 4. Wire up MediaStreamTrack → AudioData frames
    const track = stream.getAudioTracks()[0];
    const processor = new MediaStreamTrackProcessor({ track });
    reader = processor.readable.getReader();

    isRunning = true;
    reconnectAttempts = 0; // reset on successful connection
    micBtn.textContent = 'Stop';
    micBtn.className = 'mic-off';
    setStatus('Streaming...', 'connected');
    updateStats();

    // 5. Read loop
    readLoop();
  } catch (err) {
    console.error('connectAndStream() failed:', err);
    if (isRunning) {
      setStatus(`Error: ${err.message}`, 'error');
      scheduleReconnect();
    }
  }
}

async function readLoop() {
  try {
    while (isRunning && reader) {
      const { value, done } = await reader.read();
      if (done) break;
      if (encoder && encoder.state === 'configured') {
        encoder.encode(value);
      }
      value.close();
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Read loop error:', err);
      setStatus(`Read error: ${err.message}`, 'error');
    }
  }
}

// ── Error handling ──────────────────────────────────────────────

function handleStartError(err) {
  console.error('start() failed:', err);

  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    setStatus(
      'Microphone permission denied. Open Chrome settings → Privacy → Camera & Microphone → allow mic.',
      'error'
    );
  } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    setStatus(
      'No microphone found. Make sure your device has a built-in mic or an external one plugged in.',
      'error'
    );
  } else if (err.name === 'NotReadableError') {
    setStatus(
      'Microphone is in use by another app. Close other apps that are using the mic.',
      'error'
    );
  } else {
    setStatus(`Error: ${err.message}`, 'error');
  }

  stop();
}

// ── Stop ────────────────────────────────────────────────────────

function stop() {
  isRunning = false;
  cancelReconnect();

  cleanupEncoder();

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (ws) {
    ws.onopen = null;
    ws.onclose = null;
    ws.onerror = null;
    try { ws.close(); } catch (_) { /* ignore */ }
    ws = null;
  }

  micBtn.textContent = 'Start Microphone';
  micBtn.className = '';
  if (statusEl.className !== 'status error') {
    setStatus('Stopped', '');
  }
  statsEl.textContent = '';
}

function cleanupEncoder() {
  if (reader) {
    try { reader.cancel(); } catch (_) { /* ignore */ }
    reader = null;
  }
  if (encoder) {
    try { encoder.close(); } catch (_) { /* ignore */ }
    encoder = null;
  }
}

// ── UI helpers ──────────────────────────────────────────────────

function setStatus(msg, className) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (className ? ` ${className}` : '');
}

function updateStats() {
  const kb = (byteCount / 1024).toFixed(1);
  statsEl.textContent = `${chunkCount} chunks · ${kb} KB sent`;
}
