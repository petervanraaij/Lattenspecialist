# Lattenspecialist reserveringsservice

Deze Cloudflare Worker breidt tijdelijk de bestaande `stuiterbaas-reserveren`-service uit. Aanvragen van beide websites worden op basis van hun herkomst apart gevalideerd en geadresseerd. Lattenspecialist-aanvragen gaan naar `info@lattenspecialist.nl`, krijgen een unieke aanvraagcode en worden via `LATTENSPECIALIST_RESERVATIONS_KV` opgeslagen als basis voor de beheerapp en onderhoudsstatus. De bestaande Stuiterbaas-route en e-mailbestemming blijven behouden.

De tijdelijke afzender gebruikt het al geverifieerde Stuiterbaas-domein. Na verificatie van `lattenspecialist.nl` kan alleen `LATTENSPECIALIST_FROM_EMAIL` worden gewijzigd naar `reserveringen@lattenspecialist.nl`.

Benodigde versleutelde secrets:

- `RESEND_API_KEY`
- `TURNSTILE_SECRET_KEY` voor Stuiterbaas
- `LATTENSPECIALIST_TURNSTILE_SECRET_KEY` voor Lattenspecialist
- `LATTENSPECIALIST_ADMIN_TOKEN` voor de beveiligde beheerapp

De openbare configuratie staat in `wrangler.toml`. Secrets horen nooit in Git. De beheerapp staat op `/beheer.html`; een ingelogde beheerder kan reserveringen bekijken, een persoonlijke servicecode aanmaken en de klantstatus bijwerken. De openbare statusroute geeft uitsluitend service-informatie terug en nooit naam, telefoonnummer, e-mailadres of adres.
