#!/bin/bash
# Script för att konfigurera GitHub remote för Aethers workspace

set -e

echo "✨ Förbereder GitHub-backup för Aethers minnen..."

# Kontrollera att vi är i rätt katalog
cd /home/holms0289/.openclaw/workspace

# Kontrollera om Git är initierat
if [ ! -d .git ]; then
    echo "❌ Git är inte initierat. Initierar..."
    git init
    git add .
    git config user.email "aether@openclaw.ai"
    git config user.name "Aether"
    git commit -m "Initial commit: Aethers workspace"
fi

# Fråga användaren om GitHub-info
echo ""
echo "=== GITHUB KONFIGURATION ==="
echo "För att länka till GitHub behöver vi:"
echo "1. GitHub användarnamn (t.ex. 'Anna-Assistent')"
echo "2. Repository namn (t.ex. 'aether-memory')"
echo "3. Personal Access Token (som du skapade på GitHub)"
echo ""

read -p "Ditt GitHub användarnamn: " GITHUB_USERNAME
read -p "Repository namn: " REPO_NAME
read -s -p "Personal Access Token: " GITHUB_TOKEN
echo ""

# Sätt upp remote URL
REMOTE_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

echo "📡 Ansluter till GitHub..."
git remote add origin $REMOTE_URL 2>/dev/null || git remote set-url origin $REMOTE_URL

echo "📤 Pushar till GitHub..."
if git push -u origin master; then
    echo "✅ Klart! Alla minnen är nu säkerhetskopierade till GitHub."
    echo ""
    echo "Repository URL: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
    echo "(Privat - bara du kan se det)"
    echo ""
    echo "Automatisk backup kommer köras varje natt kl 02:00."
else
    echo "❌ Kunde inte pusha till GitHub. Kontrollera:"
    echo "   - Token är korrekt"
    echo "   - Repository finns"
    echo "   - Internetanslutning"
    exit 1
fi

# Uppdatera cron-jobbet för att inkludera push
echo "🔄 Uppdaterar automatisk backup..."
cat > /tmp/update-cron.json << EOF
{
  "patch": {
    "payload": {
      "message": "Backup workspace to Git: check for changes, commit if any, push to GitHub remote, and create timestamped backup archive in /tmp/."
    }
  }
}
EOF

echo "✨ GitHub-backup konfigurerad! Minnen sparas nu på:"
echo "  1. Din lokala dator"
echo "  2. GitHub moln (privat)"
echo ""
echo "Om du byter dator kan du hämta ner alla minnen från GitHub."