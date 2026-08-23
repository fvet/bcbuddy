# BC Buddy

> **Environment marker**

Een Chrome/Edge-extensie (Manifest V3) met hulpmiddelen voor Business Central.
Vandaag bevat ze de environment marker, die je omgevingen visueel uit elkaar
houdt; de opzet laat toe er later andere BC-hulpmiddelen naast te zetten.

Naast het klassieke gekleurde kader en de banner past de marker ook **de zwarte
ribbon bovenaan de BC-client** aan: die krijgt de kleur van de regel en een
eigen tekst, bijvoorbeeld

```
Dynamics 365 Business Central - CRONUS BE (Sandbox)
```

Instellingen kunnen op een publieke URL gehost worden (bv. een raw GitHub-link),
zodat iedereen in het bedrijf dezelfde markeringen gebruikt.

## Installeren

1. Open `chrome://extensions` (of `edge://extensions`).
2. Zet **Ontwikkelaarsmodus** aan.
3. Klik op **Uitgepakte extensie laden** en kies de map van deze repository.
4. De optiespagina opent automatisch bij de eerste installatie.

## Hoe matching werkt

Een regel bestaat uit een of meer **voorwaarden**; ze moeten allemaal kloppen
(AND). De eerste regel in de lijst die past, wordt toegepast — de volgorde
bepaalt dus de prioriteit. Eigen regels gaan altijd voor op gedeelde regels.

Een URL wordt ontleed in velden waarop je kan matchen:

| Veld | Uit deze voorbeeld-URL |
|---|---|
| `url` | de volledige, gedecodeerde URL |
| `environment` | `Sandbox` |
| `company` | `CRONUS BE` |
| `tenant` | `453d817a-d5b1-49c1-bdcf-d9474180a702` |

```
https://businesscentral.dynamics.com/453d817a-d5b1-49c1-bdcf-d9474180a702/Sandbox?company=CRONUS%20BE&page=1
```

Je kan dus een waarde opgeven die gewoon *ergens in de URL* voorkomt (`url`
+ `bevat`), of preciezer op omgeving of bedrijf matchen. Operatoren: bevat,
is gelijk aan, begint met, eindigt op, RegEx, bevat niet.

Zowel BC SaaS als on-premises URLs worden herkend, volgens de vorm uit de
[documentatie van Microsoft](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-web-client-urls):
`https://<host>[/<aadtenantid>][/<omgeving>]/?[company=...]&[tenant=...]`.
Tenant en omgeving zijn allebei optioneel; de tenant is een GUID of een
domeinnaam. On-prem staat het serverinstance op de plaats van de omgeving
(`/BC240/?company=...`) en komt de tenant uit de query.

Regels gelden op elke site, niet enkel op `businesscentral.dynamics.com`. Dat is
geen luxe: een on-prem installatie draait op je eigen host, dus aan de URL alleen
valt niet te zien dat het Business Central is. Wil je enkel BC gemarkeerd zien,
dan zet je dat in de voorwaarden van je regel (bijvoorbeeld `url` `bevat`
`businesscentral.dynamics.com`).

## Regels en layouts

De optiespagina heeft links een navigatie: **Omgevingen** (layouts en regels),
**Instellingen** (gedeelde configuratie, import/export) en **Over**.

Het onderscheid tussen de twee lijsten:

- Een **regel** zegt *welke* omgeving je herkent en *welke kleur* die krijgt:
  naam, voorwaarden, kleur, tekstkleur en de letters op de favicon.
- Een **layout** zegt *hoe* een markering eruitziet: ribbon, kader, banner,
  tabtitel en of er een favicon komt. Meerdere regels kunnen dezelfde layout
  gebruiken, zodat je die instellingen op een plek onderhoudt.

Er is altijd minstens een layout; nieuwe regels krijgen *Default*. Verwijder je
een layout, dan vallen de regels die eraan hingen terug op de eerste in de lijst.

Had je al regels van voor deze opsplitsing, dan worden daar bij het eerste
inlezen layouts uit afgeleid: regels die er hetzelfde uitzagen delen een layout,
dus je markeringen blijven ongewijzigd.

## Wat een layout kan tonen

- **Ribbon** — de balk bovenaan de BC-client krijgt de kleur van de regel en
  een eigen tekst. In het voorbeeld van een regel verschijnt die enkel wanneer
  de regel op Business Central mikt: met een voorwaarde op omgeving of bedrijf,
  of op een URL waarin `businesscentral.dynamics.com` voorkomt.
