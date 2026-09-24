# Ontwikkelplatform Lattenspecialist

Deze repository is de gezamenlijke ontwikkelomgeving. Het klantportaal, de Android-klantenapp, de bestaande beheerapp en de reserveringsdienst hebben ieder een eigen map en gebruiken hetzelfde onderhoudssysteem. GitHub bewaart de versies, voert controles uit en bouwt de mobiele apps. Android Studio is de werkplek voor native ontwikkeling; Google Play Console is de plek voor testen en publiceren bij Google, geen vervanging voor deze broncodeomgeving.

## Wat werkt nu

| Onderdeel | Locatie | Gebruik |
| --- | --- | --- |
| Persoonlijke klantomgeving | `mobile-customer/src` → `app.html` | Persoonlijke link opent de onderhoudsstatus op Android en iPhone; installatie is optioneel. |
| Android-klantenapp | `mobile-customer/android` | Android Studio-project, aparte DEV-identiteit en release-AAB voor Google Play. |
| Bestaand beheer | `beheer.html`, `beheer.js`, `mobile-admin` | Aanvragen, voortgang, wax, ophaaldata, betaalverzoeken en klantlinks. Toegang met de bestaande beheercode. |
| Reserveringsdienst | `worker` | Centrale API en opslag voor aanvragen en voortgang. |
| Lokale demonstratie | `mobile-customer/dev`, `scripts/dev-server.mjs` | Fictieve klantstatussen; geen productie-aanvragen of berichten. |

Start vanuit de repository met `npm ci --prefix mobile-customer`, daarna `npm run dev`. Open `http://127.0.0.1:8780/`. Stop met Ctrl+C. De preview is alleen op deze computer bereikbaar en serveert uitsluitend een vaste lijst publieke bestanden. Broncode van de backend, sleutels en beheergegevens worden niet aangeboden. Het demoformulier verstuurt niets. Aanbod en aanvragen worden in de echte omgeving afzonderlijk getest; de demo is geen kopie van de productiedatabase.

Op Windows kun je ook dubbelklikken op `Start-ontwikkelplatform.cmd`. Node.js moet geïnstalleerd zijn. Laat het venster open zolang je test. Start niet nog een exemplaar als de ontwikkelomgeving al op poort 8780 draait.

Installeer ook `npm ci --prefix worker` voordat je `npm run check` uitvoert. De controles dekken klantinteracties, persoonlijke toegang, betaalverzoeken, pushmeldingen, de preview en de reserveringsdienst. `npm run android:open` opent het Android-project na synchronisatie (Android Studio moet geïnstalleerd zijn). `npm run android:dev` bouwt de interne testapp; `npm run android:bundle` bouwt de AAB. Java 21, Android SDK en de bestaande Pillow-assetsgenerator zijn hiervoor nodig. De GitHub-workflow levert dezelfde Android-bestanden zonder lokale SDK-installatie.

Klanten ontvangen hun bevestiging, status en betaalverzoek uitsluitend in de app. De webapp kan na toestemming telefoonmeldingen geven; daarvoor zijn VAPID-sleutels op de Worker nodig. Native Android-push vereist nog FCM-configuratie. Zie [de klantenapp](mobile-customer/README.md) voor de precieze mogelijkheden en toestelcontrole.

## Uitbreiding met medewerkers en accounts

Individuele gebruikersaccounts en medewerkersrechten zijn **nog niet gebouwd**. De huidige beheercode is één eigenaarstoegang en is niet geschikt als gedeeld medewerkerswachtwoord. De persoonlijke onderhoudslink is beperkte toegang tot één onderhoudsstatus, geen volledig klantaccount.

Volgende uitbreiding: een apart medewerkersscherm en servercontrole van rollen. Voorstel:

| Rol | Gewenste toegang |
| --- | --- |
| Klant | Alleen eigen aanvragen en materiaal; persoonlijke link blijft beschikbaar voor status. |
| Medewerker | Toegewezen onderhoud, registreren van werkzaamheden en wax, toegestane statuswijzigingen. |
| Beheerder | Planning, aanvragen, betalingen, medewerkers uitnodigen en rechten intrekken. |

Vóór activeren: individuele aanmelding, serverzijdige autorisatie per aanvraag en bedrijf, sessies en herstelprocedure, logboek van wijzigingen, aparte testopslag en tests voor ingetrokken toegang. Welke medewerkers gegevens mogen inzien en betalingen mogen beheren moet bij die uitbreiding worden vastgesteld. Het verbergen van een scherm in de app geeft op zichzelf geen toegangsbeveiliging.

## Latere applicaties

Nieuwe applicaties kunnen als afzonderlijk project naast `mobile-customer` en `mobile-admin` worden toegevoegd, met een eigen app-ID, versie, tests, bouwproces en winkelvermelding. Hergebruik gedeelde onderhoudsfuncties via de API; geef een nieuw project alleen toegang tot de gegevens die het nodig heeft. Een toepassing voor een ander bedrijf krijgt eigen configuratie en opslag, tenzij bewust een gecontroleerd systeem met meerdere bedrijven wordt ontworpen.

Een Play Console-account kan meerdere apps beheren. Een toekomstige app hoeft daarom geen kopie van de klantenapp te worden. Publicatie blijft per app afhankelijk van de winkelvereisten. OpenAI/Codex, GitHub, Cloudflare en Google Play zijn verschillende diensten; deze repository maakt geen betaalde accounts aan en koopt geen abonnement.

## Publicatie

De huidige klantlink blijft de standaard voor klanten. APK's worden uitsluitend gebruikt voor interne ontwikkeling. Zie [de Android-uitbrenginstructie](mobile-customer/PLAY-CONSOLE.md). De website wordt via een beoordeelde branch en pull request bijgewerkt; prijzen en pakketinhoud worden niet door de app gekopieerd of gewijzigd. Signingmateriaal en de beheercode staan buiten Git.
