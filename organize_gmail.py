#!/usr/bin/env python3
"""
Aethers Gmail-organizer för Anna
Organiserar automatiskt: Airbnb → papperskorg
"""

import imaplib
import email
from email.header import decode_header
import time
import logging
from typing import List, Tuple

# Konfiguration (ska hämtas från säkert ställe senare)
GMAIL_IMAP = "imap.gmail.com"
# NOTE: Anna behöver skapa ett app-specifikt lösenord och sätta här
# Eller vi använder OAuth2 - det är säkrare

class GmailOrganizer:
    def __init__(self, email: str, password: str):
        self.email = email
        self.password = password
        self.imap = None
        
    def connect(self) -> bool:
        """Anslut till Gmail via IMAP"""
        try:
            self.imap = imaplib.IMAP4_SSL(GMAIL_IMAP)
            self.imap.login(self.email, self.password)
            print(f"✅ Ansluten till {self.email}")
            return True
        except Exception as e:
            print(f"❌ Kunde inte ansluta: {e}")
            return False
    
    def find_airbnb_emails(self) -> List[str]:
        """Hitta alla Airbnb-mail"""
        if not self.imap:
            return []
        
        try:
            self.imap.select("INBOX")
            # Sök efter Airbnb-mail
            status, messages = self.imap.search(None, '(OR FROM "airbnb" FROM "@airbnb.com" SUBJECT "Airbnb")')
            
            if status != "OK":
                return []
            
            email_ids = messages[0].split()
            print(f"📨 Hittade {len(email_ids)} Airbnb-mail")
            return email_ids
            
        except Exception as e:
            print(f"❌ Fel vid sökning: {e}")
            return []
    
    def move_to_trash(self, email_ids: List[str]) -> int:
        """Flytta mail till papperskorg"""
        if not email_ids:
            return 0
        
        try:
            # Konvertera ID:n till komma-separerad sträng
            ids_str = ",".join([id.decode() for id in email_ids])
            
            # Kopiera till papperskorg
            self.imap.copy(ids_str, "[Gmail]/Papperskorg")
            
            # Ta bort från inkorgen
            self.imap.store(ids_str, '+FLAGS', '\\Deleted')
            self.imap.expunge()
            
            print(f"🗑️  Flyttade {len(email_ids)} mail till papperskorg")
            return len(email_ids)
            
        except Exception as e:
            print(f"❌ Fel vid flytt: {e}")
            return 0
    
    def disconnect(self):
        """Koppla från"""
        if self.imap:
            try:
                self.imap.close()
                self.imap.logout()
                print("✅ Kopplad från")
            except:
                pass
    
    def organize(self) -> Tuple[int, int]:
        """Huvudfunktion: Organisera mail"""
        total_found = 0
        total_moved = 0
        
        if not self.connect():
            return (0, 0)
        
        try:
            # 1. Hitta Airbnb-mail
            airbnb_ids = self.find_airbnb_emails()
            total_found = len(airbnb_ids)
            
            # 2. Flytta till papperskorg
            if airbnb_ids:
                total_moved = self.move_to_trash(airbnb_ids)
            
            return (total_found, total_moved)
            
        finally:
            self.disconnect()

def main():
    """Exempel på användning"""
    print("=" * 50)
    print("Aethers Gmail-organizer för Anna")
    print("=" * 50)
    
    # HÄR BEHÖVS ANNAS UPPGIFTER:
    # 1. Gmail-adress: holmstrom2ster@gmail.com
    # 2. App-specifikt lösenord från Google
    
    email = "holmstrom2ster@gmail.com"
    # password = "HÄR_SKALL_APP_SPECIFIKT_LÖSENORD_VARA"
    
    print(f"📧 Måladress: {email}")
    print("⚠️  OBS: Behöver app-specifikt lösenord från Google")
    print("=" * 50)
    
    # Skapa instruktioner för Anna
    instructions = """
    INSTRUKTIONER FÖR ATT SKAPA APP-SPECIFIKT LÖSENORD:
    
    1. Gå till: https://myaccount.google.com/security
    2. Klicka på "Tvåstegsverifiering" (måste vara aktiverat)
    3. Klicka på "App-lösenord"
    4. Välj "E-post" och "Övrigt (Anpassat namn)"
    5. Skriv "Aether Mail Organizer"
    6. Klicka "Generera"
    7. Kopiera det 16-tecken långa lösenordet
    8. Skicka det till mig (Aether) på ett SÄKERT sätt
    
    När jag har lösenordet kan jag automatiskt:
    • Flytta ALLA Airbnb-mail till papperskorg
    • Organisera fakturor i rätt mappar
    • Skapa automatiska filter
    """
    
    print(instructions)
    
    # Simulera vad som händer när vi har lösenordet
    print("\n" + "=" * 50)
    print("SIMULERING: Vad som händer när jag har åtkomst:")
    print("-" * 50)
    print("1. ✅ Ansluter till Gmail")
    print("2. 🔍 Söker efter Airbnb-mail")
    print("3. 🗑️  Flyttar till papperskorg automatiskt")
    print("4. 📁 Organiserar fakturor i 'Löpande' och 'BODY MIND EARTH'")
    print("5. 🔄 Körs automatiskt varje dag")
    print("=" * 50)

if __name__ == "__main__":
    main()