# Lattenspecialist reserveringsservice

Deze Cloudflare Worker breidt tijdelijk de bestaande `stuiterbaas-reserveren`-service uit. Aanvragen van beide websites worden op basis van hun herkomst apart gevalideerd en geadresseerd. Lattenspecialist-aanvragen gaan naar `info@lattenspecialist.nl`, krijgen een unieke aanvraagcode en worden via `LATTENSPECIALIST_RESERVATIONS_KV` opgeslagen als basis voor de beheerapp en onderhoudsstatus. De bestaande Stuiterbaas-route en e-mailbestemming blijven behouden.

De tijdelijke afzender gebruikt het al geverifieerde Stuiterbaas-domein. Na verificatie van `lattenspecialist.nl` kan alleen `LATTENSPECIALIST_FROM_EMAIL` worden gewijzigd naar `reserveringen@lattenspecialist.nl`.

Benodigde versleutelde secrets:

- `RESEND_API_KEY`
- `TURNSTILE_SECRET_KEY` voor Stuiterbaas
- `LATTENSPECIALIST_TURNSTILE_SECRET_KEY` voor Lattenspecialist
- `LATTENSPECIALIST_ADMIN_TOKEN` voor de beveiligde beheerapp

Optioneel voor automatische WhatsApp-status- en betaalberichten via de officiële WhatsApp Business Platform-koppeling:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `LATTENSPECIALIST_WHATSAPP_STATUS_TEMPLATE`
- `LATTENSPECIALIST_WHATSAPP_PAYMENT_TEMPLATE`
- `WHATSAPP_GRAPH_VERSION` (optioneel; standaard `v23.0`)

De klant moet in het aanvraagformulier toestemming geven. Business-geïnitieerde berichten gebruiken goedgekeurde templates. Als deze variabelen ontbreken of Meta een bericht weigert, blijft de veilige handmatige WhatsApp-knop in de beheerapp beschikbaar.

De openbare configuratie staat in `wrangler.toml`. Secrets horen nooit in Git. De beheerapp staat op `/beheer.html`; een ingelogde beheerder kan ophaaldata beheren, reserveringen bekijken, een persoonlijke servicecode aanmaken, wax registreren, de klantstatus bijwerken, een betaalverzoek e-mailen en een aanvraag omkeerbaar afmelden. De openbare statusroute geeft uitsluitend service-informatie terug en nooit naam, telefoonnummer, e-mailadres of adres.

`LATTENSPECIALIST_APP_ORIGINS` bevat de lokale HTTPS-herkomsten van de native Android- en iPhone-app. Ook deze app gebruikt voor alle beheeracties de persoonlijke beheercode.

## Beheercode vergeten
De beheerpagina biedt e-mailherstel via de vaste LATTENSPECIALIST_ADMIN_RECOVERY_EMAIL. Eerst migratie 0006_admin_recovery.sql toepassen, daarna de Worker publiceren. Alleen de eigenaar ontvangt een 256-bit herstellink (20 minuten, eenmalig); D1 bewaart alleen de tokenhash. Twee minuten cooldown en maximaal acht e-mails per UTC-dag. Codeherstel trekt andere links en de oude code in; handmatige serversecret-rotatie maakt openstaande links ongeldig. HRM-pincodes en medewerkers blijven ongewijzigd. Geen code of token in logs. Native apps krijgen de knop bij de volgende reguliere appbuild; de e-maillink werkt direct in de browser.
