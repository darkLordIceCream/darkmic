# decisions.md — Architecture Decision Record | 架构决策记录

Canonical decision log per `darkmic-autonomous-engineering-goal.md` §7H. `progress.md` records session-by-session narrative; this file records *why* things are the way they are — reasons, rejected alternatives, known trade-offs, benchmark results.

> 依据自主工程章程 §7H 的规范决策记录。progress.md 记录会话过程；本文件记录决策理由、被否决的备选方案、已知取舍与基准数据。

Status values: **Active** | **Superseded** (with pointer to the replacement decision).

---

## 2026-11-14 — Charter adoption & alignment | 章程采纳与对齐

### D-001 Adopt `darkmic-autonomous-engineering-goal.md` as the operating charter — Active
The charter defines the autonomous iteration loop, sub-agent collaboration (QAInspector / CodeReviewer / ProductAdvisor / SecurityAuditor / UXDesigner), testing strategy and Git safety boundaries. AGENTS.md remains the per-session working guide; on platform strategy the charter's direction was aligned into AGENTS.md on 2026-11-14. All five named sub-agents exist in the agent environment and match the charter's role definitions.

### D-002 macOS becomes a first-class dev/test environment — Active
Supersedes the earlier "Windows-first, macOS not supported" stance, which contradicted the user-confirmed 2026-10-11 decision that cross-platform means per-OS output adapters. AGENTS.md constraints updated accordingly (2026-11-14). Windows remains the *primary target platform* (VB-Cable + pkg exe); macOS is the *primary development and integration-testing environment*. Current macOS capability: file/ffplay modes (speakers). Full closed-loop routing (other apps treating Mac audio as a mic) requires the BlackHole adapter → F-015. Machine prerequisites already present: BlackHole2ch driver, ffmpeg/ffplay (Homebrew), rustc 1.95.0.

### D-003 Rust workstream priority correction — Active
Charter §8 lists "Rust Opus decoding" as priority #1, but opusscript decode has no measured bottleneck (48kHz mono, single connection, sub-millisecond per frame) — migrating it would fail the charter's own migration rule §3.5 ("identify the actual bottleneck") and stall the whole workstream. Correction: **first Rust target = audio output adapter, not opus decode.** Rust owns output adapters (CPAL: CoreAudio/BlackHole now, WASAPI as a future WinMM evolution path); TypeScript keeps opus decode. This also avoids the libopus C-dependency cross-compile risk (macOS ARM → windows-x86_64). Prototype gate: ~100-line CPAL program consuming s16le PCM on stdin → BlackHole, reusing the proven ffplay stdin-pipe pattern (`src/audio.ts`), benchmarked against ffplay mode per charter §8. Tracked as **F-015** (queued behind F-008; roadmap F-008–F-014 remains the main line).

### D-004 decisions.md is the canonical decision record — Active
Created 2026-11-14 per charter §7H. The "Decisions Made" section in progress.md is retained as a historical snapshot; new decisions go here.

### D-005 `PENDING_WINDOWS_TEST` status adopted — Active
Per charter §4.2/§9: feature_list.json may use this status for Windows-only behavior that compiles/simulates on macOS but has no real-hardware verification. A macOS build does not prove Windows compatibility. First outstanding item: BUG-001 real-machine E2E (exe on Windows + phone stop → uptime freeze + audio close).

### D-006 Sixth sub-agent: ResourceSteward (resource logistics) — Active (2026-11-14, user proposal)
Failure mode observed by the user: long sessions accumulate leaked dev/test processes, listening ports, the darkmic-test AVD emulator and browser tabs → memory pressure / CPU overload on the MacBook Air, and polluted benchmark data. The charter said "leave clean state" but had no independent auditor. Added ResourceSteward (charter §5.6): audits and reclaims **only** resources verifiably belonging to darkmic (project path / known command-line signature — a port alone is a hint, not proof); SIGTERM first; report-only for ambiguous items and terminal windows; no file deletion, no code changes. Trigger points: after E2E/test runs (§7G.11), pre-benchmark quiet-machine check (§8), end of long sessions (§12/§13). Benchmark data integrity is the secondary but important beneficiary. Agent definition configured at `~/.zcode/agents/resourcesteward.md` (2026-11-14).

