# Beheer van website v10

## Reserveringen

Nieuwe aanvragen komen per e-mail binnen op `info@lattenspecialist.nl`. Het onderwerp begint met `[Lattenspecialist aanvraag]` en bevat de unieke aanvraagcode. Dezelfde aanvraag wordt beveiligd in Cloudflare KV opgeslagen en verschijnt in de beheerapp op `https://lattenspecialist.nl/beheer.html`.

De tijdelijke technische afzender gebruikt het geverifieerde Stuiterbaas-domein. Zodra `lattenspecialist.nl` in Resend is geverifieerd, kan de afzender worden gewijzigd naar `reserveringen@lattenspecialist.nl` zonder het formulier aan te passen.

## Beheerapp en klantstatus

Open `https://lattenspecialist.nl/beheer.html` op telefoon of computer en log in met de persoonlijke beheercode. Kies bij een nieuwe aanvraag **Maak code**. Geef deze code aan de klant en werk daarna de voortgang, verwachte gereeddatum en een kort klantbericht bij.

De klant vult de code in op `https://lattenspecialist.nl/app.html`. Alleen materiaal, pakket, voortgang, gereeddatum en het klantbericht worden getoond. Contact- en adresgegevens verlaten de beveiligde beheerweergave niet.

De stappen lopen van 1 tot en met 8: aanvraag ontvangen, planning, ontvangen, inspectie, onderhoud gestart, wax koelt af, finish/eindcontrole en klaar.

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
4. Maak of claim het Google Bedrijfsprofiel. Gebruik het servicegebied West Maas en Waal, Druten, Afferden en Horssen en toon het woonadres alleen als klanten daar zonder afspraak ontvangen worden.
5. Voeg actuele openingstijden, telefoonnummer, website, diensten en later echte werkfoto’s toe.

De technische bestanden voor Google staan al in de website. Account- en DNS-verificatie moeten in de eigen Google- en domeinaccounts worden uitgevoerd.
