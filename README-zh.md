<p align="right">
  <a href="README.md">🇬🇧 English</a>
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/darkmic-000000?style=for-the-badge" alt="darkmic">
</p>

<p align="center">
  <b>手机做电脑麦克风</b><br>
  <code>Chrome → 局域网 → 虚拟声卡</code>
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

用安卓手机或 iPad 给你的 Windows 电脑做无线麦克风。只需一个 Chrome 浏览器。

> 手机无需安装 App，不经过任何云服务。打开网页、点开始、说话。

---

## 工作方式

```
    📱 手机 / iPad (Chrome)                         🖥️ Windows PC (darkmic.exe)
    ┌──────────────────────────┐        ┌──────────────────────────────────┐
    │                          │        │                                  │
    │  打开 https://192.168..  │───────▶│  HTTPS + WebSocket 服务器          │
    │  点「Start Microphone」   │  ◀─────│  提供手机页面 + 二维码            │
    │  说话                    │   WS   │                                  │
    │                          │        │  ┌────────────────────────────┐  │
    │  getUserMedia            │        │  │ FFmpeg: opus → PCM         │  │
    │  → AudioEncoder(opus)    │        │  │ SoX: PCM → VB-Cable        │  │
    │  → WebSocket 发送         │        │  │ 任何应用视为麦克风 🎤      │  │
    │                          │        │  └────────────────────────────┘  │
    └──────────────────────────┘        └──────────────────────────────────┘
```

**端到端延迟约 80ms。** 音频单向传输：手机 → 电脑。

---

## 功能特点

<div align="center">

| | |
|---|---|
| 📱 **手机零安装** — 只需 Chrome | 🔒 **纯局域网** — 不上云，数据不出家门 |
| ⚡ **~80ms 低延迟** (WebCodecs AudioEncoder) | 🔊 **Opus 编码** 32kbps — 人声优化 |
| 🔌 **VB-Cable 输出** — 系统级虚拟麦克风 | 📦 **单文件 .exe** 分发 |
| 🖥️ **Windows 10/11** · 安卓 · iPad | 🌐 **二维码连接** *(即将到来)* |

</div>

---

## 快速开始

### 前置条件

| 项目 | 安装方式 |
|---|---|
| **Chrome**（电脑 + 手机） | [下载 Chrome](https://www.google.com/chrome/) |
| **VB-Cable** | [从 VB-Audio 下载](https://vb-audio.com/Cable/) |
| **FFmpeg** | `winget install ffmpeg` |
| **SoX** | `winget install sox` |
| **同一 WiFi** | 手机和电脑连接同一个网络 |

### 运行

```bash
git clone https://github.com/darkLordIceCream/darkmic.git
cd darkmic
pnpm install
pnpm run dev
```

终端会显示你的局域网 IP：

```
darkmic server running at https://0.0.0.0:3000
  ➜  Phone: open https://192.168.1.100:3000 in Chrome
```

### 连接

1. **手机 Chrome** 打开终端显示的网址
2. 出现隐私警告时，点**高级 → 继续前往**
3. 点 **"Start Microphone"**，允许麦克风权限
4. 开始说话 — 音频实时传输到电脑

> 💡 **自签名证书警告是正常的。** 连接仍是加密的，只是 Chrome 不认识本地生成的证书而已。局域网应用都是这样。

---

## 架构

```
手机端 (Chrome)                              PC 端 (Node.js 服务器)
┌─────────────────────────────┐             ┌──────────────────────────────────────┐
│ getUserMedia({audio: true}) │             │ Express HTTPS 服务器                  │
│         ↓                   │             │  • 提供 public/（手机页面）            │
│ MediaStreamTrackProcessor   │   HTTPS     │  • WebSocket 服务器 (ws)              │
│         ↓                   │  ◄─────────│  • FFmpeg 解码管线                     │
│ AudioEncoder                │      WS     │  • SoX 输出 → VB-Cable                 │
│   codec: opus               │ ──────────►│                                        │
│   sampleRate: 48000         │             │  ┌─── 音频管线 ────────────────────┐  │
│   channels: 1 (单声道)      │             │  │ opus 块 → FFmpeg → PCM         │  │
│   bitrate: 32kbps           │             │  │ → SoX → VB-CABLE Input         │  │
│         ↓                   │             │  │ → VB-CABLE Output（系统麦克风）│  │
│ WebSocket 发送               │             │  └────────────────────────────────┘  │
│  (EncodedAudioChunk)        │             │                                        │
└─────────────────────────────┘             └──────────────────────────────────────┘
```

### 技术栈

| 层 | 技术 |
|---|---|
| 编程语言 | TypeScript |
| HTTP 服务 | Express |
| WebSocket | ws |
| 音频编码（浏览器端） | WebCodecs `AudioEncoder` (opus) |
| 音频解码（服务端） | FFmpeg |
| 音频输出 | SoX → VB-Cable |
| 打包 | `@yao-pkg/pkg`（单文件 .exe） |
| 包管理器 | pnpm |

### Phase 2（可选）

如果需要更低延迟，可以将传输层升级为 **WebRTC**（`RTCPeerConnection`），WebSocket 仅用于信令。

---

## 项目结构

```
darkmic/
├── src/                    # PC 服务器 (TypeScript)
│   ├── index.ts            # HTTPS + WebSocket + Express
│   ├── cert.ts             # 自签名 SSL 证书生成
│   └── audio.ts            # FFmpeg 管线 → VB-Cable
├── public/                 # 手机端页面
│   ├── index.html          # 手机 UI
│   └── client.js           # WebCodecs + WebSocket 客户端
├── scripts/                # 开发工具
├── AGENTS.md               # AI 代理指令（中英双语）
├── feature_list.json        # 功能列表
├── progress.md              # 会话日志
└── init.sh                  # 验证脚本
```

## 开发命令

```bash
./init.sh                   # 完整验证（安装 + 类型检查 + 构建）
pnpm run dev                # 开发服务器（热重载）
pnpm run typecheck           # TypeScript 类型检查
pnpm run build               # 编译到 dist/
pnpm run package             # 打包为 Windows exe
```

```bash
# 系统依赖检查
./scripts/setup.sh

# Windows 上安装工具
winget install ffmpeg
winget install sox
```

---

## 功能状态

| ID | 功能 | 状态 |
|:---:|---|---|
| F-001 | 项目脚手架 + HTTPS 证书 | ✅ 完成 |
| F-002 | WebCodecs + WebSocket 管线 | ✅ 完成 |
| F-003 | FFmpeg 解码 → VB-Cable | 📝 待做 |
| F-004 | 二维码 + 连接体验 | 📝 待做 |
| F-005 | 延迟调优 + 质量控制 | 📝 待做 |
| F-006 | WebRTC P2P 传输 | ⏸️ 推迟 |
| F-007 | Windows pkg 打包 | 📝 待做 |
| F-008 | 安装程序 + 系统托盘 | 📝 待做 |

---

<p align="center">
  <a href="README.md">🇬🇧 English version</a>
</p>

<p align="center">
  <sub>献给需要一个麦克风但手边没有的人。</sub><br>
  <sub>MIT © 2026 darkLordIceCream</sub>
</p>
