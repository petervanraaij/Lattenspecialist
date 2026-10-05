# Mijn Lattenspecialist — klantenapp

Klanten openen hun persoonlijke onderhoud via `app.html#klant=…`, zonder account, code-invoer of installatie. Na aanvragen verschijnt direct **Bekijk mijn onderhoud**. De pagina toont de huidige stap, wat er vervolgens gebeurt, verwachte planning, gekozen wax en een gepubliceerd betaalverzoek. Er wordt geen automatische e-mail naar de klant gestuurd. Prijzen en pakketinhoud komen ongewijzigd van de website.

## Persoonlijke toegang

De willekeurige sleutel van 256 bits gaat niet naar de hostingserver: hij staat in het URL-fragment en wordt bij openen uit de actuele geschiedenisvermelding verwijderd. De app bewaart hem tijdelijk in het tabblad; alleen **Bewaar mijn onderhoud op dit toestel** gebruikt blijvende lokale opslag. **Verwijder van dit toestel** meldt ook de telefoonmeldingen voor dit onderhoud af. Die afmelding vereist verbinding; bij een fout toont de app dat uitzetten niet gelukt is.

De sleutel gaat via de Authorization-header naar de reserveringsservice. De korte oudere links `#status=LS-…` blijven bruikbaar voor voortgang en wax, maar tonen geen betaalgegevens. Deel persoonlijke links niet; lokale opslag is geen versleutelde kluis. De klant krijgt geen naam, adres, telefoon, e-mail, beheercode of reserveringenlijst uit de API.

Android App Links koppelen uitsluitend het officiële `/app.html` aan de native klantenapp. Alleen de release gebruikt deze koppeling; de DEV-app heeft een eigen pakketnaam. iPhone gebruikt voorlopig de webapp. Na een nieuwe installatie kan de persoonlijke link opnieuw nodig zijn: browser, geïnstalleerde webapp en native app kunnen afzonderlijke opslag hebben.

## Meldingen en betaling

In de webapp kan de klant vrijwillig meldingen aanzetten. Na een wijziging in beheer ontvangt de ingeschreven telefoon een algemene melding die de persoonlijke onderhoudspagina opent. Geen automatische toestemming, e-mailfallback of claim dat aflevering gegarandeerd is. Safari op iPhone vereist iOS 16.4+ en installatie op het beginscherm. Zonder push blijft de actuele voortgang beschikbaar. De native Android-testapp biedt nog geen push: daarvoor moet later Firebase/FCM voor het releasepakket worden ingericht. Zie [backendconfiguratie](../worker/README.md).

Betaalverzoeken verschijnen pas na publiceren in beheer. De knop opent de externe HTTPS-betaallink, zonder automatisch de status op betaald te zetten. De eigenaar bevestigt ontvangst na bankcontrole. Bedrag of link wijzigen trekt publicatie in totdat opnieuw wordt gepubliceerd; een afgemelde aanvraag toont geen open betaalknop.

## Ontwikkelen

De website en native projecten gebruiken dezelfde bronbestanden in `src`. Versie **1.2.0 / code 4**; release-ID `nl.lattenspecialist.klanten`, DEV-ID `nl.lattenspecialist.klanten.dev`. Beheer staat afzonderlijk in `mobile-admin` en `beheer.html`. Zie [platformopzet](../PLATFORM.md) en [Google Play](PLAY-CONSOLE.md).

Vanuit de repositoryroot:

```text
npm --prefix mobile-customer ci
npm --prefix worker ci
npm run check
npm run dev
```

De lokale preview bevat fictieve voorbeelden: aanvraag ontvangen, onderhoud bezig, klaar, betaalverzoek, betaald, afgemeld, ontbrekende aanvraag en verbindingsfout. De preview kan niets versturen, geen echte aanvragen opslaan en toont geen klantgegevens. De native DEV-app gebruikt wel de bestaande dienst; gebruik daarin uitsluitend herkenbare eigen testaanvragen.

`npm run build` in deze map genereert ook `app.html`, `customer-app.js`, `customer-app.css` en `pwa-install.js` in de repositoryroot. Commit bron en gegenereerde bestanden samen. `npm run sync` synchroniseert de native projecten. De GitHub-workflow controleert de gegenereerde bestanden, test interacties en backend, bouwt Android DEV/APK/AAB en compileert de iPhone-simulator. Er volgt geen automatische winkelpublicatie. Signingmateriaal blijft buiten Git.

## Formulier en verbinding

Het aanvraagformulier laadt in een iframe van `https://lattenspecialist.nl/?app=klant`. Alleen de eigen origin en het juiste iframe mogen reisgegevens, aanvraagresultaat en persoonlijke sleutel doorgeven. Versturen blijft een handmatige actie. Turnstile blijft actief. De serviceworker cachet de appschermen, maar geen onderhoud, betaalverzoeken, prijzen of beschikbaarheid. Bij een verbindingsfout verdwijnt de eerdere betaalknop en verschijnt een herstelmogelijkheid.

## Toestelcontrole vóór winkelpublicatie

Controleer Android en iPhone met eigen testgegevens: link openen, bewaren/verwijderen, push toestaan en uitzetten, melding ontvangen met gesloten app, klantnotitie/wax/betaling, afgemelde aanvraag, actuele prijzen, formulier met postcode/huisnummer en echte ophaaldatum, reis overnemen, terugknop en offline foutmelding. Een geslaagde simulatorbuild is geen installeerbare iPhone-release. Google Play en App Store vereisen nog hun eigen accounts, ondertekening en beoordeling.
