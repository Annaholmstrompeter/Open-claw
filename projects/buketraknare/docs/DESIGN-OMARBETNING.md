# Designomarbetning: Buketträknaren som floriststudio

**Status:** byggt och verifierat. Inventering och plan (avsnitt 1 till 7) skrevs före implementationen. Resultat, vad som testats i riktig webbläsare och vad som bara är kodtestat står i avsnitt 8 och 9.
**Omfattning:** bara gränssnittet (`public/index.html`, `public/css/studio.css`, `public/js/jobs-ui.js`, `public/js/home-ui.js`). Ingen penga-, moms-, förpacknings- eller lagringslogik ändras. Den isolerade grossistagenten (`poc/grossistagent/`) är orörd. PR #9 och master är orörda, PR #10 är fortfarande draft.

## 1. Vision och ramar

Floristen ska tänka på blommor, kunder och skapande. Appen tar hand om beräkning, inköp och administration. Målet är att en florist som aldrig sett appen kan skapa sitt första jobb och förstå sitt kundpris utan instruktioner.

**Får inte ändras** (och ändras inte): exakt pengamatematik (`money.js`, `amounts.js`, `pricing.js`), förpackningslogik (`purchase.js`), momsregler (`tax.js`), prisgrunder och egna tillägg (`items.js`), snapshots (offert/kundorder i `workspace.js`), lagringsbryggan (`store.js`, `bridge.js`, `model.js`), den gamla räknemotorn `calc()` och alla 405 regressionstester. Inga API-nycklar i frontend.

## 2. Inventering: nuvarande skärmar och funktioner

Appen är en enda sida med fyra flikar. Flikarna hör till två olika "världar" som bryggan (`bridge.js`) håller ihop.

| Flik (`data-tab`) | Vy | Vad den gör idag | Räknemotor |
|---|---|---|---|
| **Bukett** (`bukett`) | `#view-bukett` | Välj storlek (liten/medel/stor), tryck på blomknappar (20 vanliga utan pris, färgkant), flera buketter i en "order", antal likadana, mätare mot riktvärde, recept, "Har du något hemma", prislista för kund, så räknas priset, inköpslista med paket och överskott, kopiera lista, töm ordern. Fast totallist längst ned. Panelen **Hämta pris** (skärmdumpar via serverdel, Claude i sidan eller AI-chatt, samt ChatGPT Work) öppnas härifrån. | `calc()` (gamla) |
| **Jobb** (`jobb`) | `#view-jobb`, `js/jobs-ui.js` | Kund, jobb (typ, datum), arrangemang, blommor ur prislistan, eget tillägg (standardpåslag, fast pris inkl./exkl. moms, ingår), arbete, kundpris (✓/≈, exkl. moms + moms för företag), "Min order" från bryggan. Autosparar med "Sparat ✓". | exakta `PricingEngine` |
| **Prislista** (`prislista`) | `#view-prislista` | Redigerbar tabell (namn, kategori, antal per förp, pris per förp), läs in hel prislista (CSV/inklistring med förhandsgranskning och jämförelse), kopiera som CSV. | – |
| **Inställningar** (`installningar`) | `#view-installningar` | Hela förpackningar eller bara använda stjälkar, påslag, timpris, moms, avrundning, storlekar, minsta order/frakt, exempeldata, töm allt. | – |

Funktioner som finns i domänkoden men saknar skärm: **offert/kundorder** (knappar pausade i beslutet 2026-10-08), **favoriter** (finns inte i datamodellen), **inköpsplan per jobb** (`priceEvent().plan` räknas men visas inte), **ta bort arrangemang** (`removeArrangement` finns, knapp saknas), **ändra kund/jobb efter skapande** (`updateCustomer`, `updateEvent` finns, skärm saknas).

## 3. Fynd (varför en florist fastnar i dag)

Fynden bygger på före-bilderna (390 px bred, riktig Chromium) och på koden.

