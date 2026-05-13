<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/darkmic-000000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMWEzIDMgMCAwIDAtMyAzdjhhMyAzIDAgMCAwIDYgMFY0YTMgMyAwIDAgMC0zLTN6Ii8+PHBhdGggZD0iTTE5IDEwdjJhNyA3IDAgMCAxLTE0IDB2LTIiLz48bGluZSB4MT0iMTIiIHkxPSIxOSIgeDI9IjEyIiB5Mj0iMjMiLz48bGluZSB4MT0iOCIgeTE9IjIzIiB4Mj0iMTYiIHkyPSIyMyIvPjwvc3ZnPg=="/>
    <img alt="darkmic" src="https://img.shields.io/badge/darkmic-000000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMWEzIDMgMCAwIDAtMyAzdjhhMyAzIDAgMCAwIDYgMFY0YTMgMyAwIDAgMC0zLTN6Ii8+PHBhdGggZD0iTTE5IDEwdjJhNyA3IDAgMCAxLTE0IDB2LTIiLz48bGluZSB4MT0iMTIiIHkxPSIxOSIgeDI9IjEyIiB5Mj0iMjMiLz48bGluZSB4MT0iOCIgeTE9IjIzIiB4Mj0iMTYiIHkyPSIyMyIvPjwvc3ZnPg=="/>
  </picture>
</p>

<p align="center">
  <b>手机做电脑麦克风</b><br>
  <i>Chrome 浏览器 → 局域网 → Windows 虚拟声卡</i>
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

用安卓手机或 iPad 给你的 Windows 电脑做无线麦克风。只需一个 Chrome 浏览器，手机无需安装 App，不经过任何云服务。

## 工作方式

```
┌─────────────────────────────────────────────────┐
│               手机 / iPad (Chrome)                │
│                                                  │
│  ① 打开 https://192.168.x.x:3000                │
│  ② 点「Start Microphone」                        │
│  ③ 说话                                          │
│                                                  │
│  getUserMedia → AudioEncoder(opus) → WebSocket   │
└──────────────────────┬──────────────────────────┘
                       │  HTTPS + WebSocket
                       │  (局域网)
                       ▼
┌─────────────────────────────────────────────────┐
│                Windows PC (darkmic.exe)           │
│                                                   │
│  WebSocket → FFmpeg 解码 → PCM → VB-Cable        │
│                                                   │
│  任何应用都可以把它当做普通麦克风使用。            │
└─────────────────────────────────────────────────┘
```

音频**单向传输**（手机 → 电脑），端到端延迟约 80ms。

## 功能特点

- **手机零安装** — 只需 Chrome 浏览器
- **支持安卓手机 & iPad**
- **纯局域网** — 不上云，数据不出家门
- **~80ms 低延迟**（WebCodecs AudioEncoder）
- **Opus 编码** 32kbps — 人声优化
- **VB-Cable 输出** — 系统级虚拟麦克风
- **单文件 .exe** 分发（pkg 打包）

## 快速开始

### 前置条件

| 项目 | 说明 |
|---|---|
| **Windows PC** | Windows 10 或 11 |
| **Chrome** | 电脑和手机都安装 |
| **VB-Cable** | [下载](https://vb-audio.com/Cable/) 并安装 |
| **FFmpeg** | `winget install ffmpeg` 或[下载](https://ffmpeg.org/) |
| **SoX** | `winget install sox` |
| **同一网络** | 手机和电脑连同一个 WiFi |

### 从源码运行

```bash
git clone https://github.com/darkLordIceCream/darkmic.git
cd darkmic
pnpm install
pnpm run dev
```

终端会显示局域网 IP：

```
darkmic server running at https://0.0.0.0:3000

  ➜  Phone: open https://192.168.1.100:3000 in Chrome
```

### 连接

1. 手机 Chrome 打开终端显示的网址
2. 接受自签名证书警告（点**高级 → 继续前往**）
3. 点 **"Start Microphone"**，允许麦克风权限
4. 说话 — 音频实时传输到电脑

> ⚠️ 自签名证书警告是正常的。连接仍然是加密的，只是 Chrome 不认识局域网的自签证书而已。

## 架构

```
手机                                          电脑
─────────────────────────       ───────────────────────────
getUserMedia                                     Express HTTPS 服务器
  ↓                                              提供手机页面
MediaStreamTrackProcessor                        WebSocket 接收
  ↓                                                    ↓
AudioEncoder (opus, 48kHz, 单声道)               FFmpeg: opus → PCM
  ↓                                                    ↓
WebSocket 发送                                   SoX: PCM → VB-Cable
                                                         ↓
                                                Windows 虚拟麦克风
```

**技术栈：** Node.js / TypeScript / Express / ws / WebCodecs AudioEncoder / FFmpeg / SoX / VB-Cable

**Phase 2（可选）：** 如果需要更低延迟，可将 WebSocket 替换为 RTCPeerConnection (WebRTC)。

## 项目结构

```
darkmic/
├── src/
│   ├── index.ts        # HTTPS + WebSocket 服务器
│   ├── cert.ts         # 自签名 SSL 证书生成
│   └── audio.ts        # FFmpeg 管线 → VB-Cable
├── public/
│   ├── index.html      # 手机端页面
│   └── client.js       # WebCodecs + WebSocket 客户端
├── scripts/            # 开发工具
├── AGENTS.md           # AI 代理指令（中英双语）
├── feature_list.json   # 功能列表
├── progress.md         # 会话日志
└── init.sh             # 验证脚本
```

## 开发命令

```bash
# 完整验证
./init.sh

# 启动开发服务器（热重载）
pnpm run dev

# 类型检查
pnpm run typecheck

# 编译到 dist/
pnpm run build

# 打包为 Windows exe
pnpm run package
```

### 工具链

| 工具 | 用途 |
|---|---|
| TypeScript | 编程语言 |
| tsx | 运行/监视 TypeScript |
| Express | HTTPS 服务器 |
| ws | WebSocket 服务器 |
| FFmpeg | Opus → PCM 解码 |
| SoX | PCM → VB-Cable 输出 |
| @yao-pkg/pkg | Windows exe 打包 |
| pnpm | 包管理器 |

## 功能状态

| ID | 功能 | 状态 |
|---|---|---|
| F-001 | 项目脚手架 + HTTPS 证书 | ✅ 完成 |
| F-002 | WebCodecs + WebSocket 管线 | ✅ 完成 |
| F-003 | FFmpeg 解码 → VB-Cable | 📝 待做 |
| F-004 | 二维码 + 连接体验 | 📝 待做 |
| F-005 | 延迟调优 + 质量控制 | 📝 待做 |
| F-006 | WebRTC P2P 传输 | ⏸️ 推迟 |
| F-007 | Windows pkg 打包 | 📝 待做 |
| F-008 | 安装程序 + 系统托盘 | 📝 待做 |

## 许可证

MIT © 2026 darkLordIceCream
