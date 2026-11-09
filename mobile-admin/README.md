# Lattenspecialist Beheer voor Android en iPhone

Deze map bevat de native beheerapp voor `nl.lattenspecialist.beheer`. De app bundelt de beheeromgeving en gebruikt dezelfde beveiligde reserveringsservice als de website.

## Bijwerken

```text
npm install
npm run prepare:assets
npm run sync
```

Installeer voor het genereren van de appafbeeldingen eenmalig Pillow 12.3.0 voor Python. `npm run prepare:assets` maakt alle Android- en iPhone-formaten van het bestaande Lattenspecialist-icoon. `npm run sync` kopieert de actuele beheerpagina, scripts en styling naar de app en werkt daarna Android en iOS bij.

## Android

Gebruik voor installatie en updates het bestaande [Google Play-testkanaal voor Beheer](https://play.google.com/apps/internaltest/4701344778796450203). Het Google-account op de telefoon moet in de bestaande testlijst staan. Een geldige lokale APK-handtekening is geen garantie dat een rechtstreeks gedownloade APK door Play Protect wordt geaccepteerd. Schakel Play Protect niet uit om te installeren. De upload voor versie 1.6.1 gebruikt versiecode 16 omdat code 15 al door een eerdere conceptuitgave is gebruikt.

Op 9 november 2026 is **16 (1.6.1) – Onderhoudsmeldingen** in het bestaande interne testkanaal gepubliceerd. Play Console toont ‘Available to internal testers’; dit is geen openbare winkelpublicatie of afgeronde inhoudelijke beoordeling. De bestaande testlijst is behouden. Bundel SHA-256: `76cd893828eb31844cc0a590ee0f3b2cdfefcef7e40dd6763daa84f9d429e655`. De upload is met de bestaande beheersleutel ondertekend. Google Play verzorgt de distributie-ondertekening; een rechtstreeks geïnstalleerde APK kan daarom een andere handtekening hebben. De installatie en vergrendelschermmelding op een echt toestel zijn nog niet bevestigd.

Open `android` in Android Studio of voer op Windows `npm run build:android` uit. Voor Google Play is een eigen Play Console-account en een ondertekende AAB nodig. De GitHub-workflow bouwt daarnaast automatisch een installeerbare test-APK.

### Beginschermwidget

### Onderhoudsaanvragen (1.6.0)

- Het beheer toont bovenaan alle nog op te pakken onderhoudsaanvragen. De melding verdwijnt pas als de aanvraag verder is gezet dan ‘Aanvraag ontvangen’ of is afgesloten.
- Een geopende, zichtbare beheerpagina controleert elke 30 seconden; invoer in een opdracht wordt daarbij niet overschreven.
- De gewone Android-beheerapp controleert ook op de achtergrond via WorkManager, ongeveer elke 15 minuten. Android kan dit uitstellen bij batterijbesparing. Dit is geen directe pushdienst.
- Sta meldingen toe bij de eerste start. De melding bevat alleen een aantal, geen klantgegevens; aantikken opent het beveiligde beheer. De app verwijdert de melding bij de volgende controle zodra de aanvragen zijn opgepakt. Android kan toestaan dat je de melding zelf wegveegt.
- Voor telefonische aanvragen: gebruik de knop **Telefonische aanvraag** of voeg **Nieuwe aanvraag** toe via lang indrukken op het beginscherm → Widgets → Lattenspecialist Beheer. Log op ieder toestel afzonderlijk in. De aanvraag wordt in dezelfde administratie opgeslagen.
- De Android-uitgave heeft dezelfde applicatie-id `nl.lattenspecialist.beheer`; er is geen extra DEV-app nodig. Een update moet met de bestaande beheersleutel worden ondertekend.

Versie 1.4.0 bevat een Android-widget met het aantal nieuwe en openstaande aanvragen en het aantal materialen dat nog moet worden opgehaald of door klanten wordt gebracht. Voeg hem toe via **Beginscherm lang indrukken → Widgets → Lattenspecialist Beheer**. Open de beheerapp en log in om de widget te koppelen. De widget ververst bij gebruik van de app, handmatig via de vernieuwknop en periodiek op de achtergrond.

## Afzonderlijke openbare DEMO (kandidaat 1.6.2 / 17)

De startkeuze toont voor iedereen **Open beveiligde app** en **Bekijk fictieve demonstratie**. De demo gebruikt uitsluitend de vaste afzonderlijke demo-origin, een eigen Android-proces en eenmalig ingestelde WebView-opslag. Er is geen reviewerherkenning, operationele beheercode, JavaScript-bridge of terugval naar een productieservice. De operationele `MainActivity`, beide bestaande widgets en hun bronnen zijn identiek aan de vastgelegde 16-bron (`9918b5b5ebedb65d08f88e08fd148cc76c5e81c9`). In `RequestNotificationWorker` is uitsluitend de bestaande kanaalaanmaak omgeven door `if(Build.VERSION.SDK_INT>=26)`: Android 7 heeft geen meldingskanalen. Android 8+, tokens, verzoeken, de bestaande toestemmingsvraag en de vijftienminutenplanning blijven ongewijzigd. De echte worker-proloog wordt met Android-API-stubs voor SDK24/25/26/36 uitgevoerd om die compatibiliteitsgrens te controleren; er is geen lintonderdrukking of baseline.

Naast de operationele widgets zijn er twee afzonderlijk benoemde **DEMO**-widgets. De tellingen zijn een vast fictief voorbeeld, expliciet geen live gegevens. Vernieuwen gebruikt uitsluitend eigen demo-voorkeuren. De ski-/snowboardknoppen openen na de zichtbare demo-login het gewone bewerkbare fictieve aanvraagformulier; ze slaan niets automatisch op. Alleen de vast toegestane opdrachten en materiaalnamen worden doorgestuurd naar de demo, nooit een URL, token of klantgegeven.

De knop **DEMO-testmelding** vraagt op Android 13+ pas na aantikken om toestemming. Hij gebruikt een afzonderlijk DEMO-kanaal en meldingsnummer met vaste fictieve inhoud; aantikken opent alleen de demo. Een weigering toont uitleg en laat de demo beschikbaar. De demo plant geen achtergrondwerk. Camera, echte bestandskiezers, downloads en externe diensten blijven geblokkeerd; fictieve fotoknoppen verwerken uitsluitend de voorbeeldafbeelding.

`node --test scripts/demo-native.test.mjs scripts/verify-web-assets.test.mjs` controleert de operationele bron, intentgrenzen, toestemmingsroute en verpakte bestandsverwijzingen. JVM-unittests controleren toegestane en ongeldige opdrachten en toestemmingstoestanden. Een geslaagde build bewijst geen werking van widgets of meldingen op een echt toestel; er was geen emulator/toestel beschikbaar. Deze kandidaat wordt apart ondertekend en ter beoordeling bewaard, zonder automatische Play-upload of vervanging van openbare downloads.

## iPhone

Open `ios/App/App.xcodeproj` op een Mac met Xcode. Voor installatie via TestFlight of de App Store is een Apple Developer-account nodig. De GitHub-workflow controleert op macOS of het iOS-project compileert zonder distributie-ondertekening.

## Beveiliging

- De beheercode wordt alleen lokaal op het toestel bewaard als **Onthoud op dit apparaat** is aangevinkt.
- De app bevat geen Resend-, Cloudflare- of WhatsApp-geheimen.
- Alle beheeracties lopen via HTTPS en vereisen de persoonlijke beheercode.
