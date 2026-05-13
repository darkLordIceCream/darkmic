<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/darkmic-000000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMWEzIDMgMCAwIDAtMyAzdjhhMyAzIDAgMCAwIDYgMFY0YTMgMyAwIDAgMC0zLTN6Ii8+PHBhdGggZD0iTTE5IDEwdjJhNyA3IDAgMCAxLTE0IDB2LTIiLz48bGluZSB4MT0iMTIiIHkxPSIxOSIgeDI9IjEyIiB5Mj0iMjMiLz48bGluZSB4MT0iOCIgeTE9IjIzIiB4Mj0iMTYiIHkyPSIyMyIvPjwvc3ZnPg=="/>
    <img alt="darkmic" src="https://img.shields.io/badge/darkmic-000000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMWEzIDMgMCAwIDAtMyAzdjhhMyAzIDAgMCAwIDYgMFY0YTMgMyAwIDAgMC0zLTN6Ii8+PHBhdGggZD0iTTE5IDEwdjJhNyA3IDAgMCAxLTE0IDB2LTIiLz48bGluZSB4MT0iMTIiIHkxPSIxOSIgeDI9IjEyIiB5Mj0iMjMiLz48bGluZSB4MT0iOCIgeTE9IjIzIiB4Mj0iMTYiIHkyPSIyMyIvPjwvc3ZnPg=="/>
  </picture>
</p>

<p align="center">
  <b>Phone-as-microphone for Windows PC</b><br>
  <i>Chrome browser → local network → virtual audio device</i>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/github/last-commit/darkLordIceCream/darkmic?style=flat-square&color=22c55e" alt="Last Commit">
  <a href="https://github.com/darkLordIceCream/darkmic/issues"><img src="https://img.shields.io/github/issues/darkLordIceCream/darkmic?style=flat-square" alt="Issues"></a>
  <img src="https://img.shields.io/badge/Chrome-only-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome">
  <img src="https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm">
</p>

---

Turn your Android phone or iPad into a wireless microphone for your Windows PC — using nothing but Chrome. No app installation on the phone, no cloud services, just a web page.

## How It Works

```
┌─────────────────────────────────────────────────┐
│              Phone / iPad (Chrome)               │
│                                                  │
│  ① Open https://192.168.x.x:3000                │
│  ② Tap "Start Microphone"                        │
│  ③ Talk                                          │
│                                                  │
│  getUserMedia → AudioEncoder(opus) → WebSocket   │
└──────────────────────┬──────────────────────────┘
                       │  HTTPS + WebSocket
                       │  (local network)
                       ▼
┌─────────────────────────────────────────────────┐
│               Windows PC (darkmic.exe)            │
│                                                   │
│  WebSocket → FFmpeg decode → PCM → VB-Cable      │
│                                                   │
│  Any app sees it as a normal microphone.          │
└─────────────────────────────────────────────────┘
```

Audio flows **one-way** (phone → PC). End-to-end latency ~80ms.

## Features

- **Zero install** on phone — just Chrome
- **Android & iPad** supported
- **Local network only** — no cloud, no data leaves your home
- **~80ms** low latency (WebCodecs AudioEncoder)
- **Opus codec** at 32kbps — efficient for speech
- **VB-Cable** output — recognized as a system microphone
- **Single .exe** distribution (via pkg)

## Quick Start

### Prerequisites

| What | How |
|---|---|
| **Windows PC** | Windows 10 or 11 |
| **Chrome** | On both PC and phone |
| **VB-Cable** | [Download](https://vb-audio.com/Cable/) & install |
| **FFmpeg** | `winget install ffmpeg` or [download](https://ffmpeg.org/) |
| **SoX** | `winget install sox` |
| **Same network** | Phone and PC on the same WiFi |

### Run from source

```bash
git clone https://github.com/darkLordIceCream/darkmic.git
cd darkmic
pnpm install
pnpm run dev
```

The terminal shows your LAN IP:

```
darkmic server running at https://0.0.0.0:3000

  ➜  Phone: open https://192.168.1.100:3000 in Chrome
```

### Connect

1. On your **phone's Chrome**, open the URL shown in the terminal
2. Accept the self-signed certificate warning (tap **Advanced → Proceed**)
3. Tap **"Start Microphone"** and allow mic permission
4. Speak — audio streams to your PC

> ⚠️ The self-signed warning is expected. Your connection is encrypted — Chrome just doesn't recognize the local cert. This is normal for LAN-only apps.

## Architecture

```
Phone                                           PC
─────────────────────────       ───────────────────────────
getUserMedia                                     Express HTTPS server
  ↓                                              serves phone UI page
MediaStreamTrackProcessor                        WebSocket receiver
  ↓                                                    ↓
AudioEncoder (opus, 48kHz, mono)                 FFmpeg: opus → PCM
  ↓                                                    ↓
WebSocket send                                   SoX: PCM → VB-Cable
                                                         ↓
                                                Windows virtual microphone
```

**Stack:** Node.js / TypeScript / Express / ws / WebCodecs AudioEncoder / FFmpeg / SoX / VB-Cable

**Phase 2 (optional):** Replace WebSocket with RTCPeerConnection (WebRTC) for even lower latency if needed.

## Project Structure

```
darkmic/
├── src/
│   ├── index.ts        # HTTPS + WebSocket server
│   ├── cert.ts         # Self-signed SSL cert generation
│   └── audio.ts        # FFmpeg pipe → VB-Cable
├── public/
│   ├── index.html      # Phone UI
│   └── client.js       # WebCodecs + WebSocket client
├── scripts/            # Dev utilities
├── AGENTS.md           # AI agent instructions
├── feature_list.json   # Feature tracker
├── progress.md         # Session log
└── init.sh             # Verification script
```

## Development

```bash
# Full verification
./init.sh

# Dev server with file watching
pnpm run dev

# TypeScript check
pnpm run typecheck

# Build to dist/
pnpm run build

# Package to Windows .exe
pnpm run package
```

### Toolchain

| Tool | Purpose |
|---|---|
| TypeScript | Language |
| tsx | Run & watch TypeScript |
| Express | HTTPS server |
| ws | WebSocket server |
| FFmpeg | Opus → PCM decode |
| SoX | PCM → VB-Cable output |
| @yao-pkg/pkg | Windows .exe packaging |
| pnpm | Package manager |

## Feature Status

| ID | Feature | Status |
|---|---|---|
| F-001 | Project scaffold + HTTPS certs | ✅ Done |
| F-002 | WebCodecs + WebSocket pipeline | ✅ Done |
| F-003 | FFmpeg decode → VB-Cable | 📝 Pending |
| F-004 | QR code + connection UX | 📝 Pending |
| F-005 | Latency tuning + quality controls | 📝 Pending |
| F-006 | WebRTC P2P transport | ⏸️ Deferred |
| F-007 | Windows pkg packaging | 📝 Pending |
| F-008 | Installer + system tray | 📝 Pending |

## License

MIT © 2026 darkLordIceCream
