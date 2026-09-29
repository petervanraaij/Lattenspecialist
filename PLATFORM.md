# Ontwikkelplatform Lattenspecialist

Deze repository is de gezamenlijke ontwikkelomgeving. Het klantportaal, de Android-klantenapp, de bestaande beheerapp en de reserveringsdienst hebben ieder een eigen map en gebruiken hetzelfde onderhoudssysteem. GitHub bewaart de versies, voert controles uit en bouwt de mobiele apps. Android Studio is de werkplek voor native ontwikkeling; Google Play Console is de plek voor testen en publiceren bij Google, geen vervanging voor deze broncodeomgeving.

## Drie afzonderlijke apps

Op 29 september 2026 heeft Peter gekozen voor drie aparte apps onder het ontwikkelaarsaccount **Van Raaij Services**. Ze gebruiken dezelfde onderhoudsdienst, met afzonderlijke toegang per gebruiker en rol. Die rollenverdeling is het doel; medewerkersaccounts en serverzijdige rollencontrole zijn nog niet gerealiseerd.

| App | Android-pakketnaam | Doel | Huidige staat |
| --- | --- | --- | --- |
| Mijn Lattenspecialist | `nl.lattenspecialist.klanten` | Klanten: aanvragen en eigen onderhoudsstatus bekijken. Persoonlijke webstatuslink blijft beschikbaar. | Bestaand project `mobile-customer`; appregistratie in Google Play aangemaakt, nog niet gepubliceerd. |
| Lattenspecialist Medewerkers | `nl.lattenspecialist.medewerkers` | Medewerkers: toegewezen werk, werkzaamheden en wax registreren, toegestane voortgang bijwerken. | Als concept geregistreerd in Google Play; de app en persoonlijke aanmelding moeten nog worden gebouwd. |
| Lattenspecialist Beheer | `nl.lattenspecialist.beheer` | Peter: aanvragen, planning, betalingen en uiteindelijk gebruikersrechten beheren. | Bestaand project `mobile-admin`; als concept geregistreerd in Google Play. Persoonlijke gebruikers- en rechtenadministratie moet nog worden gebouwd. |

Het Play Console-account en beide telefoonnummers zijn geverifieerd. Op 29 september 2026 zijn de drie registraties gecontroleerd in het appoverzicht: alle drie hebben status **Draft**, zonder publicatie. Peter heeft expliciet toestemming gegeven de beleids- en exportverklaringen voor medewerkers en beheer te accepteren en hun registraties af te ronden.

| App | Play app-ID | Console |
| --- | --- | --- |
| Klanten | `4972188105715999991` | [Dashboard klanten](https://play.google.com/console/u/1/developers/6558417675951251751/app/4972188105715999991/app-dashboard) |
| Medewerkers | `4976227964173634169` | [Dashboard medewerkers](https://play.google.com/console/u/1/developers/6558417675951251751/app/4976227964173634169/app-dashboard) |
| Beheer | `4976474646127870835` | [Dashboard beheer](https://play.google.com/console/u/1/developers/6558417675951251751/app/4976474646127870835/app-dashboard) |

Elke app krijgt een eigen versie, bouwbestand, testtraject en winkelvermelding. Er zijn nog geen releasebestanden geüpload tijdens deze registratie. De medewerkers- en beheerapp krijgen eerst een beperkte testdistributie; toegang tot klantgegevens vereist daarnaast altijd controle door de server.

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

`npm run check` controleert klantinteracties, klantlinks, de preview en de reserveringsdienst. `npm run android:open` opent het Android-project na synchronisatie (Android Studio moet geïnstalleerd zijn). `npm run android:dev` bouwt de interne testapp; `npm run android:bundle` bouwt de AAB. Java 21, Android SDK en de bestaande Pillow-assetsgenerator zijn hiervoor nodig. De GitHub-workflow levert dezelfde Android-bestanden zonder lokale SDK-installatie.

## Uitbreiding met medewerkers en accounts

Individuele gebruikersaccounts en medewerkersrechten zijn **nog niet gebouwd**. De huidige beheercode is één eigenaarstoegang en is niet geschikt als gedeeld medewerkerswachtwoord. De persoonlijke onderhoudslink is beperkte toegang tot één onderhoudsstatus, geen volledig klantaccount.

Volgende uitbreiding: een aparte medewerkersapp en servercontrole van rollen. Gewenste rolverdeling:

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
