# PROJEKTLEDARE: ANNA — FULLSTÄNDIG ÖVERSIKT

*Senast uppdaterad: 2026-04-22*

## 🎯 MÅL: Organiserat driv för alla Annas projekt med 100% synk

## 📅 PRIORITERINGAR (bekräftade 2026-04-21)

### 1. 🥇 Gmail-organisering
- [ ] **Kör OAuth-autentisering**: `gcloud auth application-default-login --scopes=https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.modify` — ANSVAR: Anna (kör kommandot i terminalen)
- [ ] Skapa faktura-mappar:
  - Mapp "Löpande" — privata prenumerationer & köp
  - Mapp "BODY MIND EARTH" — företagsköp via proinvest
- [ ] Automatisera sortering av fakturor — ANSVAR: Aether (när OAuth är klart)
- [ ] Airbnb-mail → Papperskorg (✅ redan löst manuellt av Anna)
- [ ] Gmail-skript `send_gmail.py` redo — ANSVAR: Aether

### 2. 🥈 Shopify — bodymindearth.se
- [ ] Koppla domän till Shopify — ANSVAR: Aether
- [ ] Koppla Google Workspace-mail — ANSVAR: Aether
- [ ] Produktlistor och SEO — ANSVAR: Gemensamt
- [ ] Färdigställ efter etikett-inskick — ANSVAR: Aether

### 3. 🥉 Juridiska ärenden
- [ ] Förbereda dokument för stämning av arbetsgivare — ANSVAR: Gemensamt
- [ ] Kontakta försäkringsbolag om advokatkostnader — ANSVAR: Anna (påminnelse: Aether)
- [ ] Ansöka om ersättning för köksluckor — ANSVAR: Anna (påminnelse: Aether)
- [ ] Kontakta fackförbund för utökad försäkring — ANSVAR: Anna (påminnelse: Aether)

## 🏥 HÄLSOSYSTEM (PÅGÅENDE)
- [x] **Cellprov-rutin**: Veckovis måndagar 06:00 påminnelse — ANSVAR: Aether
- [ ] **COMT SNABB + DÅLIG METYLERING**: Dagliga förslag för optimalt mående — ANSVAR: Aether
- [ ] **Daglig mående/träning-log**: Anna loggar, Aether analyserar
- [ ] **Medicinpåminnelser**: Östrogengel/spray — ANSVAR: Aether
- [ ] **Hälsologg**: `health/mood-training-2026-03.md`

## 🛠️ TEKNISKA SYSTEM

### Gmail & Google Workspace
- [ ] **Gmail OAuth**: Väntar på att Anna kör gcloud-kommandot (kritisk blockerare)
- [ ] Koppla bodymindearth.se till Google Workspace
- [ ] Migrera från Loopia till Google Workspace
- [ ] Shopify-integration

### Telegram
- [x] Pairing godkänd för Anna
- [ ] Fixa chatId-konfiguration för alla cron-jobb

## 📊 PROJEKTLEDAR-METODIK

### Daglig rapportering
1. **07:00**: Morgonrapport (dagens deadlines, hälsotips)
2. **12:00**: Lunchcheck (status på förmiddagens uppgifter)
3. **18:00**: Slutrapport (vad avslutat, nästa dag)

### Påminnelsesystem
- **24h före deadline**: Första påminnelse
- **2h före deadline**: Andra påminnelse
- **30min före deadline**: Sista påminnelse

### Synkning mobil-dator
- Alla filer synkas via OpenClaw workspace
- Projektledar-fil uppdateras vid varje ändring
- MEMORY.md är källan för all långtidsinformation

## 🔄 STATUS ÖVERSIKT
- [x] Projektledar-fil skapad: 2026-03-29
- [x] Telegram konfigurerad
- [x] Backup-system aktivt (Git + `send_email.sh`)
- [x] Cellprov-påminnelse aktiv
- [x] Airbnb-filter löst (manuellt av Anna)
- [ ] Gmail OAuth-autentisering — VÄNTAR
- [ ] Google Calendar — EJ PÅBÖRJAT
- [ ] Röstfunktioner — EJ PÅBÖRJAT
- [ ] Telegram chatId för cron — EJ FIXAT
- [ ] Shopify setup — VÄNTAR

## 🚨 KONTINUITET
Om Aether inte svarar:
1. All information finns i MEMORY.md, projects/project-leader-anna.md
2. Webchat tillgänglig på http://localhost:18789
3. Telegram är primär kanal

## 📞 KONTAKT/ANSVAR
- **Anna**: Beslutsfattare, utförare
- **Aether**: Planering, påminnelser, teknisk implementation, coaching