- **Kader** — gekleurde rand rond het volledige venster (dikte 1 tot 5 px, standaard 3).
- **Banner** — balk onderaan of een diagonaal lint in een van de vier hoeken.
- **Tabtitel** — bv. `[TEST] Company Information`.
- **Favicon** — gekleurd icoontje met de eerste letters, zodat je de juiste tab
  meteen ziet in een rij tabbladen.

Tekstkleur staat standaard op *automatisch*: wit of zwart, afhankelijk van wat
leesbaar is op de gekozen kleur.

### Tokens

In elke tekst kan je tokens gebruiken:

`{name}` `{environment}` (of `{env}`) `{company}` `{title}` (de originele
tabtitel)

Lege tokens worden opgeruimd: staat er geen bedrijf in de URL, dan blijven er
geen losse streepjes of lege haakjes achter.

## Instellingen delen via GitHub

1. Stel je layouts en regels in en klik op **Exporteer**; dat levert
   `bc-markers.json` op, met de layouts erbij.
2. Zet dat bestand in een repository.
3. Iedereen vult in de optiespagina onder **Gedeelde configuratie** de URL in:
   `https://raw.githubusercontent.com/bedrijf/repo/main/bc-markers.json`
   Een gewone `github.com/.../blob/...`-link mag ook; die wordt automatisch
   omgezet naar de raw-variant.
4. Een klik op **Synchroniseren** haalt het bestand op en zet de gedeelde
   configuratie daarmee meteen aan: vanaf dan wordt ze elke dag bijgewerkt.
   Er is geen aparte schakelaar - synchroniseren is de schakelaar.
5. De `X` naast *Gedeelde regels* wist wat er binnenkwam en zet ze weer uit,
   anders staat het er de dag nadien gewoon weer. De URL blijft staan, dus een
   klik op synchroniseren volstaat om opnieuw te beginnen. Een lege URL zet ze
   ook uit: zonder bron valt er niets bij te werken.

Gedeelde regels staan onderaan de lijst en zijn niet bewerkbaar. Wil je er een
aanpassen, gebruik dan het kopieerknopje op die regel: je krijgt een eigen
versie, met haar layout erbij, en die heeft voorrang op de gedeelde. Een
voorbeeldbestand staat in [`examples/bc-markers.example.json`](examples/bc-markers.example.json).

De extensie leest enkel haar eigen formaat: een object met een `rules`-array en
 optioneel een `layouts`-array (zoals de export), of een kale array van regels. er geen layout in het bestand, dan volgen de ingelezen regels de eerste van wie ze importeert.

Importeren gaat via **Import / export > Bestand kiezen** en werkt als een
samenvoeging: een regel die je al hebt (zelfde id, anders zelfde naam) wordt
overschreven op zijn plaats, nieuwe regels komen erbij, en regels die niet in
het bestand staan blijven ongemoeid.

## Als de ribbon niet gevonden wordt

De ribbon wordt gezocht op tekst ("Dynamics 365 Business Central") en niet op
een vaste CSS-class, zodat een update van de BC-client hem niet meteen breekt.
De balk zelf is het bovenste element dat die tekst bevat en de volle breedte van
het venster inneemt.

Elementen in de balk die zelf een achtergrond schilderen - de knoppen rechts -
verliezen die, zodat er geen donkere blokjes tussen de icoontjes blijven staan.
Dat gebeurt met CSS en, voor achtergronden die BC rechtstreeks op het element
zet, met een inline stijl vanuit het content script. Invoervelden en
achtergrondafbeeldingen blijven ongemoeid: die hebben hun achtergrond nodig.

## Structuur

```
manifest.json
_locales/              nl (standaard) en en
src/
  background.js        service worker: synchroniseert het gedeelde bestand
  lib/i18n.js          vertalingen ophalen
  lib/match.js         URL ontleden, regels matchen, tokens, kleurhulpjes
  lib/settings.js      opslag, defaults, normalisatie, import/export
  content/content.js   tekent kader, banner, ribbon, titel en favicon
  content/content.css  bijhorende opmaak
  options/             optiespagina
  popup/               popup bij het extensie-icoon
examples/              voorbeeld van een gedeelde configuratie
tests/                 testpagina's + runner
icons/                 logo.svg, logo-small.svg, build-icons.ps1, de PNG's
tools/                 build-package.ps1: het ZIP voor de store
store/                 listing-teksten en checklist
```

