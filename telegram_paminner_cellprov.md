# Telegram Påminnelse - Cellprov

## Instruktioner för att skapa automatisk påminnelse:

### Alternativ 1: Använda OpenClaw Cron
1. Skapa en cron-jobb i OpenClaw:
```bash
openclaw cron create --name "cellprov_mandag" --schedule "0 6 * * 1" --command "telegram send --to 6414233850 --message '🔬 Cellprov - Kom ihåg att ta ditt cellprov idag!'"
```

### Alternativ 2: Använda system-cron
1. Öppna crontab:
```bash
crontab -e
```

2. Lägg till följande rad:
```
0 6 * * 1 /usr/bin/curl -s -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" -d "chat_id=6414233850&text=🔬 Cellprov - Kom ihåg att ta ditt cellprov idag!"
```

### Alternativ 3: Använda Telegram Bot direkt
1. Skapa en bot via @BotFather på Telegram
2. Spara bot-token
3. Använd följande Python-skript:

```python
import schedule
import time
import requests

def send_reminder():
    bot_token = "YOUR_BOT_TOKEN"
    chat_id = "6414233850"
    message = "🔬 Cellprov - Kom ihåg att ta ditt cellprov idag!"
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    data = {"chat_id": chat_id, "text": message}
    requests.post(url, data=data)

# Schemalägg varje måndag kl 06:00
schedule.every().monday.at("06:00").do(send_reminder)

while True:
    schedule.run_pending()
    time.sleep(60)
```

## Meddelandeformat:
**Tid:** Varje måndag 06:00
**Text:** "🔬 Cellprov - Kom ihåg att ta ditt cellprov idag!"
**Ton:** Vänlig, påminnande, stödjande

## Ytterligare påminnelser att överväga:
1. **24 timmar före:** "Kom ihåg cellprov imorgon - förbered vad du behöver"
2. **2 timmar före:** "Cellprov om 2 timmar - drick vatten och var förberedd"
3. **Efter provet:** "Bra jobbat! Kom ihåg att följa upp med läkaren om några dagar"

## Testa påminnelsen:
Testa att skicka ett testmeddelande först för att verifiera att allt fungerar.