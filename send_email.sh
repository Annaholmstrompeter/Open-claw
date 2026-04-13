#!/bin/bash

# Enkel e-postskickare som backup tills Gmail-integrationen är klar
# Använder curl för att skicka via en SMTP-relay eller webhook

TO_EMAIL="holmstrom2ster@gmail.com"
SUBJECT="$1"
BODY="$2"

# Logga först
echo "[$(date)] Försöker skicka e-post till: $TO_EMAIL" >> /home/holms0289/.openclaw/workspace/email_log.txt
echo "Ämne: $SUBJECT" >> /home/holms0289/.openclaw/workspace/email_log.txt

# Metod 1: Prova med sendmail om det finns
SENDMAIL_PATH="/usr/libexec/sendmail/sendmail"
if [ -f "$SENDMAIL_PATH" ]; then
    echo "Använder sendmail..." >> /home/holms0289/.openclaw/workspace/email_log.txt
    (
        echo "To: $TO_EMAIL"
        echo "Subject: $SUBJECT"
        echo "Content-Type: text/plain; charset=UTF-8"
        echo ""
        echo "$BODY"
    ) | "$SENDMAIL_PATH" "$TO_EMAIL" 2>> /home/holms0289/.openclaw/workspace/email_log.txt
    echo "Sendmail skickat." >> /home/holms0289/.openclaw/workspace/email_log.txt
    
# Metod 2: Prova med curl till en webhook
elif command -v curl &> /dev/null; then
    echo "Försöker med curl..." >> /home/holms0289/.openclaw/workspace/email_log.txt
    # Här kan vi lägga till en webhook-URL senare
    echo "Curl finns men ingen webhook konfigurerad än." >> /home/holms0289/.openclaw/workspace/email_log.txt
    
else
    echo "Inget e-postverktyg hittades." >> /home/holms0289/.openclaw/workspace/email_log.txt
fi

echo "----------------------------------------" >> /home/holms0289/.openclaw/workspace/email_log.txt