De Business Central client is een SPA die zijn DOM voortdurend hertekent. Het
content script is daarom volledig idempotent: het herbekijkt de pagina bij elke
DOM-wijziging en bij URL-wijzigingen, en doet niets zolang alles al klopt.
Delen van de BC-client draaien in een iframe; de ribbon wordt daarom in elk
frame gezocht, terwijl kader, banner, titel en favicon enkel in het hoofdvenster
getekend worden.

## Talen

De extensie is beschikbaar in het Nederlands en het Engels. Ze volgt de taal van
je browser: staat die op Engels, dan zie je de Engelse teksten, anders de
Nederlandse (`nl` is de terugval). Er is dus geen schakelaar en geen instelling.

De teksten staan in [`_locales/nl/messages.json`](_locales/nl/messages.json) en
[`_locales/en/messages.json`](_locales/en/messages.json). Een taal toevoegen komt
neer op een nieuwe map met dezelfde sleutels. De tests controleren dat beide
bestanden dezelfde sleutels bevatten, dat elke sleutel die de code gebruikt
bestaat, en dat er geen ongebruikte sleutels blijven slingeren.

Wat *niet* vertaald wordt: de teksten die jij zelf invult in een regel. Wat je in
de ribbon, de banner of de tabtitel zet, verschijnt precies zoals je het typt.

## Logo

Het merk is de lettercombinatie **BC** met een uitsparing rechtsonder waar een
bol tegenaan ligt. Kleuren komen uit de
[control add-in style guide](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-control-addin-style):
Primary `#00B7C3` voor de bol. De zetting is Segoe UI Semibold.

De letters staan lichter dan de Secondary `#505C6D` uit die gids: `#737C8A`. Het
icoon staat namelijk in de werkbalk, en die is licht of donker naargelang het
thema van de browser - een vaste PNG kan zich daar niet aan aanpassen. Met
`#505C6D` haalde het contrast op een donkere werkbalk maar 1,8:1; `#737C8A` is de
tint uit die reeks met het hoogste laagste contrast (2,9:1 op zowel licht als
donker). Op de optiespagina blijft de Secondary wel gelden: die SVG staat inline
en volgt het thema via `--brand-mark`.

Elk formaat komt uit `logo.svg`: in de werkbalk, bij de extensies en op de
optiespagina hoort hetzelfde merk te staan. Op 16 px is dat krap — `logo-small.svg`
houdt daarvoor enkel de C en de bol over — maar herkenbaarheid weegt zwaarder.

```bash
powershell -ExecutionPolicy Bypass -File icons/build-icons.ps1
```

Dat rendert de SVG op 512 px in headless Chrome en schaalt ze terug naar
`icon16/32/48/128.png`. De letters worden mee gerasterd, dus de extensie hangt
nergens af van Segoe UI op de machine van de gebruiker.

## Tests

De testpagina's draaien de echte broncode in headless Chrome (of Edge): het
ontleden van URLs, het matchen van regels, de tokens, het opbouwen van de
optiespagina en de popup, en wat het content script effectief in de DOM doet
(ribbon herschrijven en inkleuren, kader, hoeklint, titel, favicon).

```bash
powershell -ExecutionPolicy Bypass -File tests/run-tests.ps1
```

Je kan de pagina's ook gewoon in een browser openen; `test-core.html` werkt
overal, `test-options.html` en `test-popup.html` halen de HTML met `fetch` op en
hebben daarvoor de vlag `--allow-file-access-from-files` nodig (die zet de
runner al).

## Rechten

- `storage` — instellingen bewaren.
- `alarms` — periodiek het gedeelde bestand controleren.
- `<all_urls>` — regels mogen op elke URL matchen (ook on-premises servers), en
  het gedeelde JSON-bestand kan overal staan. Wil je dit beperken, vervang dan
  `<all_urls>` in `manifest.json` door je eigen hosts, bv.
  `https://businesscentral.dynamics.com/*` plus de host van je JSON-bestand.

## Publiceren

Het pakket voor de Chrome Web Store of Edge Add-ons bouw je met:

```bash
powershell -ExecutionPolicy Bypass -File tools/build-package.ps1
```

Dat zet `dist/bcbuddy-<versie>.zip` klaar met enkel wat de extensie nodig
heeft: manifest, `src`, `_locales` en de PNG-iconen. Tests, voorbeelden en de
SVG-bronnen blijven achter.

De teksten, de rechtvaardiging van elk recht en de checklist voor het
beeldmateriaal staan in [`store/listing.md`](store/listing.md); de
privacyverklaring waar de store naar verwijst in
[`PRIVACY.md`](PRIVACY.md).
