# AGENTS.md — darkmic

Phone-as-microphone for PC via Chrome browser. Phone captures mic audio via `getUserMedia` → streams over local network → PC receives and pipes to virtual audio device (VB-Cable).

> 手机做电脑麦克风。手机/ iPad Chrome 采集麦克风音频 → 局域网传输 → Windows 电脑接收并输出到虚拟声卡 (VB-Cable)。

## Architecture | 架构

### How it works — 工作方式

PC runs a Node.js server (the "app"). Phone opens the server's page in Chrome browser. Audio flows one-way: phone → PC.

> PC 运行 Node.js 服务端（即"应用本身"），手机用 Chrome 浏览器打开服务器页面，音频单向从手机流到电脑。

```
Phone / iPad (Chrome)                 Windows PC (darkmic.exe)
┌─────────────────────┐             ┌────────────────────────────┐
│ 打开服务器页面        │   HTTPS    │  Node.js Server            │
│ getUserMedia         │  ◄─────── │  → 提供手机端页面            │
│ → MediaStreamTrack   │             │  → 提供 PC 状态页 (二维码)   │
│ → AudioEncoder(opus) │   WS       │  → WebSocket 接收编码数据    │
│ → ws.send(chunk)     │  ───────► │  → FFmpeg 解码 opus → PCM   │
│                      │            │  → pipe → VB-Cable 虚拟声卡  │
└─────────────────────┘             └────────────────────────────┘
                                           ↑
                                     PC 浏览器打开
                                   localhost:3000 看状态
```

### Phase 1 (target): WebCodecs AudioEncoder + WebSocket

Phone uses `AudioEncoder` (WebCodecs API) to encode raw PCM → opus at ~10ms granularity, skipping MediaRecorder's container overhead and internal buffering. ~80ms end-to-end latency expected.

> Phase 1 使用 WebCodecs AudioEncoder 编码音频，跳过 MediaRecorder 的容器包装和内部缓冲，延迟约 80ms。

```
Phone:  getUserMedia → MediaStreamTrackProcessor → AudioEncoder(opus) → WebSocket
PC:     WebSocket → FFmpeg (raw opus) → PCM → VB-Cable
```

### Phase 2 (future): WebRTC P2P (if latency requires)

Same server infrastructure, swap transport: `RTCPeerConnection` instead of `AudioEncoder` chunks. Signaling stays on the same WebSocket.

## Packaging | 打包

The server is compiled into a single Windows `.exe` via `pkg` (bundles Node.js runtime + code). FFmpeg is distributed alongside as a separate binary. The user double-clicks `darkmic.exe` or runs a launcher script.

> 服务端通过 `pkg` 打包为单个 Windows exe（内置 Node.js 运行时）。FFmpeg 作为独立二进制文件一同分发。用户双击 exe 即可启动服务。

```
darkmic/
├── darkmic.exe         # pkg-compiled server (self-contained)
├── ffmpeg.exe          # system dep bundled alongside
├── certs/              # generated on first run (self-signed)
└── config.json         # port, quality, etc. (optional)
```

## Constraints | 约束

- **Chrome-only** (Android phone, iPad, Windows PC). No other browser testing needed. | 仅支持 Chrome（安卓手机 / iPad / Windows），不做跨浏览器兼容
- **Local network only** — same subnet, no STUN/TURN. | 仅局域网，不处理 NAT 穿透
- **HTTPS required** — use `mkcert` for local dev certs. | 必须 HTTPS，本地用 `mkcert` 生成证书
- **Windows + VB-Cable**. macOS not supported. | Windows 平台 + VB-Cable 虚拟声卡，不支持 macOS
- **FFmpeg required** — bundled with the packaged app; on dev machine install via `winget install ffmpeg` or `choco install ffmpeg` | FFmpeg 为必需依赖，打包时内置；开发环境需单独安装

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
- **Chrome-only** — don't add polyfills or cross-browser workarounds unless explicitly requested
  > 仅支持 Chrome，除非明确要求否则不添加 polyfill
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
pnpm run package       # Package into Windows .exe via pkg | 打包为 Windows exe
```

> 注意：使用 `pnpm` 而非 npm。如未安装：`brew install pnpm`。
> Windows 打包依赖：`pnpm add -g @yao-pkg/pkg`（或 `npm install -g @yao-pkg/pkg`）。

## Escalation | 升级处理

- **Architecture decisions** — ask user before diverging from plan | 架构变更先询问用户
- **Cross-browser issues** — skip: Chrome-only project | 跨浏览器问题跳过
- **Repeat failures** — log in progress.md, flag for review | 反复失败记录到 progress.md，标记待审查
