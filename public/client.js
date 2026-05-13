/**
 * F-002: Phone audio capture → WebCodecs AudioEncoder → WebSocket
 *
 * Flow:
 *   getUserMedia → MediaStreamTrackProcessor → AudioData frames
 *   → AudioEncoder (opus) → EncodedAudioChunk → ws.send
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

micBtn.addEventListener('click', () => {
  if (isRunning) {
    stop();
  } else {
    start();
  }
});

async function start() {
  try {
    setStatus('Requesting microphone...', '');

    // 1. Get mic (mono, with defaults for echo/noise)
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    setStatus('Connecting to server...', '');

    // 2. Connect WebSocket (same host/port as page, HTTPS upgrade)
    ws = new WebSocket(`wss://${location.host}`);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('WebSocket connection failed'));
    });

    ws.onclose = () => {
      if (isRunning) {
        setStatus('Connection lost', 'error');
        stop();
      }
    };

    setStatus('Starting audio encoder...', '');

    // 3. Create AudioEncoder (opus)
    chunkCount = 0;
    byteCount = 0;

    encoder = new AudioEncoder({
      output: (chunk) => {
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        ws.send(buf);

        chunkCount++;
        byteCount += buf.length;

        // Update stats every ~10 chunks to avoid layout thrashing
        if (chunkCount % 10 === 0) {
          updateStats();
        }
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
      bitrate: 32000, // good for speech
    });

    // 4. Wire up MediaStreamTrack → AudioData frames
    const track = stream.getAudioTracks()[0];
    const processor = new MediaStreamTrackProcessor({ track });
    reader = processor.readable.getReader();

    isRunning = true;
    micBtn.textContent = 'Stop';
    micBtn.className = 'mic-off';
    setStatus('Streaming...', 'connected');
    updateStats();

    // 5. Read loop (runs until canceled)
    readLoop();
  } catch (err) {
    console.error('start() failed:', err);
    setStatus(`Error: ${err.message}`, 'error');
    stop();
  }
}

async function readLoop() {
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      encoder.encode(value);
      value.close(); // free AudioData memory
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Read loop error:', err);
      setStatus(`Read error: ${err.message}`, 'error');
    }
  }
}

function stop() {
  isRunning = false;

  if (reader) {
    try { reader.cancel(); } catch (_) { /* ignore */ }
    reader = null;
  }
  if (encoder) {
    try { encoder.close(); } catch (_) { /* ignore */ }
    encoder = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (ws) {
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

function setStatus(msg, className) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (className ? ` ${className}` : '');
}

function updateStats() {
  const kb = (byteCount / 1024).toFixed(1);
  statsEl.textContent = `${chunkCount} chunks · ${kb} KB sent`;
}