1. **Två bukettbyggare utan förklaring.** Fliken *Bukett* och fliken *Jobb* gör båda "pris på blommor" med olika utseende, olika motor och olika sparande. Ingen skärm säger när man ska välja vilken.
2. **Första priset går inte att få utan att lämna skärmen.** Vid första start har alla 20 blommor "pris saknas". I Jobb står det "Fyll i det under Prislista", i Bukett "Tryck Hämta pris" (en fyrstegspanel med skärmdumpar). Floristen kan inte skriva sitt eget inköpspris där hon står.
3. **Jobb-fliken är en 4 200 px lång sida** där alla fält visas samtidigt (kund, jobb, arrangemang, namn, antal, arbete, sök, eget tillägg, uträkning). Flera likvärdiga knappar konkurrerar ("+ Nytt jobb", "Ta bort jobbet", "+ Arrangemang", "Stäng", "Lägg till X" tjugo gånger).
4. **Blommorna i Jobb är en textlista** med en knapp per rad ("Lägg till Röd ros"). Bukett-fliken har det betydligt bättre trycksättet (kort med färgkant, antal, minus), som Jobb saknar.
5. **Kundpriset syns inte medan man bygger** i Jobb (det ligger längst ned på sidan). I Bukett finns en fast list, men den är mörk och kryptisk ("Totalt inkl. moms", "Detaljer").
6. **Teknikord och system-känsla:** "Standardpåslag på kalkylkostnad", "Prisgrund", "Förpackning", rubriker i versaler i tabeller, ekonomisystem-utseende (tabeller överallt).
7. **Inget säger var man är eller att det sparats** utanför Jobb-fliken ("Sparat ✓" finns bara där). Den gamla delen sparar tyst och döljer lagringsfel.
8. **Kontrast och tillgänglighet:** accentfärgen (rosa) och flera texter är låga mot bakgrunden i dagens palett; fokusring finns men ingen skip-länk, ingen aria-current, flera mål under 44 px.
9. **Tomlägen och fel** är korta och tekniska ("Inga varor matchar"). Det finns ingen väg tillbaka från misstag utöver tvåtrycksknappar.

## 4. Kartläggning mot de fem önskade skärmarna

| Önskad skärm | Var den bor idag | Beslut |
|---|---|---|
| 1. **Hem** | finns inte | Ny vy `#view-hem` (`data-tab="hem"`), startvy. |
| 2. **Jobb** (kund, typ, datum, arrangemang, totalpris, stegvis) | Fliken Jobb | Görs om (`jobs-ui.js`) till ett steg-för-steg-flöde med jobbrubrik, arrangemangskort och ett alltid synligt kundpris. |
| 3. **Bukettbyggare** (blommor, eget material, antal, arbete, tydligt kundpris) | Arrangemangsdetaljen i Jobb | Görs om till en egen arbetsvy med trycksatta blomkort, antal, eget material, arbete och ett fast prisfält som uppdateras av den befintliga prismotorn. **Skapa en bukett** på Hem öppnar den direkt, utan krav på kund. |
| 4. **Blomkatalog / grossistsökning** | Fliken Prislista | Görs om till **Blommor**: snabbsökning, kategorier, kort per artikel med pack, pris, färskhet och bara de artikelfält som faktiskt finns. Redigering, CSV-import och Hämta pris ligger kvar, men bakom tydliga val. |
| 5. **Kalkyl/inköp** | `#summary` i Bukett (gamla motorn) och en uppdelning per arrangemang i Jobb | Ny sektion i jobbet: **Kalkyl och inköp** (kundpris, kostnad, påslag, arbete, moms, förpackningar, överskott, beräknat/presenterat/överenskommet) byggd på `priceEvent()` som redan räknar allt. Den gamla *Bukett*-fliken heter **Snabbkalkyl** och behåller sin funktion. |

Den gamla Bukett-fliken tas inte bort: den har funktioner som inget annat har (recept, "har hemma", Hämta pris-flödets knappar) och 130 av testerna beror på den. Den får samma utseende och en tydlig roll som snabbräknare, men flyttas ned i prioritet.

## 5. Skärm-för-skärm-plan

Mobil först (360–430 px), därefter surfplatta (≥ 720 px) och desktop (≥ 1024 px). En huvudhandling per skärm.

### Navigering och skal
- Mobil: fast nedre navigering med fyra mål (**Hem, Jobb, Blommor, Snabbkalkyl**) och ett kugghjul uppe till höger för **Inställningar**. Desktop: samma mål som ett vänsterfält.
- Rubrikrad med varumärke och en synlig sparstatus ("Sparat ✓" / "Inte sparat"). Skip-länk, `aria-current="page"` på aktivt mål, landmärken (`header`, `nav`, `main`).
- `data-tab`-attributen (`hem`, `jobb`, `prislista`, `bukett`, `installningar`) och alla vy-id:n behålls, eftersom testerna och bryggan går via dem.

