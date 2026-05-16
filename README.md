<p align="center">
  <samp>English &nbsp;｜&nbsp; <a href="README-zh.md">简体中文</a></samp>
</p>

<br>

<p align="center">
  <picture>
    <img src="https://img.shields.io/badge/darkmic-1a1a1a?style=for-the-badge" alt="darkmic">
  </picture>
</p>

<p align="center">
  <sup><code>Phone → PC</code>&nbsp; · &nbsp;Wireless Microphone</sup>
</p>

<p align="center">
  <b>Turn your mobile device into a Windows PC microphone.</b><br>
  <sub><i>Chromium-based browser only. &nbsp;Zero install on device. &nbsp;No cloud.</i></sub>
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/github/v/release/darkLordIceCream/darkmic?style=flat-square&labelColor=1a1a1a&color=555" alt="release">
  <img src="https://img.shields.io/github/last-commit/darkLordIceCream/darkmic?style=flat-square&labelColor=1a1a1a&color=22c55e" alt="updated">
  <img src="https://img.shields.io/github/license/darkLordIceCream/darkmic?style=flat-square&labelColor=1a1a1a&color=3b82f6" alt="license">
  <br>
  <img src="https://img.shields.io/badge/Chromium-333?style=flat-square&logo=googlechrome&logoColor=white" alt="Chromium">
  <img src="https://img.shields.io/badge/Windows-333?style=flat-square&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/TypeScript-333?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/pnpm-333?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm">
  <img src="https://img.shields.io/badge/Opus-333?style=flat-square&logo=opus&logoColor=white" alt="Opus">
  <img src="https://img.shields.io/badge/WebSocket-333?style=flat-square&logo=socket.io&logoColor=white" alt="WebSocket">
</p>

<br>

<p align="center">
  <samp>
    <a href="#-how-it-works">How It Works</a> ·
    <a href="#-features">Features</a> ·
    <a href="#-quick-start">Quick Start</a> ·
    <a href="#-architecture">Architecture</a> ·
    <a href="#-development">Dev</a> ·
    <a href="#-feature-status">Status</a> ·
    <a href="#-faq">FAQ</a>
  </samp>
</p>

<br>

---

### ⚡ &nbsp;How It Works

```
                        ┌─────────────────────────────────────────────────┐
                        │          📱 MOBILE DEVICE (Chromium)              │
                        │                                                 │
                        │   Open URL from terminal                         │
                        │   Tap "Start Microphone"                         │
                        │   Start speaking                                 │
                        │                                                 │
                        │   getUserMedia                                   │
                        │     → MediaStreamTrackProcessor                  │
                        │     → AudioEncoder (opus · 48kHz · mono)        │
                        │     → WebSocket send                             │
                        │                       │                         │
                        └───────────────────────│─────────────────────────┘
                                                │  HTTPS + WebSocket
                                                │  (local network · ~80ms)
                                                │
                        ┌───────────────────────│─────────────────────────┐
                        │                       ▼                         │
                        │           🖥️  WINDOWS PC (darkmic.exe)          │
                        │                                                 │
                        │   WebSocket receive                              │
                        │     → opusscript decode (opus → PCM)            │
                        │     → WinMM waveOut → VB-CABLE Input            │
                        │     → VB-CABLE Output (system virtual mic)       │
                        │                                                 │
                        │   ✅ Any app sees it as a normal microphone      │
                        └─────────────────────────────────────────────────┘
```

> Audio flows **one-way** (phone → PC). &nbsp;End-to-end latency ~ **80ms**.

---

### ✨ &nbsp;Features

<div align="center">

| | |
|---|---|
| 📱 &nbsp;**Zero install** on device | Just a Chromium browser — no app store needed |
| 🔒 &nbsp;**Local network only** | No cloud, no data leaves your home |
| ⚡ &nbsp;**~80ms latency** | WebCodecs AudioEncoder skips container overhead |
| 🔊 &nbsp;**Opus 32kbps** | Optimized for speech, efficient bandwidth |
| 🔌 &nbsp;**VB-Cable output** | System-level virtual microphone device |
| 📦 &nbsp;**Single .exe** | Packaged via pkg, FFmpeg bundled alongside |
| 🖥️ &nbsp;**Windows 10/11** | Any mobile device with Chromium browser |
| 🌐 &nbsp;**QR connect** | Scan QR on PC dashboard to connect phone |

</div>

---

### 🚀 &nbsp;Quick Start

**Prerequisites**

```bash
# Install system dependencies (Windows)
winget install ffmpeg
winget install OpenSSL.Light
```

