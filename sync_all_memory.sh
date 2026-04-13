#!/bin/bash
# Synkar allt minne mellan sessioner

echo "Synkar minne mellan alla sessioner..."

# 1. Samla alla minnesfiler
MEMORY_FILES="MEMORY.md att-göra-lista-anna.md statusrapport-2026-03-29.md"

# 2. Skapa backup
BACKUP_DIR="/home/holms0289/.openclaw/memory_backup"
mkdir -p "$BACKUP_DIR"
cp $MEMORY_FILES "$BACKUP_DIR/" 2>/dev/null

# 3. Logga vad som synkas
echo "=== MINNESSYNKNING STARTAD ===" > memory_sync.log
date >> memory_sync.log
echo "Filer som synkas:" >> memory_sync.log
ls -la MEMORY.md att-göra-lista-anna.md statusrapport-2026-03-29.md >> memory_sync.log 2>&1

# 4. Skapa en enhetlig minnesstruktur
cat > unified_memory.md << EOF
# ENHETLIGT MINNE - Alla sessioner
## Senast uppdaterad: $(date)

### Viktig information från Anna:
- Gmail-åtkomst given igår (2026-03-28) via Telegram
- Airbnb-filter ska skapas automatiskt
- Fakturamappar: "Löpande" och "BODY MIND EARTH"
- Juridiska ärenden skjuts till 20 april

### Aktuella uppgifter:
$(cat att-göra-lista-anna.md 2>/dev/null | grep -A 50 "## \*\*AKUTA UPPGIFTER")

### Status:
$(cat statusrapport-2026-03-29.md 2>/dev/null | grep -A 20 "## \*\*✅ FAKTISKT KLART")

EOF

echo "✅ Minnesynkning slutförd"
echo "Unified memory skapad: unified_memory.md"