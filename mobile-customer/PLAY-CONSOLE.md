# Android naar Google Play — versie 1.1.0 (code 3)

Dit is de uitbrengroute voor **Mijn Lattenspecialist**. De app is nog niet gepubliceerd in Google Play. De persoonlijke statuslink blijft ondertussen bruikbaar zonder installatie.

## Bouwbestanden

De workflow `Klantenapp Android en iPhone` levert:

- `lattenspecialist-android-ontwikkeling`: DEV-APK met pakketnaam `nl.lattenspecialist.klanten.dev`. Alleen voor interne ontwikkeling. Deze app gebruikt de echte dienst, dus uitsluitend eigen testaanvragen gebruiken. Hij kan naast de klantenapp staan en neemt geen officiële klantlinks over.
- `mijn-lattenspecialist-google-play-unsigned`: ongetekende AAB met pakketnaam `nl.lattenspecialist.klanten`, leesmij en SHA-256-checksum. Dit is een kandidaat voor de interne Play-test, nog geen uploadklare, goedgekeurde app.
- `mijn-lattenspecialist-android-release-unsigned`: technische release-APK voor controles. Niet als klantdownload aanbieden.

In Android Studio kies je de `debug`-variant voor ontwikkelen en `release` voor de winkel. Voor de lokale browserpreview met alleen fictieve gegevens gebruik je `npm run dev` in de repositoryroot.

## Eerst nodig in het eigen Play Console-account

1. Maak/verifieer het ontwikkelaarsaccount en vul de eigenaar-/bedrijfsgegevens zelf correct in. Dit project heeft geen account of betaling aangemaakt.
2. Maak **Mijn Lattenspecialist** als app aan, met pakketnaam `nl.lattenspecialist.klanten`.
3. Stel Play App Signing en een uploadsleutel in. De bestaande lokale releasesleutel staat buiten Git in `%LOCALAPPDATA%\Lattenspecialist\Signing`. Bewaar die en een herstelkopie. De bestaande DPAPI-beveiliging vereist hetzelfde Windows-profiel. Kies bewust of dezelfde app-signingsleutel via Google's voorgeschreven import wordt behouden of dat Google een nieuwe beheert; een andere sleutel is geen directe update voor oude losse APK-installaties.
4. Onderteken de AAB lokaal met de geregistreerde uploadsleutel via Android Studio **Build → Generate Signed Bundle / APK → Android App Bundle** of de officiële `jarsigner`-route. Zet nooit de sleutel, het wachtwoord of de beheercode in Git of artifacts. Controleer de handtekening en het versienummer vóór uploaden. `apksigner` is voor APK's, niet voor AAB's.
5. Upload eerst naar **Intern testen** en nodig eigen testers uit. Gebruik daarna de vereiste test-/productietoegang van het account. Nieuwe persoonlijke accounts kunnen een gesloten test met 12 testers gedurende 14 aaneengesloten dagen moeten doorlopen.
6. Vul winkeltekst, screenshots, contentclassificatie, doelgroep, contactgegevens, app-toegang en Gegevensveiligheid in op basis van het echte gedrag. Privacybeleid: `https://lattenspecialist.nl/privacy.html`. Controleer of dat beleid alle appfuncties en externe diensten dekt; publiceer geen onbevestigde verklaringen over gegevensverwerking.
7. Voeg de **app-signing** SHA-256-vingerafdruk uit Play Console toe aan `.well-known/assetlinks.json`. De uploadsleutel is niet noodzakelijk de sleutel waarmee Google de geïnstalleerde app ondertekent. De huidige vingerafdruk is die van de oude rechtstreeks gedeelde release; behoud die zolang oude installaties ondersteund worden.
8. Controleer op een echt Android-toestel: installeren via Play, persoonlijke link vanuit WhatsApp, status en wax, nieuwere status ophalen, aanvragen/Turnstile, terugknop, beperkte verbinding en privacy. Gebruik herkenbare testaanvragen. Pas na geslaagde tests en beoordeling publiceren.

Geen toezegging dat Google de app zal goedkeuren of dat ieder toestel nooit een melding toont. Er is geen automatische publicatiestap en er worden door de workflow geen klanten uitgenodigd.

## Bronnen

- [Een app uploaden en intern testen](https://developer.android.com/studio/publish/upload-bundle)
- [App signing en AAB ondertekenen](https://developer.android.com/studio/publish/app-signing)
- [Testkanalen in Play Console](https://support.google.com/googleplay/android-developer/answer/9845334?hl=nl)
- [Testvereisten voor nieuwe persoonlijke accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=nl)
- [Meerdere apps maken in Play Console](https://support.google.com/googleplay/android-developer/answer/9859152?hl=nl)
