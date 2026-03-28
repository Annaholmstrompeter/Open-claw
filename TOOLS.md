# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## Anna's Setup

### Telegram
- Bot token configured in OpenClaw.
- Pairing approved for user ID `6414233850` (Anna).
- DM policy: pairing.
- Group policy: allowlist (currently only wildcard `*` with requireMention).

### Calendar
- Not yet configured. Need to explore Google Calendar API or CalDAV integration.

### Voice (TTS/STT)
- Not yet configured. Explore ElevenLabs (`sag`) or other TTS providers.

### Skills to explore
- `weather` skill available.
- `skill-creator` for creating custom skills.
- `tmux` for remote CLI control.
- `healthcheck` for security audits.
- `node-connect` for device pairing.

### OpenClaw Status
- Gateway running locally on port 18789.
- Default model: gemini-3-flash-preview.
- Brave search API configured.