### D-007 F-010 (phone reliability) supersedes F-008 (installer) as the active main-line item in macOS-only sessions — Active (2026-11-14)
The 2026-11-14 roadmap ordered F-008 (Phase 1) before F-010 (Phase 2) while a Windows machine was expected mid-roadmap. Current sessions run exclusively on the macOS dev machine. F-008's deliverables (Inno Setup script, .bat launcher, tray) are Windows-only tooling: they can be *authored* on macOS but not executed — a full iteration would produce zero locally-verifiable evidence, violating the charter's "verification required" rule and the goal's evidence requirement. F-010's core scope (Wake Lock acquire/release, PWA shell, reconnect hardening on visibilitychange/online) is verifiable end-to-end via the emulator harness (§4.3); only lock-screen/background capture keeps `PENDING_REAL_DEVICE_TEST`. Consequence: F-010 proceeds now; F-008 is queued for the next Windows session (authoring + real install verification together). F-015 stays queued per D-003.

### D-008 Self-signed cert gates secure-context browser APIs; SW offline shell ships as progressive enhancement — Active (2026-11-14)
**Finding (emulator, Brave 1.99/Chromium 139):** with the project's self-signed cert, the page is usable only after the user bypasses the interstitial, and Chromium then *rejects service worker registration* — the SW **script fetch** runs its own TLS validation which does not inherit the user's bypass ("An SSL certificate error occurred when fetching the script", surfaced via the F-010 registration-failure logging). Consequences of the self-signed architecture in the field: no SW offline shell, no PWA install, no Wake Lock API. Installing the CA into the emulator's *system* store did not help — Brave verifies against its built-in Chrome Root Store and ignores the platform store. The same limitation applies to real phones.

**Decision:** keep the SW offline shell as a *progressive enhancement* — the code engages automatically whenever a trusted-cert scenario exists and costs nothing otherwise. The recovery UX that works everywhere is F-010's reconnect hardening (visibilitychange/online → skip-backoff reconnect, verified in the emulator under a 30s backoff). Screen-stay-awake during streaming does not depend on the Wake Lock API alone: dumpsys shows Chromium holds a SCREEN_BRIGHT_WAKE_LOCK for the capture session itself, so streaming keeps the screen on even where the API is unavailable. **Rejected alternative:** asking users to install the darkmic CA on their phones — heavy friction, confusing security dialogs, and contradicts the zero-install promise. **Related emulator-environment upgrades recorded for reuse:** test cert regenerated with IP SANs (10.0.2.2/LAN IP/localhost — `certs/server.crt` is gitignored machine-local, generated via openssl, not cert.ts), system CA installed via `adb root`+`adb remount` (needs `-writable-system` emulator flag; `adb reboot` drops the writable remount — re-run root/remount after every reboot), and `adb reverse tcp:3100 tcp:3100` + `https://localhost:3100/phone` reaches the host server with a host-matching SAN. Cert.ts still emits a CN-only cert — giving it SANs is a small future product improvement (helps only trusted-cert scenarios).

---

## Transport & Encoding | 传输与编码

### WebCodecs AudioEncoder + WebSocket (Phase 1) — Active
Lower latency than MediaRecorder (~80ms vs ~150ms). WebRTC (F-006) deferred twice: first to a separate feature, then (2026-11-14) demoted to a decision gate inside F-013 — implement only if measured end-to-end latency stays >100ms after buffer/encoding tuning.

### opusscript (pure JS) for opus decode — Active
Chosen over @discordjs/opus (needs C++ build toolchain) and FFmpeg (raw opus demuxer missing in Gyan/BtbN Windows builds). Trade-off: pure-JS decode is slower than libopus, but at 48kHz mono / single connection it is sub-millisecond per frame — no measured bottleneck. F-015 deliberately keeps decode in TypeScript.

