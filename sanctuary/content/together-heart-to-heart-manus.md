# Heart to Heart — manusutkast (för inspelning)

**Utkast, inte färdig text.** Strukturen är satt: fem delar, ca 10 minuter. Orden är ett förslag att skriva om fritt med din egen röst. Manuset skickas aldrig till gästernas telefoner; det ligger bara här (som de andra manusen).

Tonen: varm, vuxen, stilla. Inga löften om kroppen ("era hjärtan synkas", "sänker stress"), inga klichéer. Allt är en inbjudan: beröring och ögonkontakt är alltid frivilliga, och man får hålla händerna på sitt eget hjärta. Varje del bör någon gång säga det på något sätt.

Tiderna är riktmärken. När inspelningen är klar: fyll i `cues` i `content/together.json` (sekunder där varje del börjar), så visar skärmen delens namn medan den spelas. Lämna `cues` tom tills dess.

`[paus 5 s]` = tystnad. Det är pauserna som gör att det tar 10 minuter; läs lugnare än du tror.

---

## 0. Inledning (tystnad)

`[tyst 2 s]` — filen ska börja med minst en och en halv sekund tystnad (se README, "Inspelningen").

## 1. Arrival — 0:00 till ca 1:30

Welcome.

Take a moment to arrive. Sit comfortably, side by side or facing each other, in whatever way lets you both feel at ease.

`[paus 4 s]`

Let your eyes soften, or close, if that feels right.

`[paus 3 s]`

Notice the weight of your body where it is supported: the chair, the floor, the cushion beneath you.

`[paus 5 s]`

Let your shoulders loosen. Let your jaw rest.

`[paus 4 s]`

And now, without turning, simply notice that someone is here with you. The quiet presence of another person, close by.

`[paus 5 s]`

There is nothing to do, and nothing to say. Only this moment, shared.

`[paus 8 s]`

## 2. Heart Connection — ca 1:30 till ca 3:45

When you are ready, place one hand over your own heart. Feel the warmth of your palm, through the fabric or on your skin.

`[paus 6 s]`

Notice the gentle weight of your own hand. Notice any movement beneath it.

`[paus 8 s]`

If you both wish to, you may now rest your other hand lightly over your partner's heart, and receive their hand over yours. If you would rather not, there is no need. Keep both hands on your own heart. Either way is complete.

`[paus 8 s]`

Feel the warmth. Feel the weight of a hand, the texture of cloth or skin, the quiet rise and fall that moves beneath it.

`[paus 10 s]`

Let the touch be light and unhurried. You are not trying to feel anything in particular. You are simply here, with a hand over a heart.

`[paus 20 s]`

## 3. Shared Breathing — ca 3:45 till ca 6:15

Now bring your attention to your breathing. You do not need to change it. Only notice.

`[paus 6 s]`

Notice your own breath: the slight coolness as it comes in, the warmth as it leaves.

`[paus 8 s]`

And now, notice the breath of the person beside you. Perhaps you can hear it. Perhaps you sense it in the movement of their body.

`[paus 8 s]`

Without forcing anything, you may find that your breath comes a little closer to theirs. Or it may not, and that is just as it should be. Each of you breathes in your own way, and still, you are breathing in the same quiet room.

`[paus 10 s]`

Let each breath be as long, or as short, as it wishes to be.

`[paus 25 s]`

## 4. Deepening Connection — ca 6:15 till ca 8:30

If it feels comfortable, you may now let your eyes meet. Softly. There is nothing to look for. Simply allow yourself to be seen, and to see.

`[paus 10 s]`

If it feels like too much, look away, or close your eyes. That is a kind choice too.

`[paus 8 s]`

Let your hands rest where they are. Or find another gentle way to stay in contact: a hand held, a shoulder touched, or only stillness, side by side.

`[paus 15 s]`

Stay here. Nothing more is needed.

`[paus 30 s]`

## 5. Integration — ca 8:30 till ca 10:00

Slowly, let the ritual begin to settle.

`[paus 5 s]`

Allow your hands to come to rest, wherever feels natural.

`[paus 5 s]`

Notice how you feel now. In your body. In the space between you.

`[paus 10 s]`

Whatever you feel is welcome.

`[paus 6 s]`

When you are ready, take one deeper breath, and let it go.

`[paus 5 s]`

Carry this quiet with you, into the rest of your day.

`[paus 5 s]`

Thank you for sharing this moment.

`[tyst 2 s]` — filen ska sluta med ett par sekunders tystnad.

---

## Produktionskrav (så att den delade uppspelningen blir bra)

| | |
|---|---|
| Filnamn | `heart-to-heart.mp3`, i `sanctuary/public/assets/audio/together/` |
| Format | mp3, **konstant bitrate** (CBR), 128 till 192 kbps, 44,1 kHz. Samma som de andra inspelningarna. Variabel bitrate (VBR) kan göra att telefonen hamnar några tiondelar fel när den hoppar i filen. |
| Början | **Minst 1,5 sekunds tystnad** först. Telefonen "tänder" ljudet vid Ready-trycket genom att spela en kort tystnad, men en del telefoner släpper ut de första hundradelarna av filen. Tystnad där är osynlig; ett ord där hörs. |
| Slut | 1 till 2 sekunders tystnad. Spelaren går till slutvyn när filen är slut. |
| Volym | Jämn, ca −16 LUFS. Inga plötsliga toppar: två personer lyssnar med hörlurar i ett stilla rum. |
| Längd | Ca 10 minuter. Själva längden bestäms av inspelningen; sidan läser den ur filen. |
| Röst | En röst för båda. Samma ljud går till båda telefonerna; inget är "vänster" eller "höger" per person. |
