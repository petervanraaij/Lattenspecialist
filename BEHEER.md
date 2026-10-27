# Beheer van website v11

## Reserveringen

Nieuwe aanvragen komen per e-mail binnen op `info@lattenspecialist.nl`. Het onderwerp begint met `[Lattenspecialist aanvraag]` en bevat de unieke aanvraagcode. Dezelfde aanvraag wordt beveiligd in Cloudflare KV opgeslagen en verschijnt in de beheerapp op `https://lattenspecialist.nl/beheer.html`.

De tijdelijke technische afzender gebruikt het geverifieerde Stuiterbaas-domein. Zodra `lattenspecialist.nl` in Resend is geverifieerd, kan de afzender worden gewijzigd naar `reserveringen@lattenspecialist.nl` zonder het formulier aan te passen.

## Beheerapp en klantstatus

Open `https://lattenspecialist.nl/beheer.html` op telefoon of computer en log in met de persoonlijke beheercode. Vink bovenaan de concrete ophaaldata aan die klanten mogen kiezen en druk op **Data opslaan**. Kies bij een nieuwe aanvraag **Maak code**. Geef deze code aan de klant en werk daarna de voortgang, waxsoort, verwachte gereeddatum en een kort klantbericht bij.

De klant vult de code in op `https://lattenspecialist.nl/app.html`. Alleen materiaal, pakket, voortgang, gereeddatum en het klantbericht worden getoond. Contact- en adresgegevens verlaten de beveiligde beheerweergave niet.

De stappen lopen van 1 tot en met 8: aanvraag ontvangen, planning, ontvangen, inspectie, onderhoud gestart, wax koelt af, finish/eindcontrole en klaar.

## Voorraad, werkstappen en kostprijs

Open in beheer het tabblad **Voorraad & kosten**. De Holmenkol-bestelling van Newsports staat eerst als **Besteld** geregistreerd. Dit is nog geen beschikbare voorraad. Controleer de levering en kies pas daarna **Bestelling ontvangen**; dan worden wax, reinigingsmiddelen, reparatiemateriaal, verkoopvoorraad en gereedschappen bijgeboekt.

Eenmalige aanschaffen en langzaam slijtende gereedschappen worden standaard over 300 relevante onderhoudsbeurten verdeeld. Deze toerekening volgt de werkelijk uitgevoerde handeling:

- waxgereedschap telt alleen mee bij waxstappen;
- vijlen en slijpgereedschap tellen alleen mee bij vijlen/slijpen;
- reparatiemateriaal en reparatiegereedschap tellen alleen mee bij reparaties;
- cleaner en fleece worden als werkelijk verbruik geboekt.

Bij vervanging sluit je het oude gereedschap af vanuit zijn kaart. Beheer bewaart eerste en laatste gebruik, het aantal relevante beurten, de totale gebruikstijd en de uiteindelijke kostprijs per gebruik. Voor het nieuwe gereedschap begint een nieuwe levensduurregistratie, opnieuw standaard met een doel van 300 gebruiken.

Na het scannen van een materiaal-QR toont de medewerkersapp het pakket, de gekozen meerwerken, de werkvolgorde en de benodigde middelen. Iedere stap heeft een eigen timer. Bij warm waxen is het gewicht van hetzelfde waxblok vóór en na de stap verplicht; het verschil wordt als werkelijk waxverbruik van de voorraad afgeboekt.

## Oefenklant

In de medewerkersapp staat het tabblad **Oefenen**. Kies ski of snowboard en oefen alleen waxen of alleen vijlen. Een oefening gebruikt dezelfde timers, voorraad en gereedschapslevensduur als echt onderhoud. De resultaten staan apart in **Voorraad & kosten** en tellen niet mee in productieaantallen, klantdoorlooptijd of medewerkersproductie.

## Klant informeren

Bij een nieuwe aanvraag kan de klant apart toestemming geven voor WhatsApp-statusupdates. In de beheerapp staat dan bij de aanvraag **WhatsApp-statusupdates toegestaan**.

1. Kies de nieuwe status, waxsoort en zo nodig de verwachte gereeddatum en een klantbericht.
2. Druk op **Opslaan + klant berichten**.
3. De status wordt opgeslagen en de klant ontvangt een e-mail.
4. Als de officiële WhatsApp-koppeling actief is, wordt ook automatisch een goedgekeurd WhatsApp-bericht verzonden. Tot die tijd verschijnt een groene knop met een volledig ingevuld WhatsApp-bericht; controleer dit en druk in WhatsApp op **Versturen**.

Met **Alleen opslaan** wordt de status bijgewerkt zonder klantbericht. Bij oudere aanvragen kan WhatsApp-toestemming na mondelinge of schriftelijke toestemming handmatig worden vastgelegd.

Het laatste tikje op **Versturen** blijft nodig zolang de gewone WhatsApp Business-app wordt gebruikt. Volledig automatisch versturen werkt pas wanneer de officiële WhatsApp Business Platform-koppeling, de Meta-toegangssleutel en goedgekeurde berichttemplates zijn ingesteld.

## Betaalverzoek en afmelden

Maak een betaallink in je eigen bank- of betaaldienst, vul in de beheerapp het bedrag en de `https://`-link in en druk op **Betaalverzoek e-mailen**. De beheerapp maakt zelf geen betaaltransactie aan. Bij WhatsApp-toestemming verschijnt ook hier een WhatsApp-knop zolang de officiële automatische koppeling nog niet actief is.

Met **Aanvraag afmelden** verdwijnt de aanvraag uit de open telling. De gegevens worden niet verwijderd; met **Aanvraag opnieuw openen** kan de aanvraag worden hersteld.

## Verhuuraanbod bijwerken

Zet alleen materiaal dat werkelijk beschikbaar is in `data/aanbod.json`. Een lege `items`-lijst toont automatisch dat verhuur op aanvraag gaat.

```json
{
  "updated": "2026-09-18",
  "items": [
    {
      "type": "Ski’s",
      "title": "All-mountain ski’s 170 cm",
      "details": "Geschikt voor een gemiddelde skiër; schoenen niet inbegrepen.",
      "available": true
    }
  ]
}
```

## Google vindbaarheid activeren

1. Voeg `lattenspecialist.nl` als domeinproperty toe in Google Search Console en plaats de door Google gegeven DNS-verificatie bij de domeinbeheerder.
2. Dien na verificatie `https://lattenspecialist.nl/sitemap.xml` in.
3. Vraag via URL-inspectie indexering aan voor `/`, `/service.html`, `/app.html` en `/ervaring.html`.
4. Maak of claim het Google Bedrijfsprofiel. Gebruik het servicegebied de gemeenten West Maas en Waal en Druten en toon het woonadres alleen als klanten daar zonder afspraak ontvangen worden.
5. Voeg actuele openingstijden, telefoonnummer, website, diensten en later echte werkfoto’s toe.

De technische bestanden voor Google staan al in de website. Account- en DNS-verificatie moeten in de eigen Google- en domeinaccounts worden uitgevoerd.
