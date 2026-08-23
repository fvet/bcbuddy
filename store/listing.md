# Store listing - BC Buddy

Alles wat het Chrome Web Store-dashboard (en Edge Partner Center) vraagt, hier
klaar om te kopieren. Bouw het pakket met:

    powershell -ExecutionPolicy Bypass -File tools/build-package.ps1

Dat levert `dist/bcbuddy-<versie>.zip` op - dat bestand upload je.

---

## 1. Basisgegevens

| Veld | Waarde |
|---|---|
| Naam | BC Buddy |
| Categorie | Workflow & Planning (alternatief: Developer Tools) |
| Taal van de listing | Nederlands (de extensie zelf is nl + en) |
| Zichtbaarheid | Openbaar |
| Privacybeleid-URL | `https://github.com/fvet/bcbuddy/blob/main/PRIVACY.md` |
| Ondersteuning / homepage | `https://github.com/fvet/bcbuddy` |

De `default_locale` in het manifest staat op `nl`, dus de Web Store toont de
Nederlandse naam en beschrijving als standaard. Wil je Engels als
hoofdtaal in de store, zet dan de listing-taal op Engels; de extensie zelf
blijft de browsertaal volgen.

---

## 2. Korte beschrijving (max. 132 tekens)

**NL**

> Markeer je Business Central-omgevingen met kleur: ribbon, kader, banner,
> tabtitel en favicon. Instellingen deelbaar via JSON.

**EN**

> Tell your Business Central environments apart with colour: ribbon, frame,
> banner, tab title and favicon. Settings shareable via JSON.

---

## 3. Uitgebreide beschrijving

**NL**

> Werk je met meerdere Business Central-omgevingen, dan lijken ze in je
> browser allemaal op elkaar. Een boeking die in productie belandt terwijl je
> dacht in een sandbox te zitten, is zo gebeurd.
>
> BC Buddy geeft elke omgeving een eigen gezicht. Je stelt regels in - op
> omgeving, bedrijf, tenant of gewoon op een stuk van de URL - en elke regel
> krijgt een kleur en een layout.
>
> Wat een layout kan tonen:
>
> - Ribbon - de zwarte balk bovenaan de BC-client krijgt jouw kleur en jouw
>   tekst, bijvoorbeeld "PRODUCTIE - CRONUS BE".
> - Kader - een gekleurde rand rond het volledige venster.
> - Banner - een balk onderaan of een diagonaal lint in een hoek.
> - Tabtitel - bijvoorbeeld "[TEST] Company Information".
> - Favicon - een gekleurd icoontje met de eerste letters, zodat je in een
>   rij tabbladen meteen de juiste ziet.
>
> In elke tekst kan je tokens gebruiken: {name}, {environment}, {company} en
> {title}. Lege tokens worden netjes opgeruimd.
>
> Zowel Business Central online als on-premises wordt herkend.
>
> Instellingen delen met je team: exporteer je regels naar JSON, zet dat
> bestand op een publieke URL (bijvoorbeeld een raw GitHub-link) en laat
> iedereen die URL invullen. De extensie werkt ze dagelijks bij. Eigen regels
> hebben altijd voorrang op gedeelde.
>
> De extensie is beschikbaar in het Nederlands en het Engels en volgt de taal
> van je browser.
>
> Privacy: alles blijft lokaal. Geen server, geen analytics, geen tracking.
> Het enige netwerkverzoek dat BC Buddy doet, is het ophalen van het gedeelde
> configuratiebestand op de URL die jij zelf instelt.
>
> Broncode: https://github.com/fvet/bcbuddy

**EN** - zelfde tekst, vertaald, als je de listing ook in het Engels zet.

---

## 4. Antwoorden op het privacy-formulier

**Single purpose (een zin, verplicht):**

> BC Buddy visually marks Business Central environments in the browser -
> ribbon, frame, banner, tab title and favicon - so the user can tell one
> environment from another at a glance.

**Rechtvaardiging per recht** (elk veld wil een eigen antwoord):

