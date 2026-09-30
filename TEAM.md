# Medewerkers en beheer

## Gebruik

1. Open `https://lattenspecialist.nl/beheer.html` met de bestaande eigenaarssleutel.
2. Voeg onder **Medewerkers** een naam en gebruikersnaam toe. Bewaar de eenmalig getoonde sleutel en geef deze persoonlijk aan de juiste medewerker. Er wordt niet automatisch een uitnodiging verzonden.
3. Selecteer bij een aanvraag de medewerker en kies **Alleen opslaan**. De medewerker ziet deze aanvraag in `https://lattenspecialist.nl/medewerkers.html` of de Android-medewerkersapp.
4. De medewerker meldt zich aan met gebruikersnaam en persoonlijke sleutel, registreert wax en interne werknotities en kiest de eerstvolgende onderhoudsstap. De actuele voortgang en wax komen via dezelfde dienst in de klantomgeving terecht. Werknotities blijven intern.
5. Gebruik **Werklogboek** in beheer om wijzigingen te bekijken. Toegang intrekken sluit nieuwe verzoeken direct af; een al eerder zichtbaar scherm kan op een toestel nog blijven staan tot de volgende actie/vernieuwing. Bij die actie wordt toegang geweigerd.
6. Bij sleutelverlies: **Nieuwe sleutel**. Dit vervangt de oude sleutel en beëindigt alle eerdere sessies. Een sessie verloopt uiterlijk na twaalf uur; de medewerker meldt zich daarna opnieuw aan. Uitloggen wist lokale sessietoegang.

De medewerker mag geen betalingen, klantcontact, toewijzing, planning of afmeldingen aanpassen. De eigenaar kan een aanvraag afmelden; deze verdwijnt dan uit de medewerkerslijst. Een reeds geopende oude versie kan niet alsnog worden opgeslagen.

## Opslag en API

- `LATTENSPECIALIST_TEAM_DB`: D1 `lattenspecialist-team-eu`, ID `1b56c1db-5ab9-4b1d-80c9-f9ab4189988b`, met de vaste Cloudflare-jurisdictie `eu`. De eerdere database `lattenspecialist-team` blijft tijdens de gecontroleerde migratie beschikbaar als terugvalkopie.
- `members`: gebruikersnaam, naam, hash van een willekeurige 256-bit toegangssleutel en actief-status.
- `sessions`: uitsluitend hashes van sessietokens, medewerker en verloopmoment.
- `records`: volledige actuele aanvraag, toewijzing en versienummer. Eventuele oudere KV-aanvragen worden bij de eerste beheerwijziging overgenomen. Daarna is D1 de bron voor die aanvraag. KV is geen actuele herstelkopie van gewijzigde aanvragen.
- Nieuwe klantaanvragen worden direct in de EU-D1-database opgeslagen. KV bevat alleen niet-persoonlijke instellingen en servicecodeverwijzingen en blijft uitsluitend een compatibiliteitsbron voor eventuele oudere aanvragen.
- `team_audit`: actor, voortgang, wax, werknotitie, toewijzing, afmelding en tijd bij elke wijziging. Geen sleutels in het logboek.
- `login_limits`: tijdgebonden hash van IP-adres en tijdvak; maximaal twintig aanmeldpogingen per vijftien minuten. Verlopen sessies en limieten worden bij succesvolle aanmelding opgeruimd.
- `/api/team/login`, `/session`, `/logout`, `/tasks`, `/tasks/:reference`: medewerkersfuncties.
- `/api/admin/team/members`, `/members/:id`, `/audit?reference=…`: uitsluitend eigenaarstoegang.
- De bestaande `/api/admin/reservations/:reference` gebruikt `revision` en `assignedTo`. Oude beheerclients zonder versienummer krijgen een verzoek om te vernieuwen, zodat ze geen gewijzigde aanvraag overschrijven.
- Geen demoaccounts of sleutels worden in productie aangemaakt. De app bevat geen eigenaarssleutel. Sessies staan alleen in sessionStorage. Android-back-up is uitgeschakeld voor medewerkers en beheer.

