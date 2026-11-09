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
