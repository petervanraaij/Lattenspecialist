# Lattenspecialist Medewerkers

Kandidaat **1.7.3 (13)** herstelt opnieuw openen en Activity-recreatie van de fictieve demo: de WebView-opslagsuffix wordt eenmaal per demoproces ingesteld, vóór de eerste WebView. De bestaande werkapp, gebundelde webassets en demo-origin blijven behouden. Native regressietests controleren het werkelijk gecompileerde procesvlag-/guardgedrag; fysieke Android-recreatie blijft afzonderlijk te verifiëren. Dit is geen publicatiebevestiging.

## Zichtbare fictieve demonstratie

De Android-launcher toont iedere gebruiker eerst dezelfde keuze: **Open beveiligde app** of **Bekijk fictieve demonstratie**. De werkkeuze opent de bestaande MainActivity; de demokeuze opent een afzonderlijke DemoActivity met een vaste, eigen HTTPS-demo-origin en een blijvende DEMO-aanduiding. Er wordt geen reviewer, Google-account, verwijzer of toestelkenmerk gebruikt om de keuze of inhoud te veranderen.

De demo draait in een apart Android-proces met een eigen WebView-opslagmap. Zij leest geen werkappaanmelding, gebruikt geen Capacitor-/widgetbrug en opent geen operationele API of externe provider. Camera-, geolocatie-, popup- en downloadacties worden in deze aanvullende demo geweigerd. Op Android ouder dan 9 wordt de demo zonder netwerkverzoek geweigerd omdat afzonderlijke WebView-opslag daar niet beschikbaar is; de bestaande werkapp blijft bereikbaar. De demonavigatie vervangt geen fysieke test van de operationele app. Bestaande widgets en hun expliciete werkappacties blijven zelfstandig en ongewijzigd.

De nieuwe native originpolicy heeft een zelfstandige controle in android/verification/DemoOriginPolicyTest.java. Het aanvullende isolatie-/compileerscript staat in de afzonderlijke oplevermap output/isolated-google-play-demos/android/scripts/test-native-entry.mjs. Deze bronwijziging is nog geen opgebouwde, ondertekende of ingediende Play-update; versiecodes worden apart bevestigd vóór een releasebuild.


Android-app `nl.lattenspecialist.medewerkers`, versie 1.7.1 (10). Dezelfde schermen als `medewerkers.html`; bronbestanden staan in de repositoryroot. Bouw met `npm ci`, `npm run sync`, `npm run prepare:assets` en `android/gradlew bundleRelease` (Windows: `gradlew.bat`). Java 21 en Android SDK 36 zijn vereist. GitHub voert dezelfde bouwstappen uit.

Voor de lokale demonstratie en beheer van medewerkers: [TEAM.md](../TEAM.md). Alle rechten worden door de Worker gecontroleerd; de app bevat geen gedeelde beheersleutel. DEV gebruikt pakket-ID `nl.lattenspecialist.medewerkers.dev` en kan naast de release staan.

De registratie staat in Google Play Console. Een AAB bouwen is geen winkelpublicatie: ondertekenen, interne test, app-toegang voor review, privacy-/gegevensverklaringen en goedkeuring blijven afzonderlijke stappen.

## Gewone Android-app bijwerken

De reguliere app heeft ID `nl.lattenspecialist.medewerkers`. De update 1.7.1 (10) gebruikt dezelfde ondertekening als de bestaande reguliere versie 1.1.1 (3). De download staat op `https://lattenspecialist.nl/downloads/De-Lattenspecialist-Medewerkersapp.apk`. Installeren hoort een update van de bestaande app te zijn; verwijder de oude app niet vooraf. De DEV-app is hiervoor niet nodig.

Bouw `assembleRelease` na de normale web-assetsynchronisatie. Onderteken lokaal met `scripts/sign-release.ps1`, met Android SDK 36 en Java 21. De oorspronkelijke staff-upload-sleutel en het DPAPI-beveiligde wachtwoord blijven buiten de repository. Het script weigert een DEV-app en controleert ondertekening en uitlijning. Er worden geen wachtwoorden of sleutels in de app, downloadmetadata of GitHub opgeslagen.

Controleer na ondertekenen de gewone app-ID, hogere versionCode, certificaatgelijkheid met 1.1.1, afwezigheid van de debuggable-vlag en aanwezigheid van de actuele oefen-, reparatie-, premium- en gereedschapsschermen. De SHA256 van het publiek gedownloade bestand moet gelijk zijn aan het lokaal geverifieerde bestand.

Waxen oefenen gebruikt vanaf 1.6.0 twee vaste blokken: Alpha Mix Yellow voor reinigen, daarna Beta Mix Red als basis. Beide stappen vragen een eigen begin- en eindgewicht. De werkelijke gewichtsverschillen worden afzonderlijk van de juiste voorraad afgeboekt en tellen als oefenverbruik, niet als klantproductie. Bestaande oefeningen behouden hun vastgelegde plan; oudere clients zonder het nieuwe waxprotocol blijven compatibel.

Versie 1.6.0 toont de waxnaam, kleur en het laatst gewogen blok als richtgewicht. Bij een actieve werkstap kun je direct naar het betreffende materiaal gaan om te pauzeren of af te ronden.

Versie 1.7.1 gebruikt dezelfde behandelingsoverzichten als het reserveringsformulier: standaardwerk en alleen gekozen premium-/eindwax-extra’s. Oefenen kan na het gele reinigingsblok en de rode basis een aparte gele, blauwe of Purple-eindwax krijgen, met eigen gewichten en werkelijk voorraadverbruik. Toeslagen in een oefening zijn uitsluitend klantprijsinformatie en maken geen klantfactuur.
