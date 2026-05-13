# Session Progress Log | 会话进度日志

## Current State | 当前状态

**Last Updated | 最后更新:** 2026-05-13
**Active Feature | 当前功能:** (none — document update | 无 — 文档更新)

## Status | 状态

### What's Done | 已完成

- [x] AGENTS.md — Project harness with bilingual content | 项目框架（中英双语）
- [x] feature_list.json — 8 features with Chinese descriptions | 8 个功能及中文描述
- [x] init.sh — Verification pipeline | 验证管线
- [x] progress.md — Session tracking | 会话追踪
- [x] Remote repo connected: darkLordIceCream/darkmic (private | 私有)
- [x] **F-001: Project scaffold + HTTPS certs | 项目脚手架 + HTTPS 证书**
  - package.json with deps (express, ws, tsx, typescript, pnpm)
  - tsconfig.json (ES2022, NodeNext)
  - src/index.ts: HTTPS server + WebSocket + Express static
  - src/cert.ts: self-signed cert generation via openssl | 自签名证书
  - src/audio.ts: stub for F-003 | 音频管线桩
  - public/index.html + client.js: phone UI scaffold | 手机 UI 骨架
  - scripts/setup.sh, scripts/dev.sh
  - Verified: pnpm install → typecheck → build → server start + cert gen | 已验证

### What's In Progress | 进行中

- (none | 无)

### What's Next | 下一步

1. **F-002: WebSocket server + phone client | WebSocket 服务端 + 手机客户端**
   - Phone: getUserMedia → MediaStreamTrackProcessor → AudioEncoder (opus) → ws.send
   - Server: receive chunks, log stats | 服务端接收数据块，记录统计
   - Verify encoded opus chunks flow end-to-end | 验证 opus 编码块端到端流通
2. **F-003: Server audio decode → virtual mic** (after F-002)
   - FFmpeg decode raw opus → PCM → VB-Cable

## Blockers / Risks | 阻塞项 / 风险

- (none | 无)

## Decisions Made | 已做决策

- **Transport: WebCodecs AudioEncoder + WebSocket**: Lower latency than MediaRecorder (~80ms vs ~150ms) by skipping WebM container and internal buffering. Uses `AudioEncoder` + `MediaStreamTrackProcessor`. WebRTC deferred to F-006 if latency still insufficient.
  > 传输方案采用 WebCodecs AudioEncoder + WebSocket，延迟 ~80ms，跳过 MediaRecorder 容器包装，WebRTC 推迟到 F-006
- **Node.js retained as server runtime**: After evaluating Rust/Go alternatives, Node.js is the right choice for this I/O-bound audio pipeline. Rust rewrite would increase dev time 3-5x for marginal latency gains. Node.js + pkg packaging is sufficient for distribution.
  > 保持 Node.js，Rust 重写收益有限，对 I/O 密集的音频传输场景不划算
- **Windows-first (VB-Cable)**: Target platform is Windows + VB-Cable virtual audio device. macOS not supported.
  > 目标平台 Windows + VB-Cable 虚拟声卡，不支持 macOS
- **Packaging via pkg**: Server compiled into standalone .exe with @yao-pkg/pkg. FFmpeg bundled alongside. No Node.js needed on target machine.
  > 通过 pkg 打包为独立 exe，FFmpeg 附带，目标机不需要 Node.js
- **Chrome-only**: No cross-browser testing scope | 仅 Chrome，不做跨浏览器
- **No TURN/STUN**: Local network only | 仅局域网，不需要 NAT 穿透
- **Self-signed certs via openssl**: No npm dependency for cert generation | 用 openssl 自签证书，不引入 npm 依赖
- **pnpm**: Use pnpm instead of npm for package management | 使用 pnpm 替代 npm

## Files Modified This Session | 本次修改的文件

- `AGENTS.md` — Bilingual harness | 双语框架
- `feature_list.json` — Chinese descriptions added | 添加了中文描述
- `init.sh` — pnpm + Chinese comments | pnpm + 中文注释
- `progress.md` — Bilingual | 双语
- `package.json` — pnpm config | pnpm 配置
- `tsconfig.json` — TypeScript config | TypeScript 配置
- `src/index.ts` — Server entry | 服务端入口
- `src/cert.ts` — Cert generation | 证书生成
- `src/audio.ts` — Audio pipe stub | 音频管线桩
- `public/index.html` — Phone UI | 手机 UI
- `public/client.js` — Phone client stub | 手机客户端桩
- `scripts/setup.sh` — System deps check | 系统依赖检查
- `scripts/dev.sh` — Dev server launcher | 开发服务器启动
- `.gitignore` — Standard ignores | 标准忽略规则

## Evidence of Completion | 完成证据

- [x] `pnpm run typecheck` — clean | 通过
- [x] `pnpm run build` — clean | 通过
- [x] `./init.sh` — full pipeline passes | 完整管线通过
- [x] Server starts, certs generated, HTTPS listening | 服务器启动，证书生成，HTTPS 正常监听

## Notes for Next Session | 下次会话备注

- Start F-002: phone-side WebCodecs AudioEncoder + WebSocket send loop | 开始 F-002：手机端 WebCodecs 编码 + WebSocket 发送
- Verify encoded opus chunks arrive on server | 通过控制台日志验证 opus 编码块到达
