# AGENTS.md — darkmic

This repository is currently empty. Nothing has been initialized yet (no package manager, no framework, no config, no code).

Update this file as the project takes shape — extract real developer commands, architecture notes, and quirks from executable sources of truth (config files, scripts, CI workflows), not from speculation.

## What to include later

Once the project has content, capture:

- **Setup & dev commands** — install, build, test, lint, typecheck, dev server, codegen
- **Required command order** — e.g. `lint → typecheck → test` if order matters
- **Monorepo structure** — package boundaries, entrypoints, workspace config
- **Framework/toolchain quirks** — generated code, migrations, env loading, infra deploy
- **Testing specifics** — how to run a single test, fixture setup, integration prerequisites
- **Conventions that differ from defaults** — naming, imports, error handling, commit style
- **References** — keep a one-liner pointing to any other instruction files (`.cursor/rules/`, `CLAUDE.md`, `opencode.json` `instructions`)

## Tone

Short bullets. High signal only. If a fact is obvious from filenames or framework defaults, leave it out.