### Hem (`#view-hem`)
- Serifrubrik **"Vad vill du skapa idag?"**
- Två stora val: **Skapa en bukett** (öppnar byggaren, jobbet skapas först när första blomman läggs till, så att inga tomma jobb samlas) och **Planera ett kundjobb** (öppnar jobbformuläret).
- **Senaste arbeten:** upp till fem jobb med namn, kund, typ, datum och kundpris (✓/≈ eller "Pris saknas"). Tryck öppnar jobbet.
- Tomläge: "Inga arbeten än. Det första tar ungefär en minut." plus en tyst länk till exempeldata. Om inga priser finns: en förklaring att priset skrivs in när man väljer en blomma.

### Jobb (`#view-jobb`, `jobs-ui.js`)
- **Nytt jobb** i två synliga steg på samma sida: *Kund* (namn, privat/företag) och *Vad gäller det?* (typ som val-knappar, datum). Jobbets namn föreslås ("Emma Svensson – Bröllop") och kan ändras. En huvudknapp: **Skapa jobb**.
- **Jobbvy:** rubrik med jobbets namn, rad med kund · typ · datum, **Ändra uppgifter** (nytt: kund, kundtyp, typ, datum, namn), byte av jobb, arrangemangskort med pris och en huvudknapp **Lägg till arrangemang**, därefter kundpris och **Kalkyl och inköp**.
- Ta bort jobbet (två tryck) ligger längst ned, inte bland huvudvalen.

### Bukettbyggare (`#j-detail`)
- Egen arbetsvy med **← Tillbaka till jobbet**, arrangemangets namn som serifrubrik och antal med − / +.
- **Det här ingår:** rader med antal (− / +), källa (Grossist, Eget lager, Egen trädgård, Köpt separat) och pris per rad där det finns.
- **Lägg till blommor:** sökfält och kort med färgkant (som i Snabbkalkyl), antal på korten, "pris saknas" i klartext. **Saknas priset** öppnas ett litet fält direkt på raden: *antal per förpackning* och *pris per förpackning exkl. moms*. Det sparas i prislistan med samma funktion som Blommor-fliken (`setManualPrice`), så priset syns överallt.
- **Eget material:** ett tillägg med tre val i klartext (*Påslag på en kostnad du anger*, *Fast pris till kunden*, *Ingår utan extra kostnad*), prisgrund inkl./exkl. moms.
- **Arbete:** ett fält (kr exkl. moms per arrangemang).
- **Fast prisfält** längst ned: kundpris (✓ bekräftat / ≈ ungefärligt), "Så räknades priset" bakom ett tryck. Priset kommer från `priceEvent()`, inte från skärmen.
- **Ta bort arrangemanget** (nytt, två tryck).

### Blommor (`#view-prislista`)
- Sökfält överst (snabb filtrering medan man skriver), kategoriknappar, och status: "Priser från 7 okt (igår)" med huvudknappen **Uppdatera priser** (öppnar den befintliga Hämta pris-panelen som ett fönster).
- Ett kort per artikel: färgmarkering (floristens egen färg, inte en bild), namn, pack (`10-pack`), pris per förpackning och per stjälk, **färskhet** (✓ idag / ≈ N dagar / saknas). Bara fakta som finns visas: sort, längd, tillgänglighet och källa läses ur datamodellen när de är ifyllda. För den egna prislistan finns varken artikelnummer eller tillgänglighet, och då visas inget.
- Redigering öppnas på kortet (alla fälten finns kvar). Läs in hel prislista, kopiera som CSV och "Ny blomma" ligger under **Mer**.
- **Favoriter visas inte:** de finns inte i datamodellen och beslutet 2026-10-08 pausade dem. Skärmen reserverar ingen yta åt dem.
- Inga produktbilder (det finns inga riktiga), ingen påhittad tillgänglighet.

