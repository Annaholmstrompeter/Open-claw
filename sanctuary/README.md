# Body Mind Earth — Sensory Ritual (fristaden)

En liten, helt fristående webbplats som gästerna når med QR-koden i Sensory Enrichment-asken.
Fem ritualer (Balance, Luminance, Kindness, Serenity, Presence), guidade skärm för skärm. Ingen
butik, inga priser, inga länkar ut, inga cookies och ingen spårning.

Formspråket kommer från etiketterna: etikettens exakta färger, gravyrerna, vågmönstret, den
riktiga logotypen och "A reminder of the world we share". Texterna är dina egna: ritualtexterna
från Google-dokumentet "Meditations mall" och produkttexterna från etiketterna.

Kostar 0 kr: statiska filer på Cloudflare Pages (gratis), ingen databas, inget byggsteg i molnet.

## Vad som är vad

| Mapp / fil | Innehåll |
|---|---|
| `public/` | Själva sidan. Det här är det som läggs ut. |
| `public/assets/img/` | Bilderna, uttagna ur etikett-PDF:erna (gravyrer, vågmönster, arter, logotyp) samt `hero.webp`. |
| `content/meditations-mall.txt` | Textkopia av Google-dokumentet "Meditations mall" (Drive-id i filens första rader). |
| `content/products.json` | Produktfakta ordagrant från de fem etiketterna, plus Shopify-id. |
| `tools/build-content.py` | Gör `public/assets/content.js` av de två filerna ovan och uppdaterar offline-cachen i `public/sw.js`. |
| `tools/extract-label-art.py` | Tar ut bilderna ur etikett-PDF:erna (kräver `pdftoppm`, `numpy`, `scipy`, `pillow`). |
| `tools/make-hero.py` | Gör bakgrundsfotot till välkomstvyn och avslutet. |
| `tools/make-qr.py` | Gör QR-koden när den riktiga adressen är bestämd. |
| `tools/make-preview.py` | Packar hela sidan i en enda fil för förhandsvisning. |

## Lägga ut sidan (ca 10 minuter, en gång)

1. Skapa ett gratis konto på <https://dash.cloudflare.com>.
2. **Workers & Pages → Create → Pages → Upload assets.** Döp projektet (t.ex. `body-mind-earth`),
   dra in innehållet i mappen `public/` (eller zip-filen) och tryck *Deploy*. Du får en adress
   som `body-mind-earth.pages.dev`.
   - Alternativ: *Connect to Git* mot det här repot med *Root directory* `sanctuary`,
     *Build output directory* `public` och inget byggkommando. Då uppdateras sidan automatiskt
     när `master` ändras.
3. Egen adress (rekommenderas innan något trycks): i projektet, *Custom domains → Set up a
   domain*, t.ex. `ritual.bodymindearth.se`. Cloudflare säger vilken DNS-rad som ska läggas
   in hos den som sköter bodymindearth.se.
4. Gör QR-koden med den slutliga adressen och skanna den med en telefon innan tryck:
   `pip install segno` och sedan `python3 sanctuary/tools/make-qr.py https://din-adress`.

## När texterna ändras

Du ändrar i Google-dokumentet "Meditations mall" eller i etiketterna. Be mig synka (eller klistra
in ändringen i `content/…`), kör sedan

```
python3 sanctuary/tools/build-content.py
```

Det räcker. Skriptet delar manuset i lugna skärmar vid pauserna (produktionsanteckningarna i
hakparentes visas aldrig) och ser till att gäster som redan öppnat sidan får den nya versionen.
Har etiketterna ändrats: kör `extract-label-art.py` med de nya PDF-filerna först.

## Öppna punkter

- **Texterna är inte klara.** Mallen ändras fortfarande. Sidan bygger på kopian från 2026-10-08.
- **Shopify stämmer inte med etiketterna.** Etiketterna har använts som källa. Shopify-sidorna har
  bland annat andra ritualrader och ton-ord (t.ex. "Smoothing" mot etikettens "Hydrating") och en
  garblad ingredienslista för handtvålen ("Coco-Communis Oil"). Uppdatera Shopify efter etiketterna.
- **Bakgrundsfoto.** Välkomstvyn och avslutet använder en mjukfokuserad bit av olivkvisten i kit-fotot
  (`public/assets/img/hero.webp`). Byt mot ett riktigt foto när det finns (varmt, ljust, högt format).
- **Inget ljud.** Meditationerna finns som inspelningar i Drive, men sidan visar bara text och bild.
- **Ingen "Visit Body Mind Earth"-knapp,** som skissen hade. Fristaden är stängd.
- **Meningen om webbplatsen** i introt ("You can discover more … on our website.") är utelämnad.
- **Språk.** Allt är på engelska, som lådorna och inspelningarna. Svenska kräver en översättning som du godkänner.
- **Kontakt.** Ingen e-postadress är inlagd. Ett färdigt ställe finns i kommentaren i `about()` i `public/assets/app.js`.
- **Integritetsraden** ("keeps nothing about you") stämmer så länge ingen statistik slås på i Cloudflare.

## Typsnitt

Cormorant Garamond och Jost (SIL Open Font License, licenserna ligger i `public/assets/fonts/`).
De ligger på sidan, så gästernas telefoner anropar inga externa tjänster.
