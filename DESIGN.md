# Max Leimkühler Consulting – One-Pager

Spec, Stand 2026-09-14. Freigegeben im Chat, im Bau nachgezogen.

## Ziel
Eine statische Seite, ein Viewport, kein Scrollen. Fast kein Inhalt, dafür ein
animierter Hintergrund: eine Schlange (Snake), die sich selbst spielt und die
Besucher übernehmen können. Sprache: nur Englisch. Hosting später (GitHub Pages),
vorerst lokal per Doppelklick testbar.

## Layout (vier Ecken)
- Oben links: Wortmarke "Max Leimkühler", darunter gesperrt in Magenta "CONSULTING".
- Oben rechts: Icons LinkedIn und Mail als feine Outline-Kreise.
- Unten links: Kicker, Headline (eine Zeile), Subheadline.
- Unten links unter der Subheadline: "IMPRESSUM" als Link.
- Unten rechts: Spielwechsler, drei Mono-Namen SNAKE PONG RUNNER, aktives in Magenta.
  Auf dem Handy (bis 720 px) ausgeblendet, dort läuft nur Snake.
- Mobil: Blöcke untereinander, Headline kleiner, Legal unter dem Text.

## Texte
- Kicker: OSNABRÜCK, GERMANY
- Headline (eine Zeile): Turning complexity into advantage.
- Subheadline: I help ambitious companies streamline their operations, unlock the
  value hidden in their data, and build custom software that delivers.
  Hands-on, end to end.

## Farben und Schrift
- Grund: tiefes Violett mit Verlauf zu fast Schwarz nach unten (IOCO-Referenz).
- Text: Weiß. Ein Akzent: Magenta. Sonst keine weiteren Farben.
- Schrift: Outfit (variable, lokal) für alles, JetBrains Mono (variable, lokal)
  für kleine gesperrte Labels. Keine externen Requests.

## Spiele
Ein Host (js/host.js) besitzt Canvas, Frame-Schleife, Wechsler und Eingabe.
Jedes Spiel ist ein Modul mit enter/layout/frame/draw/still/key/touch/exit.
Wechsel blendet das alte Spiel aus und das neue ein (350 ms). Der Host misst
den freien Streifen zwischen Kopfzeile und Textblock ("band"); Pong und Runner
spielen nur dort, Snake nutzt die ganze Fläche. Kein Score in keinem Spiel.

### Pong
Zwei Balken am linken und rechten Rand des Streifens, Ball als Magenta-Punkt.
Ohne Eingabe Computer gegen Computer, absichtlich leicht ungenau, damit Punkte
fallen. Pfeiltasten hoch/runter steuern rechts, W/S links. Am Handy zieht man
den Balken auf der jeweiligen Hälfte. Ein Balken ohne Eingabe für 6 s geht
zurück an den Computer. Logik in js/pong-core.js.

### Runner
Bodenlinie am unteren Rand des Streifens, Läufer als Magenta-Punkt, Hindernisse
als Balkengruppen von rechts. Ohne Eingabe springt der Läufer selbst und wird
zügig schneller, bis 0,8 px/ms. Leertaste, Pfeil hoch, W oder Tippen übernimmt, dann springt
nur noch der Mensch. Nach dem Aufprall ausblenden, neuer Lauf im Autopilot.
Logik in js/runner-core.js.

## Schlange
- Canvas hinter dem Inhalt, unsichtbares Raster, Zelle ca. 22 px.
- Körper: abgerundete Linie in Violett, wenig heller als der Grund.
  Futter: kleiner Magenta-Punkt mit weichem Glow. Kein Spielbrett, keine Ränder.
- Autopilot: Textblöcke (Wortmarke, Icons, Textblock, Legal) sind mit Abstand
  Hindernisse. Bei Resize neu berechnen.
- Spieler: ganzes Brett frei, die Schlange darf hinter die Schrift. Der Textblock,
  hinter dem sie gerade ist, dimmt auf 35 %, sonst volle Deckkraft.
- Autopilot: BFS zum Futter mit Sicherheitsprüfung (danach Schwanz erreichbar),
  sonst Schwanz verfolgen, sonst irgendein sicherer Zug. Tod: ausblenden, neu starten.
- Übernahme: Pfeiltasten/WASD (Handy: Wischen). Schlange wird heller, kein
  Score, kein Hinweis. Nach Tod ausblenden, zurück in Autopilot.
- prefers-reduced-motion: stehende Windung, keine Animation.
  Tab im Hintergrund: Pause.
- Autopilot ca. 7 Zellen/s, Spieler ca. 9 Zellen/s.

## Mailadresse
Steht nirgends im HTML. js/contact.js setzt sie beim Laden aus Teilen zusammen
und hängt sie an Mail-Icon (mailto) und Legal-Seite (Text + mailto).

## Impressum (impressum.html)
Gleicher Grund ohne Spiel, Wortmarke als Link zurück, Seite auf Deutsch.
Angaben nach § 5 DDG: Max Leimkühler, Belfortplatz 1, 49076 Osnabrück,
E-Mail per Script, USt-IdNr DE352708430. Datenschutz in fünf Sätzen: keine
Cookies, kein Tracking, Server-Logs bei GitHub, Umgang mit E-Mails,
Betroffenenrechte. Keine Haftungs- oder Urheberrechtsbausteine.

## Dateien
index.html, impressum.html, css/style.css, js/host.js, js/{snake,pong,runner}-core.js
(reine Logik), js/{snake,pong,runner}.js (Module für den Host), js/contact.js,
fonts/*.woff2. Tests in test/: *-core.test.js (Logik), host/snake-controller/
pong-game/runner-game (gegen den Fake-Browser in test/harness.js).
Ausführen: node --test test/*.test.js
Klassische Scripts, keine ES-Module (file:// muss funktionieren).

## Offen
- Hosting (GitHub Pages) und Domain.
