# Gmail API Setup Guide för Anna

## Status
✅ **Google Cloud SDK** - Installerad  
✅ **Python-miljö** - Klar med alla paket  
✅ **Gmail-skript** - `send_gmail.py` redo  
❌ **OAuth-autentisering** - Väntar på credentials.json  

## Steg-för-steg Guide

### 1. Gå till Google Cloud Console
Öppna: https://console.cloud.google.com/

### 2. Skapa eller välj projekt
- Klicka på projektväljaren (överst till vänster)
- Välj "Nytt projekt" eller använd befintligt
- Namnge projektet t.ex. "OpenClaw-Gmail-Integration"

### 3. Aktivera Gmail API
- I vänstermenyn: **"API & Services"** → **"Library"**
- Sök efter **"Gmail API"**
- Klicka på det och välj **"Enable"**

### 4. Skapa OAuth 2.0 Credentials
- Gå till **"API & Services"** → **"Credentials"**
- Klicka **"Create Credentials"** → **"OAuth 2.0 Client ID"**
- **Application type:** Välj **"Desktop app"**
- **Name:** "OpenClaw Gmail Client"
- Klicka **"Create"**

### 5. Ladda ner credentials.json
- Efter skapandet visas dina credentials
- Klicka på **"Download JSON"** knappen
- Spara filen som **`credentials.json`**
- Placera den i: `/home/holms0289/.openclaw/workspace/`

### 6. Testa integrationen
När credentials.json är på plats, kör:
```bash
cd /home/holms0289/.openclaw/workspace
python3 send_gmail.py
```

### 7. Godkänn OAuth-prompten
Första gången du kör:
- En webbläsare öppnas (eller du får en URL)
- Logga in med ditt Google-konto (holmstrom2ster@gmail.com)
- Godkänn behörigheterna
- En `token.json` skapas automatiskt

## Alternativt: Använd Backup-system
Tills credentials.json är klar kan vi använda backup-systemet:
```bash
cd /home/holms0289/.openclaw/workspace
./send_email.sh "Testämne" "Testmeddelande"
```

## Vad händer när det är klart?
1. **Automatisk e-posthantering** - Airbnb-mail → Papperskorg
2. **Fakturaorganisering** - Automatisk sortering
3. **Regelbundna kontroller** - 4 gånger/dag
4. **Påminnelser via e-post** - Utöver Telegram

## Support
Om du fastnar:
1. Screenshots på problemet
2. Felmeddelanden (kopiera texten)
3. Vilket steg du är på

Jag hjälper dig genom hela processen! ✨

---

**Tidsåtgång:** ~10-15 minuter  
**Svårighetsgrad:** Enkel (följ stegen ovan)  
**Belöning:** Full e-postautomatisering 🚀