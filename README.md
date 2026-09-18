# De Lattenspecialist website v9

GitHub Pages-website voor De Lattenspecialist, inclusief de installeerbare webapp **Mijn Lattenspecialist**.

## Kerngegevens

- Ski- en snowboardonderhoud in West Maas en Waal en omgeving
- Gratis haal- en brengservice in West Maas en Waal, Druten, Afferden en Horssen
- Zelf brengen en ophalen in Wamel, uitsluitend op afspraak
- WhatsApp: 06 18 32 71 32
- Betaling via betaalverzoek na onderhoud
- KvK 99668637
- BTW-id NL005403580B64

## Website en webapp

- `index.html`: hoofdwebsite en aanvraagformulieren
- `app.html`: status, waxadvies en actueel huuraanbod
- `ervaring.html`: neutraal verzoek om een ervaring te delen
- `service.html`: uitleg over onderhoud, servicegebied en verhuur op aanvraag
- `privacy.html`: privacy-informatie, waaronder ervaringen en servicecodes
- `data/status.json`: statusrecords zonder persoonsgegevens
- `data/aanbod.json`: actueel aanbod of een lege lijst bij verhuur op aanvraag

De PWA gebruikt `manifest.webmanifest` en `sw.js`. Bij een nieuwe release moet de cachenaam in `sw.js` worden verhoogd.

## Beheer

Zie `BEHEER.md` voor het bijwerken van klantstatussen, verhuuraanbod en de stappen voor Google Search Console en Google Bedrijfsprofiel.

De repository moet `CNAME` met exact `lattenspecialist.nl` behouden.
