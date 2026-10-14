# Hemsidan (Body Mind Earth, Shopify): start här

Läs den här filen först när du fortsätter arbetet med hemsidan i en ny chatt. Senast uppdaterad 2026-10-14 (efter v47, karusellen).

## Så fortsätter Anna i en ny chatt

Starta en ny **Code-session på det här repot** (molnet räcker för hemsidan; datoranvändning behövs inte) och skriv:

> Fortsätt med hemsidan. Läs HEMSIDAN.md och skills/webbdesign-varldsklass/SKILL.md först. Mitt nästa önskemål: …

`CLAUDE.md` leder också dit av sig själv, och projektskillen `webbdesign-varldsklass` finns i `.claude/skills/` så att den dyker upp i listan över skills i sessioner på det här repot.

**Skillen ska laddas automatiskt för alla Annas hemsidor, även andra än BME och även utanför det här repot.** Det görs genom att skillen ligger i hennes Claude-konto: filen `webbdesign-varldsklass.skill` skickades till henne 2026-10-14 med en **Spara skill**-knapp. När hon klickat följer den med i alla hennes sessioner och väljs automatiskt utifrån beskrivningen (hemsida, webbshop, Shopify, tema, sektion, karusell, video på sida …). Skillen är allmän; BME-specifikt ligger i `references/bme.md`. Om knappen inte syns: Inställningar → Skills → ladda upp filen. Bygg om paketet med `python -m scripts.package_skill` (skill-creator) från `skills/webbdesign-varldsklass/` när skillen ändrats, och skicka den nya `.skill`-filen igen (kontoversionen uppdateras inte av repot). Filmskillen `reklamfilm-regissor` ligger redan i hennes konto.

## Rollen och sättet att jobba (Annas ord väger tyngst)

- Claude är **världsledande creative director** för sajten, inte en utförare. Anna 13 okt: *"du måste i varje beslut bära din roll som världsledande"*. Hon ska aldrig behöva leda eller rätta samma sak två gånger.
- **Beslut, inte menyer.** En rekommendation. Säg svagaste punkten och vad som inte är testat. Fråga bara det som bara Anna kan svara på.
- Hon skriver kort och med stavfel. Tolka, fråga inte om det går att lista ut. När hon säger att "det fanns lite fel" utan att peka ut vilka: granska själv (copy mot det låsta dokumentet, mät layouten, kör tester), rätta, rapportera vad du hittade.
- Svara på **svenska**, enkla ord, kort. Hon är mycket oteknisk men skarp i ögat. Visa bilder (skärmdumpar från den riktiga förhandsvisningen), inte bara text.
- **Aldrig publicera** något på live-sajten. Allt arbete går i utkast-temat. Publicering gör Anna i Shopify admin (verktyget blockerar det också).
- **Copyn i block B är låst.** Ändra aldrig orden, bara formatering. Källa: `projects/bme-copy-varumarkesbeskrivning-2026-10-12.md` (se "Rättelse 2026-10-13": *Anchor. Direct.*).

## Var allt finns

| Vad | Var |
|---|---|
| Playbook: arbetssätt, designregler, rörlig bild, karusell, Shopify-fällor | `skills/webbdesign-varldsklass/SKILL.md` |
| Projektet "The Experience" (README med hela vägen, filer, mätningar, öppna punkter) | `projects/bme-experience-window/README.md` |
| Temakoden (kopior av det som ligger i Shopify) | `projects/bme-experience-window/theme/` |
| Testbänk (liquidjs + Chromium, 11 skärmstorlekar, touch, felhantering) | `projects/bme-experience-window/lab/` |
| Hur filmerna byggs om (20 filer, gradering) | `projects/bme-experience-window/films/make-films.sh` |
| Annas stämningsreferenser (Pinterest, BONJIL) | `projects/bme-experience-window/referenser-pinterest.md` |
| Låst copy och varumärkestext | `projects/bme-copy-varumarkesbeskrivning-2026-10-12.md` |
| Startsidans struktur | `projects/bme-startsida-strukturrevision-2026-10-09.md` |
| Filmskill (hero-film, Flow-prompter, gradering) | Annas Claude-konto: `reklamfilm-regissor`. Reservkopia: `skills/reklamfilm-regissor/` |
| Dagslogg med beslut och Annas omdömen | `memory/2026-10-13.md` |

## Shopify