| Recht | Rechtvaardiging |
|---|---|
| `storage` | Stores the user's own rules and layouts, plus the URL of an optional shared configuration file. All of it stays in `chrome.storage.local`; nothing is transmitted. |
| `alarms` | Schedules one daily check of the shared configuration file the user configured, so a team-wide change reaches everyone without manual action. |
| Host permission `<all_urls>` | Rules must be able to match any URL. Business Central on-premises runs on the customer's own host name, which the extension cannot know in advance, and the optional shared configuration file may be hosted on any domain the user chooses. The access is used only to draw the extension's own markers on pages that match a user-defined rule; page content is never read for any other purpose, stored or transmitted. |
| Remote code | **No.** All code ships inside the package. The only thing fetched at runtime is a JSON data file, which is parsed as data and never executed. |

**Data usage - vink aan:**

- Verzamelt de extensie gebruikersgegevens? **Nee.**
- Alle drie de verklaringen onderaan (niet verkopen aan derden, geen gebruik
  buiten het aangegeven doel, geen gebruik voor kredietwaardigheid) mogen
  aangevinkt worden.

---

## 5. Beeldmateriaal

Wat de store minstens wil:

| Item | Formaat | Aantal | Status |
|---|---|---|---|
| Icoon | 128x128 PNG | 1 | Zit in het pakket |
| Screenshots | 1280x800 (of 640x400) PNG/JPEG | 1 tot 5 | **Nog te maken** |
| Kleine promotietegel | 440x280 PNG/JPEG | 1, optioneel maar aangeraden | **Nog te maken** |
| Marquee-tegel | 1400x560 | optioneel | Overslaan |

Suggestie voor de vijf screenshots, in deze volgorde:

1. Een BC-client met gekleurde ribbon "PRODUCTIE - CRONUS BE" en kader - het
   effect waar het om draait.
2. Dezelfde pagina als sandbox, in een andere kleur, zodat het contrast
   duidelijk is.
3. De optiespagina met een paar regels open.
4. Een rij tabbladen waarin de gekleurde favicons het verschil maken.
5. De gedeelde configuratie in de optiespagina.

Zet er geen echte klantgegevens op - gebruik CRONUS.

---

## 6. Stappen om in te dienen

Deze stappen vragen je eigen account en je eigen akkoord; ze moeten door jou
gezet worden.

1. Maak een ontwikkelaarsaccount op
   <https://chrome.google.com/webstore/devconsole>. Eenmalige registratie van
   $5. Zet meteen je publisher-naam en e-mailadres goed: die staan straks
   publiek bij de extensie.
2. Zorg dat `PRIVACY.md` op GitHub staat en publiek bereikbaar is - de URL
   hierboven moet werken voor je indient.
3. Maak de screenshots en de promotietegel.
4. Bouw het pakket (`tools/build-package.ps1`) en upload
   `dist/bcbuddy-1.0.0.zip`.
5. Vul de listing in met de teksten hierboven, en de privacy-antwoorden uit
   punt 4.
6. Dien in. Reken op een langere review dan gemiddeld door de brede
   hostrechten - zie de opmerking hieronder.

### Edge Add-ons

Hetzelfde ZIP-bestand werkt op <https://partner.microsoft.com/dashboard/microsoftedge>.
Daar is geen registratiekost. De listing-velden zijn nagenoeg dezelfde, dus de
teksten hierboven kan je hergebruiken.

---

## 7. Wat de review kan vertragen

`<all_urls>` met een content script op elke pagina is de zwaarste combinatie
die je kan aanvragen. Ze is hier verdedigbaar - on-prem BC draait op een
hostnaam die de extensie niet vooraf kent - maar reken op extra vragen en een
tragere review.

Wil je dat vermijden, dan is de smalle variant: `host_permissions` beperken
tot `https://businesscentral.dynamics.com/*` en de rest via
`optional_host_permissions` laten aanvragen door de gebruiker die on-prem
draait. Dat is echter een gedragswijziging in de extensie, geen listing-keuze,
en betekent dat on-prem-gebruikers eerst toestemming moeten geven.
