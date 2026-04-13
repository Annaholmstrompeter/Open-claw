#!/usr/bin/env python3
"""
Skicka e-post via Gmail API.
För att använda:
1. Aktivera Gmail API i Google Cloud Console
2. Skapa OAuth 2.0 credentials
3. Spara credentials som credentials.json i samma mapp
"""

import os
import base64
from email.mime.text import MIMEText
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Om du ändrar dessa scopes, radera token.json
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

def get_credentials():
    """Hämta eller skapa OAuth2 credentials."""
    creds = None
    # token.json sparar användarens access och refresh tokens
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # Om inga giltiga credentials finns, låt användaren logga in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Spara credentials för nästa gång
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    
    return creds

def create_message(sender, to, subject, message_text):
    """Skapa ett e-postmeddelande."""
    message = MIMEText(message_text, 'plain', 'utf-8')
    message['to'] = to
    message['from'] = sender
    message['subject'] = subject
    
    # Konvertera till base64-url-safe string
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
    return {'raw': raw_message}

def send_message(service, user_id, message):
    """Skicka ett e-postmeddelande."""
    try:
        message = service.users().messages().send(
            userId=user_id, body=message).execute()
        print(f'Meddelande skickat. Message Id: {message["id"]}')
        return message
    except HttpError as error:
        print(f'Ett fel uppstod: {error}')
        return None

def main():
    """Huvudfunktion för att skicka test-e-post."""
    sender = "holmstrom2ster@gmail.com"  # Din Gmail-adress
    to = "holmstrom2ster@gmail.com"      # Mottagarens e-post
    subject = "Test från Aether - E-postintegration pågår ✨"
    
    message_text = """Hej Anna! ✨

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
    
    try:
        # Hämta credentials
        creds = get_credentials()
        
        # Bygg Gmail API service
        service = build('gmail', 'v1', credentials=creds)
        
        # Skapa och skicka meddelande
        message = create_message(sender, to, subject, message_text)
        send_message(service, "me", message)
        
        print("✅ E-post skickat via Gmail API!")
        
    except Exception as e:
        print(f"❌ Fel vid skickande av e-post: {e}")
        print("\nFör att konfigurera Gmail API:")
        print("1. Gå till https://console.cloud.google.com/")
        print("2. Skapa ett nytt projekt eller välj befintligt")
        print("3. Aktivera Gmail API")
        print("4. Skapa OAuth 2.0 credentials (Desktop app)")
        print("5. Ladda ner credentials.json och placera i denna mapp")
        print("6. Kör skriptet igen")

if __name__ == '__main__':
    main()