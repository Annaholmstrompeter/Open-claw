# Body Mind Earth — Sensory Ritual (fristaden)

En liten, helt fristående webbplats som gästerna når med QR-koden i Sensory Enrichment-asken.
Fem ritualer (Balance, Luminance, Kindness, Serenity, Presence) som **lyssnas på**: när man trycker
på *Short ritual* eller *Extended ritual* visas en vacker bild och en rad ur meditationen, och
inspelningen startar av sig själv. Man kan pausa, börja om, backa 15 sekunder och söka. Själva
meditationen visas aldrig som text. Ingen butik, inga priser, inga länkar ut, inga cookies och
ingen spårning.

Formspråket kommer från etiketterna: etikettens exakta färger, gravyrerna, vågmönstret, den
riktiga logotypen och "A reminder of the world we share". Ljudet är dina inspelningar ur Drive-mappen
"FÄRDIGA - hemsida (8 okt)".

Kostar 0 kr: statiska filer på Cloudflare Pages (gratis), ingen databas, inget byggsteg i molnet.

## Inspelningarna (viktigt)

Lägg de elva mp3-filerna ur Drive-mappen **"FÄRDIGA - hemsida (8 okt)"**, med oförändrade namn, i
`public/assets/audio/`:

```
01_Intro_Sensory-Enrichment.mp3
02_Presence_Raspberry-Body-Lotion_KORT.mp3     03_Presence_Raspberry-Body-Lotion_LANG.mp3
04_Balance_Bergamot-Hand-Wash_KORT.mp3         05_Balance_Bergamot-Hand-Wash_LANG.mp3
06_Luminance_Apricot-Hand-Cream_KORT.mp3       07_Luminance_Apricot-Hand-Cream_LANG.mp3
08_Kindness_Cherry-Body-Wash_KORT.mp3          09_Kindness_Cherry-Body-Wash_LANG.mp3
10_Serenity_Macadamia-Shampoo_KORT.mp3         11_Serenity_Macadamia-Shampoo_LANG.mp3
```

Tre av dem (01, 02 och 04) ligger redan i repot. De övriga åtta är för stora för att hämtas
automatiskt ur Drive; ladda ner dem och lägg dem i mappen (t.ex. via GitHub: öppna
`sanctuary/public/assets/audio`, *Add file → Upload files*, dra in filerna). Saknas en fil säger
spelaren "This recording is not available yet." i stället för att låta tyst.

Ändras en inspelning: byt filen med samma namn. Ljudet cachas inte offline (filerna är stora och
spelas som ström), så gästerna behöver täckning när de lyssnar.

## Vad som är vad

| Mapp / fil | Innehåll |
|---|---|
| `public/` | Själva sidan. Det här är det som läggs ut. |
| `public/assets/audio/` | Inspelningarna (se ovan). |
| `public/assets/img/` | Bilderna, uttagna ur etikett-PDF:erna (gravyrer, vågmönster, arter, logotyp) samt `hero.webp`. |
| `content/products.json` | Produktfakta ordagrant från de fem etiketterna. |
| `content/quotes.json` | En rad ur varje meditation, som visas medan den spelas. Ändra fritt. |
| `content/audio.json` | Vilka filer som hör till vilken ritual. |
| `content/meditations-mall.txt` | Textkopia av Google-dokumentet "Meditations mall". Används bara för introtexten och för att kontrollera att varje citat står ordagrant i manuset. Skickas aldrig till gästens telefon. |
| `tools/build-content.py` | Gör `public/assets/content.js` och uppdaterar offline-cachen i `public/sw.js`. Skriver ut vilka inspelningar som saknas. |
| `tools/extract-label-art.py` | Tar ut bilderna ur etikett-PDF:erna (kräver `pdftoppm`, `numpy`, `scipy`, `pillow`). |
| `tools/make-hero.py` | Gör bakgrundsfotot till välkomstvyn och avslutet. |
| `tools/make-qr.py` | Gör QR-koden när den riktiga adressen är bestämd. |
| `tools/make-preview.py` | Packar sidan i en enda fil för förhandsvisning (utan ljud). |

## Lägga ut sidan (ca 10 minuter, en gång)

1. Skapa ett gratis konto på <https://dash.cloudflare.com>.
2. **Workers & Pages → Create → Pages → Upload assets.** Döp projektet (t.ex. `body-mind-earth`),
   dra in innehållet i mappen `public/` (med alla elva ljudfiler i `assets/audio/`) och tryck
   *Deploy*. Du får en adress som `body-mind-earth.pages.dev`. En enskild fil får vara högst 25 MB;
   dina är högst 10 MB.
   - Alternativ: *Connect to Git* mot det här repot med *Root directory* `sanctuary`,
     *Build output directory* `public` och inget byggkommando. Då uppdateras sidan automatiskt
     när `master` ändras.
3. Egen adress (rekommenderas innan något trycks): i projektet, *Custom domains → Set up a
   domain*, t.ex. `ritual.bodymindearth.se`. Cloudflare säger vilken DNS-rad som ska läggas
   in hos den som sköter bodymindearth.se.
4. Gör QR-koden med den slutliga adressen och skanna den med en telefon innan tryck:
   `pip install segno` och sedan `python3 sanctuary/tools/make-qr.py https://din-adress`.

## När något ändras

Texter eller citat: ändra i `content/…` (eller be mig synka från Google-dokumentet) och kör

```
python3 sanctuary/tools/build-content.py
```

Det räcker. Skriptet kontrollerar citaten och håller offline-cachen i takt med sidan, så att gäster
som redan öppnat sidan får den nya versionen. Har etiketterna ändrats: kör `extract-label-art.py`
med de nya PDF-filerna först.

## Öppna punkter

- **Åtta inspelningar saknas i repot** (se ovan). Utan dem säger spelaren att inspelningen inte finns än.
- **Texterna är inte klara.** "Meditations mall" ändras fortfarande; citaten och introtexten bygger på kopian från 2026-10-08.
- **Shopify stämmer inte med etiketterna.** Etiketterna har använts som källa. Shopify-sidorna har
  bland annat andra ritualrader och ton-ord (t.ex. "Smoothing" mot etikettens "Hydrating") och en
  garblad ingredienslista för handtvålen ("Coco-Communis Oil"). Uppdatera Shopify efter etiketterna.
- **Bakgrundsfoto.** Välkomstvyn och avslutet använder en mjukfokuserad bit av olivkvisten i kit-fotot
  (`public/assets/img/hero.webp`). Byt mot ett riktigt foto när det finns (varmt, ljust, högt format).
- **Ingen "Visit Body Mind Earth"-knapp,** som skissen hade. Fristaden är stängd.
- **Meningen om webbplatsen** i introt ("You can discover more … on our website.") är utelämnad i texten.
  Den kan fortfarande finnas i den inspelade introt: lyssna igenom `01_Intro_Sensory-Enrichment.mp3`.
- **Språk.** Allt är på engelska, som lådorna och inspelningarna.
- **Kontakt.** Ingen e-postadress är inlagd. Ett färdigt ställe finns i kommentaren i `about()` i `public/assets/app.js`.
- **Integritetsraden** ("keeps nothing about you") stämmer så länge ingen statistik slås på i Cloudflare.

## Typsnitt

Cormorant Garamond och Jost (SIL Open Font License, licenserna ligger i `public/assets/fonts/`).
De ligger på sidan, så gästernas telefoner anropar inga externa tjänster.
