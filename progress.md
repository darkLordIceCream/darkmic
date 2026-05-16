# Session Progress Log | 会话进度日志

## Current State | 当前状态

**Last Updated | 最后更新:** 2026-05-16
**Session | 会话:** F-004 — Connection UX + QR code + PC management page
**Active Feature | 当前功能:** F-004 in-progress | F-004 进行中
**Branch | 分支:** `feat/f-004-connection-ux`

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
  - src/audio.ts: AudioPipe with 3 modes (file / ffplay / wasapi) | 三种输出模式
  - src/index.ts: AudioPipe integrated into WebSocket handler, AUDIO_PIPE_MODE env var | 集成到 WebSocket
  - scripts/test-audio.ts: Manual test script for all modes | 手动测试脚本
  - scripts/gen-sine-test.ts: Sine wave generator for E2E audio pipeline test | 正弦波生成器
  - Decoding strategy: opusscript (pure JS) decode opus → PCM in-process | 使用 opusscript 纯 JS 解码
  - **File mode verified**: 100 opus frames → 800 bytes on disk | 文件模式已验证
  - **ffplay mode verified**: 440Hz sine wave → decoded → played through speakers | ffplay 扬声器播放已验证
- [x] **F-003 (Phase 3-4): WASAPI VB-Cable + production hardening | VB-Cable 输出 + 生产化**
  - src/wasapi.ts: WinMM waveOut API via koffi (pure JS FFI) — PCM → VB-Cable, no FFmpeg | 使用 koffi 纯 JS FFI 调用 WinMM API 输出到 VB-Cable
  - src/audio.ts: ffplay auto-restart on crash (up to 3 attempts), state change callbacks | ffplay 崩溃自动重启（最多3次），状态变化回调
  - src/index.ts: WebSocket state feedback to phone UI (connected/started/restarting/error/stopped) | WebSocket 状态反馈到手机端
  - **WASAPI mode verified**: 440Hz sine → opusscript encode → WASAPI → VB-Cable (192KB PCM, clean exit) | WASAPI 模式验证通过
  - Dependencies: koffi (pure JS FFI, no native build tools) | 新增依赖 koffi

### What's In Progress | 进行中

- [ ] **F-004: Connection UX + QR code + PC management page | 连接体验 + 二维码 + PC 管理页**
  - PC management page (`public/pc.html`) with QR code, status, real-time log
  - Route split: `/` → pc.html, `/phone` → phone client
  - Auto-open browser on startup
  - WebSocket state push to PC page (same WS as phone)
  - Phone UI: connection status, auto-reconnect, error handling

### What's Next | 下一步

1. **F-005**: Latency tuning + quality controls | 延迟调优

## Blockers / Risks | 阻塞项 / 风险

- ~~**Git push blocked**~~ → Resolved: push from Windows PowerShell works | 推送问题已解决
- ~~**VB-Cable not installed**~~ → Installed + verified 2026-05-16 | 已安装并验证
- ~~**FFmpeg Gyan/BtbN builds lack WASAPI muxer**~~ → Mitigation: WinMM waveOut API via koffi | 改用 WinMM waveOut
- **opusscript decoder fidelity**: Real phone E2E passed — no issues with standard opus frames. | 真机测试未发现问题
- **No raw opus demuxer in FFmpeg**: Mitigation: decode in Node.js via opusscript. | 改用 Node.js 解码

### Accepted Risks (PR review, 2026-05-16) | 已接受的已知风险

以下问题经过评估后认为不修复或推迟修复，记录在此供后续参考：

- **ACC_MAX discards oldest data** (`wasapi.ts:214`): 缓冲区池饥饿时丢弃最旧 600ms 音频而非拒绝新数据，可能造成 pop/click。触发条件苛刻（6 缓冲区全忙），正常使用中几乎不会触发。
- **byteCount logged before waveOutWrite success** (`wasapi.ts:197`): `waveOutWrite` 失败时 close 日志会高估播放字节数。`waveOutWrite` 在正常设备上不会失败，仅影响日志准确性。
- **`as AudioPipeMode` bypasses type-check** (`index.ts:21`): 无效的 `AUDIO_PIPE_MODE` 值不会在编译期报错，运行时 fallback 到 file 模式。不会崩溃，但用户体验差。
- **Naming: `createWasapiOutput` actually uses WinMM** (`wasapi.ts`): 函数名误导，实际使用 WinMM waveOut API（非 WASAPI COM）。纯命名问题，不影响功能。
- **Silent opus decode failures** (`audio.ts:88`): 解码失败空 `catch {}` 不记录日志，排查客户端坏数据时缺少线索。
- **Silent waveOutPrepareHeader/Write failures** (`wasapi.ts:194-195`): 音频输出失败不打印警告，排查无线索。
- **No unit tests**: 缺乏自动化测试覆盖（ffplay 重启、状态回调、缓冲池饥饿、并发连接），重构有回归风险。
- **file mode lacks `closed` guard + `onStateChange`**: file 模式与其他两种模式不一致，close 后 write 不会报错但数据丢失。

