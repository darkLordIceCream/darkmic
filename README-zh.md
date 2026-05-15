<p align="right">
  <a href="README.md">
    <img src="https://img.shields.io/badge/-English-333?style=flat-square" alt="English">
  </a>
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/darkmic-000?style=flat-square" alt="">
</p>

<h1 align="center">
  <code>手机 → 电脑 · 无线麦克风</code>
</h1>

<p align="center">
  <b>用安卓手机或 iPad 给你的 Windows 电脑做无线麦克风。</b><br>
  <i>只需 Chrome。手机零安装。不上云。</i>
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/github/v/release/darkLordIceCream/darkmic?style=flat-square&label=版本&color=333" alt="">
  <img src="https://img.shields.io/github/last-commit/darkLordIceCream/darkmic?style=flat-square&label=更新&color=22c55e" alt="">
  <img src="https://img.shields.io/github/license/darkLordIceCream/darkmic?style=flat-square&label=许可&color=blue" alt="">
  <br>
  <img src="https://img.shields.io/badge/-Chrome-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="">
  <img src="https://img.shields.io/badge/-Windows-0078D4?style=flat-square&logo=windows&logoColor=white" alt="">
  <img src="https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="">
  <img src="https://img.shields.io/badge/-pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="">
</p>

<br>
<hr>
<br>

## ‎ ‎ ‎ ⚡ 工作方式

<br>

```
                        ┌─────────────────────────────────────────────────┐
                        │           📱 手机 / iPad (Chrome)                │
                        │                                                 │
                        │   打开终端显示的网址                              │
                        │   点「Start Microphone」                         │
                        │   开始说话                                       │
                        │                                                 │
                        │   getUserMedia                                   │
                        │     → MediaStreamTrackProcessor                  │
                        │     → AudioEncoder (opus · 48kHz · 单声道)       │
                        │     → WebSocket 发送                             │
                        │                       │                         │
                        └───────────────────────│─────────────────────────┘
                                                │  HTTPS + WebSocket
                                                │  (局域网 · 约 80ms)
                                                │
                        ┌───────────────────────│─────────────────────────┐
                        │                       ▼                         │
                        │          🖥️  Windows PC (darkmic.exe)           │
                        │                                                 │
                        │   WebSocket 接收                                 │
                        │     → opusscript 解码 (opus → PCM)                  │
                        │     → WinMM waveOut → VB-CABLE Input                 │
                        │     → VB-CABLE Output (系统虚拟麦克风)            │
                        │                                                 │
                        │   ✅ 任何应用都可以把它当作普通麦克风              │
                        └─────────────────────────────────────────────────┘
```

> 音频**单向传输**（手机 → 电脑），端到端延迟约 **80ms**。

<br>
<hr>
<br>

## ‎ ‎ ‎ ✨ 功能特点

<br>

<div align="center">

| | |
|---|---|
| 📱 **手机零安装** | 只需 Chrome，不用装 App |
| 🔒 **纯局域网** | 不上云，数据不出家门 |
| ⚡ **~80ms 低延迟** | WebCodecs AudioEncoder，跳过容器包装 |
| 🔊 **Opus 32kbps** | 人声优化，带宽友好 |
| 🔌 **VB-Cable 输出** | 系统级虚拟麦克风 |
| 📦 **单文件 .exe** | pkg 打包，FFmpeg 内置 |
| 🖥️ **Windows 10/11** | 支持安卓手机和 iPad |
| 🌐 **二维码连接** | *(即将到来)* |

</div>

<br>
<hr>
<br>

## ‎ ‎ ‎ 🚀 快速开始

<br>

### 前置条件

```bash
# 安装系统依赖 (Windows)
winget install ffmpeg
winget install OpenSSL.Light
```

