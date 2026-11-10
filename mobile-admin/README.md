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

### Updatecontrole 1.8.1 (20)

De aangemelde werkapp controleert bij openen en hervatten via de officiële Play In-App Updates-bibliotheek 2.1.0 of Google Play een update voor dit account beschikbaar stelt. Een flexibele update downloadt na de Play-toestemming op de achtergrond. De app biedt daarna **Bijwerken** aan met een herinnering om werk eerst op te slaan. Een geweigerde aanbieding wordt maximaal eenmaal per dag opnieuw getoond. Zonder Play-toegang of netwerk blijft de app bruikbaar. De demo start geen updatecontrole. Dit vervangt niet de Android-instelling Automatisch updaten en omzeilt geen toestemming, accountrechten of Play-beoordeling. Versie 20 moet eerst via de bestaande Play-vermelding worden geïnstalleerd voordat deze controle beschikbaar is.

### Pushupdate 1.8.0 (19)

Deze update voegt Firebase Cloud Messaging 25.0.1 toe aan de bestaande beheerapp. Registratie start uitsluitend in de aangemelde werkapp wanneer Android meldingen toestaat. De demo houdt zijn eigen proces, opslag en widgets en roept geen Firebase-registratie aan. Analytics is uitgeschakeld. De server bewaart toesteltokens versleuteld en verstuurt alleen een meldingstype en opdrachtreferentie, zonder klantgegevens. Uitloggen meldt het toestel af; een gewijzigde beheercode maakt oude registraties ongeldig. Een duurzame verzendwachtrij bewaart mislukte pogingen; de bestaande periodieke controle blijft als terugval beschikbaar.

Firebase staat op het kosteloze Spark-plan. De beperkte serviceaccount heeft uitsluitend Firebase Cloud Messaging API Admin; de privésleutel staat als Cloudflare-servergeheim en wordt niet in de Android-app of deze repository opgeslagen. De openbare Android-appconfiguratie bevat geen serversleutel. Voor uitgave 19 moet de Play-gegevensveiligheidsverklaring ook installatie-/toestelidentificatoren voor appfunctionaliteit noemen. Een geslaagde server- of bouwtest bewijst nog geen ontvangst op een echt toestel; daarvoor moet de Play-update worden geïnstalleerd en een echte testaanvraag worden gedaan.

### Openbare releasekandidaat 1.7.0 (17)

Deze versie behoudt de beveiligde beheeromgeving en de achtergrondmeldingen van 1.6.1. Het startscherm biedt daarnaast een expliciete, afzonderlijke demonstratie voor gebruikers en de appbeoordeling. De demo draait in een eigen Android-proces en WebView-opslag, zonder beheersleutel, native widgetbridge of toegang tot de productieomgeving. Alle demo-verbindingen blijven beperkt tot het vaste HTTPS-reviewadres. SSL-fouten worden geweigerd; downloads, camera, locatie en externe navigatie zijn daar uitgeschakeld. De demonstratie is fictief en voert geen echte berichten of betalingen uit. De normale werkapp en de bestaande widgets blijven afzonderlijk beschikbaar.

Voor Google Play is de doelgroep 18+ ingesteld. Reviewinstructies verwijzen expliciet naar deze demo en beschrijven de beperkingen; er zijn geen echte beheer- of klantgegevens verstrekt. De gegevensveiligheidsverklaring vermeldt de verwerkte gegevens en de privacy-/verwijderverzoekpagina. Nederland is de gekozen productieregio. Een productie-upload is pas openbaar beschikbaar nadat Google de uitgave heeft goedgekeurd en gepubliceerd.

Validatie: 28 controles op de toegestane demo-origin, de bestaande 69 klant-/beheertests, Android bundleRelease inclusief lint en verificatie van de bestaande uploadhandtekening. Een echte toesteltest blijft nodig.

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

## iPhone

Open `ios/App/App.xcodeproj` op een Mac met Xcode. Voor installatie via TestFlight of de App Store is een Apple Developer-account nodig. De GitHub-workflow controleert op macOS of het iOS-project compileert zonder distributie-ondertekening.

## Beveiliging

- De beheercode wordt alleen lokaal op het toestel bewaard als **Onthoud op dit apparaat** is aangevinkt.
- De app bevat geen Resend-, Cloudflare- of WhatsApp-geheimen.
- Alle beheeracties lopen via HTTPS en vereisen de persoonlijke beheercode.

## Aanvragen en werkorders (1.8.2)

Tik op een aanvraagkaart om de details te openen. Klantgegevens en aanvullende afspraken kunnen worden aangepast. Met **Omzetten naar werkorder** krijgt dezelfde aanvraag een vast WO-nummer en klantcode. De status gaat naar voorbereiding; dit verstuurt geen klantbericht en bevestigt geen concrete brengafspraak. Materiaal, foto’s en historie blijven via het oorspronkelijke aanvraagnummer gekoppeld. Herhaald omzetten maakt geen tweede werkorder.

Het opdrachtenoverzicht heeft filters voor open, nieuw, gepland, werkplaats, gereed en afgerond. Automatische en handmatige verversing behouden niet-opgeslagen invoer. Een versiestrijd blokkeert opslaan; via **Wijzigingen verwerpen en herladen** haal je bewust de laatste versie op. Nieuwe aanvragen blijven tijdens bewerken zichtbaar.

Controle: `npm run test:orders:browser` (synthetische gegevens, geïsoleerde lokale database) en de bestaande worker-regressietests.
