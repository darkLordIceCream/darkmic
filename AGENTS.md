# AGENTS.md — darkmic

This file provides guidance to Claude Code (claude.ai/code) and other AI coding agents. It replaces the usual CLAUDE.md.

> 本文档为 AI 编码代理（Claude Code 等）提供项目指导，替代通常的 CLAUDE.md。

Phone-as-microphone for PC via Chromium-based browser. Mobile device captures mic audio via `getUserMedia` → streams over local network → PC receives and pipes to virtual audio device (VB-Cable).

> 手机做电脑麦克风。移动设备 Chromium 内核浏览器采集麦克风音频 → 局域网传输 → Windows 电脑接收并输出到虚拟声卡 (VB-Cable)。

## Architecture | 架构

### How it works — 工作方式

PC runs a Node.js server (the "app"). Mobile device opens the server's page in a Chromium-based browser. Audio flows one-way: mobile → PC.

> PC 运行 Node.js 服务端（即"应用本身"），移动设备用 Chromium 内核浏览器打开服务器页面，音频单向从手机流到电脑。

```
Mobile device (Chromium)               Windows PC (darkmic.exe)
┌──────────────────────┐            ┌──────────────────────────────┐
│ /phone                │   HTTPS   │  Node.js Server              │
│ getUserMedia          │  ◄────── │  → /      → pc.html (仪表盘)   │
│ → MediaStreamTrack    │           │  → /phone → index.html (手机端) │
│ → AudioEncoder(Opus)  │   WS      │  → WebSocket 接收编码数据      │
│ → ws.send(chunk)      │  ───────► │  → opusscript 解码 Opus → PCM │
│                        │           │  → WinMM waveOut → VB-Cable  │
└──────────────────────┘            └──────────────────────────────┘
                                            ↑
                                     PC 浏览器打开 / 看仪表盘
                                     二维码 · 状态 · 指标 · 日志
```

### Phase 1 (current): WebCodecs AudioEncoder + WebSocket

Phone uses `AudioEncoder` (WebCodecs API) to encode raw PCM → Opus at ~10ms granularity, with AGC (`DynamicsCompressorNode`) and adaptive bitrate (32↔64kbps based on measured latency). Server decodes Opus → PCM via `opusscript` (pure JS), then pipes PCM via WinMM waveOut API to VB-Cable virtual audio device. ~80ms end-to-end latency.

> Phase 1 使用 WebCodecs AudioEncoder 编码，带 AGC 自动增益和自适应码率（根据实测延迟自动切换 32↔64kbps）。服务端通过 opusscript 纯 JS 解码，经 WinMM waveOut API 输出到 VB-Cable 虚拟声卡，延迟约 80ms。

```
Phone:   getUserMedia → AGC (DynamicsCompressorNode) → AudioEncoder(Opus, adaptive bitrate) → WebSocket
PC:      WebSocket → opusscript decode → PCM → WinMM waveOut → VB-Cable
Dashboard: / → pc.html (QR code, 4 metrics incl. latency, event log)
```

### Phase 2 (future): WebRTC P2P (if latency requires)

Same server infrastructure, swap transport: `RTCPeerConnection` instead of `AudioEncoder` chunks. Signaling stays on the same WebSocket.

## Source Code | 源代码

```
public/               → Web app pages (served by Express)
  pc.html               PC dashboard: QR code, 4 real-time metrics (throughput/chunks/uptime/latency),
                         status badge, event log panel. Connects to same WebSocket for live updates.
  index.html            Phone UI: start/stop button, connection status, stats
  client.js             getUserMedia → AGC (DynamicsCompressorNode) → AudioEncoder(opus) → WebSocket send.
                        Auto-reconnect (exponential backoff 1s→30s, max 10 attempts).
                        Mic permission error handling (NotAllowed, NotFound, NotReadable).
                        Adaptive bitrate (32↔64kbps, debounced 5s) based on ping/pong latency.
                        Ping every 2s → server pong → RTT/2 displayed as one-way ms.

src/                  → PC server (Node.js + TypeScript, ES modules, NodeNext resolution)
  index.ts              HTTPS server (Express) + WebSocket server (ws).
                        Route split: / → pc.html, /phone → index.html.
                        /api/qr → server-side QR SVG generation.
                        WebSocket: broadcast state/stats/latency/url to all clients.
                        Ping/pong relay for latency measurement (server echoes back timestamp).
                        Lazy AudioPipe: created on first binary message (dashboard doesn't trigger it).
                        getLanUrl(): filters virtual adapters by name, prefers private LAN ranges.
                        Auto-open browser on startup (windowsHide: true).
  cert.ts               Self-signed X.509 cert via Node.js crypto. Cached in certs/ (gitignored).
  audio.ts              AudioPipe factory with 3 modes (controlled by AUDIO_PIPE_MODE env var):
                          file   — writes framed raw opus to disk (default, safe)
                          ffplay — opusscript decode → PCM → ffplay stdin (speaker playback)
                          wasapi — opusscript decode → PCM → WinMM waveOut → VB-Cable (Windows only)
  wasapi.ts             WinMM waveOut API via koffi (pure JS FFI). Device enumeration with truncated
                         name matching (31-char WinMM limit). Buffer pool (6×4800 bytes).

scripts/              → Dev utilities
  test-audio.ts         Audio pipeline test harness (3 modes)
  gen-sine-test.ts      Sine wave generator for E2E audio test
```

