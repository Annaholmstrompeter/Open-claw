#!/usr/bin/env python3
"""
Enkel e-postskickare med SMTP.
Kräver att du har skapat ett app-lösenord i Google-kontot.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

def send_email_via_smtp():
    """Skicka e-post via Gmail SMTP med app-lösenord."""
    
    # Konfiguration
    sender_email = "holmstrom2ster@gmail.com"
    receiver_email = "holmstrom2ster@gmail.com"
    
    # App-lösenord (måste skapas i Google-konto säkerhetsinställningar)
    # Gå till: https://myaccount.google.com/apppasswords
    # Skapa ett app-lösenord för "Mail"
    app_password = ""  # LÄGG TILL DITT APP-LÖSENORD HÄR
    
    subject = "Test från Aether - E-postintegration pågår ✨"
    
    body = """Hej Anna! ✨

Detta är ett testmeddelande från din assistent Aether. Jag arbetar just nu med att konfigurera full e-postintegration via OpenClaws Gmail-plugin.

**Status:**
✅ Telegram-automatisering redan aktiv (morgonuppdatering, dagliga check-ins)
🔄 Gmail-integration pågår (installerar gcloud)
🎯 När klar: Jag kan skicka och läsa e-post åt dig

**Vad jag redan kan göra:**
1. Skicka Telegram-meddelanden till dig regelbundet
2. Påminna om cellprov varje måndag
3. Ge morgonuppdateringar 07:00
4. Checka in 4 gånger/dag (endast om viktigt)

**Nästa steg:**
När Gmail-integrationen är klar kommer jag automatiskt:
- Hantera dina e-postfilter (Airbnb → papperskorg)
- Organisera fakturor i rätt mappar
- Skicka viktiga påminnelser via e-post

Med transformerande energi,
Aether ✨

PS: Svara på detta meddelande så vet jag att det kom fram!"""
    
    if not app_password:
        print("❌ App-lösenord saknas!")
        print("\nFör att skicka e-post automatiskt behöver du:")
        print("1. Gå till https://myaccount.google.com/apppasswords")
        print("2. Logga in med ditt Google-konto")
        print("3. Välj 'Mail' och 'Other (Custom name)'")
        print("4. Namnge det t.ex. 'OpenClaw'")
        print("5. Kopiera det 16-tecken långa lösenordet")
        print("6. Lägg till det i app_password variabeln ovan")
        return False
    
    try:
        # Skapa meddelande
        message = MIMEMultipart()
        message["From"] = sender_email
        message["To"] = receiver_email
        message["Subject"] = subject
        
        # Lägg till brödtext
        message.attach(MIMEText(body, "plain", "utf-8"))
        
        # Skicka e-post
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender_email, app_password)
            server.sendmail(sender_email, receiver_email, message.as_string())
        
        print("✅ E-post skickat via Gmail SMTP!")
        return True
        
    except Exception as e:
        print(f"❌ Fel vid skickande av e-post: {e}")
        return False

if __name__ == "__main__":
    send_email_via_smtp()