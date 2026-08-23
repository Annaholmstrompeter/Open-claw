# Riktiga foton i stället för SVG-ikoner

Just nu använder appen handritade SVG-ikoner. Vi vill byta ut dem mot riktiga
foton, men det gick inte att slutföra i den sessionen som byggde appen —
nätverkspolicyn i den sandboxade miljön blockerade nedladdning från Adobes/
AWS servrar (`photoshop-api.adobe.io`, S3-presignerade länkar gav
`EGRESS_BLOCKED`). Adobe-verktygen för sökning/licensiering/beskärning
funkade fint (de körs på Adobes egen sida), det är bara den sista
nedladdningen till filsystemet som stoppades av policyn.

**Kör därför det här steget någonstans utan den begränsningen** — t.ex. i
OpenClaw lokalt på din dator, eller en Claude Code-session med fri
internetåtkomst.

## De 8 bilderna är redan licensierade

Ingen ny kostnad att hämta dem igen — att anropa
`asset_license_and_download_stock` på ett redan licensierat asset-id
förnyar bara nedladdningslänken (giltig 1 timme), det drar inte en ny licens.

| Underverk (id i `WONDERS`) | Adobe Stock asset-id | Beskärning |
|---|---|---|
| `giza` | `192775815` | `image_crop_and_resize`, fit `reframe`, focus `subject`, output `{width:900, height:675}` |
| `great-wall` | `208387081` | samma som ovan |
| `petra` | `327200590` | samma som ovan |
| `christ` | `104292915` | samma som ovan — **inte** `300054771` (den är "Editorial Use Only" och får inte användas i appen) |
| `machu` | `301399336` | `fit: "reframe"`, output `{width:900}` (utan height — annars vill verktyget beskära bort delar av ruinerna; låt bildens egna proportioner vara kvar, CSS `object-fit: cover` sköter resten) |
| `chichen` | `264662578` | fit `reframe`, focus `subject`, output `{width:900, height:675}` |
| `colosseum` | `195961957` | `fit: "reframe"`, output `{width:900}` (samma anledning som Machu Picchu) |
| `taj` | `427635755` | fit `reframe`, focus `subject`, output `{width:900, height:675}` |

## Steg för steg

1. För varje rad: `asset_license_and_download_stock(assetId)` → ger en
   presignerad S3-URL (1 timme giltig).
2. Kör `image_crop_and_resize` på den URL:en med parametrarna i tabellen,
   `outputFileType: "jpeg"`.
3. Ladda ner resultatet (`outputUrl` i svaret) till
   `world-of-wonders-app/public/images/<id>.jpg` där `<id>` är kolumn 1
   (t.ex. `giza.jpg`, `great-wall.jpg` osv).
4. I `public/index.html`:
   - Lägg till en `image` (filnamn) på varje objekt i `WONDERS`-arrayen.
   - I `iconFor(...)`-anropen i `renderGrid()` och `openModal()`, byt ut
     `<div class="icon-wrap">${iconFor(w.icon)}</div>` mot en `<img>`-tagg,
     t.ex. `<img src="/images/${w.image}" alt="${w.name}" loading="lazy">`.
   - I CSS: sätt `.card .icon-wrap img { width:100%; height:100%;
     object-fit: cover; border-radius: 12px; }` (och motsvarande för
     `.modal-icon img`) så bilderna croppas snyggt oavsett proportioner.
   - SVG-ikonerna (`svgIcons`-objektet och `iconFor()`) kan sparas kvar som
     fallback om en bild saknas, eller tas bort helt när alla 8 har foton.
5. Lägg till bildsökvägarna (`/images/giza.jpg` osv.) i `ASSETS`-listan i
   `public/sw.js` så de precache:as för offline-bruk.
6. Testa i webbläsare (kort-vy + modal) innan push.
