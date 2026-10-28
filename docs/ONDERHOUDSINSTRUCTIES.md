# Begeleid onderhoud per materiaal

Pierfinity beheert de Lattenspecialist-uitbreiding. De bestaande Lattenspecialist-beheer- en medewerkersapp gebruiken dezelfde aanvragen, materiaalstickers, voorraad en werkstappen. Deze uitbreiding verrijkt die bestaande werkplannen; er wordt geen tweede opdrachtenadministratie aangemaakt.

## Gebruik

1. Beheer neemt de aanvraag aan en kiest de juiste pakketten, wax en extra’s. Met **Maak / bekijk QR-stickers** krijgt ieder materiaal zijn bestaande eigen werkplan en sticker. Bij een paar ski’s wordt het paar als één materiaal behandeld.
2. **Bekijk onderhoudsplan** toont in beheer de inhoud van dat plan. Dit is een leesweergave; toewijzing en medewerkersrechten blijven gelden.
3. De medewerker kiest bij zijn opdracht **Open onderhoudsplan per materiaal**, kiest de ski/het snowboard, of scant de sticker. Camera’s blijven optioneel: de leesbare materiaalcode werkt ook.
4. Bovenaan staan het materiaal, pakket, gekozen wax, aantal werkstappen en voorraadartikelen zonder voorraad. De lijst met geregistreerde benodigdheden komt uit het bestaande voorraadsysteem. Overige werkplekbenodigdheden worden per instructie genoemd; die worden niet als aanwezige voorraad voorgesteld.
5. Iedere stap beschrijft doel, benodigdheden, uitvoering en controlepunten. De eerstvolgende stap is geopend. Latere stappen zijn alvast te lezen, maar de bestaande servercontrole laat ze niet voortijdig starten. Start, pauzeer en rond af met de bestaande timer- en verbruiksregistratie.
6. Bevestig vóór afronden alle getoonde controlepunten. De nieuwe app stuurt deze met de instructieversie mee. De server valideert de volledige lijst en bewaart de bevestigde tekst, versie, medewerker en tijd in `material_events` binnen dezelfde batch als de stapafronding. Een ontbrekend of oud controlepunt krijgt geen nieuwe bevestiging. Na herladen blijft de bevestiging zichtbaar.

## Gekozen werkzaamheden

| Keuze | Inhoud van het werkplan |
| --- | --- |
| Koper | Inspectie, vastzetten, reinigen, gekozen warme wax, afkoelen/schrapen, borstelen en eindcontrole. |
| Brons | Inspectie, vastzetten, kanten vijlen/slijpen en eindcontrole. |
| Zilver | Kantenwerk en de waxbehandeling. |
| Goud | Zilver plus beoordelen/vrijmaken van de bestaande belagstructuur. Een borstelbehandeling is geen nieuwe steenslijpstructuur. |
| Platinum | Goud met de afgesproken kleine oppervlakkige belagreparatie. |
| Los slijpen of repareren | Alleen het gekozen werk met passende voorbereiding en eindcontrole. |
| Snowboardbindingen | Oorspronkelijke stand en hardware vastleggen, demonteren waar gekozen en modelgebonden terugmonteren. Geen generieke DIN- of skibindingafstelling. |
| Complexe reparatie | Eerst diagnose, verantwoordelijke specialist en vastgelegd akkoord/herstelplan; geen automatische instructie om constructieschade met een reparatiestrip te vullen. |
| Extra reiniging | Eigen reinigingsstap met werkelijk cleaner-/fleeceverbruik. Dit is geen fluorvrijcertificering. |
| Spoed | De gekozen werkvolgorde blijft gelden. Spoed verkort geen noodzakelijke productdroog- of afkoeltijd. |
| Waxstick meegeven | Aantal en product controleren; uitsluitend het gekozen aantal wordt via de bestaande verkoopvoorraad geboekt. |
| Oefenen | Wax- of slijpoefening met werkinstructie. Bestaande registratie van tijd, verbruik en uitsluiting uit productiecijfers blijft gelden. |