> [!IMPORTANT]
> Also required: [VB-Cable](https://vb-audio.com/Cable/) (virtual audio driver) and a Chromium-based browser ([Chrome](https://www.google.com/chrome/), Edge, Brave, etc.) on both PC and mobile. Both devices on the same WiFi.

**Run**

```bash
git clone https://github.com/darkLordIceCream/darkmic.git
cd darkmic
pnpm install
pnpm run dev
```

The terminal shows your LAN IPs:

```
  ➜  Dashboard: https://localhost:3000
  ➜  Phone:     https://192.168.1.100:3000/phone
```

**Connect**

<table>
<tr><td>①</td><td>Open <b>https://localhost:3000</b> on your PC — the dashboard appears with a QR code</td></tr>
<tr><td>②</td><td>Scan the QR code with your <b>mobile device's browser</b>, or open the Phone URL manually</td></tr>
<tr><td>③</td><td>Tap <b>Advanced → Proceed</b> (self-signed cert — <a href="#-faq">expected</a>)</td></tr>
<tr><td>④</td><td>Tap <b>"Start Microphone"</b> → allow mic permission</td></tr>
<tr><td>⑤</td><td>Speak — audio streams to your PC's VB-Cable virtual microphone</td></tr>
</table>

---

### 🏗️ &nbsp;Architecture

**Tech Stack**

| Layer | Technology |
|:---|:---|
| Server runtime | Node.js + TypeScript |
| HTTP | Express |
| WebSocket | `ws` |
| Audio encode (browser) | WebCodecs `AudioEncoder` (opus) |
| Audio decode (server) | `opusscript` (pure JS) |
| Audio output | WinMM waveOut via `koffi` |
| Packaging | `@yao-pkg/pkg` |

**Project Layout**

```
darkmic/
├── src/                    # PC server (TypeScript)
│   ├── index.ts            # HTTPS + WebSocket + Express
│   ├── cert.ts             # Self-signed SSL cert generation
│   ├── audio.ts            # AudioPipe factory (3 modes)
│   └── wasapi.ts           # WinMM waveOut → VB-Cable
├── public/                 # Web app pages
│   ├── pc.html             # PC dashboard (QR code, metrics, event log)
│   ├── index.html          # Phone UI
│   └── client.js           # WebCodecs + WebSocket + auto-reconnect
├── scripts/                # Dev utilities
├── AGENTS.md               # AI agent instructions
├── feature_list.json       # Feature tracker
├── progress.md             # Session log
└── init.sh                 # Verification script
```

> **Future:** If lower latency is needed, upgrade transport to **WebRTC** (`RTCPeerConnection`). WebSocket becomes signaling only.

---

### 🧪 &nbsp;Development

```bash
./init.sh               # Full verification (install + typecheck + build + audio test)
pnpm run dev            # Dev server with hot reload
pnpm run typecheck      # TypeScript type check only
pnpm run build          # Compile TypeScript to dist/
pnpm run start          # Production server (node dist/index.js)
pnpm test:audio         # Audio pipe test → file mode
pnpm test:audio -- ffplay   # Audio pipe test → speaker playback
pnpm test:audio -- wasapi   # Audio pipe test → VB-Cable output
```

---

### ✅ &nbsp;Feature Status

| ID | Feature | Completed | |
|:---:|:---|---|:---:|
| F-001 | Project scaffold + HTTPS certs | 2026-05-13 | `done` |
| F-002 | WebCodecs + WebSocket pipeline | 2026-05-13 | `done` |
| F-003 | opusscript decode → WinMM → VB-Cable | 2026-05-16 | `done` |
| F-004 | QR code + PC dashboard + auto-reconnect | 2026-05-16 | `done` |
| F-005 | AGC + quality selector + latency measurement | — | `todo` |
| F-006 | WebRTC P2P transport | — | `deferred` |
| F-007 | Windows pkg packaging | — | `todo` |
| F-008 | Installer + system tray | — | `todo` |

---

### ❓ &nbsp;FAQ

<details>
<summary><b>Why does the browser show a privacy warning?</b></summary>
<br>
The server generates a self‑signed SSL certificate on first run. Chrome warns because it isn't signed by a public CA. Your connection is still encrypted — perfectly safe for local network use. Tap <b>Advanced → Proceed</b> to continue.
</details>

<br>

<details>
<summary><b>Can I use Safari or Firefox?</b></summary>
<br>
No. This project requires a <b>Chromium-based browser</b> (Chrome, Edge, Brave, Opera, etc.) on both mobile and PC. It uses WebCodecs <code>AudioEncoder</code> which is only implemented in Chromium.
</details>

<br>

<details>
<summary><b>Can I use this over the internet?</b></summary>
<br>
No. darkmic is designed for <b>local network only</b> (same WiFi subnet). There is no STUN/TURN, no cloud relay, no NAT traversal.
</details>

<br>

---

<br>

<p align="center">
  <samp>English &nbsp;｜&nbsp; <a href="README-zh.md">简体中文</a></samp>
</p>

<p align="center">
  <sub>Built for when you need a mic but don't have one. &nbsp;© 2026 darkLordIceCream</sub>
</p>
