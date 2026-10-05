# Android naar Google Play — versie 1.1.0 (code 3)

Dit is de uitbrengroute voor **Mijn Lattenspecialist**. Versie 1.1.0 (3) is op 29 september 2026 beschikbaar gemaakt voor intern testen in Google Play. Er is nog geen openbare winkelpublicatie. De persoonlijke statuslink blijft bruikbaar zonder installatie.

## Uitgevoerde interne release — 29 september 2026

- Ondertekende AAB geaccepteerd; intern testkanaal actief. [Testlink](https://play.google.com/apps/internaltest/4701567766370931615).
- Play App Signing actief. Google ondertekent distributie-apps met zijn beheerde app-signingsleutel; de bestaande lokale sleutel blijft de uploadsleutel. Oude rechtstreeks geïnstalleerde APK's kunnen daarom niet als gewone update door deze Play-versie worden vervangen.
- De SHA-256 uit Google's **Digital Asset Links JSON** is aan de website toegevoegd: `A1:44:05:CF:27:55:EA:99:37:E1:54:61:12:97:52:20:AD:40:F0:33:ED:51:A3:DB:54:82:4F:15:BD:EE:16:74`. De oudere rechtstreeks gedeelde app behoudt zijn bestaande vingerafdruk.
- Google meldt een tijdelijke technische appnaam met **unreviewed** totdat de inrichting en beoordeling compleet zijn. Testdistributie is geen productiegoedkeuring.
- Nog uitvoeren: echte toesteltest van installatie, WhatsApp-link, status, wax, betaalverzoek, formulier en terugknop. Daarna winkelvermelding en inhouds-/privacyverklaringen afronden voor openbare distributie.

## Bouwbestanden

De workflow `Klantenapp Android en iPhone` levert:

- `lattenspecialist-android-ontwikkeling`: DEV-APK met pakketnaam `nl.lattenspecialist.klanten.dev`. Alleen voor interne ontwikkeling. Deze app gebruikt de echte dienst, dus uitsluitend eigen testaanvragen gebruiken. Hij kan naast de klantenapp staan en neemt geen officiële klantlinks over.
- `mijn-lattenspecialist-google-play-unsigned`: ongetekende AAB met pakketnaam `nl.lattenspecialist.klanten`, leesmij en SHA-256-checksum. Dit is een kandidaat voor de interne Play-test, nog geen uploadklare, goedgekeurde app.
- `mijn-lattenspecialist-android-release-unsigned`: technische release-APK voor controles. Niet als klantdownload aanbieden.

In Android Studio kies je de `debug`-variant voor ontwikkelen en `release` voor de winkel. Voor de lokale browserpreview met alleen fictieve gegevens gebruik je `npm run dev` in de repositoryroot.

## Eerst nodig in het eigen Play Console-account

1. Het organisatieaccount **Van Raaij Services** (`beheer@vanraaijservice.nl`, account-ID `6558417675951251751`) is aangemaakt en betaald door Peter. Op 29 september 2026 zijn de afgeronde identiteitsverificatie en beide geverifieerde telefoonnummers in Play Console gecontroleerd.
2. **Mijn Lattenspecialist** is geregistreerd in Play Console (Play app-ID `4972188105715999991`) als gratis Nederlandstalige app met pakketnaam `nl.lattenspecialist.klanten`. De eerste interne release is geüpload en uitgerold. Medewerkers en beheer hebben aparte apps; zie [de indeling en actuele testlinks](../PLATFORM.md#drie-afzonderlijke-apps).
3. Stel Play App Signing en een uploadsleutel in. De bestaande lokale releasesleutel staat buiten Git in `%LOCALAPPDATA%\Lattenspecialist\Signing`. Bewaar die en een herstelkopie. De bestaande DPAPI-beveiliging vereist hetzelfde Windows-profiel. Kies bewust of dezelfde app-signingsleutel via Google's voorgeschreven import wordt behouden of dat Google een nieuwe beheert; een andere sleutel is geen directe update voor oude losse APK-installaties.
4. Onderteken de AAB lokaal met de geregistreerde uploadsleutel via Android Studio **Build → Generate Signed Bundle / APK → Android App Bundle** of de officiële `jarsigner`-route. Zet nooit de sleutel, het wachtwoord of de beheercode in Git of artifacts. Controleer de handtekening en het versienummer vóór uploaden. `apksigner` is voor APK's, niet voor AAB's.
5. Upload eerst naar **Intern testen** en nodig eigen testers uit. Gebruik daarna de vereiste test-/productietoegang van het account. Nieuwe persoonlijke accounts kunnen een gesloten test met 12 testers gedurende 14 aaneengesloten dagen moeten doorlopen.
6. Vul winkeltekst, screenshots, contentclassificatie, doelgroep, contactgegevens, app-toegang en Gegevensveiligheid in op basis van het echte gedrag. Privacybeleid: `https://lattenspecialist.nl/privacy.html`. Controleer of dat beleid alle appfuncties en externe diensten dekt; publiceer geen onbevestigde verklaringen over gegevensverwerking.
7. Houd de **app-signing** SHA-256-vingerafdruk uit Play Console bij in `.well-known/assetlinks.json`. Zowel de oude directe release als de Google Play-handtekening zijn opgenomen. De uploadsleutel is niet noodzakelijk de sleutel waarmee Google de geïnstalleerde app ondertekent. Controleer dit opnieuw na een app-signingsleutelwijziging.
8. Controleer op een echt Android-toestel: installeren via Play, persoonlijke link vanuit WhatsApp, status en wax, nieuwere status ophalen, aanvragen/Turnstile, terugknop, beperkte verbinding en privacy. Gebruik herkenbare testaanvragen. Pas na geslaagde tests en beoordeling publiceren.

Geen toezegging dat Google de app zal goedkeuren of dat ieder toestel nooit een melding toont. Er is geen automatische publicatiestap en er worden door de workflow geen klanten uitgenodigd.

## Bronnen

- [Een app uploaden en intern testen](https://developer.android.com/studio/publish/upload-bundle)
- [App signing en AAB ondertekenen](https://developer.android.com/studio/publish/app-signing)
- [Testkanalen in Play Console](https://support.google.com/googleplay/android-developer/answer/9845334?hl=nl)
- [Testvereisten voor nieuwe persoonlijke accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=nl)
- [Meerdere apps maken in Play Console](https://support.google.com/googleplay/android-developer/answer/9859152?hl=nl)