**Decoding strategy | 解码方案**: `opusscript` (pure JS, no native deps) decodes opus → s16le PCM in-process. Output varies by mode: wasapi mode writes PCM via WinMM waveOut API (`koffi` FFI) directly to VB-Cable (no FFmpeg needed); ffplay mode pipes PCM to ffplay stdin (speakers); file mode saves framed raw opus to disk for debugging. This avoids FFmpeg's missing raw opus demuxer and WASAPI muxer in Gyan/BtbN Windows builds.

**Data flow | 数据流**: Browser `AudioEncoder` produces variable-length raw opus packets (no container) → WebSocket binary frames → `AudioPipe.write()` → opusscript decode to PCM → output via WinMM waveOut (VB-Cable) or ffplay stdin (speakers) or file.

## Packaging | 打包

The server is compiled into a single Windows `.exe` via `@yao-pkg/pkg` (bundles Node.js runtime + code). Zero external dependencies — certs via Node.js `crypto`, audio via WinMM. `public/` placed alongside the exe. User double-clicks `darkmic.exe` to start.

> 服务端通过 `@yao-pkg/pkg` 打包为单个 Windows exe（内置 Node.js 运行时）。零外部依赖 — 证书通过 Node.js crypto 生成，音频通过 WinMM 输出。public/ 放在 exe 旁边。用户双击 exe 启动。

```
darkmic/
├── darkmic.exe         # pkg-compiled server (self-contained)
├── public/             # web assets (served by Express)
│   ├── pc.html           PC dashboard — QR, metrics, event log, VB-Cable warning
│   ├── index.html        Phone UI — start/stop, stats, status
│   └── client.js         WebCodecs AudioEncoder + WebSocket + AGC + auto-reconnect
├── certs/              # generated on first run (self-signed via crypto)
└── config.json         # port, quality, etc. (optional)
```

## Constraints | 约束

- **Chromium-based browsers only** (Chrome, Edge, Brave, Opera, etc.) on both mobile and PC. No Firefox/Safari. | 仅支持 Chromium 内核浏览器（Chrome/Edge/Brave/Opera 等），不支持 Firefox/Safari
- **Local network only** — same subnet, no STUN/TURN. | 仅局域网，不处理 NAT 穿透
- **HTTPS required** — self-signed certs auto-generated via Node.js crypto. | 必须 HTTPS，自签名证书通过 Node.js crypto 自动生成
- **Windows + VB-Cable**. macOS not supported. | Windows 平台 + VB-Cable 虚拟声卡，不支持 macOS
- **FFmpeg not required** for default wasapi mode (WinMM handles output). ffplay mode and test scripts still need ffmpeg on PATH. | wasapi 模式不需要 FFmpeg（WinMM 直接输出），ffplay 模式和测试脚本需要

## Startup Workflow | 启动流程

Before writing code — 开始编码前：

1. **Read this file** completely | 完整阅读本文档
2. **Run `./init.sh`** to verify environment is healthy | 运行 `./init.sh` 验证环境
3. **Read `feature_list.json`** for current feature state | 阅读功能列表确认当前状态
4. **Review recent commits** with `git log --oneline -5` | 查看最近提交

If baseline verification fails, repair it first before adding new scope.
> 如果基础验证失败，先修好再开始新功能。

## Working Rules | 工作规则

