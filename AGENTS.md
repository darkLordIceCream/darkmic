# AGENTS.md — darkmic

Phone-as-microphone for PC via Chrome browser. Phone captures mic audio via `getUserMedia` → streams over local network → PC receives and pipes to virtual audio device (BlackHole/VB-Cable).

> 手机做电脑麦克风。手机 Chrome 采集麦克风音频 → 局域网传输 → 电脑接收并输出到虚拟声卡。

## Architecture | 架构

### Phase 1 (target): MediaRecorder + WebSocket

```
Phone (Chrome)                    PC (Node.js)
┌────────────────────┐          ┌──────────────────────────┐
│ GET / → index.html │  HTTPS  │ Express/Koa server        │
│ getUserMedia       │ ◄─────► │ → serves static pages     │
│ → MediaRecorder     │          │ → WebSocket server (ws)  │
│   (opus 20ms)      │  WS     │ → receives opus chunks    │
│ → ws.send(chunk)   │ ──────► │ → FFmpeg decode → PCM    │
│                    │          │ → pipe to virtual mic     │
└────────────────────┘          │   (BlackHole / VB-Cable) │
                                └──────────────────────────┘
```

> Phase 1 使用 MediaRecorder + WebSocket，实现简单可靠。Phase 2（未来）按需切换到 WebRTC P2P 以降低延迟。

### Phase 2 (future): WebRTC P2P (if latency requires)

Same server infrastructure, swap transport: `RTCPeerConnection` instead of `MediaRecorder` chunks. Signaling stays on the same WebSocket.

## Constraints | 约束

- **Chrome-only** (both phone and PC). No other browser testing needed. | 仅支持 Chrome，不做跨浏览器兼容
- **Local network only** — same subnet, no STUN/TURN. | 仅局域网，不处理 NAT 穿透
- **HTTPS required** — use `mkcert` for local dev certs. | 必须 HTTPS，本地用 `mkcert` 生成证书
- **macOS primary** (BlackHole for virtual mic). Windows via VB-Cable if needed. | 优先 macOS + BlackHole

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
pnpm run start         # Start production server | 启动生产服务器
```

> 注意：使用 `pnpm` 而非 npm。如未安装：`brew install pnpm`。

## Escalation | 升级处理

- **Architecture decisions** — ask user before diverging from plan | 架构变更先询问用户
- **Cross-browser issues** — skip: Chrome-only project | 跨浏览器问题跳过
- **Repeat failures** — log in progress.md, flag for review | 反复失败记录到 progress.md，标记待审查
