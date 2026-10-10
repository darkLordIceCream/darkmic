# Session Progress Log | 会话进度日志

## Current State | 当前状态

**Last Updated | 最后更新:** 2026-10-11
**Session | 会话:** Repo sync — bug-001 fix branch merged back to main | 仓库同步——bug-001 修复分支合回 main
**Active Feature | 当前功能:** F-008 next | F-008 下一步
**Branch | 分支:** `main` @ 2c09a01

## Status | 状态

### 2026-10-11 Session | 本次会话：仓库同步 + 架构确认

- 本地 main 原停在 F-002 + README 优化（落后远程 41 个提交，工作区 audio.ts 还是 stub）。已 fast-forward 到 origin/main（544ad75，含 F-003~F-005 完整音频管线），再 fast-forward 合并 `origin/fix/bug-001-exe-uptime-audio`（2c09a01，含 F-007 打包 + BUG-001 修复）。历史保持线性，零冲突。
- **架构结论（与用户确认）**: 目标是让电脑软件（微信/Zoom/OBS 等）把手机当麦克风。虚拟声卡是操作系统层面的必需环节——用户态程序（含 Node、含浏览器）没有任何 API 能把自己注册为系统音频输入设备，音频到达 PC 后只是进程内的字节，必须经虚拟声卡驱动才能进入系统麦克风列表。同类产品 WO Mic / DroidCam 均同方案。
- **跨平台方向（暂不实施）**: 手机端 + 传输层已天然跨平台（纯浏览器能力）。如需支持 macOS/Linux，在现有 `AudioPipeMode` 抽象下增加输出适配器即可（macOS → BlackHole、Linux → PulseAudio/PipeWire 虚拟源）。注意各平台都无法省略"虚拟音频设备"这一概念，跨平台 ≠ 去掉虚拟声卡。
- `.gitignore` 增加 `.zcode/`（编辑器会话产物，与 `.claude/` 同类）。
- 验证：`./init.sh` 在合并后的代码上完整通过（install + typecheck + build + 音频管线测试 PASS）。

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

### What's Done — Continued | 已完成（续）

- [x] **F-004: Connection UX + QR code + PC management page | 连接体验 + 二维码 + PC 管理页**
  - PC management page (`public/pc.html`) — dark theme, QR code, real-time metrics, event log
  - Route split: `/` → pc.html, `/phone` → phone client
  - Auto-open browser on startup (`windowsHide: true` to avoid Ctrl+C double-prompt)
  - WebSocket state broadcast to all clients (PC dashboard + phone)
  - Phone UI: auto-reconnect (exponential backoff 1s→30s, max 10 attempts)
  - Phone UI: mic permission error handling (NotAllowed, NotFound, NotReadable)
  - IP detection: filters virtual adapters by name, prefers private LAN ranges (192.168/10/172.16-31)
  - WASAPI: targets VB-Cable by device ID (not WAVE_MAPPER)
  - E2E verified: phone → PC → VB-Cable audio flow works

### What's Done — Continued | 已完成（续）

- [x] **F-005**: AGC + adaptive bitrate + latency measurement | 自动增益 + 自适应码率 + 延迟测量
  - AGC: DynamicsCompressorNode (-50dB/12:1/3ms) between getUserMedia and AudioEncoder
  - Adaptive bitrate: one-way <50ms → 64kbps, >=50ms → 32kbps (5s debounce)
  - Latency: ping/pong round-trip every 2s, dashboard 4th metric + phone stats display
  - E2E verified 2026-05-16

- [x] **F-007: Windows pkg packaging | pkg 打包**
  - cert.ts: Node.js `crypto` generates self-signed X.509 certs (no openssl, no node-forge)
  - @yao-pkg/pkg builds 72MB standalone exe (node20-win-x64)
  - Path resolution: `appRoot()` via `/snapshot/` detection for pkg, `import.meta.url` for dev
  - public/ alongside exe (not bundled — Express static needs real filesystem path)
  - VB-Cable detection: dashboard warning with download link when not installed
  - pnpm scripts: `pkg` (build exe), `package` (full release → release/ folder)
  - Verified: exe from release/ starts, generates certs, serves HTTPS, finds public/, detects LAN IP
  - Zero external deps: no FFmpeg (WinMM), no openssl (crypto)

### What's Next | 下一步

- **F-008: Launcher UX + installer** (pending) | 启动体验 + 安装程序（待做）
- **Cross-platform output adapters** (deferred, see 2026-10-11 session) | 跨平台输出适配（推迟）

## Known Bugs | 已知 Bug

### BUG-001: exe 模式下 uptime 不停止 + 音频不通

