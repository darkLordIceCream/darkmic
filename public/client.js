/**
 * F-002/F-004: Mobile audio capture → WebCodecs AudioEncoder → WebSocket
 * F-004 additions: auto-reconnect, permission error handling, state display
 */

const micBtn = document.getElementById('micBtn');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');
const levelBar = document.getElementById('levelbar');
const levelFill = document.getElementById('levelfill');
const levelDb = document.getElementById('leveldb');

// ── PWA service worker (F-010) ───────────────────────────────────
// Caches the phone shell so the page still opens when the server briefly
// disappears; live streaming never depends on it.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => console.log('SW registered, scope:', reg && reg.scope),
      (err) => {
        // Offline shell is a bonus — never break streaming over it, but a
        // silent failure here is undebuggable (same lesson as F-009).
        // Note: Chromium rejects the SW script fetch when the server's TLS
        // cert is untrusted (self-signed) even if the user bypassed the
        // interstitial — registration then fails with "An SSL certificate
        // error occurred when fetching the script". Expected with the
        // self-signed setup; engages automatically with a trusted cert.
        console.error('Service worker registration failed:', err && err.message);
      }
    );
  });
}

let encoder = null;
let ws = null;
let stream = null;
let reader = null;
let chunkCount = 0;
let byteCount = 0;
let isRunning = false;
let audioCtx = null;
let rawStream = null;
let pingTimer = null;
let latencyMs = 0;
let currentBitrate = 32000;
// Starting bitrate pushed by the server via {type:'config'} (config.json, F-009)
let serverInitialBitrate = 32000;
let lastBitrateSwitch = 0;

// ── Audio settings (F-011, persisted per device) ─────────────────

const DEFAULT_SETTINGS = {
  micId: '',
  echoCancel: true,
  agc: true,
  eq: false,
  bass: 0,
  treble: 0,
  gate: false,
  gateThreshold: -50,
};

let settings = loadSettings();

function loadSettings() {
  let saved = {};
  try {
    const parsed = JSON.parse(localStorage.getItem('darkmic-settings') || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed;
  } catch (_) {
    saved = {};
  }
  const s = { ...DEFAULT_SETTINGS, ...saved };
  // Sanitize: corrupted values must not reach the DSP graph (QAInspector P2-3)
  for (const k of ['bass', 'treble', 'gateThreshold']) {
    if (!Number.isFinite(s[k])) s[k] = DEFAULT_SETTINGS[k];
  }
  for (const k of ['micId', 'echoCancel', 'agc', 'eq', 'gate']) {
    if (typeof s[k] !== typeof DEFAULT_SETTINGS[k]) s[k] = DEFAULT_SETTINGS[k];
  }
  return s;
}

function saveSettings() {
  try { localStorage.setItem('darkmic-settings', JSON.stringify(settings)); } catch (_) { /* private mode */ }
}

// DSP node refs for the current capture session (null when stopped)
let eqNodes = null;   // { low, high } BiquadFilter pair
let gateNode = null;  // AudioWorkletNode
let analyser = null;
let levelData = null;
let levelTimer = null;

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

// ── Wake Lock + recovery reconnects (F-010) ──────────────────────

let wakeLock = null;
let wakeLockPending = false; // in-flight guard: two callers racing must not double-acquire

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock || wakeLockPending) return;
  wakeLockPending = true;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) {
    // Denied (e.g. low battery, page hidden): streaming still works,
    // the screen may sleep on its own.
    wakeLock = null;
  } finally {
    wakeLockPending = false;
  }
}

function releaseWakeLock() {
  if (!wakeLock) return;
  try { wakeLock.release(); } catch (_) { /* already released */ }
  wakeLock = null;
}

function forceReconnectNow() {
  if (!isRunning) return;
  // Already connected or connecting — nothing to recover.
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  cancelReconnect(); // skip the remaining backoff delay
  setStatus('Reconnecting now...', '');
  connectAndStream();
}

