# De Lattenspecialist website v11

GitHub Pages-website voor De Lattenspecialist, inclusief de installeerbare webapp **Mijn Lattenspecialist**.

## Native beheerapp

In `mobile-admin` staat de native beheerapp voor Android en iPhone. De app bevat de reserveringen, ophaalplanning, servicecodes, waxregistratie, voortgang en betaalverzoeken. Android wordt als test-APK gebouwd via GitHub Actions; het iPhone-project is klaar voor ondertekening en publicatie via TestFlight of de App Store.

## Kerngegevens

- Ski- en snowboardonderhoud in West Maas en Waal en omgeving
- Gratis haal- en brengservice in West Maas en Waal, Druten, Afferden en Horssen
- Zelf brengen en ophalen in Wamel, uitsluitend op afspraak
- WhatsApp: 06 18 32 71 32
- Betaling via betaalverzoek na onderhoud
- Concrete ophaaldata uit de beheerapp en automatische Nederlandse adresopzoeking via PDOK
- Beheer van servicecode, voortgang, waxsoort, klantberichten, betaalverzoeken en afmelden
- KvK 99668637
- BTW-id NL005403580B64

## Website en webapp

- `index.html`: hoofdwebsite en aanvraagformulieren
- `app.html`: installeerbare klantenapp met aanvragen, status, waxkeuze, aanbod en reisgegevens
- `ervaring.html`: neutraal verzoek om een ervaring te delen
- `service.html`: uitleg over onderhoud, servicegebied en verhuur op aanvraag
- `privacy.html`: privacy-informatie, waaronder ervaringen en servicecodes
- `data/status.json`: statusrecords zonder persoonsgegevens
- `data/aanbod.json`: actueel aanbod of een lege lijst bij verhuur op aanvraag

De PWA gebruikt `manifest.webmanifest` en `sw.js`. De klantenschermen worden samen met de native apps gebouwd vanuit `mobile-customer/src` (`cd mobile-customer`, `npm ci`, `npm run build`, `npm test`). Commit de gegenereerde `app.html`, `customer-app.js`, `customer-app.css` en `pwa-install.js` voor GitHub Pages. Bij een nieuwe release moeten de gewijzigde assetversies en de cachenaam in `sw.js` worden verhoogd.

Klanten openen `https://lattenspecialist.nl/app.html#installeren` en installeren via Chrome of voegen de app in Safari toe aan het beginscherm. Er is geen APK-download of toestemming voor onbekende bronnen nodig. De browser kan een normale installatiebevestiging tonen. De losse debug-APK is alleen voor interne tests; deze wordt niet aan klanten aangeboden op de website.

## Beheer

Zie `BEHEER.md` voor het bijwerken van klantstatussen, verhuuraanbod en de stappen voor Google Search Console en Google Bedrijfsprofiel.

De repository moet `CNAME` met exact `lattenspecialist.nl` behouden.

## Mobiele apps

`mobile-customer/` is **Mijn Lattenspecialist**, de Android- en iPhone-app voor klanten: aanvragen, actuele prijzen en aanbod, persoonlijke onderhoudsstatus met waxkeuze en reisvoorbereiding. Zie de README in die map voor bouwen, testen en publicatie. De winkelpublicatie vereist nog eigen ontwikkelaarsaccounts en ondertekening.

`mobile-admin/` is uitsluitend **Lattenspecialist Beheer** voor de eigenaar. De beheerapp wordt niet aan klanten aangeboden. Klanten gebruiken hun persoonlijke onderhoudscode; de beheercode blijft alleen voor de eigenaar.