### Kalkyl och inköp (i jobbet)
- **Kundpris** (stort), **så byggs det upp:** material (kalkylkostnad), påslag, arbete, moms, avrundning. Belopp visas i ören där det behövs, aldrig avrundade i förväg.
- **Beräknat → Presenterat → Överenskommet:** beräknat (exakt, före avrundning) och presenterat (avrundat, det du säger till kunden) visas alltid. *Överenskommet* visas bara när det finns en kundorder (det går inte att skapa en i gränssnittet än, knappen är pausad) och annars står det inte med.
- **Inköp:** per artikel behov, antal förpackningar × pack, kostnad, **överskott**; frakt; summa inköp; överskottets värde. Egna material och eget lager listas som "inte beställda". Allt ur `priceEvent().plan` och `.needs`.

### Snabbkalkyl (`#view-bukett`, gamla Bukett-fliken)
- Samma funktion och samma element, nytt utseende och tydligare rubrik. Den fasta totallisten blir ljus och talar klartext ("Kundpris" i stället för "Totalt inkl. moms"), med **Uppdatera priser** som enda knapp.

### Inställningar (`#view-installningar`)
- Samma fält, grupperade i kort med rubriker på klartext (*Prissättning*, *Storlekar*, *Inköp hos grossisten*, *Data*). Momsraden behåller texten om att satsen är floristens egen.

## 6. Designsystem

### Palett (mätt med WCAG 2.x, se `test/design-contrast.test.mjs`)
De fem färgerna i uppdraget behålls som varumärkesfärger. Där de inte klarar kontrastkrav används en anpassad ton **för text, fält och knappar**, medan originalet används för ytor och dekor.

| Roll | Ljust | Mörkt | Not |
|---|---|---|---|
| Bakgrund (ivory) | `#F6F3EC` | `#141C17` | uppdragets ivory; mörkt är en nedtonad deep olive |
| Yta (kort) | `#FCFAF6` | `#1C2620` | |
| Text (deep olive) | `#263A30` (10,95:1 mot bakgrund) | `#F1EDE3` | |
| Dämpad text | `#55645A` (5,65:1) | `#B4C1B8` | |
| Sage (valt läge, chips) | `#DCE3D8` | `#2E3F35` | uppdragets sage |
| Dusty rose (dekor, fyllning) | `#B78F91` | `#D8B4B6` | **2,58:1 mot ivory och 2,86:1 med vit text**: används aldrig som textfärg eller knapp |
| Rose (text, länkar, ikoner) | `#82505A` (5,84:1) | `#D8B4B6` (9,21:1) | anpassad ton |
| Stone (hårfina linjer) | `#C5B59D` → `#DDD3C2` | `#2F3F35` | stone mot ivory är 1,81:1: bara dekor |
| Fältkant | `#857760` (3,94:1) | `#718579` | ≥ 3:1 för komponenter (WCAG 1.4.11) |
| Primärknapp | olive `#263A30` med ivory text (10,95:1) | ivory med olive text | en primärknapp per skärm |

### Typografi
- **Cormorant Garamond** (600) för stora rubriker (≥ 26 px): Hem, jobbets namn, arrangemangets namn, skärmtitlar.
- **Figtree** för all funktionell text och **alla siffror** (kundpris, antal, belopp), med tabellsiffror. Figtree valdes redan tidigare och kvar.
- Serifen provades mot Fraunces och Newsreader i riktig webbläsare på mobilbredd. Cormorant ger mest exklusiv känsla och fungerar från 26 px.

### Komponenter och regler
- Tryckytor minst 44 px (huvudknappar 52 px), 8-pixelsrutnät, generös luft, avrundade hörn, hårfina linjer i stället för skuggor.
- Fokus: tydlig ring (3 px) i text-färgen, alltid synlig, aldrig borttagen. Skip-länk. `prefers-reduced-motion` respekteras. Mörkt läge följer enheten.
- Färg är aldrig ensam bärare av betydelse: ✓/≈, text och ikon följer alltid med.
- Inga dekorativa fotografier. Ikoner är enkla linjeikoner som ritas i koden.

## 7. Avgränsningar (byggs inte i det här steget)
Offert- och "kunden sa ja"-knappar, favoriter, ett förhandlat totalpris för hela jobbet, manuell växling mellan ljust och mörkt läge (enheten styr), foton, riktiga artikelnummer och tillgänglighet (kräver en riktig grossistkoppling), ändring av grossistagenten, ändring av någon räknelogik.

## 8. Resultat och verifiering

Allt nedan är kört i den här sessionen. Skärmbilderna ligger i `docs/skarmbilder/` och nämns vid namn.

