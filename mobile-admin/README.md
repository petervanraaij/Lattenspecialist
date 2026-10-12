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

Open `android` in Android Studio of voer op Windows `npm run build:android` uit. Voor Google Play is een eigen Play Console-account en een ondertekende AAB nodig. De GitHub-workflow bouwt daarnaast automatisch een installeerbare test-APK.

### Beginschermwidget

Versie 1.4.0 bevat een Android-widget met het aantal nieuwe en openstaande aanvragen en het aantal materialen dat nog moet worden opgehaald of door klanten wordt gebracht. Voeg hem toe via **Beginscherm lang indrukken → Widgets → Lattenspecialist Beheer**. Open de beheerapp en log in om de widget te koppelen. De widget ververst bij gebruik van de app, handmatig via de vernieuwknop en periodiek op de achtergrond.

## iPhone

Open `ios/App/App.xcodeproj` op een Mac met Xcode. Voor installatie via TestFlight of de App Store is een Apple Developer-account nodig. De GitHub-workflow controleert op macOS of het iOS-project compileert zonder distributie-ondertekening.

## Beveiliging

- De beheercode wordt alleen lokaal op het toestel bewaard als **Onthoud op dit apparaat** is aangevinkt.
- De app bevat geen Resend-, Cloudflare- of WhatsApp-geheimen.
- Alle beheeracties lopen via HTTPS en vereisen de persoonlijke beheercode.
