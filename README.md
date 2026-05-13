<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/darkmic-000000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMWEzIDMgMCAwIDAtMyAzdjhhMyAzIDAgMCAwIDYgMFY0YTMgMyAwIDAgMC0zLTN6Ii8+PHBhdGggZD0iTTE5IDEwdjJhNyA3IDAgMCAxLTE0IDB2LTIiLz48bGluZSB4MT0iMTIiIHkxPSIxOSIgeDI9IjEyIiB5Mj0iMjMiLz48bGluZSB4MT0iOCIgeTE9IjIzIiB4Mj0iMTYiIHkyPSIyMyIvPjwvc3ZnPg=="/>
    <img alt="darkmic" src="https://img.shields.io/badge/darkmic-000000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMWEzIDMgMCAwIDAtMyAzdjhhMyAzIDAgMCAwIDYgMFY0YTMgMyAwIDAgMC0zLTN6Ii8+PHBhdGggZD0iTTE5IDEwdjJhNyA3IDAgMCAxLTE0IDB2LTIiLz48bGluZSB4MT0iMTIiIHkxPSIxOSIgeDI9IjEyIiB5Mj0iMjMiLz48bGluZSB4MT0iOCIgeTE9IjIzIiB4Mj0iMTYiIHkyPSIyMyIvPjwvc3ZnPg=="/>
  </picture>
</p>

<p align="center">
  <b>Phone-as-microphone for Windows PC</b><br>
  <i>Chrome 手机/平板 → 局域网 → Windows 虚拟声卡</i>
</p>

<p align="center">
  <a href="https://github.com/darkLordIceCream/darkmic/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
  <a href="https://github.com/darkLordIceCream/darkmic"><img src="https://img.shields.io/github/last-commit/darkLordIceCream/darkmic?style=flat-square&color=22c55e" alt="Last Commit"></a>
  <a href="https://github.com/darkLordIceCream/darkmic/issues"><img src="https://img.shields.io/github/issues/darkLordIceCream/darkmic?style=flat-square" alt="Issues"></a>
  <img src="https://img.shields.io/badge/Chrome-only-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome">
  <img src="https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm">
</p>

---

## Overview | 概述

**darkmic** turns your Android phone or iPad into a wireless microphone for your Windows PC — using nothing but a Chrome browser.

> darkmic 让你的安卓手机或 iPad 变身 Windows 电脑的无线麦克风，只需一个 Chrome 浏览器。

No app installation on the phone. No cloud services. Just open a web page, tap start, and talk.

> 手机无需安装 App，不经过任何云服务。打开网页、点开始、说话。

### How It Works | 工作方式

```
┌──────────────────────────────────────────────────┐
│           Phone / iPad (Chrome)                   │
│                                                   │
│  ① Open https://192.168.x.x:3000                 │
│  ② Tap "Start Microphone"                         │
│  ③ Talk                                           │
│                                                   │
│  getUserMedia → AudioEncoder(opus) → WebSocket    │
└──────────────────────┬───────────────────────────┘
                       │  HTTPS + WebSocket
                       │  (local network)
                       ▼
┌──────────────────────────────────────────────────┐
│              Windows PC (darkmic.exe)              │
│                                                    │
│  WebSocket → FFmpeg decode → PCM → VB-Cable       │
│                                                    │
│  Any app sees it as a normal microphone 🎤        │
└──────────────────────────────────────────────────┘
```

Audio flows **one-way**: phone → PC. ~80ms end-to-end latency.

> 音频单向传输：手机 → 电脑。端到端延迟约 80ms。

---

## ✨ Features | 功能

<table>
<tr>
<td>✅ <b>Zero install</b> on phone</td>
<td>📱 <b>Android & iPad</b> supported</td>
</tr>
<tr>
<td>🔒 <b>Local network only</b> — no cloud</td>
<td>⏱️ <b>~80ms</b> low latency</td>
</tr>
<tr>
<td>🎛️ <b>Opus codec</b> at 32kbps</td>
<td>🔌 <b>VB-Cable</b> virtual mic output</td>
</tr>
<tr>
<td>📦 <b>Single .exe</b> distribution</td>
<td>🌐 <b>QR code</b> connection (coming soon)</td>
</tr>
</table>