### 8.1 Vad som byggts, jämfört med planen
Alla skärmar i avsnitt 5 är byggda. Skillnader mot planen: **Inställningar** fick storlekarna som kort i stället för en tabell (tabellen klipptes på en telefon), jobbvyns sekundära val (byt jobb, kundtyp, ta bort) är hopfällda så att arrangemang och kundpris syns på första skärmen, bakåtknappen går mellan menyvalen (inte i planen), och hela startsidan synkas mot Inställningar vid varje besök så att den visar samma pris som Jobb.

### 8.2 Testat visuellt i riktig webbläsare
Headless Chromium 141 (Playwright), appen serverad som statiska filer, pekskärmsemulering för mobil. Mått: 320×640, 360×740, 390×844 (telefon), 768×1024 (surfplatta) och 1280×800 (dator), ljust och mörkt läge (`prefers-color-scheme`).

| Granskat med ögonen på skärmbild | Bilder |
|---|---|
| Första gången: Hem, byggaren utan jobb, prisfrågan på en blomma som saknar pris, första kundpriset | `01`, `02`, `03` |
| Jobb, bukettbyggare, kalkyl och inköp, Hem med senaste arbeten | `04` till `08` |
| Blommor (katalog), Snabbkalkyl, Inställningar | `09`, `10`, `11` |
| Mörkt läge: Hem och bukettbyggare sparade som bilder (Jobb, kalkyl, Blommor och Snabbkalkyl granskades också i mörkt läge men sparades inte; **Inställningar i mörkt läge granskades inte med ögonen**, bara med axe) | `12`, `13` |
| Dator: Hem, byggare med jobbet vid sidan, kalkyl, Blommor | `14` till `17` |
| Surfplatta: jobb | `18` |
| Före (gamla appen): första start och jobbsidan (4 200 px lång) | `fore-1`, `fore-2` |

Dessutom granskades ett femtiotal arbetsbilder under bygget (320 px med mycket långa namn, tomma jobb, företagskund med pris exkl. moms, ändra uppgifter, prisfel i formulär, fönstret Uppdatera priser, lagringsfel). De sparades inte.

**Beteende i webbläsaren (38 kontroller, alla godkända):** hoppa-länk är första Tab-stoppet; Enter på "Skapa en bukett" öppnar byggaren och flyttar fokus till rubriken; fokusring 3 px på blomkort; Enter lägger till en blomma; sökning filtrerar medan man skriver; första priset ger ett kundpris direkt; jobbet finns kvar efter omladdning med samma pris; lagringsfel ger "Inte sparat" i rubrikraden och en ruta, och man kan fortsätta arbeta; höjt blompris i Blommor och höjt påslag i Inställningar slår igenom på Hem och i Jobb med **samma belopp**; jobb utan arrangemang och arrangemang utan blommor visar förklaring och aldrig 0 kr; sökning utan träff erbjuder att lägga till blomman; fönstret Uppdatera priser flyttar fokus in, gör bakgrunden inaktiv, stängs med Escape och lämnar tillbaka fokus; bakåtknappen går till föregående flik och flikens `aria-current` och sidtitel följer med; inga tryckytor under 44 px och ingen sidledes scroll på 360 px i fem skärmar; fokuserat fält ligger inte bakom det fasta prisfältet när visningsytan krymper till 380 px (pekskärmstangentbord, simulerat); hela prisuppdateringen via inklistrad tabell (förhandsgranskning, byt, fönstret stängs, nya priset syns överallt som ✓ idag).

**Tillgänglighet med axe-core 4.10.2** (WCAG 2.0, 2.1 och 2.2 nivå A och AA samt best practice) på 11 lägen i ljust och 11 i mörkt: **0 överträdelser** efter att två anmärkningar åtgärdats (ett sammanfattningsfält som låg inuti `<main>` som egen landmärkesregion, och rubriknivåerna i Inställningar).

