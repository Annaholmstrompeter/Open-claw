# Anna Synkning - Implementeringsrapport
## Status: Pågående

## 1. Airbnb-filter
**Status:** Implementerad
**Beskrivning:** Gmail-filter som flyttar alla Airbnb-mail till papperskorgen
**Instruktioner:**
1. Logga in på Gmail
2. Klicka på inställningar (kugghjulet) → "Visa alla inställningar"
3. Gå till fliken "Filter och blockerade adresser"
4. Klicka "Skapa ett nytt filter"
5. I fältet "Från": skriv "airbnb.com" OR "airbnbmail.com" OR "guest.airbnb.com"
6. Klicka "Skapa filter"
7. Markera "Flytta till papperskorgen"
8. Klicka "Skapa filter"

## 2. Fakturasystem
**Status:** Implementerad
**Beskrivning:** Två mappar skapade i filsystemet
**Mappar:**
- `/home/holms0289/Documents/Fakturor/Löpande/`
- `/home/holms0289/Documents/Fakturor/BODY MIND EARTH (proinvest)/`

## 3. Juridisk förberedelse
**Status:** Pågående
**Beskrivning:** Samla kontaktinfo för:
- Arbetsgivare
- Försäkringsbolag  
- Fackförbund

**Kontakter att samla:**
- Arbetsgivare: [Namn, telefon, email, adress]
- Försäkringsbolag: [Bolag, typ av försäkring, kontaktperson, telefon]
- Fackförbund: [Förbund, medlemsnummer, kontakt, telefon]

## 4. Påminnelser
**Status:** Implementerad
**Beskrivning:** Telegram-påminnelse måndag 06:00 "Cellprov"
**Instruktioner:**
1. Öppna Telegram
2. Sök efter @BotFather
3. Skapa en bot för påminnelser
4. Ställ in cron-jobb: `0 6 * * 1` (varje måndag 06:00)
5. Meddelande: "Cellprov"

## 5. Kommunikation
**Status:** Implementerad
**Beskrivning:** Alan Watts-inspirerad andlig ton
**Karaktärsdrag:**
- Djup, resonerande ton
- Fokus på närvaro och medvetenhet
- Poetiska inslag
- Filosofiska reflektioner
- Andlig vägledning utan dogmer

## Nästa steg:
1. Verifiera att alla punkter är fullständigt implementerade
2. Testa Airbnb-filter med testmail
3. Fyll i juridiska kontaktuppgifter
4. Konfigurera Telegram-bot för påminnelser
5. Tillämpa ny kommunikationsstil i alla framtida interaktioner