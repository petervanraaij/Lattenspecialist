# Reserveringsservice

Cloudflare Worker `stuiterbaas-reserveren` verwerkt beide websites. Stuiterbaas behoudt zijn bestaande reserveringsmail. Lattenspecialist-aanvragen worden in KV opgeslagen en gaan als interne melding naar `info@lattenspecialist.nl`. Klanten krijgen **geen automatische e-mail of WhatsApp**: bevestiging, voortgang, wax en betaalverzoek staan in hun persoonlijke klantenapp.

## Toegang en betaling

Elke nieuwe aanvraag krijgt direct een onderhoudscode en een willekeurige persoonlijke sleutel van 256 bits. De sleutel staat in het URL-fragment `app.html#klant=…`, wordt uit de actuele browsergeschiedenis verwijderd en gaat alleen als Bearer-header naar `/api/customer/status` en `/api/customer/push`. De KV-index bevat een SHA-256-hash van de sleutel. Het klantantwoord bevat geen naam, adres, telefoon of e-mail. De oudere route `/api/status/LS-…` blijft werken, maar geeft geen betaalgegevens. Een bestaande aanvraag krijgt bij de eerstvolgende beheerderswijziging een lange persoonlijke link.

Bedrag en HTTPS-betaallink blijven concept totdat de beheerder `publishPayment` gebruikt. Een wijziging van bedrag of link maakt opnieuw publiceren nodig. Betaling is pas ontvangen als de beheerder dat na bankcontrole vastlegt. Het openen van een betaallink verandert geen betaalstatus. Afmelden trekt een open betaalverzoek in de app in; het annuleert geen reeds uitgegeven externe banklink.

De beheerroute blijft beveiligd met `LATTENSPECIALIST_ADMIN_TOKEN`. Oudere beheerapps die `sendStatusEmail`, `sendPaymentEmail` of `sendWhatsApp` meesturen kunnen blijven opslaan; er worden geen klantmails of WhatsApp-berichten verstuurd. `sendPaymentEmail` publiceert voor die apps alleen het betaalverzoek in de klantomgeving.

## Telefoonmeldingen

De webapp vraagt uitsluitend na een klik toestemming. `/api/push/config` geeft alleen de openbare VAPID-sleutel. Met de persoonlijke klanttoken kan `/api/customer/push` een browserinschrijving opslaan, controleren of verwijderen (`action: subscribe | status | unsubscribe`). Maximaal vijf toestellen per aanvraag; inschrijvingen verlopen na 180 dagen. Alleen HTTPS-adressen van bekende browser-pushdiensten zijn toegestaan. Redirects worden niet gevolgd.

Status, klantnotitie, planning, wax, afmelding en gepubliceerde/betaalde betaalverzoeken geven bij wijziging automatisch een Web Push. Ongewijzigd opslaan verstuurt niets. Inhoud is versleuteld met RFC 8291; de melding toont algemene tekst en opent het eigen onderhoud. Een provideracceptatie bewijst nog niet dat de telefoon de melding heeft getoond. Fouten laten de opgeslagen status intact en worden in beheer vermeld. Verlopen inschrijvingen worden verwijderd. Er is geen e-mailfallback.

Benodigde secrets (nooit in Git):

- `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `LATTENSPECIALIST_TURNSTILE_SECRET_KEY`
- `LATTENSPECIALIST_ADMIN_TOKEN`
- `VAPID_PUBLIC_KEY` (onbewerkte P-256 openbare sleutel, base64url)
- `VAPID_PRIVATE_KEY` (P-256 privéscalar, base64url)

Bewaar hetzelfde VAPID-paar bij toekomstige releases: bestaande browserinschrijvingen zijn eraan gekoppeld. Configuratie kan met `wrangler secret bulk` worden geladen; controleer namen met `wrangler secret list`. Overige instellingen en de bestaande KV-binding staan in `wrangler.toml`.

## Testen en uitrollen

`npm ci` en `npm test` controleren beide reserveringsroutes, klantisolatie, betaalverzoeken, de afwezigheid van klantmail, pushinschrijvingen, duplicaten, providerfouten en echte encryptie/decryptie met fictieve netwerkantwoorden. `npx wrangler deploy --dry-run` controleert de Worker-bundel. Deploy de Worker met `--keep-vars` vóór de bijbehorende websitebestanden.

Controle op een echt toestel blijft nodig: persoonlijke link openen, app bewaren, expliciet meldingen toestaan, status in beheer wijzigen, melding met gesloten app ontvangen en aanklikken, en meldingen weer uitzetten. Op iPhone vereist Web Push iOS 16.4+ en een webapp op het beginscherm. De native Android-testapp heeft nog geen FCM-configuratie en biedt geen native push aan.

Bronnen: [Web Push-bibliotheek](https://github.com/block65/webcrypto-web-push), [Apple Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Capacitor native push](https://capacitorjs.com/docs/apis/push-notifications).