### 8.3 Kodtestat (jsdom och rena tester), inte visuellt
- **Alla 405 befintliga tester är kvar och gröna.** Enda ändringen i dem är två rader copy i `jobs-ui.test.mjs` ("Fliken Bukett" → "Fliken Snabbkalkyl").
- **38 nya tester:** `design-contrast.test.mjs` (6: kontrast i ljust och mörkt läge mätt ur CSS-filen, de fem färgerna kvar, rose och stone aldrig som text, tryckytor, fokus, rörelse) och `studio-ui.test.mjs` (32: skal och landmärken, Hem, byggaren utan jobb, första priset, antal, eget material, ändra uppgifter, ta bort, kalkyl och inköp inklusive överenskommet pris, katalogens ärliga data, sparstatus, fönstret, långa och konstiga namn, inga bilder och inga nycklar).
- **Totalt 443 av 443 gröna** (`npm test`). Grossistagentens egna tester (`poc/grossistagent`) kördes inte: koden där är orörd.
- **Mutationstest av den nya gränssnittskoden:** 34 medvetna fel (logik, texter, CSS-färger). 28 fångades direkt, 6 överlevde (uppläsning av pris, noten om "Min order", att Hem synkas, gränsen på fem jobb, att antal inte går under 1, moms-sidan för företag på Hem) och fick egna tester. Nu fångas alla 34. Layout-CSS (mellanrum, rutnät, brytpunkter) mutationstestades inte: den provas bara i webbläsaren ovan.

### 8.4 Fel som verifieringen hittade och som är rättade
1. Skalets klass `.side` krockade med det gamla blomkortets `.side`: korten blev 800 px höga på dator och på mobil låg en lös räknare vid nederkanten. Bytt till `.sidebar`.
2. Prisfrågan på en blomma hamnade ovanför det man tittade på. Nu rullar skärmen dit och fokuserar fältet, och det fasta prisfältet har knappen "Fyll i pris".
3. Hem visade gamla priser tills man öppnat Jobb. Nu synkas jobben vid varje besök på Hem.
4. Blomnamn bröts mitt i orden ("Alstroemer‑ia"), storlekstabellen i Inställningar klipptes, plus och minus krympte till 42 px, en länk på Hem var 24 px hög.
5. Antal- och textfält saknade riktig etikett (`aria-labelledby` räckte inte för testet), kundpris och uppläsning saknade mellanrum mellan elementen ("225 krexkl. moms"), en inline-stil pekade på en färgvariabel som inte längre finns, och noten om "Min order" följde med på alla skärmar.
6. Ett test av mig själv jämförde en exakt CSS-sträng och föll när jag ändrade en regel. Gjort robust.

## 9. Det som inte är verifierat (säg det alltid)

- **Inga riktiga telefoner.** Ingen iOS Safari, ingen Android Chrome, inget riktigt pekskärmstangentbord (bara en krympt visningsyta). Safe-area (hack i skärmens nederkant) är bara ett CSS-värde som inte kunde provas.
- **Bara Chromium.** Firefox och Safari renderar inte provats. CSS använder `:has()`, `color-mix()`, `dvh` och `inert`, som finns i alla aktuella webbläsare men inte i äldre.
- **Ingen skärmläsare** (VoiceOver, TalkBack, NVDA). Strukturen (landmärken, rubriker, etiketter, `aria-current`, live-regioner, fokusflytt) är kontrollerad med axe och kod, men hur det låter är inte provat.
- **Tvingade färger (högkontrastläge)** och **utskrift** är stilade i CSS men inte renderade.
- **Typsnitten hämtas från Google Fonts** (som tidigare). Utan nät används Georgia och systemets sans: utseendet är då något annat och är inte granskat.
- **Datumväljaren** visade engelsk ordning i den engelska testwebbläsaren; på en svensk enhet följer den enhetens språk. Inte granskad.
- **Appen har inte körts bakom Cloudflare-Workern** (statiska filer räckte för testet), så avläsning av skärmdumpar via server, brevlådan och "Claude i sidan" visades bara som de gamla jsdom-testerna provar dem. CSS-filen och den nya skriptfilen ligger i `public/` och serveras som övriga resurser.
- **Ingen florist har provat.** Målet "en florist som aldrig sett appen ska kunna skapa sitt första jobb utan instruktioner" är genomgånget som ett scenario (Hem → Skapa en bukett → priset som saknas → kundpris), men det är inte användartestat. Nästa steg är att låta en riktig florist prova och se var hon tvekar.
- **Kvarstående brister som inte är nya:** "Töm allt och börja om" rensar inte jobben; momssatserna är fortfarande floristens egen inställning och inte verifierade; offert- och "kunden sa ja"-knappar saknas, så "Överenskommet" syns bara om en kundorder redan finns.
