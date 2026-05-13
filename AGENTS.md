# AGENTS.md — darkmic

Phone-as-microphone for PC via Chrome browser. Phone captures mic audio via `getUserMedia` → streams over local network → PC receives and pipes to virtual audio device (BlackHole/VB-Cable).

## Architecture

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

### Phase 2 (future): WebRTC P2P (if latency requires)

Same server infrastructure, swap transport: `RTCPeerConnection` instead of `MediaRecorder` chunks. Signaling stays on the same WebSocket.

## Constraints

- **Chrome-only** (both phone and PC). No other browser testing needed.
- **Local network only** — same subnet, no STUN/TURN.
- **HTTPS required** — use `mkcert` for local dev certs.
- **macOS primary** (BlackHole for virtual mic). Windows via VB-Cable if needed.

## Startup Workflow

Before writing code:

1. **Read this file** completely
2. **Run `./init.sh`** to verify environment is healthy
3. **Read `feature_list.json`** for current feature state
4. **Review recent commits** with `git log --oneline -5`

If baseline verification fails, repair it first before adding new scope.

## Working Rules

- **One feature at a time** — pick exactly one unfinished feature from `feature_list.json`
- **Chrome-only** — don't add polyfills or cross-browser workarounds unless explicitly requested
- **No backend streaming infrastructure** — no TURN/STUN servers, no cloud relay, no SFU
- **Verification required** — don't claim done without running verification
- **Update artifacts** — update `progress.md` and `feature_list.json` before ending session
- **Leave clean state** — next session must be able to run `./init.sh` immediately

## Required Artifacts

- `feature_list.json` — Feature state tracker (source of truth)
- `progress.md` — Session continuity log
- `init.sh` — Standard startup and verification path

## Definition of Done

A feature is done only when ALL of the following are true:

- [ ] Target behavior is implemented
- [ ] Required verification actually ran (type-check / lint / audio pipeline test)
- [ ] Evidence recorded in `feature_list.json` or `progress.md`
- [ ] Repository remains restartable from standard startup path

## End of Session

1. Update `progress.md` with current state
2. Update `feature_list.json` with new feature status
3. Record unresolved blockers/risks
4. Commit with descriptive message
5. Leave repo clean for `./init.sh`

## Developer Commands

```bash
./init.sh              # Full verification: install + type-check + build
npm run dev            # Start dev server with file watching
npm run typecheck      # TypeScript type check only
```

## Escalation

- **Architecture decisions** — ask user before diverging from plan
- **Cross-browser issues** — skip: Chrome-only project
- **Repeat failures** — log in progress.md, flag for review
