# CLAUDE.md

This repo is Anna's personal OpenClaw workspace (assistant identity: "Aether"). Full operating instructions live in `AGENTS.md` — read it.

## Sync convention

This repo is shared across multiple fronts: OpenClaw running locally, and Claude Code sessions elsewhere (web or otherwise). `master` is the single source of truth everyone syncs against.

- **Before working:** pull latest `master` so you're not acting on stale state.
- **After changes meant to be visible everywhere** (notes, lists, memory, docs): commit and push straight to `master` (fast-forward when possible) rather than leaving them stranded on a feature branch — a branch nobody merges is invisible to every other session.
- This doesn't relax normal care around destructive operations, secrets, or anything external-facing — see `AGENTS.md` Red Lines. It only means routine syncing of plain notes/files to `master` doesn't need to be re-confirmed every time.