- Butik: `9w0qpc-07.myshopify.com`. Verktyg: Shopify-anslutningen (`graphql_query`, `graphql_mutation`, `graphql_schema`, `validate_graphql_codeblocks`). Temafiler får bara skrivas till **opublicerade** teman.
- **Utkast-tema** (där allt byggs): *Atelier – Rituals-stil (utveckling 2026-09-02)*, id `gid://shopify/OnlineStoreTheme/199116816758`, roll `UNPUBLISHED`.
- **Förhandsvisning**: https://9w0qpc-07.myshopify.com/?preview_theme_id=199116816758 (sektionen `#the-experience`). Live-temat är orört.
- Startsidans ordning (`templates/index.json`): hero (`bme-hero`), **scene_experience (`bme-experience`)**, scene4_ritual, scene2_rituals, scene5_science, scene6_formula, scene7_world, scene3_portals, scene8_future, section_products_final.
- Filmerna ligger i Shopify → Innehåll → Filer: `bme-film-N-wide|tall.mp4|jpg` (N = 1–5, 20 filer). Äldre `bme-moment-1…5-*.mp4` (från v45) används inte längre och kan raderas i admin.
- **Återställningspunkter i utkast-temat** (`assets/`): `backup-bme-experience-v43-…` (gamla fotoversionen) och `backup-index-pre-window-…` (index.json före allt), `…-v46-…`, `…-v46b-…` (filmerna under varandra, rättad), `backup-index-before-direct-…` / `…-after-direct-…` / `…-v46b-direct-…`, **`…-v47-carousel-…` (karusellen, nuläget)**. Återställ med `themeFilesCopy` tillbaka till den riktiga filen.
- **Stubbar som Anna kan radera i admin → Edit code** (verktyget får inte radera temafiler): `sections/bme-window.liquid`, `snippets/bme-window-js-2.liquid`, `assets/zz-url-test-2026-10-13.txt`, `assets/zz-css-check-2026-10-13.txt`.

## Läget (2026-10-14)

Block B "The Experience" ("WHERE THE SENSES LEAD, THE FEELING DEEPENS") är byggt som **v47: en horisontell karusell med fem filmer** (Breathe/Regulate, Scent/Evoke, Touch/Embody, Feel/Amplify, Anchor/Direct). En film i taget i mitten, grannar tittar fram, "the window" öppnas med svepet, orden ligger inne i filmen, styrning i en egen rad under filmerna (räknare, streck, pilar, paus). Sidan scrollar vanligt. Ett typsnitt (Cormorant), ljus elfenbenssida, en gemensam gradering.

Annas vägar dit: v43 (foto) → v44 (mörk fastnålad, "wow men för mörkt") → v45 (valvrad, *"ser konstigt ut, passar inte"*) → v46 (kapitel under varandra, godkänd riktning, *"det fanns lite fel"* → rättat) → **v47 karusell** (hennes önskemål). Detaljer och mätningar i projektets README.

## Öppna punkter (i den ordning de bör tas)

1. **Anna ska bedöma karusellen** (väntar). Säg vad som känns fel med hennes egna ord.
2. **Filmerna är stockfilm (Pexels) som platshållare.** Den riktiga lösningen är egna klipp från Flow via videoväljaren per ögonblick (`video_1…5` i temaredigeraren). Skillen `reklamfilm-regissor` styr: citera Annas ord, en sekvens i taget, hennes ok före nästa. Erbjud Flow-prompter per ögonblick.
3. **Inte sett med egna ögon**: riktig H.264-uppspelning, riktig telefon (svep, tröghet), Safari, Firefox, långsamt nät. Be Anna titta på sin telefon.
4. **De fem boxarna** (version 3 i copy-dokumentet) är inte byggda.
5. **Resten av startsidan** har inte fått samma behandling (Anna jämförde med BONJIL, bonjil.com). Föreslå nästa sektion med samma metod (baslinje, koncept, bygg i testbänk, mät, visa).
6. Befintligt headerfel (kontoikonen högre än sök/varukorg) är orört.
7. **Publicering**: inget är publicerat. Innan Anna publicerar: radera stubbarna, jämför mot live, kontrollera header, ta en ny backup.
8. Möjliga tillägg om hon vill: automatisk växling i karusellen, dra med musen.

## Teknik att minnas (hela listan i skillen)

- GraphQL-dokument max 16 384 tecken: dela temafiler i `snippets/`, använd `"""`-block, verifiera `checksumMd5`.
- Stora filer (t.ex. `templates/index.json`) skrivs via `themeFilesUpsert` med `body.type: URL` och den utdelade staged-adressen (asynkront jobb; Shopify minifierar JSON).
- Headless Chromium saknar H.264: i tester ersätts filmerna med VP9-kopior (`lab/make-test-media.sh`, `lab/live.mjs`).
- Mät alltid i den **riktiga förhandsvisningen** och i flera skärmstorlekar; Shopifys fasta utkastrad (ca 68 px längst ner) täcker knappar i förhandsvisningen men finns inte live.
