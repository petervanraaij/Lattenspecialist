# Website en aanvraagroute — september 2026

## Wat is veranderd
- Pakketkaarten tonen drie hoofdpunten. De oorspronkelijke werkzaamheden staan onder Alle werkzaamheden. De prijzen, oorspronkelijke werklijsten en toeslagen zijn behouden.
- Eén pakketkeuze gaat via de parameter pakket naar afspraak.html. Het formulier kiest zelf geen standaardpakket.
- Alleen bij gratis ophalen zijn ophaaldatum, postcode, huisnummer en ophaal- en terugbrenglocatie zichtbaar en verplicht. Zelf brengen en ophalen in Wamel is één optie. Inactieve velden worden niet meegestuurd.
- Ophaaldata komen uit de bestaande beheerplanning. Een klant kiest expliciet een datum; bij ontbrekende data kan In overleg worden gekozen. De planning en het moment waarop het materiaal klaar is worden persoonlijk bevestigd.
- Het verhaal van Peter is gebaseerd op zijn eigen toelichting. De werkplaatsfoto blijft een sfeerbeeld, geen portret van Peter. Echte onderhoudsfoto’s en klantreviews ontbreken nog en zijn niet nagebootst.
- Na een succesvolle aanvraag verschijnt de aanvraagcode en een controleerbaar overzicht. Een mislukte bevestigingsmail wordt eerlijk vermeld. De persoonlijke statuslink ontstaat nog steeds bij de onderhoudsregistratie in beheer.
- Navigatielabels zijn gelijkgetrokken naar Onderhoud aanvragen. De deelafbeelding gebruikt het originele logo.

## Bestanden
| Onderdeel | Bestanden |
| --- | --- |
| Homepage, persoonlijke intro en pakketten | index.html, homepage.css, package-choice.js |
| Formulier en bevestiging | afspraak.html, booking.js |
| Bestaande klantenapp / formulierkoppeling | customer-booking.js, mobile-customer/src/customer.js (ongewijzigd) |
| Dagtotalen en beheerweergave | website-metrics.js, beheer.html, beheer.js, admin-metrics.css |
| Afgeschermde API en opslag | worker/src/metrics.js, worker/migrations/0001_website_metrics.sql |
| Privacy en service-afspraken | privacy.html, service.html |
| Cacheversie en assets | sw.js |

## Statistieken
Cloudflare D1 slaat alleen dag, actietype en aantal op, in de tabel website_metrics. Vier gebeurtenissen: packages_viewed, form_opened, form_started en booking_submitted. Alleen de openbare website telt; de ingesloten klantenapp niet. Geen cookies, lokale opslag, bezoeker-ID, formulierinhoud, aanvraagcode of URL. Browserinstellingen GPC en DNT worden gerespecteerd. Per pagina wordt elke actie eenmaal geteld; herhaalde bezoeken kunnen opnieuw tellen. Het zijn indicatieve aantallen, geen unieke bezoekers of betrouwbare percentages per klant.

De beheerroute GET /api/admin/metrics accepteert uitsluitend de bestaande beheertoken en een periode van 7, 30 of 90 dagen. De POST-route /api/metrics accepteert exact één toegestane gebeurtenis in maximaal 128 bytes. Een tijdelijke begrenzing per Worker-instantie gebruikt het IP alleen in geheugen (maximaal één minuut); er is geen persistente IP-opslag. Dagtotalen zijn begrensd op 10.000 per actie. De oudste totalen worden bij een nieuwe telling verwijderd, zodat maximaal 90 kalenderdagen zichtbaar zijn. Bij een storing blijven aanvragen en beheer bruikbaar. Tellingen worden niet met reserveringen verbonden en zijn niet bedoeld als fraudebestendige administratie.

De D1-database heet lattenspecialist-website-statistieken. De bestaande gedeelde Worker stuiterbaas-reserveren blijft beide merken bedienen. Bestaande mailinstellingen, secrets en reserveringsopslag zijn behouden. Uitrollen: pas de D1-migratie toe en publiceer de Worker met behoud van bestaande variabelen; publiceer daarna de statische website via GitHub Pages. Er zijn geen sleutels in de website of dit document opgenomen.

## Controle
- 30 tests voor klantenapp, beheerlinks en websiteformulier; bestaande Worker-tests plus aparte statistiektests.
- Geautomatiseerde browsercontrole op 375, 390, 768 en 1440 pixels: pakketkeuze, juiste velden, adresopzoeking, ontvangstbevestiging, beheertellingen, geen horizontale overflow en geen ontbrekende assets of JavaScript-fouten.
- Pakketprijzen en oorspronkelijke werklijsten zijn automatisch vergeleken met main.
- Aanvragen en e-mail tijdens tests zijn gesimuleerd; er zijn geen testberichten naar klanten verstuurd.
- CNAME en de Google-verificatie blijven behouden.

## Beeldmateriaal
De twee sfeerbeelden zijn met de ingebouwde image_gen bewerkt, niet met de CLI. Het oorspronkelijke logo images/logo-main.webp is als referentie meegegeven. De ongewijzigde bronbeelden blijven beschikbaar. De uitvoer is als WebP geoptimaliseerd; de volledige gegenereerde PNG’s blijven lokaal bewaard.

- images/edge-tuning-logo-v2.webp — bewerkte werkplaatsfoto.
- images/pickup-service-logo-v2.webp — bewerkte haal- en brengfoto.
- images/social-preview.png — 1200 × 630, met HTML/CSS samengesteld uit het originele logo en huisstijltekst.

Prompts voor de beeldbewerking: zie image-prompts.md.

## Nog afhankelijk van echte bedrijfsinformatie
- Eigen portret en echte voor-en-nafoto’s toevoegen zodra Peter die heeft.
- Alleen echte reviews met toestemming publiceren.
- Google Bedrijfsprofiel afzonderlijk afronden en de door Google gevraagde bedrijfsverificatie uitvoeren. De website en Search Console zijn andere onderdelen.
