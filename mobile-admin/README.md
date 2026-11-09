# Lattenspecialist Beheer voor Android en iPhone

## Zichtbare fictieve demonstratie

De Android-launcher toont iedere gebruiker eerst dezelfde keuze: **Open beveiligde app** of **Bekijk fictieve demonstratie**. De werkkeuze opent de bestaande MainActivity; de demokeuze opent een afzonderlijke DemoActivity met een vaste, eigen HTTPS-demo-origin en een blijvende DEMO-aanduiding. Er wordt geen reviewer, Google-account, verwijzer of toestelkenmerk gebruikt om de keuze of inhoud te veranderen.

De demo draait in een apart Android-proces met een eigen WebView-opslagmap. Zij leest geen werkappaanmelding, gebruikt geen Capacitor-/widgetbrug en opent geen operationele API of externe provider. Camera-, geolocatie-, popup- en downloadacties worden in deze aanvullende demo geweigerd. Op Android ouder dan 9 wordt de demo zonder netwerkverzoek geweigerd omdat afzonderlijke WebView-opslag daar niet beschikbaar is; de bestaande werkapp blijft bereikbaar. De demonavigatie vervangt geen fysieke test van de operationele app. Bestaande widgets en hun expliciete werkappacties blijven zelfstandig en ongewijzigd.

De nieuwe native originpolicy heeft een zelfstandige controle in android/verification/DemoOriginPolicyTest.java. Het aanvullende isolatie-/compileerscript staat in de afzonderlijke oplevermap output/isolated-google-play-demos/android/scripts/test-native-entry.mjs. Deze bronwijziging is nog geen opgebouwde, ondertekende of ingediende Play-update; versiecodes worden apart bevestigd vóór een releasebuild.


Deze map bevat de native beheerapp voor `nl.lattenspecialist.beheer`. De app bundelt de beheeromgeving en gebruikt dezelfde beveiligde reserveringsservice als de website.

## Bijwerken

```text
npm install
npm run prepare:assets
npm run sync
```

Installeer voor het genereren van de appafbeeldingen eenmalig Pillow 12.3.0 voor Python. `npm run prepare:assets` maakt alle Android- en iPhone-formaten van het bestaande Lattenspecialist-icoon. `npm run sync` kopieert de actuele beheerpagina, scripts en styling naar de app en werkt daarna Android en iOS bij.

## Android

Open `android` in Android Studio of voer op Windows `npm run build:android` uit. Voor Google Play is een eigen Play Console-account en een ondertekende AAB nodig. De GitHub-workflow bouwt daarnaast automatisch een installeerbare test-APK.

### Beginschermwidget

Versie 1.4.0 bevat een Android-widget met het aantal nieuwe en openstaande aanvragen en het aantal materialen dat nog moet worden opgehaald of door klanten wordt gebracht. Voeg hem toe via **Beginscherm lang indrukken → Widgets → Lattenspecialist Beheer**. Open de beheerapp en log in om de widget te koppelen. De widget ververst bij gebruik van de app, handmatig via de vernieuwknop en periodiek op de achtergrond.

## iPhone

Open `ios/App/App.xcodeproj` op een Mac met Xcode. Voor installatie via TestFlight of de App Store is een Apple Developer-account nodig. De GitHub-workflow controleert op macOS of het iOS-project compileert zonder distributie-ondertekening.

## Beveiliging

- De beheercode wordt alleen lokaal op het toestel bewaard als **Onthoud op dit apparaat** is aangevinkt.
- De app bevat geen Resend-, Cloudflare- of WhatsApp-geheimen.
- Alle beheeracties lopen via HTTPS en vereisen de persoonlijke beheercode.
