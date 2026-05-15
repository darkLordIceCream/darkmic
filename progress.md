# Session Progress Log | 会话进度日志

## Current State | 当前状态

**Last Updated | 最后更新:** 2026-05-16
**Session | 会话:** Harness assessment + cert hotfix + end-of-session cleanup
**Active Feature | 当前功能:** F-003 (in-progress | 进行中)

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
- [x] **F-002: WebSocket server + phone client | WebSocket 服务端 + 手机客户端**
  - public/client.js: getUserMedia → MediaStreamTrackProcessor → AudioEncoder (opus) → ws.send
  - public/index.html: Start/Stop button, status, stats display
  - src/index.ts: chunk logging with seq + byte count, disconnect summary
  - E2E test: 5 binary chunks → server logged #1-5 with correct byte totals
- [x] **F-003 (Phase 1-2): Audio pipe + ffplay playback | 音频管线 + ffplay 播放**
  - `src/audio.ts`: AudioPipe with 3 modes (file / ffplay / wasapi) | 三种输出模式
  - `src/index.ts`: AudioPipe integrated into WebSocket handler, configurable via `AUDIO_PIPE_MODE` env var | 集成到 WebSocket
  - `scripts/test-audio.ts`: Manual test script for all modes | 手动测试脚本
  - `scripts/gen-sine-test.ts`: Sine wave generator for E2E audio pipeline test | 正弦波生成器
  - Decoding strategy: `opusscript` (pure JS) decode opus → PCM in-process | 使用 opusscript 纯 JS 解码
  - **File mode verified**: 100 opus frames → 800 bytes on disk | 文件模式已验证
  - **ffplay mode verified**: 440Hz sine wave encoded → decoded → played through speakers | ffplay 扬声器播放已验证

### What's In Progress | 进行中

- [ ] **F-003 (Phase 3-4): VB-Cable + production hardening | VB-Cable 输出 + 生产化**
  - WASAPI mode implemented but not verified (requires Windows + VB-Cable driver) | WASAPI 模式已实现但未验证
  - Auto-restart, error handling not yet implemented | 自动重启/错误处理未实现

### What's Next | 下一步

1. **F-003 Phase 3**: VB-Cable WASAPI output — test on Windows with VB-Cable installed | 在装有 VB-Cable 的 Windows 上验证
2. **F-003 Phase 4**: Production hardening — FFmpeg auto-restart, connection state feedback | 生产化加固
3. **F-004**: Connection UX + QR code + error handling | 连接体验

## Blockers / Risks | 阻塞项 / 风险

- **Git push blocked**: HTTPS credentials unavailable in WSL. `b171313` committed locally, needs `git push` from Windows (PowerShell) with stored GitHub credentials. | Git 推送在 WSL 中因凭据问题受阻，需在 Windows 端推送
- **FFmpeg Gyan build lacks audio output devices**: `-devices` shows only input devices (dshow, openal). Cannot use FFmpeg for direct audio playback. Mitigation: use ffplay for output. | FFmpeg Gyan 构建版没有音频输出设备，用 ffplay 替代
- **No raw opus demuxer in FFmpeg**: `-f opus` not available. Mitigation: decode opus in Node.js via opusscript, pipe PCM to ffplay/FFmpeg. | FFmpeg 无 raw opus 解析器，改用 Node.js 解码
- **opusscript decoder fidelity**: Pure JS decode may have edge cases with non-standard frame sizes. Test with real phone audio needed. | 纯 JS 解码器在非标准帧大小时可能有边缘情况
- **VB-Cable not installed on dev machine**: Phase 3 (wasapi mode) cannot be verified locally. | 开发机未安装 VB-Cable

## Decisions Made | 已做决策

- **Transport: WebCodecs AudioEncoder + WebSocket**: Lower latency than MediaRecorder (~80ms vs ~150ms). WebRTC deferred to F-006.
  > Phase 1 采用 WebCodecs AudioEncoder + WebSocket
- **Decoding strategy: opusscript (pure JS) → PCM → ffplay**: Instead of FFmpeg raw opus demuxer (not available in Gyan build) or @discordjs/opus (needs native compilation). Pure JS avoids Python/C++ build toolchain dependency.
  > 解码方案：opusscript 纯 JS 解码，避免原生编译依赖
- **Node.js retained vs Rust**: Node.js is sufficient for I/O-bound audio pipeline.
- **Windows-first (VB-Cable)**: macOS not supported.
- **packaging via pkg**: Standalone .exe via @yao-pkg/pkg.
- **Chrome-only**: No cross-browser testing.
- **No TURN/STUN**: Local network only.
- **pnpm**: Package manager.

## Files Modified This Session | 本次修改的文件

- `AGENTS.md` — Merged CLAUDE.md content: CLAUDE.md replacement note, source code architecture section, fix Phase 1 diagram (FFmpeg→opusscript), add test:audio commands, add Key Implementation Notes | 合并 CLAUDE.md 内容
- `init.sh` — Remove 2>/dev/null error suppression (typecheck/build now fatal), add test:audio step, fix CRLF → LF | 去掉静默吞错
- `feature_list.json` — Fix F-003 evidence date 2025→2026 | 日期修正
- `progress.md` — Fix date, session tracking update | 日期修正
- `README.md` / `README-zh.md` — Add openssl to prerequisites | 前置条件新增 openssl
- `.gitignore` — Add `*.log` | 忽略日志文件
- `.gitattributes` — New: `* text=auto` + `*.sh text eol=lf` | 换行符规范化
- `src/cert.ts` — Reverted to openssl-only (simple version) after brief Node.js crypto experiment | 回退到纯 openssl 版本

## Evidence of Completion | 完成证据

- [x] `pnpm run typecheck` — clean | 类型检查通过
- [x] `pnpm run build` — clean | 构建通过
- [x] `./init.sh` — typecheck + build pass, audio skipped (WSL) | 验证通过
- [x] File mode test: 100 synthetic opus frames → 800 bytes output | 文件模式验证通过
- [x] ffplay mode test: 440Hz sine wave → opus encode → opusscript decode → ffplay speaker playback (6552 bytes processed) | 扬声器播放验证通过
- [x] `openssl` dependency documented in README prerequisites | OpenSSL 依赖已文档化
- [ ] E2E phone → PC audio: requires real phone + Windows with VB-Cable | 手机端到端验证待完成
- [ ] WASAPI VB-Cable output: requires VB-Cable driver | VB-Cable 验证待完成
- [ ] Push to remote: HTTPS auth blocked in WSL | 推送到远端受阻

## Notes for Next Session | 下次会话备注

- **Push first**: Run `git push` from Windows PowerShell (not WSL) to push commit `b171313` | 下次先推送
- **F-003 Phase 3**: Start server with `$env:AUDIO_PIPE_MODE="wasapi"`, connect phone on Windows with VB-Cable
- **F-003 Phase 4**: Add FFmpeg process restart on crash, connection state feedback to phone UI
- **Branch**: `feat/f-003-audio-decode` (NOT merged to main)
- **Windows prerequisites**: `winget install ffmpeg sox OpenSSL.Light` + [VB-Cable](https://vb-audio.com/Cable/)
