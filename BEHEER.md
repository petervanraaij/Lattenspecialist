# Beheer van website v10

## Reserveringen

Nieuwe aanvragen komen per e-mail binnen op `info@lattenspecialist.nl`. Het onderwerp begint met `[Lattenspecialist aanvraag]` en bevat de unieke aanvraagcode. Dezelfde aanvraag wordt beveiligd in Cloudflare KV opgeslagen. De geplande beheerapp gaat deze gegevens gebruiken om een onderhoudscode toe te kennen en de voortgang bij te werken.

De tijdelijke technische afzender gebruikt het geverifieerde Stuiterbaas-domein. Zodra `lattenspecialist.nl` in Resend is geverifieerd, kan de afzender worden gewijzigd naar `reserveringen@lattenspecialist.nl` zonder het formulier aan te passen.

## Klantstatus bijwerken

Voeg in `data/status.json` één record toe per actieve servicecode. Gebruik een willekeurige code van minimaal twaalf tekens en zet nooit een naam, telefoonnummer, adres of e-mailadres in dit bestand.

```json
{
  "updated": "2026-09-18",
  "records": [
    {
      "code": "voorbeeldcode123",
      "material": "Ski’s",
      "package": "Goud",
      "currentStep": 4,
      "status": "Inspectie uitgevoerd",
      "updatedAt": "18 september 2026 om 15:30",
      "expectedReady": "20 september 2026",
      "note": "De kanten worden nu geslepen."
    }
  ]
}
```

De stappen lopen van 1 tot en met 8: aanvraag ontvangen, planning, ontvangen, inspectie, onderhoud gestart, wax koelt af, finish/eindcontrole en klaar. Verwijder een record zodra de klant het materiaal heeft opgehaald.

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
