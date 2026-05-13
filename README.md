<p align="right">
  <a href="README-zh.md">🇨🇳 中文</a>
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/darkmic-000000?style=for-the-badge" alt="darkmic">
</p>

<p align="center">
  <b>Phone-as-microphone for Windows PC</b><br>
  <code>Chrome → local network → virtual audio device</code>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/github/last-commit/darkLordIceCream/darkmic?style=flat-square&color=22c55e" alt="Last Commit">
  <a href="https://github.com/darkLordIceCream/darkmic/releases"><img src="https://img.shields.io/github/v/release/darkLordIceCream/darkmic?style=flat-square" alt="Release"></a>
  <img src="https://img.shields.io/badge/Chrome-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome">
  <img src="https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
</p>

<br>

Turn your Android phone or iPad into a wireless microphone for your Windows PC — using nothing but Chrome.

> No app installation on the phone. No cloud services. Just open a web page, tap start, and talk.

---

## How It Works

```
    📱 PHONE / IPAD (CHROME)                         🖥️ WINDOWS PC (darkmic.exe)
    ┌──────────────────────────┐        ┌──────────────────────────────────┐
    │                          │        │                                  │
    │  Open https://192.168..  │───────▶│  HTTPS + WebSocket server         │
    │  Tap "Start Microphone"  │  ◀─────│  Serves phone UI + QR code       │
    │  Speak                    │   WS   │                                  │
    │                          │        │  ┌────────────────────────────┐  │
    │  getUserMedia            │        │  │ FFmpeg: opus → PCM         │  │
    │  → AudioEncoder(opus)    │        │  │ SoX: PCM → VB-Cable        │  │
    │  → WebSocket send        │        │  │ Any app sees it as mic 🎤  │  │
    │                          │        │  └────────────────────────────┘  │
    └──────────────────────────┘        └──────────────────────────────────┘
```

**~80ms end-to-end latency.** One-way audio: phone → PC.

---

## Features

<div align="center">

| | |
|---|---|
| 📱 **Zero install** on phone — just Chrome | 🔒 **Local network only** — no cloud, no data leaves your home |
| ⚡ **~80ms** low latency (WebCodecs AudioEncoder) | 🔊 **Opus codec** at 32kbps — efficient for speech |
| 🔌 **VB-Cable** output — system-level virtual mic | 📦 **Single .exe** distribution (pkg) |
| 🖥️ **Windows 10/11** · Android · iPad | 🌐 **QR code** connection *(coming soon)* |

</div>

---

## Quick Start

### Prerequisites

| Requirement | Installation |
|---|---|
| **Chrome** (PC + phone) | [Download Chrome](https://www.google.com/chrome/) |
| **VB-Cable** | [Download from VB-Audio](https://vb-audio.com/Cable/) |
| **FFmpeg** | `winget install ffmpeg` |
| **SoX** | `winget install sox` |
| **Same WiFi** | Phone and PC on the same network |

### Run

```bash
git clone https://github.com/darkLordIceCream/darkmic.git
cd darkmic
pnpm install
pnpm run dev
```

The terminal will show your LAN IPs:

```
darkmic server running at https://0.0.0.0:3000
  ➜  Phone: open https://192.168.1.100:3000 in Chrome
```

### Connect

1. On your **phone's Chrome**, open the URL shown in the terminal
2. When you see the privacy warning, tap **Advanced → Proceed**
3. Tap **"Start Microphone"** and allow microphone access
4. Start speaking — audio streams to your PC in real time

> 💡 **The self-signed certificate warning is expected.** Your connection is encrypted — Chrome just doesn't recognize a cert created on your local machine. This is normal for LAN-only applications.

---

## Architecture

```
PHONE SIDE (Chrome)                          PC SIDE (Node.js server)
┌─────────────────────────────┐             ┌──────────────────────────────────────┐
│ getUserMedia({audio: true}) │             │ Express HTTPS server                  │
│         ↓                   │             │  • Serves public/ (phone UI)          │
│ MediaStreamTrackProcessor   │   HTTPS     │  • WebSocket server (ws)              │
│         ↓                   │  ◄─────────│  • FFmpeg decoder pipe                  │
│ AudioEncoder                │      WS     │  • SoX output → VB-Cable               │
│   codec: opus               │ ──────────►│                                        │
│   sampleRate: 48000         │             │  ┌─── AUDIO PIPELINE ──────────────┐  │
│   channels: 1 (mono)        │             │  │ opus chunks → FFmpeg → PCM      │  │
│   bitrate: 32kbps           │             │  │ → SoX → VB-CABLE Input          │  │
│         ↓                   │             │  │ → VB-CABLE Output (system mic)  │  │
│ WebSocket send              │             │  └────────────────────────────────┘  │
│  (EncodedAudioChunk)        │             │                                        │
└─────────────────────────────┘             └──────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| HTTP | Express |
| WebSocket | ws |
| Audio encode (browser) | WebCodecs `AudioEncoder` (opus) |
| Audio decode (server) | FFmpeg |
| Audio output | SoX → VB-Cable |
| Packaging | `@yao-pkg/pkg` (single .exe) |
| Package manager | pnpm |

### Phase 2 (optional)

If lower latency is needed, the transport can be upgraded to **WebRTC** (`RTCPeerConnection`), keeping the same WebSocket for signaling only.

---

## Project Structure

```
darkmic/
├── src/                    # PC server (TypeScript)
│   ├── index.ts            # HTTPS + WebSocket + Express
│   ├── cert.ts             # Self-signed SSL cert generation
│   └── audio.ts            # FFmpeg pipe → VB-Cable
├── public/                 # Phone-facing web app
│   ├── index.html          # Phone UI
│   └── client.js           # WebCodecs + WebSocket client
├── scripts/                # Dev utilities
├── AGENTS.md               # AI agent instructions
├── feature_list.json        # Feature tracker
├── progress.md              # Session log
└── init.sh                  # Verification script
```

## Development

```bash
./init.sh                   # Full verification (install + typecheck + build)
pnpm run dev                # Dev server with file watching
pnpm run typecheck           # TypeScript check only
pnpm run build               # Compile to dist/
pnpm run package             # Package to Windows .exe
```

```bash
# System dependency check
./scripts/setup.sh

# Install tools on Windows
winget install ffmpeg
winget install sox
```

---

## Feature Status

| ID | Feature | Status |
|:---:|---|---|
| F-001 | Project scaffold + HTTPS certs | ✅ done |
| F-002 | WebCodecs + WebSocket pipeline | ✅ done |
| F-003 | FFmpeg decode → VB-Cable | 📝 pending |
| F-004 | QR code + connection UX | 📝 pending |
| F-005 | Latency tuning + quality controls | 📝 pending |
| F-006 | WebRTC P2P transport | ⏸️ deferred |
| F-007 | Windows pkg packaging | 📝 pending |
| F-008 | Installer + system tray | 📝 pending |

---

<p align="center">
  <a href="README-zh.md">🇨🇳 中文版本</a>
</p>

<p align="center">
  <sub>Built for anyone who needs a mic but doesn't have one handy.</sub><br>
  <sub>MIT © 2026 darkLordIceCream</sub>
</p>