- **One feature at a time** — pick exactly one unfinished feature from `feature_list.json`
  > 一次只做一个功能，从 feature_list.json 中挑选一个未完成的
- **Chromium-only** — don't add polyfills or cross-browser workarounds unless explicitly requested
  > 仅支持 Chromium 内核浏览器，除非明确要求否则不添加 polyfill
- **No backend streaming infrastructure** — no TURN/STUN servers, no cloud relay, no SFU
  > 不使用任何后端流媒体基础设施（TURN/STUN/云中继/SFU）
- **Verification required** — don't claim done without running verification
  > 必须验证才能标记完成
- **Update artifacts** — update `progress.md` and `feature_list.json` before ending session
  > 结束会话前更新进度和功能列表
- **Leave clean state** — next session must be able to run `./init.sh` immediately
  > 保持仓库状态干净，下次会话可直接运行 ./init.sh

## Required Artifacts | 必需文件

- `feature_list.json` — Feature state tracker (source of truth) | 功能状态追踪（事实来源）
- `progress.md` — Session continuity log | 会话连续性日志
- `init.sh` — Standard startup and verification path | 标准启动和验证脚本

## Definition of Done | 完成定义

A feature is done only when ALL of the following are true:
> 功能完成必须满足以下所有条件：

- [ ] Target behavior is implemented | 目标行为已实现
- [ ] Required verification actually ran (type-check / lint / audio pipeline test) | 验证已运行通过
- [ ] Evidence recorded in `feature_list.json` or `progress.md` | 证据已记录
- [ ] Repository remains restartable from standard startup path | 仓库可从标准路径重新启动

## End of Session | 结束会话

1. Update `progress.md` with current state | 更新进度
2. Update `feature_list.json` with new feature status | 更新功能状态
3. Record unresolved blockers/risks | 记录未解决的阻塞项和风险
4. Commit with descriptive message | 提交并写好描述
5. Leave repo clean for `./init.sh` | 保持仓库可重新启动

## Developer Commands | 开发命令

```bash
./init.sh              # Full verification: install + type-check + build | 完整验证
pnpm run dev           # Start dev server with file watching | 启动开发服务器（热重载）
pnpm run typecheck     # TypeScript type check only | 仅做类型检查
pnpm run build         # Compile TypeScript to dist/ | 编译 TypeScript 到 dist/
pnpm run start         # Start production server (node dist/index.js) | 启动生产服务器
pnpm run pkg           # Build standalone .exe (requires prior build) | 打包为 exe
pnpm run package       # Full release: build + pkg → release/ folder | 完整发布
pnpm test:audio        # Audio pipe test (file mode → ./test-output.raw) | 音频管线测试
pnpm test:audio -- ffplay   # Audio test with speaker playback | 音频测试+扬声器播放
pnpm test:audio -- wasapi   # Audio test with VB-Cable output (Windows only) | VB-Cable 输出
```

> 注意：使用 `pnpm` 而非 npm。

## Key Implementation Notes | 关键实现备注

- The opusscript decoder (48kHz, mono) is instantiated once per WebSocket connection. Malformed opus packets are silently dropped.
- `AudioPipe` is created lazily on the first binary WebSocket message (dashboard connections don't trigger it). Maintained per-connection via `ensureAudioPipe()`.
- `AudioPipe.close()`: wasapi mode calls `waveOutReset` + `waveOutClose` after 500ms delay; ffplay mode sends SIGTERM after 300ms delay; file mode calls `stream.end()` immediately. All modes call `decoder.delete()` after output cleanup.
- Certificates auto-generated to `certs/` (gitignored) via Node.js `crypto` on first run. No external deps. Path resolved via `appRoot()` which detects pkg via `/snapshot/` in `import.meta.url`.
- The server binds `0.0.0.0` so mobile devices on the same LAN can reach it. Port defaults to 3000 (`PORT` env var).
- `getLanUrl()` filters virtual adapters by name regex, prefers private LAN IPs (192.168/10/172.16-31), falls back to any non-internal address.
- `broadcast()` sends JSON messages (state/stats/url) to ALL connected WebSocket clients — both dashboard and phone receive updates.

## Escalation | 升级处理

- **Architecture decisions** — ask user before diverging from plan | 架构变更先询问用户
- **Cross-browser issues** — skip: Chromium-only project | 跨浏览器问题跳过
- **Repeat failures** — log in progress.md, flag for review | 反复失败记录到 progress.md，标记待审查