### Chromium-only, no polyfills — Active
Chrome/Edge/Brave/Opera on mobile and PC. No Firefox/Safari testing or workarounds unless explicitly requested.

### Local network only, no TURN/STUN/SFU — Active
Same-subnet use case; no backend streaming infrastructure.

## Audio Output & Platform | 音频输出与平台

### WinMM waveOut via koffi (pure JS FFI) for VB-Cable — Active
Both Gyan and BtbN FFmpeg Windows builds lack a WASAPI muxer; WinMM waveOut is simpler, more reliable, and targets devices by name. Device-name note: WinMM truncates names to 31 chars — `"CABLE Input (VB-Audio Virtual C"` is the correct match. Trade-off: WinMM is legacy with higher latency than WASAPI; acceptable for Phase 1, revisit via F-015 (CPAL/WASAPI) only if benchmarks justify.

### Virtual sound card is mandatory — Active (2026-10-11, user-confirmed)
Userspace programs cannot register as OS audio input devices, so a virtual audio driver is required on every platform. Cross-platform = per-OS output adapters (VB-Cable / BlackHole / PulseAudio), not removing the virtual device.

### ~~Windows-first: macOS not supported~~ — Superseded 2026-11-14 → D-002
Historical Phase-1 scoping decision; replaced by first-class macOS dev/test environment.

## Packaging & Distribution | 打包与分发

### Single exe via @yao-pkg/pkg — Active
node20-win-x64 target, 72MB output; certs via Node.js crypto, audio via WinMM → zero external dependencies is a product selling point (F-007). This trade-off is a formal benchmark dimension in F-015: Rust Option A (subprocess) adds a second binary; Rust Option B (N-API) keeps single-exe but adds native-module packaging complexity (koffi pkg handling was already proven in commit 28e8d07).

### Self-signed cert via Node.js crypto — Active
RSA 2048 + manual X.509 DER construction + `crypto.createSign('RSA-SHA256')`. No openssl, proven working with Node 24 TLS. Cached in `certs/` (gitignored).

### node-forge rejected — Active (rejected alternative)
Forge-generated certs passed forge's own parser but failed OpenSSL 3.x ASN.1 validation (illegal padding). Reverted to the Node.js crypto approach.

### Path resolution via `appRoot()` — Active
Detects pkg via `/snapshot/` in `import.meta.url`, falls back to `dirname(dirname(fileURLToPath(import.meta.url)))`. public/ sits alongside the exe.

## UI & Dashboard | 界面与仪表盘

### Route split + client-side QR — Active
`/` → pc.html (dashboard), `/phone` → index.html (phone client); QR generated browser-side via `qrcode` npm; both pages share one WebSocket for state/log push.

### VB-Cable detection banner — Active
Dashboard shows a warning banner with download link when VB-Cable is absent.

## Tooling & Conventions | 工具与约定

### pnpm — Active
Use pnpm, not npm.

### Node.js runtime — Active (scope clarified 2026-11-14)
"Node.js is sufficient for the I/O-bound audio pipeline" remains true for the network/orchestration/UI layers. F-015 re-evaluates this **only** for audio-output adapters, under the charter's measurable-benefit rule; absent demonstrated benefit, TypeScript is retained.

---

## Benchmark Results | 基准数据

None recorded yet. F-015 slice 1 (CPAL/BlackHole stdin-PCM vs ffplay mode) will populate this section per charter §8 requirements: audio decoding correctness, processing latency, end-to-end latency, CPU, memory, buffer stability, error recovery, build/packaging complexity — with hardware, software versions, test conditions and measurement limitations documented. Do not fabricate numbers.

> 暂无基准数据。F-015 切片 1 将按章程 §8 要求填充，须记录硬件、软件版本、测试条件与测量局限。禁止编造数据。
