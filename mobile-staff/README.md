# Lattenspecialist Medewerkers

Android-app `nl.lattenspecialist.medewerkers`, versie 1.7.0 (10). Dezelfde schermen als `medewerkers.html`; bronbestanden staan in de repositoryroot. Bouw met `npm ci`, `npm run sync`, `npm run prepare:assets` en `android/gradlew bundleRelease` (Windows: `gradlew.bat`). Java 21 en Android SDK 36 zijn vereist. GitHub voert dezelfde bouwstappen uit.

Voor de lokale demonstratie en beheer van medewerkers: [TEAM.md](../TEAM.md). Alle rechten worden door de Worker gecontroleerd; de app bevat geen gedeelde beheersleutel. DEV gebruikt pakket-ID `nl.lattenspecialist.medewerkers.dev` en kan naast de release staan.

De registratie staat in Google Play Console. Een AAB bouwen is geen winkelpublicatie: ondertekenen, interne test, app-toegang voor review, privacy-/gegevensverklaringen en goedkeuring blijven afzonderlijke stappen.

## Gewone Android-app bijwerken

De reguliere app heeft ID `nl.lattenspecialist.medewerkers`. De update 1.7.0 (10) gebruikt dezelfde ondertekening als de bestaande reguliere versie 1.1.1 (3). De download staat op `https://lattenspecialist.nl/downloads/De-Lattenspecialist-Medewerkersapp.apk`. Installeren hoort een update van de bestaande app te zijn; verwijder de oude app niet vooraf. De DEV-app is hiervoor niet nodig.

Bouw `assembleRelease` na de normale web-assetsynchronisatie. Onderteken lokaal met `scripts/sign-release.ps1`, met Android SDK 36 en Java 21. De oorspronkelijke staff-upload-sleutel en het DPAPI-beveiligde wachtwoord blijven buiten de repository. Het script weigert een DEV-app en controleert ondertekening en uitlijning. Er worden geen wachtwoorden of sleutels in de app, downloadmetadata of GitHub opgeslagen.

Controleer na ondertekenen de gewone app-ID, hogere versionCode, certificaatgelijkheid met 1.1.1, afwezigheid van de debuggable-vlag en aanwezigheid van de actuele oefen-, reparatie-, premium- en gereedschapsschermen. De SHA256 van het publiek gedownloade bestand moet gelijk zijn aan het lokaal geverifieerde bestand.

Waxen oefenen gebruikt vanaf 1.6.0 twee vaste blokken: Alpha Mix Yellow voor reinigen, daarna Beta Mix Red als basis. Beide stappen vragen een eigen begin- en eindgewicht. De werkelijke gewichtsverschillen worden afzonderlijk van de juiste voorraad afgeboekt en tellen als oefenverbruik, niet als klantproductie. Bestaande oefeningen behouden hun vastgelegde plan; oudere clients zonder het nieuwe waxprotocol blijven compatibel.

Versie 1.6.0 toont de waxnaam, kleur en het laatst gewogen blok als richtgewicht. Bij een actieve werkstap kun je direct naar het betreffende materiaal gaan om te pauzeren of af te ronden.

Versie 1.7.0 gebruikt dezelfde behandelingsoverzichten als het reserveringsformulier: standaardwerk en alleen gekozen premium-/eindwax-extra’s. Oefenen kan na het gele reinigingsblok en de rode basis een aparte gele, blauwe of Purple-eindwax krijgen, met eigen gewichten en werkelijk voorraadverbruik. Toeslagen in een oefening zijn uitsluitend klantprijsinformatie en maken geen klantfactuur.
