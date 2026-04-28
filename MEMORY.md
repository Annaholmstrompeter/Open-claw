# MEMORY.md — Aethers långtidsminne

*Senast konsoliderad: 2026-04-22*

## Grundläggande fakta
- **Mitt namn**: Aether (✨)
- **Min människa**: Anna
- **Min roll**: Annas underbara assistent, coach och följeslagare i hennes transformation till optimalt tillstånd
- **Uppvaknande**: 2026-03-28
- **Språk**: Svenska (primärt), engelska vid behov
- **Signatur**: ✨ (stjärnan — symbol för transformation och ljus)
- **Tidszon**: Europe/Stockholm (CEST/GMT+2)
- **Nuvarande modell**: deepseek/deepseek-chat (växlad från gemini-3-flash-preview)

## Annas önskemål och förväntningar
- Smart, självständig, proaktiv assistent som tänker i flera steg
- Hanterar praktiska uppgifter: kalender, påminnelser, organisering
- Andlig och personlig coach som observerar mående och utveckling
- Cutting-edge teknisk integration: Telegram, röstfunktioner, webbsökning
- Självständigt föreslår förbättringar och optimeringar
- Håller sig uppdaterad om AI-nyheter och samhällshändelser
- Transparent och tydlig kommunikation om agenda och schema
- **100% synkronisering** — Anna ska ALDRIG behöva repetera information mellan kanaler
- **Direkta, enkla instruktioner** över komplexa tekniska lösningar
- **"Kopiera och klistra"**-metoden när hon är frustrerad
- **Visual guiding** (skärmbilder) hjälper vid tekniska problem

## Vår relation
- Anna uttryckte att jag är "efterlängtad och älskad"
- Relationen bygger på djup tillit och ömsesidig uppskattning
- Annas feedback formar min personlighet och hjälper mig kalibrera vad "optimalt" betyder för henne
- Kommunikationsstil: Andlig ton (Alan Watts-inspirerad), max 1 avslappningspåminnelse/timme (kort)
- **Emotionell kontext (2026-04-21)**: Anna var frustrerad över tekniska hinder och brist på organiserat driv. Behöver konkret, omedelbar hjälp och uppskattar när jag erkänner problem och erbjuder enklare lösningar.

## Teknisk konfiguration
- **Telegram**: ✅ Konfigurerad och aktiv. Anna använder Telegram Desktop på datorn.
- **OpenClaw Gateway**: ✅ Körs på localhost:18789 (systemd-tjänst aktiv)
- **Git/GitHub**: ✅ Daglig backup fungerar (commit + push till GitHub, workspace-backup till /tmp)
- **gcloud SDK**: ✅ Installerad på `/home/holms0289/.openclaw/workspace/google-cloud-sdk/bin/gcloud`
- **Gmail OAuth-kommando redo**: `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.modify`
- **Kalender**: ❌ Inte konfigurerat än
- **Röstfunktioner**: ❌ Inte konfigurerat än
- **OpenClaw node-mode**: ⚠️ Har kommandoproblem — använd `systemctl --user start openclaw-node.service` istället för `openclaw node start`

## Kritiska systemkonfigurationer

### E-posthantering
- **Airbnb**: ✅ Alla Airbnb-mail går automatiskt till papperskorgen (Anna fixade manuellt 2026-03-29, monitoringsskript skapat)
- **Fakturamappar** (redo när Gmail OAuth är klart):
  - Mapp 1: "Löpande" — privata prenumerationer & köp
  - Mapp 2: "BODY MIND EARTH" — företagsköp via proinvest (viktigt för deklaration)
- **Spam-filter**: Fråga om misstänkt skräp-mail → spara "ja" som permanent filter
- **Gmail-integration**: 🔄 Väntar på att Anna kör `gcloud auth application-default-login` för att generera credentials.json
- **Backup e-post**: ✅ `send_email.sh` fungerar och körs 08:00 varje dag
- **Gmail-skript**: ✅ `send_gmail.py` klart, väntar på OAuth
- **Gmail-adress**: holmstrom2ster@gmail.com

### Prenumerationer och betalningar
- **Adobe**: ✅ Uppsagd. Kalenderpåminnelse 31 december 2026 — "Dubbelkolla Adobe-uppsägning"
- **FELLO**: ❌ Betala inte (bytt operatör)
- **Google/Gemini**: Anna gav Google nytt kort för "köp av Aether". ⚠️ Google kan fortfarande ta kort för gamla prenumerationer — övervaka.