Er zijn zestien instructievarianten, inclusief de twee oefeningen. Nieuwe presentatie-instructies veranderen geen historische verbruiksposten, stapvolgordes, prijzen of klantkeuzes. Onbekende bestaande stapcodes vragen afstemming in plaats van een verzonnen behandeling.

## Video’s en bronnen

De Nederlandstalige demonstraties voor waxen, kanten slijpen en de Holmenkol-borstelset zijn gekoppeld vanaf de [eigen videopagina van SkiWebShop](https://www.skiwebshop.nl/skiwebshop-videos). Ook is de [SWIX-glijwaxdemonstratie](https://swixsport.com/eu/swixschool/apply-glide-wax-on-skis) opgenomen. Naslag voor belagreparatie en snowboardbindingen verwijst naar [Burton belagonderhoud](https://www.burton.com/en-us/blogs/the-burton-blog/snowboard-base-maintenance) en [Burton montage](https://www.burton.com/en-us/blogs/the-burton-blog/how-to-mount-snowboard-bindings).

De links openen uitsluitend na een klik buiten de app. Er worden geen YouTube-speler, thumbnails, video’s of tracking vooraf geladen. Een video demonstreert een techniek: de werkbon, het werkelijke productetiket en de juiste modelhandleiding bepalen temperatuur, hoek en montagegegevens. Beeldmateriaal is niet gekopieerd of opnieuw gehost. Bronnen en videokoppelingen zijn op 29 oktober 2026 nagezien; afspelen op iedere telefoon/regio is niet gegarandeerd.

## Techniek en grenzen

`worker/src/maintenance-guides.js` beheert instructieversie `2026-10-29.1`. `getWorkflow` verrijkt bestaande stappen en leest hun eventuele bevestigingen in één aanvullende query per materiaal. De eerste scanweergave hergebruikt de al ontvangen workflow en doet daarvoor geen tweede aanvraag. Latere materiaalkeuzes, uitloggen en late antwoorden worden van elkaar afgeschermd. De eigenaar krijgt een afzonderlijk beveiligde leesroute; medewerkers kunnen alleen hun toegewezen opdrachtlijst openen en houden de bestaande werkrechten.

Er is geen nieuwe database of schemamigratie nodig. Oude geïnstalleerde medewerkersapps kunnen blijven werken zonder de nieuwe bevestigingspayload. Zo’n oude afronding krijgt geen verzonnen controlebewijs. Een nieuw verpakte app bevat de nieuwe instructie-interface; bestaande APK’s krijgen die interface pas met een app-update. De webomgeving krijgt de interface met de website-uitrol. Dit werk publiceert geen Google Play-release en configureert geen nieuwe betaalde dienst.

De algemene, oudere statusregistratie blijft voor compatibiliteit bestaan. De concrete materiaalworkflow bewaakt zijn eigen stapvolgorde; deze wijziging maakt niet alle oudere handmatige statusroutes tot formele kwaliteitsvrijgave.

## Verificatie

`npm run test:maintenance` controleert alle instructievarianten, pakket-/extra-keuzes, afwijkende reparatie, bevestigingsvalidatie, toewijzing, eigenaarstoegang, stapvolgorde, opgeslagen bevestigingen en herhaalde afronding. `npm run test:maintenance:browser` gebruikt uitsluitend een synthetische SQLite-database in het geheugen en controleert zes scenario’s: openen vanuit de opdracht, instructies/video’s zonder externe laadverzoeken, verplichte controles en herladen, snowboardkeuzes/mobiel, late antwoorden/uitloggen en de leesweergave voor beheer.

`npm run check` bouwt de klantenapp en voert de 53 bestaande klant-/websitecontroles en alle Worker-suites uit. De webbundels voor medewerkers en beheer worden eveneens opgebouwd. Screenshots in `docs/screenshots/maintenance-*.png` bevatten uitsluitend fictieve gegevens. Een test met een echte klantopdracht, daadwerkelijke behandeling of geïnstalleerd Android-toestel maakt geen deel uit van deze automatische controles.
