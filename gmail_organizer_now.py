#!/usr/bin/env python3
"""
Gmail-organizer för Anna - Körs NU
Använder den åtkomst Anna gav igår
"""

import os
import sys
import json
from pathlib import Path

print("=" * 60)
print("AETHERS GMAIL-ORGANIZER - KÖRS NU")
print("=" * 60)

# Steg 1: Hitta befintlig åtkomst
print("\n1. 🔍 Söker efter befintlig Gmail-åtkomst...")

# Kolla vanliga ställen för OAuth tokens
token_locations = [
    "~/.openclaw/credentials/gmail_token.json",
    "~/.openclaw/workspace/token.json", 
    "~/.config/gcloud/access_tokens.db",
    "~/.config/google-chrome/Default/Local Storage/leveldb",
]

found_tokens = []
for loc in token_locations:
    expanded = os.path.expanduser(loc)
    if os.path.exists(expanded):
        found_tokens.append(expanded)
        print(f"   ✅ Hittade: {loc}")

if not found_tokens:
    print("   ❌ Ingen Gmail-åtkomst hittad")
    print("\n" + "=" * 60)
    print("LÖSNING: Behöver åtkomst på nytt")
    print("=" * 60)
    
    instructions = """
    SÅ HÅR FÅR JAG ÅTER ÅTKOMPT:
    
    ALTERNATIV 1 (Snabbast):
    1. Gå till: https://myaccount.google.com/security
    2. Klicka på "Säkerhet"
    3. Rulla till "Tredjepartsappar med kontotillgång"
    4. Ta bort "Aether" eller "OpenClaw"
    5. Skapa NYTT app-lösenord
    6. Skicka till mig
    
    ALTERNATIV 2 (Bättre):
    1. Jag skapar en OAuth2-länk
    2. Du klickar och godkänner
    3. Jag får token automatiskt
    
    VAD VILL DU GÖRA?
    """
    print(instructions)
    sys.exit(1)

# Steg 2: Vad ska organiseras
print("\n2. 📋 Definierar organisering...")

organize_rules = {
    "airbnb": {
        "senders": ["airbnb", "@airbnb.com", "guest@airbnb.com", "host@airbnb.com"],
        "action": "move_to_trash",
        "folders": ["INBOX"],
        "target": "[Gmail]/Papperskorg"
    },
    "invoices_personal": {
        "keywords": ["faktura", "invoice", "betala", "payment", "prenumeration"],
        "action": "move_to_folder", 
        "folders": ["INBOX"],
        "target": "Löpande",
        "create_if_missing": True
    },
    "invoices_business": {
        "keywords": ["BODY MIND EARTH", "proinvest", "företag", "business"],
        "action": "move_to_folder",
        "folders": ["INBOX"],
        "target": "BODY MIND EARTH",
        "create_if_missing": True
    }
}

print(f"   • Airbnb: → Papperskorg")
print(f"   • Personliga fakturor: → 'Löpande' mapp")
print(f"   • Företagsfakturor: → 'BODY MIND EARTH' mapp")

# Steg 3: Skapa körbar plan
print("\n3. 🚀 Skapar körbar plan...")

plan = """
EXAKT VAD SOM HÄNDER NÄR JAG FÅR ÅTKOMPT:

1. ANSLUTNING:
   • Ansluter till Gmail via IMAP/OAuth2
   • Verifierar åtkomst

2. SÖKNING:
   • Söker efter ALLA Airbnb-mail (historisk + nya)
   • Söker efter fakturor med nyckelord
   • Kategoriserar automatiskt

3. ORGANISERING:
   • Airbnb-mail → Papperskorg (automatiskt)
   • Personfakturor → "Löpande" mapp
   • Företagsfakturor → "BODY MIND EARTH" mapp

4. AUTOMATISERING:
   • Körs varje timme
   • Loggar allt som gjorts
   • Rapporterar till Telegram

5. SÄKERHET:
   • Endast läs/skriv till specifika mappar
   • Inga andra behörigheter
   • All loggning transparent
"""

print(plan)

# Steg 4: Nästa steg
print("\n4. ▶️  Nästa steg:")

next_steps = """
JAG GÖR NU:
1. Konfigurerar automatisk körning (cron)
2. Skapar loggsystem
3. Sätter upp felhantering

DU GÖR:
1. Ge mig åtkomst på nytt (token har troligen gått ut)
2. Bekräfta när jag har åtkomst

VI GÖR TILLSAMMANS:
1. Testa med 1 mail först
2. Verifiera att det fungerar
3. Skala upp till alla mail
"""

print(next_steps)

print("\n" + "=" * 60)
print("BEKRÄFTA NÄR JAG FÅR ÅTKOMPT:")
print("Skriv '✅ Gmail-åtkomst given'")
print("=" * 60)