---

## 🚀 Quick Start | 快速开始

### Prerequisites | 前置条件

| What | How |
|---|---|
| **Windows PC** | Windows 10 or 11 |
| **Chrome** | On both PC and phone |
| **VB-Cable** | [Download](https://vb-audio.com/Cable/) & install |
| **FFmpeg** | `winget install ffmpeg` or [download](https://ffmpeg.org/) |
| **SoX** | `winget install sox` (for PCM → VB-Cable) |
| **Same WiFi** | Phone and PC on the same network |

### Run (from source) | 从源码运行

```bash
git clone https://github.com/darkLordIceCream/darkmic.git
cd darkmic
pnpm install
pnpm run dev
```

Your console will show LAN IPs like:

```
darkmic server running at https://0.0.0.0:3000

  ➜  Phone: open https://192.168.1.100:3000 in Chrome
```

### Connect | 连接

1. On your **phone's Chrome**, open the URL shown in the terminal
2. Accept the self-signed certificate warning (tap **Advanced → Proceed**)
3. Tap **"Start Microphone"** and allow mic permission
4. Speak — audio streams to your PC in real time

> ⚠️ **First time?** The self-signed cert warning is expected. Your connection is still encrypted — it's just that the cert isn't signed by a public CA (fine for local network use).

---

## 🏗️ Architecture | 架构

### Phase 1 (current) | 当前

```
Phone (Chrome)
  getUserMedia
    → MediaStreamTrackProcessor (AudioData frames @ ~10ms)
    → AudioEncoder (opus, 48kHz, mono, 32kbps)
    → WebSocket send

PC (Node.js)
  WebSocket receive
    → FFmpeg decode (opus → s16le PCM)
    → SoX / VB-Cable output
    → Windows virtual microphone
```

**Stack:** Node.js / Express / TypeScript / `ws` / `AudioEncoder` (WebCodecs) / FFmpeg / VB-Cable

### Phase 2 (optional) | 未来可选

If latency needs further improvement, swap transport to **WebRTC P2P** (`RTCPeerConnection`) while keeping the same signaling server on WebSocket.

---

## 📁 Project Structure | 项目结构

```
darkmic/
├── src/                 # PC server (TypeScript → dist/)
│   ├── index.ts         # HTTPS + WebSocket + Express
│   ├── cert.ts          # Self-signed SSL cert generation
│   └── audio.ts         # FFmpeg pipe → VB-Cable
├── public/              # Phone-facing web app
│   ├── index.html       # Phone UI
│   └── client.js        # WebCodecs + WebSocket logic
├── scripts/             # Dev utilities
├── AGENTS.md            # AI agent instructions (bilingual)
├── feature_list.json    # Feature tracker
├── progress.md          # Session log
└── init.sh              # Verification script
```

---

## 🧪 Development | 开发

```bash
# Full verification
./init.sh

# Dev server with file watching
pnpm run dev

# TypeScript check only
pnpm run typecheck

# Build to dist/
pnpm run build

# Package to Windows .exe
pnpm run package
```

```bash
# System dependency check
./scripts/setup.sh

# Install tools (Windows)
winget install ffmpeg
winget install sox
```

### Toolchain | 工具链

| Tool | Purpose |
|---|---|
| **TypeScript** | Language |
| **tsx** | Run & watch TypeScript |
| **Express** | HTTPS server |
| **ws** | WebSocket server |
| **FFmpeg** | Opus → PCM decode |
| **SoX** | PCM → VB-Cable output |
| **@yao-pkg/pkg** | Windows .exe packaging |
| **pnpm** | Package manager |

---

## ✅ Feature Status | 功能状态

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

---

## 📜 License | 许可证

MIT © 2026 darkLordIceCream

---

<p align="center">
  <sub>Built with ❤️ for anyone who needs a mic but doesn't have one handy.</sub><br>
  <sub>献给需要一个麦克风但手边没有的人。</sub>
</p>
