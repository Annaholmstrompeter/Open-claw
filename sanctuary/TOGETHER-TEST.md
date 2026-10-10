# TOGETHER — provlyssning på riktiga telefoner

Det här är det enda som inte kan testas i molnet. Allt annat är redan testat automatiskt (se README, "Tester"). Det som behöver riktiga telefoner är **hur iPhone-Safari och Android-Chrome faktiskt beter sig med ljud**: om de låter en nätverksstyrd start spela utan nytt tryck, om ljudet fortsätter när skärmen låses, och hur det låter i Bluetooth-hörlurar.

Räkna med ca 20 minuter och två telefoner (helst en iPhone och en Android, eller två av samma sort) med varsitt par hörlurar.

## Innan

1. Sidan ligger ute på sin riktiga `https://`-adress (inte `localhost`, inte en privat förhandsvisning).
2. `assets/together/config.js` har Supabase-uppgifterna (README, "Together → Så här kopplar du på delade sessioner").
3. En inspelning ligger som `assets/audio/together/heart-to-heart.mp3`. **Till provet räcker en testfil med ett klick varje sekund**: då hör du direkt om telefonerna ligger i takt. Gör den så här (kräver `ffmpeg`), och döp den till `heart-to-heart.mp3`:

   ```
   ffmpeg -f lavfi -i "aevalsrc=if(lt(mod(t\,1)\,0.025)\,0.6*sin(2*PI*1500*t)\,0):s=44100:d=75" -ac 2 -b:a 128k -c:a libmp3lame heart-to-heart.mp3
   ```

   Byt tillbaka till den riktiga inspelningen när du är klar.

## Provet (gör det på båda telefonerna, byt gärna roller)

Skriv ner ett kryss eller en rad för varje punkt.

| # | Gör så här | Ska bli så här |
|---|---|---|
| 1 | Telefon A: öppna adressen, tryck **Together**, **Begin Your Ritual**, **Heart to Heart**, **Invite Your Partner**. | En QR-kod, en kopierbar länk och (på telefonen) en **Share link**-knapp visas. |
| 2 | Telefon B: skanna QR-koden med kameran, eller öppna länken du skickade. | B ansluter. På båda telefonerna går ringarna ihop och det står **Your partner: Here**. |
| 3 | Koppla var sin hörlur till sin egen telefon. Tryck **I'm Ready** på A. | Knappen blir **Ready**. På B står det att A är redo. |
| 4 | Tryck **I'm Ready** på B. | A får knappen **Begin Together**. B ser **Your shared moment is almost here.** |
| 5 | Tryck **Begin Together** på A. Håll telefonerna intill varandra och lyssna med en hörlur i varje öra (en från A, en från B). | Efter ca 7 sekunder (andas, 3, 2, 1) startar ljudet. **Hör du klicken som ett enda klick eller som två?** Anteckna: i takt / något efter / tydligt efter. |
| 6 | **Viktigast på iPhone:** startade ljudet av sig självt på B, utan nytt tryck? | Ja = telefonen tillät den nätverksstyrda starten. Nej = B visade **Tap to join your partner**; efter trycket ska B hamna rätt i filen. Båda är godkända utfall; anteckna vilket det blev. |
| 7 | Vänta 30 sekunder. Hör du klicken glida isär? | De ska ligga i takt eller glida mycket långsamt (sidan rättar till små skillnader). Bluetooth-hörlurar kan ha olika fördröjning (ofta 100 till 300 ms); det kan sidan inte mäta eller ändra. |
| 8 | Tryck **Pause** på B. | A pausar också, inom en sekund. |
| 9 | Tryck **Resume** på A. | Båda startar igen från samma ställe efter ca 3 sekunder. |
| 10 | **Lås skärmen** på båda telefonerna i 30 sekunder, medan det spelas. Lås upp. | Ljudet har fortsatt hela tiden. Klicken ligger fortfarande ungefär i takt (sidan rättar till vid upplåsning). På iPhone: anteckna om ljudet avbröts. |
| 11 | Stäng av wifi/mobildata på B i 10 sekunder, slå på igen. | Ljudet på B fortsätter. På A står en liten rad om att något återansluts, sedan försvinner den. Båda är fortfarande i takt. |
| 12 | Tryck **Pause**, ta ut en Bluetooth-hörlur ur örat/stäng av den på B. | Vid frånkoppling pausar iPhone (och ofta Android) ljudet av sig själv: då ska **båda** pausa. Resume fungerar sedan. |
| 13 | Ladda om sidan på B mitt i. | B visar **Your ritual is under way** med **Tap to join your partner**. Efter trycket hamnar B rätt. |
| 14 | Stäng fliken på B. | A får en stilla rad om att B har lämnat, och A:s inspelning fortsätter. |
| 15 | Låt det spela klart (eller hoppa till slutet). | Båda får **Take a moment.** |
| 15b | Medan det spelar: öppna **inbjudningslänken** på en tredje telefon (eller i en privat flik). | Den tredje får *This ritual already has two people* och påverkar ingenting; A och B spelar vidare. |
| 15c | Ta ur och sätt tillbaka en hörlur på B medan det spelar, och tryck sedan **Resume**. | B:s ljud kommer inte plötsligt ur högtalaren: B visar *Tap to join your partner* och efter ett tryck hamnar B rätt. |
| 16 | Telefon A: **Listen Together on One Device**. | Vanlig spelare. Går att pausa, söka och backa 15 sekunder. Ljudet fortsätter med låst skärm. Vattenljuset syns bara medan det spelas. |

## Om något inte stämmer

Anteckna telefonmodell, iOS/Android-version, webbläsare, hörlurar, vilken punkt och vad som hände. Det går att åtgärda för det mesta, men det kräver att man vet *vilken* telefon som gör vad.

Kända gränser (se README): synkroniseringen är "i takt så gott webbläsarna medger", inte sampelexakt; hörlurarnas egen fördröjning kan inte mätas; iPhone kan kräva ett tryck till innan ljudet startar.
