# Session Progress Log

## Current State

**Last Updated:** 2026-05-13
**Session:** F-001 implementation
**Active Feature:** F-001 (done)

## Status

### What's Done

- [x] AGENTS.md created with project architecture and working rules
- [x] feature_list.json created with 6 features across 2 phases
- [x] init.sh created with basic verification pipeline
- [x] progress.md created for session continuity
- [x] Remote repo connected: darkLordIceCream/darkmic (private)
- [x] **F-001: Project scaffold + HTTPS certs**
  - package.json with deps (express, ws, tsx, typescript)
  - tsconfig.json (ES2022, NodeNext)
  - src/index.ts: HTTPS server + WebSocket + Express static
  - src/cert.ts: self-signed cert generation via openssl
  - src/audio.ts: stub for F-003
  - public/index.html + client.js: phone UI scaffold
  - scripts/setup.sh, scripts/dev.sh
  - Verified: npm install → typecheck → build → server start + cert gen

### What's In Progress

- (none)

### What's Next

1. F-002: WebSocket server + phone client
   - Phone: getUserMedia → MediaRecorder (opus 20ms) → ws.send
   - Server: receive chunks, log stats
   - Verify binary chunks flow end-to-end

## Blockers / Risks

- (none)

## Decisions Made

- **Transport: MediaRecorder + WebSocket first**: Lower complexity than WebRTC P2P, Chrome-only so API support is guaranteed. WebRTC deferred to F-006 if latency is insufficient.
- **macOS-first, Windows follow-up**: Developer uses macOS + BlackHole. VB-Cable support added on request.
- **Chrome-only**: No cross-browser testing scope.
- **No TURN/STUN**: Local network only, not designing for NAT traversal.
- **Self-signed certs via openssl**: No npm dependency for cert generation. Browser shows warning but works after user accepts.
- **No mkcert dependency**: mkcert is optional — system openssl is sufficient. scripts/setup.sh documents mkcert as optional install.

## Files Modified This Session

- `AGENTS.md` — Full project harness (architecture, rules, commands)
- `feature_list.json` — 6 features across MVP + optional WebRTC
- `init.sh` — Verification pipeline script
- `progress.md` — Session tracking file
- `package.json` — Project manifest with deps
- `tsconfig.json` — TypeScript config
- `src/index.ts` — Server entry (HTTPS + WebSocket + Express)
- `src/cert.ts` — Self-signed cert generation
- `src/audio.ts` — Audio pipe stub (F-003 placeholder)
- `public/index.html` — Phone UI skeleton
- `public/client.js` — Phone client stub
- `scripts/setup.sh` — System dependency check
- `scripts/dev.sh` — Dev server launcher
- `.gitignore` — Standard ignores

## Evidence of Completion

- [x] `npm run typecheck` — clean
- [x] `npm run build` — clean
- [x] `./init.sh` — full pipeline passes
- [x] Server starts, certs generated, HTTPS listening

## Notes for Next Session

- Start F-002: implement the phone-side MediaRecorder + WebSocket send loop, verify chunks arrive on server
