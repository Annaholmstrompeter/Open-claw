# GMAIL FALLBACK PLAN - Aethers åtgärd

**Problem:** Gmail API-integration fungerar inte
**Lösning:** Använd IMAP direkt via skript

## **Steg 1: Skapa IMAP-skript för Airbnb-filter**
```bash
#!/bin/bash
# Aethers IMAP mail-organizer för Anna
# Hanterar: Airbnb → papperskorg automatiskt
```

## **Steg 2: Använd annat verktyg**
- **Option 1:** `imapfilter` med konfiguration
- **Option 2:** `fetchmail` + `procmail` pipeline
- **Option 3:** Python-skript med `imaplib`

## **Steg 3: Säkerhetsåtgärd**
- App-specifikt lösenord från Google
- Endast läs/skriv till papperskorg
- Inga andra behörigheter

## **Deadline:** Imorgon 12:00
**Resultat:** Airbnb-mail går automatiskt till papperskorg utan Annas inblandning.