// Backgrounding auto-releases the screen wake lock and can kill a stalled
// socket. On return to the foreground: re-acquire the lock and reconnect
// immediately if the socket died. 'online' covers Wi-Fi / flight-mode recovery.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !isRunning) return;
  requestWakeLock();
  forceReconnectNow();
});
window.addEventListener('online', forceReconnectNow);

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
    rawStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: settings.micId ? { exact: settings.micId } : undefined,
        channelCount: 1,
        echoCancellation: settings.echoCancel,
        // The panel's "AGC (compressor)" toggle owns gain control — Chrome's
        // native AGC must not stack on top of it (QAInspector P2-4).
        autoGainControl: false,
        noiseSuppression: true,
      },
    }).catch((err) => {
      // A stale saved mic id (device unplugged) must not brick Start —
      // fall back to the default device once and clear the setting.
      if ((err.name === 'NotFoundError' || err.name === 'OverconstrainedError') && settings.micId) {
        settings.micId = '';
        saveSettings();
        return navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: settings.echoCancel,
            autoGainControl: false,
            noiseSuppression: true,
          },
        });
      }
      throw err;
    });

    // 1b. Capture graph: mic → [gate] → [AGC] → [EQ] → analyser tap → encoder
    // (F-011: each stage toggleable from the settings panel)
    audioCtx = new AudioContext({ sampleRate: 48000 });
    let node = audioCtx.createMediaStreamSource(rawStream);

    if (settings.gate) {
      await audioCtx.audioWorklet.addModule('/gate-worklet.js');
      gateNode = new AudioWorkletNode(audioCtx, 'noise-gate');
      gateNode.parameters.get('threshold').value = settings.gateThreshold;
      node.connect(gateNode);
      node = gateNode;
    }

    if (settings.agc) {
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -50;
      comp.knee.value = 20;
      comp.ratio.value = 12;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      node.connect(comp);
      node = comp;
    }

    if (settings.eq) {
      const hp = audioCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 80;   // fixed voice low-cut
      hp.Q.value = 0.7;
      const low = audioCtx.createBiquadFilter();
      low.type = 'lowshelf';
      low.frequency.value = 200;
      low.gain.value = settings.bass;
      const high = audioCtx.createBiquadFilter();
      high.type = 'highshelf';
      high.frequency.value = 4000;
      high.gain.value = settings.treble;
      node.connect(hp);
      hp.connect(low);
      low.connect(high);
      node = high;
      eqNodes = { low, high };
    }

    const dest = audioCtx.createMediaStreamDestination();
    dest.channelCountMode = 'explicit';
    dest.channelCount = 1;
    node.connect(dest);
    stream = dest.stream;

    // Level meter tap (F-011)
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    levelData = new Float32Array(analyser.fftSize);
    node.connect(analyser);

    // 2. Connect WebSocket + setup encoder, then stream
    await connectAndStream();
  } catch (err) {
    handleStartError(err);
  }
}

async function connectAndStream() {
  // Clean up any previous encoder/ws before reconnect
  cleanupEncoder();

  // Clear timers from the previous attempt — reconnect paths re-enter this
  // function, and stacked intervals double ping/level broadcast rates on
  // every reconnect (QAInspector P1, 2026-11-14).
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (levelTimer) { clearInterval(levelTimer); levelTimer = null; }

  // Detach the old socket's handlers and close it: a socket left in CLOSING
  // fires its onclose after this reconnect is already streaming, scheduling a
  // second reconnect that tears the new one down — a reconnect storm that
  // leaks server-side pipes (QAInspector P1, 2026-11-14).
  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    try { ws.close(); } catch (_) { /* already closing */ }
    ws = null;
  }

  try {
    setStatus('Connecting to server...', '');

    ws = new WebSocket(`wss://${location.host}`);
    ws.binaryType = 'arraybuffer';

    // Register the message handler BEFORE awaiting open: the server sends
    // config/url/vbcable right after connection, and a handler assigned
    // only after the open promise resolves would miss them.
    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state') {
            const label = msg.state === 'error' ? 'error' : 'connected';
            setStatus(`Server: ${msg.state}`, label);
          } else if (msg.type === 'pong') {
            latencyMs = Date.now() - msg.t;
            adaptBitrate();
            updateStats();
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'latency', ms: Math.round(latencyMs / 2) }));
            }
          } else if (msg.type === 'config' && typeof msg.initialBitrate === 'number') {
            serverInitialBitrate = msg.initialBitrate;
          }
        } catch { /* ignore */ }
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('WebSocket connection failed'));
      // Timeout after 10s
      setTimeout(() => reject(new Error('Connection timed out')), 10000);
    });

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
    currentBitrate = serverInitialBitrate;
    lastBitrateSwitch = 0;

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
      bitrate: currentBitrate,
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
    requestWakeLock(); // keep the screen on while streaming (F-010)

    latencyMs = 0;
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
      }
    }, 2000);

    // Level meter + broadcast (F-011)
    levelBar.hidden = false;
    levelDb.hidden = false;
    levelTimer = setInterval(updateLevelMeter, 500);

    // 5. Read loop
    readLoop();
  } catch (err) {
    console.error('connectAndStream() failed:', err);
    if (isRunning) {
      setStatus(`Error: ${err.message}`, 'error');
      scheduleReconnect();
    } else {
      // Initial connect failed — release the mic + audio context instead of
      // leaving them dangling until the next Start (QAInspector P3-2).
      stop();
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
      'Microphone permission denied. Open browser settings → Privacy → Camera & Microphone → allow mic.',
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
  releaseWakeLock();

  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (levelTimer) {
    clearInterval(levelTimer);
    levelTimer = null;
  }

  cleanupEncoder();

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (rawStream) {
    rawStream.getTracks().forEach((t) => t.stop());
    rawStream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  eqNodes = null;
  gateNode = null;
  analyser = null;
  levelData = null;
  levelBar.hidden = true;
  levelDb.hidden = true;
  levelFill.style.width = '0%';
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

// ── Level meter (F-011) ─────────────────────────────────────────

function updateLevelMeter() {
  if (!analyser || !isRunning) return;
  analyser.getFloatTimeDomainData(levelData);
  let sum = 0;
  for (let i = 0; i < levelData.length; i++) sum += levelData[i] * levelData[i];
  const rms = Math.sqrt(sum / levelData.length);
  const db = 20 * Math.log10(Math.max(rms, 1e-10));
  const dbClamped = Math.max(-99, Math.min(0, db)); // gate-closed silence reads -inf; keep sane range
  const pct = Math.max(0, Math.min(100, ((dbClamped + 60) / 60) * 100));
  levelFill.style.width = pct.toFixed(0) + '%';
  levelDb.textContent = dbClamped.toFixed(1) + ' dB';
  // Relay to the dashboard at the same cadence (server broadcasts it).
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'level', v: Math.round(dbClamped * 10) / 10 }));
  }
}