- **日期**: 2026-05-17
- **现象**: 双击打包好的 darkmic.exe 运行后，手机连接、点停止，uptime 持续计时不停止，PC 端也获取不到音频信息。但 `pnpm run dev` 本地开发模式下一切正常。
- **影响范围**: pkg 打包后的 exe
- **可能方向**: pkg 打包后环境变量 `AUDIO_PIPE_MODE` 默认值可能走不到 wasapi 路径，或 pkg 环境下 WebSocket/broadcast 行为与 dev 模式有差异
- **状态**: `fixed` (2026-05-17, awaiting user verification)
- **修复**: 
  1. `ensureAudioPipe()` 不再无条件调用 `sendState('started')`，避免覆盖音频管道创建失败时发出的 `error` 状态
  2. 为 `createFilePipe` 添加 `onStateChange` 回调，确保所有管道模式状态上报一致
  3. pkg 配置中添加 `assets` 字段，显式包含 koffi 的 `.node` 原生模块和 opusscript 的 `.wasm` 文件

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
- **packaging via pkg**: Standalone .exe via @yao-pkg/pkg. node20-win-x64 target, 72MB output.
- **Self-signed cert via Node.js crypto**: RSA 2048 keypair + manual X.509 DER construction + `crypto.createSign('RSA-SHA256')`. No openssl, no node-forge (ASN.1 incompatibility with OpenSSL 3.x). Proven working with Node 24 TLS.
- **Path resolution**: `appRoot()` detects pkg via `/snapshot/` check in `import.meta.url`, falls back to `dirname(dirname(fileURLToPath(import.meta.url)))`. public/ alongside exe.
- **VB-Cable detection**: Dashboard shows warning banner with download link. Separate from pkg packaging but added in F-007 branch.
- **node-forge rejected**: Generated certs passed forge's own parser but failed OpenSSL 3.x ASN.1 validation (illegal padding). Reverted to Node.js crypto approach.
- **Chromium-only**: No cross-browser testing beyond Chromium-based browsers (Chrome, Edge, Brave, etc.).
- **No TURN/STUN**: Local network only.
- **pnpm**: Package manager.
- **Virtual sound card retained (2026-10-11)**: Confirmed with user — the goal is a system-level microphone for PC apps. Userspace programs cannot register as OS audio input devices, so a virtual audio driver is mandatory on every platform. Cross-platform means per-OS output adapters (VB-Cable / BlackHole / PulseAudio), not removing the virtual device. | 架构确认：虚拟声卡不可省略；跨平台通过各系统输出适配器实现，而非去掉虚拟设备。
- **F-004 PC management page**: `/` serves `pc.html` (management UI with QR code + log panel), `/phone` serves `index.html` (phone client). QR code generated client-side via `qrcode` npm package. PC page connects to same WebSocket for state/log push. | PC 管理页：`/` 提供管理界面，`/phone` 提供手机端，二维码通过 qrcode 包在浏览器端生成，PC 页通过同一 WebSocket 接收状态推送。

## Files Modified This Session | 本次修改的文件

- `.gitignore` — Add `.zcode/` (editor session artifacts, same class as `.claude/`) | 忽略编辑器会话产物
- `progress.md` — This session's log and architecture decision | 本会话记录与架构决策
- Git history: `main` fast-forwarded 98ead4a → 544ad75 (origin/main) → 2c09a01 (bug-001 fix branch), linear, no conflicts | main 快进合并，线性无冲突

## Evidence of Completion | 完成证据

- [x] `pnpm run typecheck` — clean | 类型检查通过
- [x] `pnpm run build` — clean | 构建通过
- [x] `./init.sh` — typecheck + build + audio test pass | 完整验证通过
- [x] File mode test: 100 synthetic opus frames → 800 bytes output | 文件模式验证通过
- [x] ffplay mode test: 440Hz sine wave → opus encode → opusscript decode → ffplay speaker playback | 扬声器播放验证通过
- [x] WASAPI mode test: 440Hz sine → opusscript → WinMM waveOut → "CABLE Input (VB-Audio Virtual C)" (192KB PCM, clean exit 0) | WASAPI 验证通过
- [x] State callbacks: started → stopped lifecycle confirmed | 状态回调验证通过
- [x] Auto-restart: spawnFfplay, max restarts=3, restarting/error state transitions | 自动重启已实现
- [x] F-007: pkg exe builds + runs from release/, certs via Node.js crypto (no openssl), zero external deps | pkg 打包验证通过
- [x] E2E phone → PC audio: real mobile device (Chromium) → VB-Cable verified | 手机端到端真实验证通过
- [x] 2026-10-11: `./init.sh` on merged main (2c09a01) — install + typecheck + build + audio pipeline test PASS | 合并后完整验证通过
- [x] 2026-10-11: main pushed to origin (supersedes old WSL push blockage) | 推送成功（旧的 WSL 推送受阻已解决）

## Notes for Next Session | 下次会话备注

- **Next feature**: F-008 Launcher UX + installer | 下一功能 F-008（启动体验 + 安装程序）
- **Branch**: cut from `main` @ 2c09a01 (synced with remote 2026-10-11)
- **Deferred direction**: cross-platform output adapters behind `AudioPipeMode` abstraction (macOS BlackHole / Linux PulseAudio virtual source) — see 2026-10-11 session notes | 推迟方向：在 AudioPipeMode 抽象下增加各系统输出适配
- **Known risks**: See "Accepted Risks" section above for deferred low-priority issues | 已知风险见上方记录
- **Windows prerequisites**: `winget install ffmpeg OpenSSL.Light` + [VB-Cable](https://vb-audio.com/Cable/)
- **WaveOut device name note**: WinMM truncates device names to 31 chars. "CABLE Input (VB-Audio Virtual C" is the correct match.
- **Remote branch note**: `origin/fix/bug-001-exe-uptime-audio` is fully merged into main (fast-forward); the remote branch can be deleted whenever desired | bug-001 远程分支已完整合入 main，可随时删除
