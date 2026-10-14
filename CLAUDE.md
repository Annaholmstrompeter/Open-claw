# CLAUDE.md

This repo is Anna's personal OpenClaw workspace (assistant identity: "Aether"). Full operating instructions live in `AGENTS.md` — read it.

## Paralellsida för spakunder (Annas QR-sida för spa-kunder)

Annas pågående projekt, även kallat "fristaden" / "Body Mind Earth Sanctuary" / "sanctuary" / "parallellsidan". Allt ligger här på `master`:

- **Mapp:** `paralellsida-for-spakunder/` (webbplatsen, tester, verktyg, README).
- **Överlämning (läs först):** `projects/paralellsida-for-spakunder.md`: hur Anna vill jobba, vad som är bestämt, gjort och planerat, kommandon och fällor. Logg: `projects/paralellsida-for-spakunder-logg.md`.
- Säger Anna "paralellsidan", "spa-sidan", "fristaden" eller "sidan med ritualerna" menar hon detta. Startar hon en ny session: fortsätt med nästa punkt i överlämningen. Ge henne alltid en ny, verifierad testlänk när något är klart.

## Datorstyrning (computer use)

Fungerar bara i sessioner som körs **lokalt på Annas dator**, inte i molnet. Om en molnsession ska styra hennes dator, eller det blir krångligt: be Anna starta en ny session och i knappen **Default** (molnikon, ovanför skrivrutan) byta från molnet till lokalt. Detaljer i `AGENTS.md` → "Datorstyrning".

## Sync convention

This repo is shared across multiple fronts: OpenClaw running locally, and Claude Code sessions elsewhere (web or otherwise). `master` is the single source of truth everyone syncs against.

- **Before working:** pull latest `master` so you're not acting on stale state.
- **After changes meant to be visible everywhere** (notes, lists, memory, docs): commit and push straight to `master` (fast-forward when possible) rather than leaving them stranded on a feature branch — a branch nobody merges is invisible to every other session.
- This doesn't relax normal care around destructive operations, secrets, or anything external-facing — see `AGENTS.md` Red Lines. It only means routine syncing of plain notes/files to `master` doesn't need to be re-confirmed every time.