## Decisions Made | 已做决策

- **Transport: WebCodecs AudioEncoder + WebSocket**: Lower latency than MediaRecorder (~80ms vs ~150ms). WebRTC deferred to F-006.
  > Phase 1 采用 WebCodecs AudioEncoder + WebSocket
- **Decoding strategy: opusscript (pure JS) → PCM → ffplay**: Instead of FFmpeg raw opus demuxer (not available in Gyan build) or @discordjs/opus (needs native compilation). Pure JS avoids Python/C++ build toolchain dependency.
  > 解码方案：opusscript 纯 JS 解码，避免原生编译依赖
- **VB-Cable output: WinMM waveOut API via koffi (pure JS FFI)**: Both Gyan and BtbN FFmpeg builds lack WASAPI muxer. WinMM waveOut API is simpler, more reliable, and targets specific audio devices by name. No native build tools needed.
  > VB-Cable 输出：FFmpeg 的 WASAPI 输出在两个主流 Windows 构建版都缺失，改用 WinMM waveOut API，可通过名称精确指定目标设备
- **Node.js retained vs Rust**: Node.js is sufficient for I/O-bound audio pipeline.
- **Windows-first (VB-Cable)**: macOS not supported.
- **packaging via pkg**: Standalone .exe via @yao-pkg/pkg.
- **Chrome-only**: No cross-browser testing.
- **No TURN/STUN**: Local network only.
- **pnpm**: Package manager.
- **F-004 PC management page**: `/` serves `pc.html` (management UI with QR code + log panel), `/phone` serves `index.html` (phone client). QR code generated client-side via `qrcode` npm package. PC page connects to same WebSocket for state/log push. | PC 管理页：`/` 提供管理界面，`/phone` 提供手机端，二维码通过 qrcode 包在浏览器端生成，PC 页通过同一 WebSocket 接收状态推送。

## Files Modified This Session | 本次修改的文件

- `src/wasapi.ts` — New: WinMM waveOut output via koffi, targets VB-Cable by name, no FFmpeg needed | 新增文件
- `src/audio.ts` — Phase 4: ffplay auto-restart (max 3), state change callbacks, updated createWasapiPipe to use WinMM | Phase 4 生产加固
- `src/index.ts` — Phase 4: WebSocket state feedback to phone UI, onStateChange integration | 状态反馈
- `package.json` — Added koffi dependency | 添加 koffi
- `pnpm-lock.yaml` — Updated | 更新
- `scripts/test-audio.ts` — Fix: TOCTOU (existsSync→try/catch), unused import | 修复 TOCTOU
- `src/audio.ts` — Fix: capture proc local in write() to avoid stale reference | 修复 proc 引用竞态
- `src/index.ts` — Fix: remove dead pipeState, type sendState param | 清理死代码，类型化参数
- `.gitignore` — Add *.raw, .claude/ | 忽略测试产物和本地配置

## Evidence of Completion | 完成证据

- [x] `pnpm run typecheck` — clean | 类型检查通过
- [x] `pnpm run build` — clean | 构建通过
- [x] `./init.sh` — typecheck + build + audio test pass | 完整验证通过
- [x] File mode test: 100 synthetic opus frames → 800 bytes output | 文件模式验证通过
- [x] ffplay mode test: 440Hz sine wave → opus encode → opusscript decode → ffplay speaker playback | 扬声器播放验证通过
- [x] WASAPI mode test: 440Hz sine → opusscript → WinMM waveOut → "CABLE Input (VB-Audio Virtual C)" (192KB PCM, clean exit 0) | WASAPI 验证通过
- [x] State callbacks: started → stopped lifecycle confirmed | 状态回调验证通过
- [x] Auto-restart: spawnFfplay, max restarts=3, restarting/error state transitions | 自动重启已实现
- [x] `openssl` dependency documented in README prerequisites | OpenSSL 依赖已文档化
- [x] E2E phone → PC audio: real phone Chrome → VB-Cable verified | 手机端到端真实验证通过
- [ ] Push to remote: HTTPS auth blocked in WSL | 推送到远端受阻

## Notes for Next Session | 下次会话备注

- **Next feature**: F-004 Connection UX + QR code | 下一功能 F-004
- **Branch**: Start from main (`git checkout -b feat/f-004-connection-ux`)
- **Known risks**: See "Accepted Risks" section above for deferred low-priority issues | 已知风险见上方记录
- **Windows prerequisites**: `winget install ffmpeg OpenSSL.Light` + [VB-Cable](https://vb-audio.com/Cable/)
- **WaveOut device name note**: WinMM truncates device names to 31 chars. "CABLE Input (VB-Audio Virtual C" is the correct match.
