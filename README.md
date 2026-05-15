<p align="right">
  <a href="README-zh.md">
    <img src="https://img.shields.io/badge/-简体中文-333?style=flat-square" alt="简体中文">
  </a>
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/darkmic-000?style=flat-square" alt="">
</p>

<h1 align="center">
  <code>Phone → PC · Wireless Microphone</code>
</h1>

<p align="center">
  <b>Turn your Android phone or iPad into a Windows PC microphone.</b><br>
  <i>Chrome browser only. Zero install on phone. No cloud.</i>
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/github/v/release/darkLordIceCream/darkmic?style=flat-square&label=release&color=333" alt="">
  <img src="https://img.shields.io/github/last-commit/darkLordIceCream/darkmic?style=flat-square&label=updated&color=22c55e" alt="">
  <img src="https://img.shields.io/github/license/darkLordIceCream/darkmic?style=flat-square&label=license&color=blue" alt="">
  <br>
  <img src="https://img.shields.io/badge/-Chrome-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="">
  <img src="https://img.shields.io/badge/-Windows-0078D4?style=flat-square&logo=windows&logoColor=white" alt="">
  <img src="https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="">
  <img src="https://img.shields.io/badge/-pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="">
</p>

<br>
<hr>
<br>

## ‎ ‎ ‎ ⚡ How It Works

<br>

```
                        ┌─────────────────────────────────────────────────┐
                        │            📱 PHONE / IPAD (Chrome)             │
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
                        │     → opusscript decode (opus → PCM)                │
                        │     → WinMM waveOut → VB-CABLE Input               │
                        │     → VB-CABLE Output (system virtual mic)       │
                        │                                                 │
                        │   ✅ Any app sees it as a normal microphone      │
                        └─────────────────────────────────────────────────┘
```

> Audio flows **one-way** (phone → PC). End-to-end latency ~ **80ms**.

<br>
<hr>
<br>

## ‎ ‎ ‎ ✨ Features

<br>

<div align="center">

| | |
|---|---|
| 📱 **Zero install** on phone | Just Chrome — no app store needed |
| 🔒 **Local network only** | No cloud, no data leaves your home |
| ⚡ **~80ms latency** | WebCodecs AudioEncoder skips container overhead |
| 🔊 **Opus 32kbps** | Optimized for speech, efficient bandwidth |
| 🔌 **VB-Cable output** | System-level virtual microphone device |
| 📦 **Single .exe** | Packaged via pkg, FFmpeg bundled alongside |
| 🖥️ **Windows 10/11** | Android phone & iPad supported |
| 🌐 **QR connect** | *(coming soon)* |

</div>

<br>
<hr>
<br>

## ‎ ‎ ‎ 🚀 Quick Start

<br>

### Prerequisites

```bash
# Install system dependencies (Windows)
winget install ffmpeg
winget install OpenSSL.Light
```

Also required: [VB-Cable](https://vb-audio.com/Cable/) (virtual audio driver) and [Chrome](https://www.google.com/chrome/) on both PC and phone. Both devices on the same WiFi.

### Run

```bash
git clone https://github.com/darkLordIceCream/darkmic.git
cd darkmic
pnpm install
pnpm run dev
```

The terminal shows your LAN IPs:

```
  ➜  Phone: open https://192.168.1.100:3000 in Chrome
```

### Connect

<table>
<tr>
<td>①</td>
<td>Open the URL on <b>phone's Chrome</b></td>
</tr>
<tr>
<td>②</td>
<td>Tap <b>Advanced → Proceed</b> (self-signed cert — <a href="#why-self-signed">expected</a>)</td>
</tr>
<tr>
<td>③</td>
<td>Tap <b>"Start Microphone"</b> → allow mic permission</td>
</tr>
<tr>
<td>④</td>
<td>Speak — audio streams to your PC in real time</td>
</tr>
</table>

<br>
<hr>
<br>

## ‎ ‎ ‎ 🏗️ Architecture

<br>

### Tech Stack

| Layer | Technology |
|:---|---|
| Server runtime | Node.js + TypeScript |
| HTTP | Express |
| WebSocket | ws |
| Audio encode (browser) | WebCodecs `AudioEncoder` (opus) |
| Audio decode (server) | opusscript (pure JS) |
| Audio output | WinMM waveOut (koffi FFI) |
| Packaging | `@yao-pkg/pkg` |

### Project Layout

```
darkmic/
├── src/                    # PC server (TypeScript)
│   ├── index.ts            # HTTPS + WebSocket + Express
│   ├── cert.ts             # Self-signed SSL cert generation
│   ├── audio.ts            # AudioPipe factory (3 modes)
│   └── wasapi.ts           # WinMM waveOut → VB-Cable
├── public/                 # Phone-facing web app
│   ├── index.html          # Phone UI
│   └── client.js           # WebCodecs + WebSocket client
├── scripts/                # Dev utilities
├── AGENTS.md               # AI agent instructions
├── feature_list.json       # Feature tracker
├── progress.md             # Session log
└── init.sh                 # Verification script
```

### Future (optional)

If lower latency is needed, upgrade transport to **WebRTC** (`RTCPeerConnection`). WebSocket becomes signaling only.

<br>
<hr>
<br>

## ‎ ‎ ‎ 🧪 Development

<br>

```bash
# Full verification
./init.sh

# Dev server with hot reload
pnpm run dev

# TypeScript check
pnpm run typecheck

# Build to dist/
pnpm run build

# Package to Windows .exe
pnpm run package
```

<br>
<hr>
<br>

## ‎ ‎ ‎ ✅ Feature Status

<br>

| ID | Feature | | Status |
|:---:|---|---|:---:|
| F-001 | Project scaffold + HTTPS certs | 2026-05-13 | ✅ |
| F-002 | WebCodecs + WebSocket pipeline | 2026-05-13 | ✅ |
| F-003 | opusscript decode → WinMM → VB-Cable | 2026-05-16 | ✅ |
| F-004 | QR code + connection UX | — | 📝 |
| F-005 | Latency tuning + quality controls | — | 📝 |
| F-006 | WebRTC P2P transport | — | ⏸️ |
| F-007 | Windows pkg packaging | — | 📝 |
| F-008 | Installer + system tray | — | 📝 |

<br>
<hr>
<br>

## ‎ ‎ ‎ ❓ FAQ

<br>

<details>
<summary><b>Why does the browser show a privacy warning?</b></summary>
<br>
The server generates a self‑signed SSL certificate on first run. Chrome warns because it isn't signed by a public CA. Your connection is still encrypted — perfectly safe for local network use. Tap <b>Advanced → Proceed</b> to continue.
</details>

<br>

<details>
<summary><b>Can I use Safari or Firefox?</b></summary>
<br>
No. This project targets <b>Chrome only</b> on both phone and PC. It uses WebCodecs <code>AudioEncoder</code> which has full support in Chrome.
</details>

<br>

<details>
<summary><b>Can I use this over the internet?</b></summary>
<br>
No. darkmic is designed for <b>local network only</b> (same WiFi subnet). There is no STUN/TURN, no cloud relay, no NAT traversal.
</details>

<br>
<hr>
<br>

<p align="center">
  <a href="README-zh.md">
    <img src="https://img.shields.io/badge/-简体中文-333?style=flat-square" alt="简体中文">
  </a>
  &nbsp;&nbsp;
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT">
</p>

<p align="center">
  <sub>
    Built for when you need a mic but don't have one.<br>
    © 2026 darkLordIceCream
  </sub>
</p>
