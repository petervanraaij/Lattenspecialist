# Lattenspecialist Medewerkers

Android-app `nl.lattenspecialist.medewerkers`, versie 1.0.0 (1). Dezelfde schermen als `medewerkers.html`; bronbestanden staan in de repositoryroot. Bouw met `npm ci`, `npm run sync`, `npm run prepare:assets` en `android/gradlew bundleRelease` (Windows: `gradlew.bat`). Java 21 en Android SDK 36 zijn vereist. GitHub voert dezelfde bouwstappen uit.

Voor de lokale demonstratie en beheer van medewerkers: [TEAM.md](../TEAM.md). Alle rechten worden door de Worker gecontroleerd; de app bevat geen gedeelde beheersleutel. DEV gebruikt pakket-ID `nl.lattenspecialist.medewerkers.dev` en kan naast de release staan.

De registratie staat in Google Play Console. Een AAB bouwen is geen winkelpublicatie: ondertekenen, interne test, app-toegang voor review, privacy-/gegevensverklaringen en goedkeuring blijven afzonderlijke stappen.
