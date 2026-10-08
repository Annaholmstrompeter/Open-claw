# Body Mind Earth — Sensory Ritual (fristaden)

En liten, helt fristående webbplats som gästerna når med QR-koden i Sensory Enrichment-asken.
Fem ritualer (Balance, Luminance, Kindness, Serenity, Presence), guidade skärm för skärm, med
dina egna texter. Ingen butik, inga priser, inga länkar ut, inga cookies och ingen spårning.

Kostar 0 kr: statiska filer på Cloudflare Pages (gratis), ingen databas, inget byggsteg.

## Vad som är vad

| Mapp / fil | Innehåll |
|---|---|
| `public/` | Själva sidan. Det här är det som läggs ut. |
| `content/meditations-mall.txt` | Textkopia av Google-dokumentet "Meditations mall" (Drive-id i filens första rader). |
| `content/products.json` | Kopia av de fem produkterna i Shopify: namn, doft, "The Scent/Touch/Feel", bekräftelse, formula, INCI. |
| `tools/build-content.py` | Gör `public/assets/content.js` av de två filerna ovan. Skriver inte om något. |
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

Du ändrar i Google-dokumentet "Meditations mall" och produkterna i Shopify. Be mig synka
(eller klistra in ändringen i `content/…`), kör sedan

```
python3 sanctuary/tools/build-content.py
```

och höj `VERSION` i `public/sw.js` så att gäster som redan öppnat sidan får den nya versionen.
Skriptet delar manuset i lugna skärmar vid pauserna; produktionsanteckningarna i hakparentes
([Pause.], [Music …]) visas aldrig.

## Öppna punkter

- **Bilder.** Shopifys bildserver (`cdn.shopify.com`) är spärrad i den här miljön, så etikettbilderna
  och produktbilderna är inte med än. Platsen finns (`shopify.image` i `products.json`). Tills vidare
  ritar sidan en liten botanisk linjeteckning per ritual.
- **Balance, ingrediensrad.** Shopify har "Coco-Communis Oil" i INCI-listan för handtvålen; den äldre
  etiketten har "Coco Glucoside … Ricinus Communis Oil" och "Simmondsia Chinensis Oil". Det ser ut som
  en sammanblandning. Sidan visar Shopify-texten; rätta den där (eller i `products.json`) innan lansering.
- **Meningen om webbplatsen.** I introt står "You can discover more … on our website." Den är utelämnad
  eftersom fristaden är sluten. Lägg tillbaka den om du vill.
- **Texterna är inte klara.** Mallen ändras fortfarande. Sidan är byggd på kopian från 2026-10-08.
- **Språk.** Allt är på engelska, som lådorna och inspelningarna. Svenska kräver en översättning som du godkänner.
- **Kontakt.** Ingen e-postadress är inlagd. Ett färdigt ställe finns i kommentaren i `about()` i `public/assets/app.js`.
- **Integritetsraden** ("keeps nothing about you") stämmer så länge ingen statistik slås på i Cloudflare.
- **Logotypen** är en nyritad approximation av märket. Byt ut `public/assets/logo.svg` mot den riktiga.

## Typsnitt

Cormorant Garamond och Jost (SIL Open Font License, licenserna ligger i `public/assets/fonts/`).
De ligger på sidan, så gästernas telefoner anropar inga externa tjänster.
