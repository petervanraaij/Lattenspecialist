# Mijn Lattenspecialist — klantenapp

Android-klanten kunnen de ondertekende APK rechtstreeks ontvangen; iPhone-klanten gebruiken voorlopig de webapp. Dezelfde schermen zijn beschikbaar in de native Android- en iPhone-broncode, app-ID `nl.lattenspecialist.klanten`. De eigenaar gebruikt de afzonderlijke `mobile-admin`-app of `beheer.html`. De klantenapp bevat geen beheerpagina, beheercode, reserveringenlijst of private API-sleutels.

## Persoonlijke WhatsApp-statuslink

`https://lattenspecialist.nl/app.html#status=LS-ABC234` opent direct de status van die onderhoudscode. Dit is een voorbeeldcode, geen echte klant. De code staat in het URL-fragment zodat de hostingserver hem niet ontvangt. De app verwijdert het fragment met de code uit de huidige geschiedenisvermelding, toont meteen de voortgang en bewaart de code alleen als de klant dat zelf kiest. De link geeft toegang tot de openbare onderhoudsstatus; behandel echte links daarom als persoonlijk. Naam, adres, telefoon en e-mail worden niet door de status-API teruggegeven.

De beheerpagina zet deze link in het WhatsApp-statusbericht; de backend gebruikt dezelfde link in statusmails en de bestaande WhatsApp-templateparameter. Als de code bij het eerste statusbericht nog ontbreekt, wordt hij eerst aangemaakt en opgeslagen. Automatische WhatsApp-verzending blijft afhankelijk van de bestaande Meta-configuratie en toestemming van de klant.

Android App Links koppelen uitsluitend `/app.html` aan de klantenapp. `.well-known/assetlinks.json` bevat alleen de openbare SHA-256-certificaatvingerafdruk; `.nojekyll` zorgt dat GitHub Pages dit bestand publiceert. Geïnstalleerde Android-apps kunnen hiermee persoonlijke links rechtstreeks openen. Op iPhone blijft de persoonlijke link een webapp-link; er is geen App Store-publicatie nodig voor deze route.

## Android rechtstreeks delen

De workflow bouwt zowel een test-APK als een niet-debugbare, nog ongetekende release-APK. Download voor een release het artifact `mijn-lattenspecialist-android-release-unsigned`. Het bevat de APK, pakketcontrole, checksums en de officiële `apksigner.jar` uit de Android SDK. Onderteken lokaal met de vaste release-sleutel; upload nooit een private sleutel of wachtwoord naar Git of een openbaar artifact. De release van deze wijziging gebruikt versiecode 2 / versie 1.0.1.

De vaste sleutel staat op de beheerderscomputer buiten de repository in `%LOCALAPPDATA%\Lattenspecialist\Signing`. Het wachtwoord is beschermd met Windows DPAPI voor die gebruiker. Bewaar een veilige herstelkopie via de eigen back-upvoorziening; dezelfde sleutel is nodig voor latere updates. Controleer na ondertekenen `apksigner verify --verbose --print-certs`, de APK-checksum en overeenkomst met `assetlinks.json`.

De klant kan `Mijn-Lattenspecialist.apk` als document ontvangen. Na installatie heet de app **Mijn Lattenspecialist** en gebruikt hij het bestaande logo. Android vraagt bij installatie buiten een winkel toestemming voor die bron en kan een beveiligingsmelding tonen; de naam of ondertekening schakelt die bescherming niet uit. Schakel Play Protect niet uit.

Een eerder geïnstalleerde debug/test-APK gebruikt een andere sleutel en kan niet met deze release worden overschreven. Noteer in dat geval eerst de eigen onderhoudscode en reisgegevens voordat de testapp handmatig wordt verwijderd. Reserveringen blijven op de server bewaard. Latere releases met dezelfde release-sleutel kunnen de klantenapp wel bijwerken.

## Installeren vanaf de website

Chrome biedt de normale webapp-installatie aan zodra de browser die beschikbaar stelt. De knop vraagt dit uitsluitend na een klik van de klant. Safari-gebruikers krijgen instructies voor 'Zet op beginscherm'. Er wordt geen APK gedownload en niemand hoeft installatie uit onbekende bronnen toe te staan. De browser en telefoon blijven hun eigen beveiliging toepassen; geen website kan garanderen dat een apparaat nooit een waarschuwing zal tonen. HTTPS, een geldig manifest en normale browserinstallatie worden gebruikt.

De bestaande manifestidentiteit `/app.html` blijft behouden. Bestaande links naar `#status` en `#waxplanner` blijven bruikbaar. Installatiehulp verdwijnt wanneer de app zelfstandig geopend is. Annuleren van installatie verhindert het gebruik niet.

`npm run build` genereert ook de GitHub Pages-bestanden `app.html`, `customer-app.js`, `customer-app.css` en `pwa-install.js` in de repositoryroot. Pas de bronbestanden in `src` aan en commit die samen met de gegenereerde bestanden. De workflow controleert dat deze gelijk blijven. De serviceworker cachet het scherm voor offline openen, maar haalt prijzen, voorraad en status altijd via het netwerk op. Een offline aanvraagformulier krijgt een verbindingsmelding, geen schijnbare bevestiging.

## Klantfuncties

- Onderhoud of verhuur aanvragen in de app, met dezelfde velden, beschikbare ophaaldata, automatische adresopzoeking en e-mailbevestiging als de website.
- Voortgang ophalen met de persoonlijke onderhoudscode; gekozen wax en afgemelde aanvragen worden getoond. Een aanvraagreferentie is geen onderhoudscode.
- Onderhoudscode optioneel onthouden en weer wissen. Status wordt opnieuw opgehaald bij openen; er wordt geen verouderde status als actueel opgeslagen.
- Pakketten, prijzen en verhuuraanbod live ophalen van de website. Prijzen en pakketinhoud zijn niet gedupliceerd in de app.
- Bestemming, eerste skidag en verwachte omstandigheden lokaal bewaren en op verzoek overnemen in een aanvraag. Externe weerinformatie opent alleen na een klik.
- Duidelijke foutmelding bij offline gebruik. De app bevat nog geen pushmeldingen, klantaccounts of ingebouwde weersvoorspelling.

## Formulier en beveiliging

De app bundelt zijn eigen schermen. Alleen het formulier laadt vanuit `https://lattenspecialist.nl/?app=klant` in een iframe. Zo werkt de bestaande Turnstile-controle op de al toegestane domeinnaam; er wordt geen beveiliging uitgezet en geen sleutel in de app ingebouwd. `customer-booking.js` verandert alleen in deze expliciete modus de weergave. Dit volgt Cloudflares aanpak voor [Turnstile in mobiele WebViews](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/).

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
