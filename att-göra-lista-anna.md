# ATT-GÖRA-LISTA för Anna

*Skapad 2026-03-29 · Sorterad och uppstädad 2026-08-09*

> Listan låg orörd sedan 2026-04-28 (se `MEMORY.md`). Flera datum nedan har
> passerat sedan dess — de är märkta **⏰ FÖRFALLET** och behöver ett
> statuscheck med Anna snarare än att antas vara klara eller bortglömda.

## ✅ Klart
- [x] **Airbnb-filter** — alla Airbnb-mail går automatiskt till papperskorgen (bekräftat av Anna 2026-03-29)
- [x] **Adobe-prenumeration** — uppsagd
- [x] **Telegram** — konfigurerat och pairing godkänd

## 🔴 Akut / Behöver statuscheck (deadlines har passerat)
- [ ] **⏰ FÖRFALLET — CSN omställningsstöd:** skulle påbörjas 1 april 2026. Kolla med Anna om ansökan är inskickad, pågående eller inte påbörjad.
- [ ] **⏰ FÖRFALLET — Stämma arbetsgivare:** ursprunglig tidsram "inom 30 dagar" från 2026-03-29. Se `juridiska_atgarder.md`. Kolla status.
- [ ] **⏰ FÖRFALLET — Ersättning för köksluckor:** ursprunglig tidsram "inom 14 dagar" från 2026-03-29. Kolla status.
- [ ] **⏰ FÖRFALLET — Kontakta fackförbund** om utökad försäkring: ursprunglig tidsram "inom 30 dagar". Kolla status.
- [ ] **Kontakta försäkringsbolag** om advokatkostnader (rättshjälp) — inget datum satt, gör före advokatkontakt

## 📧 E-post & Ekonomi
- [ ] **Gmail-integration:** väntar fortfarande (per MEMORY.md 2026-04-28) på att Anna kör `gcloud auth application-default login --scopes=...gmail.readonly,...gmail.modify` för att generera `credentials.json`. Detta blockerar all automatisk fakturasortering.
- [ ] **Fakturamappar** (klara att aktiveras så fort Gmail-OAuth är klar) — se `fakturahantering.md`:
  1. **"Löpande"** — privata prenumerationer & köp
  2. **"BODY MIND EARTH"** — företagsköp via proinvest (viktigt för deklaration)
- [ ] **Spam-filter:** löpande rutin — vid misstänkt skräp-mail, fråga Anna en gång och spara svaret som permanent filter
- [ ] **FELLO:** bevaka att inga betalningar går igenom (operatör redan bytt)
- [ ] **Google/Gemini:** månatlig koll att Google inte drar kort för gamla prenumerationer (nytt kort kopplat för "köp av Aether")

## 🗓️ Kalender & Röst
- [ ] **Google Calendar:** ej påbörjat (per MEMORY.md 2026-04-28)
- [ ] **Röstfunktioner:** utforska TTS/STT (ElevenLabs/sag) — ej påbörjat

## ⚖️ Juridiska ärenden
Detaljer i `juridiska_atgarder.md` och `juridiska_kontakter.md`.
- [ ] Stämma arbetsgivare (se akutsektion ovan för status)
- [ ] Kontakta försäkringsbolag om advokatkostnader
- [ ] Ansöka om ersättning för köksluckor (se akutsektion ovan för status)
- [ ] Kontakta fackförbund för utökad försäkring (se akutsektion ovan för status)

## 🔁 Återkommande rutiner
- [ ] **Varje måndag 06:00:** Telegram-påminnelse "Tid för cellprov – dubbelkolla"
- [ ] **08:00 dagligen:** backup-mejl via `send_email.sh`
- [ ] **31 december 2026:** dubbelkolla att Adobe-uppsägningen fortfarande gäller (inga återkommande dragningar)

## 🌱 Transformation & coaching (löpande, ej deadline-styrt)
- [ ] Observera Annas mående och utveckling över tid
- [ ] Föreslå fokusområden för personlig/andlig transformation
- [ ] Andlig ton i påminnelser: Alan Watts-inspirerad, max 1 avslappningspåminnelse/timme

## 🛠️ Teknisk skuld
- [ ] Förnya Gemini Embeddings API-nyckel (minnessökning `memory_search` var ur funktion 2026-04-28)
- [ ] Bekräfta att cron-jobb med Telegram-leverans har korrekt `chatId` konfigurerad (tidigare orsak till leveransfel)

---
*Se `MEMORY.md` för fullständig bakgrund och tidigare lärdomar. Historiken om synk-problem mellan Webchat/Telegram och tidigare "tomma löften"-incidenten (2026-03-29) är arkiverad där och i `memory/2026-03-29.md` — plockad bort härifrån eftersom det inte är en öppen uppgift.*
