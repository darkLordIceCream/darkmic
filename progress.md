# Session Progress Log | 会话进度日志

## Current State | 当前状态

**Last Updated | 最后更新:** 2026-11-14
**Session | 会话:** Project re-evaluation vs MicYou + roadmap approved + Phase 0 stability hardening (F-009) | 项目对标 MicYou 重评估 + 路线图批准 + Phase 0 稳定性收口
**Active Feature | 当前功能:** F-009 in-progress (real-machine BUG-001 verification outstanding); next: F-008 | F-009 进行中（真机验证待用户），下一步 F-008
**Branch | 分支:** `main`

## Status | 状态

### 2026-11-14 (cont. 2) Session | 自主工程章程可行性评估 + 文档对齐

**背景 | Context**: 用户提供 `darkmic-autonomous-engineering-goal.md`（自治工程章程，来自外部专家），要求先评估可行性。评估结论：整体可行，环境前提基本齐备——5 个子代理（QAInspector/CodeReviewer/ProductAdvisor/SecurityAuditor/UXDesigner）已注册且角色吻合、rustc 1.95.0 + cargo 已装、BlackHole2ch 驱动已装、ffmpeg/ffplay 已装（Homebrew）、Node v26.3.1。发现 3 处需修订的冲突。

**修订落地（用户批准）| Revisions implemented (user-approved)**:
- **AGENTS.md**: ① 约束条目 "Windows + VB-Cable. macOS not supported" → Windows 为主要目标平台、macOS 为一等公民开发/测试环境（现阶段 file/ffplay 模式支持，BlackHole 适配器规划于 F-015），跨平台 = 各系统输出适配器（与 2026-10-11 用户确认的决策一致，原条目过时）；② 顶部增加章程引用块；③ 启动流程加第 5 步（自主迭代时读章程与 decisions.md）；④ 必需工件清单加入 decisions.md。
- **decisions.md（新建）**: 章程 §7H 要求的规范决策记录。迁移 progress.md 全部历史决策（标注 Active/Superseded），新增 5 项决策：D-001 章程采纳、D-002 macOS 一等公民、D-003 Rust 优先级修正、D-004 decisions.md 规范化、D-005 PENDING_WINDOWS_TEST 状态采纳。
- **feature_list.json**: 新增 **F-015** "Rust audio-engine evaluation (output adapter first)"，依赖 F-008（排在安装器之后），not-started。关键修正：章程 §8 将 opus 解码列为 Rust 优先级 #1，但 opusscript 无实测瓶颈（48kHz mono、单连接、每帧亚毫秒），迁移它过不了章程自己的迁移规则 §3.5 → **首个落点改为输出适配器**（CPAL + BlackHole 消费 stdin PCM 的 ~100 行原型，复用 ffplay 管道模式做基准对比）；TypeScript 保留 opus 解码，规避 libopus C 依赖从 macOS ARM 交叉编译的风险。路线图 F-008–F-014 主线不变。
- **progress.md**: 本条目 + Decisions 章节迁移指针。

**验证 | Verification (2026-11-14)**:
- `feature_list.json` JSON 解析通过（15 features，末项 F-015）。
- `./init.sh` 完整通过（install + typecheck + build + 24/24 单测 + 音频管线测试）。

**后续 | Next**: 主线不变——F-008 为下一实现项（F-009 等 BUG-001 真机验证闭环）；F-015 为排其后的低优先级评估流，切片 1 原型在 F-008 后可随时开工。未跟踪文件 `scripts/e2e-emulator.sh` 属上个会话产物，本次未纳入提交。

### 2026-11-14 Session | 本次会话：项目重评估 + 路线图 + F-009 稳定性收口

