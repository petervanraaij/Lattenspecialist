# Intake- en opleverfoto’s

Per materiaal (een paar ski’s of een snowboard) is er in de medewerkerswerkbank een fotopaneel met Binnenkomst en Oplevering. Foto maken opent de telefooncamera; Foto’s kiezen selecteert bestaande afbeeldingen. Meerdere foto’s per upload, toelichting, medewerker en tijdstip blijven aan het materiaal en de onderhoudsbeurt gekoppeld. De galerie toont beide fases naast elkaar op brede schermen en onder elkaar op mobiel.

Foto’s zijn uitsluitend intern. De server controleert bij iedere lijst-, upload- en afbeeldingsaanvraag de geldige medewerker en materiaaltoewijzing; eigenaar kan ze via het beheer-API lezen. Geen openbare fotolinks of automatische klantdeling. Bij uitloggen of materiaal wisselen worden lopende verzoeken afgebroken en lokale beeld-URL’s ingetrokken.

De client verkleint naar maximaal 1600 pixels en JPEG. De server controleert het formaat en de afmetingen en verwijdert metadata zoals EXIF/GPS. Maximaal 750 KiB per foto en 40 foto’s per materiaal. De bestaande private Cloudflare KV-opslag bewaart de beelden; D1 bewaart metadata, koppeling en audit. Geen nieuwe dienst of abonnement. Foto’s kunnen na opslaan door verspreiding van de opslag kort nodig hebben om te openen; de gebruiker kan opnieuw proberen.

Herhalen van dezelfde upload maakt geen dubbele foto. Bestandsopslag moet slagen voordat metadata wordt opgeslagen; fouten worden zichtbaar gemeld. Tests gebruiken uitsluitend een fictieve 8x8-pixel afbeelding en een geïsoleerde database, geen echte klantfoto’s of voorraadmutaties.

Android: reguliere app 1.4.0 (6), zelfde app-ID en oorspronkelijke ondertekening als 1.1.1/1.3.0. Geen DEV-app nodig.