// ── Settings panel (F-011) ──────────────────────────────────────

async function populateMicList() {
  const sel = document.getElementById('set-mic');
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((d) => d.kind === 'audioinput');
    sel.innerHTML = '';
    mics.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Microphone ${i + 1}`;
      sel.appendChild(opt);
    });
    if (settings.micId && [...sel.options].some((o) => o.value === settings.micId)) {
      sel.value = settings.micId;
    }
  } catch (_) {
    sel.innerHTML = '<option value="">(unable to list devices)</option>';
  }
}

function bindSettings() {
  const bindToggle = (id, key) => {
    const el = document.getElementById(id);
    el.checked = settings[key];
    el.addEventListener('change', () => {
      settings[key] = el.checked;
      saveSettings();
    });
  };
  const bindRange = (id, key, valId, liveApply) => {
    const el = document.getElementById(id);
    const val = document.getElementById(valId);
    el.value = settings[key];
    val.textContent = settings[key];
    el.addEventListener('input', () => {
      settings[key] = Number(el.value);
      val.textContent = el.value;
      saveSettings();
      if (liveApply) liveApply(settings[key]);
    });
  };
  bindToggle('set-ec', 'echoCancel');
  bindToggle('set-agc', 'agc');
  bindToggle('set-eq', 'eq');
  bindToggle('set-gate', 'gate');
  bindRange('set-bass', 'bass', 'set-bass-v', (v) => {
    if (eqNodes) eqNodes.low.gain.setTargetAtTime(v, audioCtx.currentTime, 0.05);
  });
  bindRange('set-treble', 'treble', 'set-treble-v', (v) => {
    if (eqNodes) eqNodes.high.gain.setTargetAtTime(v, audioCtx.currentTime, 0.05);
  });
  bindRange('set-gth', 'gateThreshold', 'set-gth-v', (v) => {
    if (gateNode) gateNode.parameters.get('threshold').setTargetAtTime(v, audioCtx.currentTime, 0.05);
  });
  const micSel = document.getElementById('set-mic');
  micSel.addEventListener('change', () => {
    settings.micId = micSel.value;
    saveSettings();
  });
}

document.getElementById('gearBtn').addEventListener('click', async () => {
  const panel = document.getElementById('settings');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) await populateMicList();
});
document.getElementById('set-done').addEventListener('click', () => {
  document.getElementById('settings').classList.add('hidden');
});
bindSettings();

// ── UI helpers ──────────────────────────────────────────────────

function setStatus(msg, className) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (className ? ` ${className}` : '');
}

function adaptBitrate() {
  const oneWay = latencyMs / 2;
  const target = oneWay < 50 ? 64000 : 32000;
  if (target === currentBitrate) return;
  // Debounce: don't switch more than once per 5s
  if (Date.now() - lastBitrateSwitch < 5000) return;

  if (!encoder || encoder.state !== 'configured') return;

  currentBitrate = target;
  lastBitrateSwitch = Date.now();
  encoder.configure({
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 1,
    bitrate: target,
  });
  updateStats();
}

function updateStats() {
  const kb = (byteCount / 1024).toFixed(1);
  const kbps = Math.round(currentBitrate / 1000);
  let text = `${chunkCount} chunks · ${kb} KB sent · ${kbps}kbps`;
  if (latencyMs > 0) {
    text += ` · ${Math.round(latencyMs / 2)}ms`;
  }
  statsEl.textContent = text;
}