Databasefouten leiden tot een foutmelding. Er wordt niet stilzwijgend oude KV-data teruggeschreven wanneer D1 niet beschikbaar is. Bij gelijktijdig opslaan krijgt één client een conflictmelding en moet die vernieuwen.

## Bouw en controles

`npm --prefix worker test` voert ook `team.test.mjs` uit: echte SQLite-tabellen en triggers, privacy, rolgrenzen, vreemde aanvraagcodes, verlopen sessies, intrekken, rotatie, afmeldingen, verouderde versies en aanmeldlimieten. `npm --prefix mobile-customer test` controleert onder meer persoonlijke klantlinks en bestaande beheerfuncties.

`node worker/team-preview.mjs` start een uitsluitend lokale demonstratie op `http://127.0.0.1:8897`. Alleen fictieve aanvragen: medewerker `demo` / `demo-werkplaats`, eigenaar `demo-beheer`. De server leest geen echte sleutels en verstuurt geen berichten. Stop met Ctrl+C.

De GitHub-workflow **Android apps klanten medewerkers beheer** bouwt aparte release-AAB's en DEV-APK's. Release-ID's zijn de drie geregistreerde pakketnamen; DEV-apps hebben `.dev` als achtervoegsel. De AAB's worden buiten Git ondertekend. Niet automatisch gepubliceerd. Een geslaagde build vervangt geen praktijktest op een echt Android-toestel.

## Herstel

Voer migraties vóór de Worker-update uit. Maak bij productiewijzigingen een D1-export en bewaar deze vertrouwelijk buiten Git. Gebruik D1-herstel/export voor actuele aanvragen; teruggaan naar alleen KV zou latere wijzigingen verliezen. Bij een applicatiefout herstel je bij voorkeur de webbestanden of repareer je de Worker met behoud van de teamdatabasebinding. Rol de Worker niet terug naar een versie die D1 negeert nadat er D1-wijzigingen zijn opgeslagen.

Eigenaarssleutel en ondertekenmateriaal blijven buiten Git. Bij een verloren medewerkerssleutel vernieuwt Peter die in beheer. Het terughalen van een oude sleutel is niet mogelijk. Definitief verwijderen van klant- of medewerkersgegevens uit D1, audit en KV vraagt een gecontroleerde beheerstap; er is geen publieke verwijderknop.

Automatische betalingstransacties, instelbare rollen, pushmeldingen en meerdere beheeraccounts zijn nog niet toegevoegd. Bestaande bericht- en betaalverzoekfuncties in beheer blijven aanwezig; logistieke QR-scans versturen alleen een WhatsApp-template wanneer de klant toestemming gaf en de Meta-configuratie actief is.

## Materiaal, routes en HRM

- Iedere fysieke ski-/snowboardeenheid krijgt in `materials` een eigen willekeurige scansleutel en leesbare `LSM-`-code. De QR bevat alleen een app-link met die sleutel, nooit naam, adres of onderhoudsgegevens.
- Scans registreren ophalen, ontvangst, actieve onderhoudstijd, pauze, gereed, terugbrengen en aflevering. Logistieke klantstatussen kunnen bij toestemming automatisch via de bestaande WhatsApp-template worden verstuurd.
- Routes worden vanuit geselecteerde aanvragen via PDOK geocodeerd en lokaal op dichtstbijzijnde volgende stop geordend. Start, aankomst, vertrek en afronding worden geregistreerd; de kaart opent in Google Maps.
- Medewerkers beheren hun eigen beschikbaarheid. Beheer ziet de ingevulde dagen bij het maken van routes.
- HRM gebruikt een aparte pincode boven op de normale sessie. Profiel, IBAN, loonafspraken en contracttekst worden met AES-GCM versleuteld; `HRM_DATA_KEY` staat uitsluitend als Worker-secret. Beheer wijzigt loon en voorwaarden, medewerkers alleen hun eigen profiel en bankrekening.
- Het bedrijfsdashboard toont actieve materialen, gemiddelde en mediane onderhoudstijd, vergelijking met de vorige 30 dagen, op-tijd-percentage, routetijd, productie en klanttevredenheid.

Technische referentie: [Cloudflare D1-transacties](https://developers.cloudflare.com/d1/worker-api/d1-database/).