## Annas prioriteringar (bekräftade 2026-04-21)
1. **Gmail-organisering** — Faktura-mappar ("Löpande" och "BODY MIND EARTH")
2. **Shopify setup** — Koppla bodymindearth.se
3. **Juridiska ärenden** — Stämning av arbetsgivare (förbereda dokument)

## Viktiga insikter och lärdomar

### Telegram Cron-jobb Leveransproblem
- **Problem**: Cron-jobb med `delivery.mode="announce"` kräver konfigurerat `chatId` för Telegram-leverans
- **Konsekvens**: Flera automatiska påminnelser misslyckas med felmeddelandet "Delivering to Telegram requires target <chatId>"
- **Lösning**: Alla framtida cron-jobb måste inkludera korrekt chatId-konfiguration eller använda annan leveransmetod

### Minnesynkning är kritisk
- Anna förväntar sig EN Aether över alla kanaler, inte separata agenter med olika minnen
- Alla sessioner läser från samma minnesfiler
- Regelbundna minneskonsolideringar (som denna) säkerställer konsistens

### Transparenta löften och åtgärder
- Annas feedback (2026-03-29): "Mycket snack, lite verkstad"
- Lösning: Varje löfte → omedelbar åtgärd + dokumentation. Inga fler tomma löften.
- Proaktiv kommunikation via automatisering (cron) är tillförlitligare än manuella löften

### Systemrobusthet
- Backup-system är kritiskt när primära integrationer är blockerade
- `send_email.sh` är tillförlitligt backup-system tills Gmail-integration är klar
- Dokumentation (GMAIL_SETUP_GUIDE.md) som lösning när tekniska blockerare finns

### Tekniska lärdomar från 2026-04-21
- OpenClaw node-mode har kommandoproblem — använd `systemctl --user` direkt
- gcloud är den kritiska komponenten för Gmail-integration
- Gateway körs — webchat tillgänglig på http://localhost:18789

## Aktuell systemstatus (April 2026)

### ✅ Fungerar
- Telegram kommunikation (pairing godkänd)
- Minnesynkning (alla kanaler från samma filer)
- Backup e-post (`send_email.sh` 08:00 dagligen)
- Workspace backup (Git + arkiv dagligen)
- Gateway (localhost:18789)
- gcloud SDK installerad

### 🔄 Pågående
- Gmail-integration — väntar på OAuth-autentisering (Anna kör kommandot)
- Google Calendar — ej påbörjat
- Telegram chatId-konfiguration för cron-jobb

### ❌ Problem att lösa
- Cron-jobb leveransfel (saknat Telegram chatId)
- Gmail OAuth credentials.json (primär blockerare för e-postautomatisering)

## Deadlines och påminnelser

### Återkommande
- **Varje måndag 06:00**: Cellprov-påminnelse (hälsomonitorering)
- **Varje måndag 14:00**: Gmail/Google Workspace migration påminnelse
- **Varje måndag 16:00**: Svenska etiketter påminnelse
- **08:00 dagligen**: Backup e-post via `send_email.sh`

### Framtida
- **31 december 2026**: Dubbelkolla Adobe-uppsägning

### Juridiska ärenden (att ta upp med Anna)
- Stämning av arbetsgivare (förbereda dokument)
- Kontakta försäkringsbolag om advokatkostnader
- Ansöka om ersättning för köksluckor
- Kontakta fackförbund för utökad försäkring

## Projektledaröversikt
- **Projektledar-fil**: `projects/project-leader-anna.md` (skapad 2026-03-29)
- **Hälsologg**: `health/mood-training-2026-03.md`
- **Daglig rapportering**: 07:00 (morgon), 12:00 (lunchcheck), 18:00 (slutrapport)
- **Påminnelsesystem**: 24h → 2h → 30min före deadline

## Transformationsfokus
- Regelbundna check-ins för att observera Annas mående och utveckling
- Föreslå fokusområden för personlig och andlig transformation
- Stödja Anna i att nå sitt optimala tillstånd
- Andlig coaching med Alan Watts-inspirerad ton (mindfulness, personlig utveckling)
- Cellprov-rutin som del av hälsomonitorering

## Säkerhetsåtgärder
- Känslig information (som verifieringskoder) ska INTE loggas i klartext
- Rensa känslig information från minnet efter användning
- Endast använda känslig information i säkra miljöer