**背景 | Context**: 用户要求对标 [MicYou](https://github.com/MicYou-Dev/MicYou)（4.5k star，Android Kotlin / iOS Swift 原生 App + Tauri 2 桌面端，Wi-Fi/USB 连接，AI 降噪/AEC/插件市场）重新评估本项目并制定路线图。**约束（不可变）**: 手机端仅浏览器零安装 + PC 端 VB-Cable。

**评估结论 | Assessment**:
- 差异化不在功能广度，而在**连接体验的极致简单**——MicYou 的 Web 模式只是次要入口，我们的浏览器模式是唯一入口，必须把"打开网页即用、断线自愈、锁屏不断采"做到极致。
- WebRTC（F-006）降级为决策门：浏览器能力、零安装不变，但 ~80ms 未证明不达标；先做真实延迟测量（F-012）+ 缓冲调优（F-013），实测 >100ms 才实施。
- AI 降噪（WASM RNNoise in AudioWorklet，F-014）为后期差异化亮点；跨平台维持 Windows 优先（backlog）。

**路线图（已批准）| Roadmap (approved)**: Phase 0 F-009 稳定性收口 → Phase 1 F-008 安装器 → Phase 2 F-010 手机端可靠性（Wake Lock/PWA/重连）→ Phase 3 F-011 浏览器 DSP（EQ/噪声门/电平表）→ Phase 4 F-012 真实延迟测量+监控 → Phase 5 F-013 延迟调优+WebRTC 决策门 → Phase 6 F-014 AI 降噪。Backlog：跨平台适配器、soundpad、插件系统、多语言、多手机连接。

**本次实施 | Implemented (F-009)**:
- `src/config.ts`（新增）: config.json 可选加载（port / audioPipeMode / initialBitrate），env 优先，无效值警告回退；消除 `index.ts` 的 `as AudioPipeMode` 强转。WS 连接时下发 `{type:'config', initialBitrate}`，`public/client.js` 据此设置编码器初始码率；`ws.onmessage` 注册移至 await open 之前（避免丢失服务端连接后立即发送的消息）。
- `src/audio.ts`: opus 解码失败不再静默——限频日志（首次详录 + 每 50 次计数 + 关闭时汇总）；file 模式补 closed guard、close 幂等、写盘错误广播 error 状态。
- `src/wasapi.ts`: waveOutPrepareHeader/Write 失败记录 MMRESULT（原先静默 return）；抽出纯逻辑 `PcmChunker` 类（累积/切片/饥饿裁剪，零 WinMM 依赖，可单测）；`WasapiOutput.stats()` 暴露 submittedBytes/pendingBytes/starvedBytes（为 F-012 缓冲水位指标预留）。
- 测试: `test/audio-pipe.test.ts`（工厂分发/未知模式回退/帧格式/状态机/closed guard/opus 编解码 roundtrip）、`test/wasapi-chunker.test.ts`（部分缓冲/精确切片/freeSlots 上限/内容顺序/饥饿裁剪最旧优先/flush/饥饿后恢复）、`test/config.test.ts`（默认值/读取/无效回退/部分无效/未知字段/坏 JSON/env 覆盖/无效 env）。`package.json` 加 `"test": "vitest run"`（vitest 5.1.0），`init.sh` 加入单元测试步骤。
- `.gitignore` 加 `config.json`（机器本地配置）。

**验证 | Verification (2026-11-14)**:
- `vitest run`: **24/24 通过**。
- `pnpm run typecheck` + `pnpm run build`: 干净通过。
- `./init.sh`: 完整通过（install + typecheck + build + 单测 + 音频管线测试）。
- 运行时冒烟测试: 临时 config.json（port 3199 / audioPipeMode file / initialBitrate 48000）→ 日志确认三项全部生效；`PORT=` 空值触发 `Invalid port` 警告路径；服务器正常启动后清理。

**待办 | Outstanding**:
- **BUG-001 真机验证（用户操作）**: Windows 上双击 release exe → 手机连接 → 点停止 → 确认 uptime 停止计时且音频关闭；恢复再停止重复一次。通过后 BUG-001 与 F-009 均转 done。
- F-008（Phase 1）为下一实现项。

### 2026-11-14 (cont.) Session | 仿真器 E2E 测试台（手机端自动化验证）

**目的 | Motivation**: 用户提出用安卓模拟器代替"真机扫码"，让 F-010/F-011 等手机端功能在 macOS 上即可自动化验证。模拟器 Brave = 标准 Chromium 客户端，可全自动打开 URL、过证书警告、授权麦克风、点击开始。

**一次性环境搭建（本机已完成）| One-time setup**:
- sdkmanager 安装 `emulator` + `system-images;android-35;default;arm64-v8a`（~2.9GB）。注意：非交互 shell 需显式 `JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/...`。
- **avdmanager 22.0 (homebrew) 创建 AVD 有 bug**（"Package path is not valid ... null"，即使镜像已注册）——绕过方式：手写 `~/.android/avd/darkmic-test.avd/config.ini` + `darkmic-test.ini`（emulator -list-avds 能发现即可用）。
- 浏览器侧载：官方 Chromium 快照只有 armeabi-v7a（API 35 arm64-only 镜像装不上）→ 改用 **Brave 官方 arm64 APK**（Chromium 内核，GitHub Releases，SHA256 已校验：`7b92ee8c...f37b`，v1.99.57）。
- 授权：`adb shell pm grant com.brave.browser android.permission.RECORD_AUDIO`（app 层）。

**自动化流程（scripts/e2e-emulator.sh，3 次运行全通过）**:
1. 起独立 file 模式服务（默认 :3100，`DARKMIC_E2E_PORT` 可覆盖）
2. `am start` 用 Brave 打开 `https://10.0.2.2:<port>/phone`（10.0.2.2 = 模拟器访问宿主机的固定别名，**不需要扫码/输 IP**）
3. uiautomator dump + 坐标点击：首启引导（CANCEL/Maybe later/Continue）→ 证书插页（Advanced → "Proceed to 10.0.2.2 (unsafe)"）→ 点 Start Microphone → 授权弹窗（forever + Allow）
4. 等 8 秒 → 服务端日志数 "Chunk #"（≥20 PASS）→ 点 Stop → 可选解码校验
- **实测证据**: 手动流程 663 chunks/45KB 落盘，1385/1385 包解码成功（2.66MB PCM）；脚本 :3200 → 336 chunks，:3300 → 341 chunks，477/477 解码 915840 PCM 字节。
- 已知行为：Brave 证书例外按**主机**记忆（10.0.2.2:3000 的 Proceed 让 :3100/:3300 免插页）；mic 授权弹窗是点 Start 后才触发（getUserMedia 惰性请求）；uiautomator dump 动画期间会间歇失败（脚本内已重试）。
- **限制**: 模拟器虚拟麦克风喂静音（3 字节 opus 帧，与单测静音帧一致）——传输/解码/ UI 全真，但音质/真实延迟/AGC 表现仍需真机；VB-Cable 输出仍 Windows-only。

**用回该测试台 | How to reuse**: `./scripts/e2e-emulator.sh`（模拟器已在跑则直接用；否则 `DARKMIC_AVD=darkmic-test` 自动启动）。

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

> **2026-11-14**: 决策记录已迁移至 `decisions.md`（章程 §7H 规范版本，含 Active/Superseded 状态标注）。以下为历史快照，新决策一律记入 `decisions.md`。
> Decisions are now canonical in `decisions.md` (charter §7H, with Active/Superseded status). The list below is a historical snapshot; record new decisions in `decisions.md`.

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
- [x] 2026-11-14: `vitest run` — 24/24 tests pass (audio-pipe / wasapi-chunker / config suites) | 单元测试全通过
- [x] 2026-11-14: `pnpm run typecheck` + `pnpm run build` — clean | 类型检查与构建通过
- [x] 2026-11-14: `./init.sh` full pass — now includes unit test step | 完整验证通过（已含单测步骤）
- [x] 2026-11-14: Runtime smoke test — config.json values effective (port 3199 / file mode / 48000bps), invalid env warned, server boots clean | 运行时冒烟测试通过
- [x] 2026-11-14: Emulator E2E — Brave arm64 side-loaded (SHA256 verified), scripted flow 3× PASS (:3200→336, :3300→341 chunks), decode 477/477 packets → 915840 PCM bytes | 仿真器 E2E 测试台建成并通过
- [ ] 2026-11-14: BUG-001 real-machine E2E (exe on Windows + phone stop → uptime freeze + audio close) — awaiting user verification | BUG-001 真机验证待用户执行

## Notes for Next Session | 下次会话备注

- **Charter adopted (2026-11-14)**: `darkmic-autonomous-engineering-goal.md` is the operating charter; AGENTS.md aligned (macOS first-class, cross-platform via per-OS adapters); decisions created. **F-015** (Rust output-adapter eval, dep F-008) is the low-priority parallel stream — slice 1 = CPAL + BlackHole stdin-PCM prototype vs ffplay-mode benchmarks. | 章程已采纳并对齐文档；F-015 为 F-008 之后的低优先级评估流。
- **Roadmap (approved 2026-11-14)**: Phase 0 F-009 stability (in-progress, awaiting real-machine check) → Phase 1 **F-008 installer/launcher (next implementation)** → Phase 2 F-010 phone reliability (Wake Lock/PWA/reconnect) → Phase 3 F-011 browser DSP → Phase 4 F-012 real latency + monitoring → Phase 5 F-013 tuning + WebRTC decision gate → Phase 6 F-014 WASM AI denoising. Backlog: cross-platform adapters, soundpad, plugins, i18n, multi-phone. | 路线图已批准，下一实现项为 F-008。
- **F-009 completion condition**: real-machine BUG-001 verification (user) → flip F-009 + BUG-001 to done | F-009 完成条件：用户真机验证 BUG-001 后转 done。
- **Config precedence**: defaults ← config.json (exe/project root, gitignored) ← env (PORT / AUDIO_PIPE_MODE). Invalid values warn, never crash. | 配置优先级与容错行为。
- **Branch**: `main`; keep linear history | 分支 main，保持线性历史
- **Windows prerequisites**: [VB-Cable](https://vb-audio.com/Cable/) (wasapi mode needs it; FFmpeg only for ffplay mode / test scripts) | Windows 前置依赖
- **WaveOut device name note**: WinMM truncates device names to 31 chars. "CABLE Input (VB-Audio Virtual C" is the correct match. | 设备名截断匹配
- **PcmChunker**: pure buffer logic lives in `src/wasapi.ts`; `WasapiOutput.stats()` (submitted/pending/starved bytes) is ready for F-012 dashboard metrics | 缓冲遥测已为 F-012 预留
- **Emulator E2E harness**: `scripts/e2e-emulator.sh` automates the phone side (Brave arm64 in AVD `darkmic-test`, URL via 10.0.2.2 instead of QR). Enables autonomous iteration on F-010/F-011 phone features. Caveats: emulator mic = silence; real-device checks (latency/AGC/quality) still need a phone. | 仿真器测试台使手机端功能可自主迭代；音质/延迟仍需真机