还需安装 [VB-Cable](https://vb-audio.com/Cable/)（虚拟声卡驱动）。手机和电脑都装 Chrome，连同一个 WiFi。

### 运行

```bash
git clone https://github.com/darkLordIceCream/darkmic.git
cd darkmic
pnpm install
pnpm run dev
```

终端会显示局域网 IP：

```
  ➜  Phone: open https://192.168.1.100:3000 in Chrome
```

### 连接

<table>
<tr>
<td>①</td>
<td>手机 Chrome 打开终端显示的网址</td>
</tr>
<tr>
<td>②</td>
<td>点<b>高级 → 继续前往</b>（自签名证书 — <a href="#faq">正常现象</a>）</td>
</tr>
<tr>
<td>③</td>
<td>点<b>「Start Microphone」</b> → 允许麦克风权限</td>
</tr>
<tr>
<td>④</td>
<td>说话 — 音频实时传输到电脑</td>
</tr>
</table>

<br>
<hr>
<br>

## ‎ ‎ ‎ 🏗️ 架构

<br>

### 技术栈

| 层 | 技术 |
|:---|---|
| 服务端运行时 | Node.js + TypeScript |
| HTTP | Express |
| WebSocket | ws |
| 音频编码（浏览器） | WebCodecs `AudioEncoder` (opus) |
| 音频解码（服务端） | opusscript (纯 JS) |
| 音频输出 | WinMM waveOut (koffi FFI) |
| 打包 | `@yao-pkg/pkg` |

### 项目结构

```
darkmic/
├── src/                    # PC 服务器 (TypeScript)
│   ├── index.ts            # HTTPS + WebSocket + Express
│   ├── cert.ts             # 自签名 SSL 证书生成
│   ├── audio.ts            # AudioPipe 工厂 (3 种模式)
│   └── wasapi.ts           # WinMM waveOut → VB-Cable
├── public/                 # 手机端页面
│   ├── index.html          # 手机 UI
│   └── client.js           # WebCodecs + WebSocket 客户端
├── scripts/                # 开发工具
├── AGENTS.md               # AI 代理指令（中英双语）
├── feature_list.json       # 功能列表
├── progress.md             # 会话日志
└── init.sh                 # 验证脚本
```

### 未来方向（可选）

如果需要更低延迟，可将传输层升级为 **WebRTC**（`RTCPeerConnection`），WebSocket 仅用于信令。

<br>
<hr>
<br>

## ‎ ‎ ‎ 🧪 开发命令

<br>

```bash
# 完整验证
./init.sh

# 开发服务器（热重载）
pnpm run dev

# TypeScript 类型检查
pnpm run typecheck

# 编译到 dist/
pnpm run build

# 打包为 Windows exe
pnpm run package
```

<br>
<hr>
<br>

## ‎ ‎ ‎ ✅ 功能状态

<br>

| ID | 功能 | | 状态 |
|:---:|---|---|:---:|
| F-001 | 项目脚手架 + HTTPS 证书 | 2026-05-13 | ✅ |
| F-002 | WebCodecs + WebSocket 管线 | 2026-05-13 | ✅ |
| F-003 | opusscript 解码 → WinMM → VB-Cable | 2026-05-16 | ✅ |
| F-004 | 二维码 + 连接体验 | — | 📝 |
| F-005 | 延迟调优 + 质量控制 | — | 📝 |
| F-006 | WebRTC P2P 传输 | — | ⏸️ |
| F-007 | Windows pkg 打包 | — | 📝 |
| F-008 | 安装程序 + 系统托盘 | — | 📝 |

<br>
<hr>
<br>

## ‎ ‎ ‎ ❓ 常见问题

<br>

<details>
<summary><b>为什么浏览器显示隐私警告？</b></summary>
<br>
服务端首次运行会自动生成自签名证书。Chrome 会因为不是正规 CA 签发而警告。连接仍然是加密的，局域网使用完全安全。点<b>高级 → 继续前往</b>即可。
</details>

<br>

<details>
<summary><b>可以用 Safari 或 Firefox 吗？</b></summary>
<br>
不行。本项目<b>仅支持 Chrome</b>，使用了 WebCodecs <code>AudioEncoder</code> API，只有 Chrome 完整支持。
</details>

<br>

<details>
<summary><b>可以跨互联网使用吗？</b></summary>
<br>
不行。darkmic 设计为<b>仅限局域网</b>（同一 WiFi），没有 STUN/TURN、云中继或 NAT 穿透。
</details>

<br>
<hr>
<br>

<p align="center">
  <a href="README.md">
    <img src="https://img.shields.io/badge/-English-333?style=flat-square" alt="English">
  </a>
  &nbsp;&nbsp;
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT">
</p>

<p align="center">
  <sub>
    献给需要一个麦克风但手边没有的人。<br>
    © 2026 darkLordIceCream
  </sub>
</p>
