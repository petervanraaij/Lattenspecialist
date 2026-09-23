# Mijn Lattenspecialist — klantenapp

Android- en iPhone-app voor klanten, app-ID `nl.lattenspecialist.klanten`. De eigenaar gebruikt de afzonderlijke `mobile-admin`-app of `beheer.html`. De klantenapp bevat geen beheerpagina, beheercode, reserveringenlijst of private API-sleutels.

## Klantfuncties

- Onderhoud of verhuur aanvragen in de app, met dezelfde velden, beschikbare ophaaldata, automatische adresopzoeking en e-mailbevestiging als de website.
- Voortgang ophalen met de persoonlijke onderhoudscode; gekozen wax en afgemelde aanvragen worden getoond. Een aanvraagreferentie is geen onderhoudscode.
- Onderhoudscode optioneel onthouden en weer wissen. Status wordt opnieuw opgehaald bij openen; er wordt geen verouderde status als actueel opgeslagen.
- Pakketten, prijzen en verhuuraanbod live ophalen van de website. Prijzen en pakketinhoud zijn niet gedupliceerd in de app.
- Bestemming, eerste skidag en verwachte omstandigheden lokaal bewaren en op verzoek overnemen in een aanvraag. Externe weerinformatie opent alleen na een klik.
- Duidelijke foutmelding bij offline gebruik. De app bevat nog geen pushmeldingen, klantaccounts of ingebouwde weersvoorspelling.

## Formulier en beveiliging

De app bundelt zijn eigen schermen. Alleen het formulier laadt vanuit `https://lattenspecialist.nl/?app=klant#afspraak` in een iframe. Zo werkt de bestaande Turnstile-controle op de al toegestane domeinnaam; er wordt geen beveiliging uitgezet en geen sleutel in de app ingebouwd. `customer-booking.js` verandert alleen in deze expliciete modus de weergave. Dit volgt Cloudflares aanpak voor [Turnstile in mobiele WebViews](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/).

De berichten tussen formulier en app controleren bronvenster, origin en berichttype. Prefill verstuurt uitsluitend de door de klant gekozen reisgegevens/pakketkeuze; versturen van een aanvraag blijft een handmatige actie. Alleen de aanvraagreferentie keert naar de app terug. Een gewone websitebezoeker krijgt de bestaande weergave.

De app gebruikt de bestaande publieke `/api/status/`- en `/api/availability`-routes. Native origins zijn al toegelaten in de reserveringsservice. Android-back-ups staan uit om bewaarde onderhoudscodes niet mee te kopiëren. De optionele lokale opslag is geen versleutelde kluis: deel persoonlijke codes niet en gebruik de wisfunctie op gedeelde toestellen.

## Bouwen en testen

```text
npm ci
npm run sync
npm test
python -m pip install Pillow==12.3.0
npm run prepare:assets
```

`npm run sync` bouwt de webbestanden en synchroniseert beide native projecten. De afbeeldingen komen uit het bestaande logo en bestaande websitefoto's. De map `www` is gegenereerd en staat niet in Git.

De workflow `customer-app.yml` test de klantinteracties, bouwt een Android-test-APK en compileert iOS voor de simulator. Download de Android-artifact `mijn-lattenspecialist-klanten-android-test` voor een toesteltest. Deze APK is een debugversie, geen definitieve distributie via Google Play. Publiceer de bijbehorende websitewijziging voordat je het aanvraagformulier in de app test.

Voor Google Play zijn een eigen ondertekeningssleutel en Play Console-account nodig. Voor TestFlight/App Store zijn een Apple Developer-account, signing en winkelbeoordeling nodig. Een geslaagde simulatorbuild is geen installeerbare iPhone-release. Bewaar signingmateriaal en wachtwoorden buiten Git. Native toesteltests, met name Turnstile op Android WebView en iOS WKWebView, blijven nodig vóór publieke distributie.

## Releasecontrole

Controleer op een echt toestel: aanmelden is niet nodig; code opzoeken en wissen; status en wax; afgemelde aanvraag; actuele prijzen inclusief 'vanaf'; postcode/huisnummer; beschikbare datum; aanvraag versturen en e-mail ontvangen; reis overnemen; externe WhatsApp/privacylinks; terugknop; offline melding. Verstuur uitsluitend herkenbare testaanvragen met toestemming.
