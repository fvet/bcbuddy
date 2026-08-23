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

Dit is ook de `description` in `_locales/*/messages.json`: de Web Store weigert
het pakket als een van beide talen over 132 tekens gaat. De tests bewaken dat.

**NL**

> Zie in een oogopslag in welke Business Central-omgeving je werkt: eigen
> kleur in de balk bovenaan, kader, banner en tabicoon.

**EN**

> See at a glance which Business Central environment you are in: your own
> colour in the top bar, frame, banner and tab icon.

---

## 3. Uitgebreide beschrijving

De volledige tekst staat klaar om te plakken in:

- [`store/description-nl.txt`](description-nl.txt)
- [`store/description-en.txt`](description-en.txt)

Het veld neemt platte tekst: geen markdown, geen HTML, en regeleindes
blijven staan zoals ze er staan. Daarom zijn de alineas in die bestanden
een doorlopende regel - hard afbreken op 80 tekens geeft in de store een
rafelige kolom.

---

## 4. Antwoorden op het privacy-formulier

Klaar om te plakken in [`store/privacy-practices.txt`](privacy-practices.txt):
de beschrijving voor een doel, de verantwoording per recht, het antwoord
over externe code, en wat je aanvinkt bij gegevensgebruik.

Schrijf die velden in het Engels - de reviewers lezen Engels, ook als je
listing Nederlands is.

Los daarvan vraagt de pagina Instellingen om een e-mailadres van de
uitgever dat je ook moet laten verifieren; zonder dat blijft publiceren
geblokkeerd.

---

## 5. Beeldmateriaal

Wat de store minstens wil:

Het winkelicoon is een apart bestand: de store wil 16 px doorzichtige rand
rondom, terwijl het werkbalkicoon (`icon128.png`) de ruimte net wel mag
vullen. Bouw het met `icons/build-icons.ps1`; het gaat niet mee in de ZIP.

| Item | Formaat | Aantal | Status |
|---|---|---|---|
| Winkelicoon | 128x128 PNG, merk binnen 96x96 | 1 | `icons/store-icon128.png` |
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

De store meldt bij het indienen dat brede hostrechten een grondige
beoordeling kunnen vragen. Dat is verwacht en aanvaard (23 augustus 2026):
we houden `<all_urls>` en nemen de tragere review erbij.

Waarom niet versmald:

- `activeTab` kan niet. Dat geeft pas toegang na een expliciete klik op het
  extensie-icoon, terwijl BC Buddy net automatisch moet markeren bij
  `document_start`. Met `activeTab` zou je op elk tabblad eerst moeten
  klikken voor er iets kleurt.
- Een vaste lijst hosts dekt on-prem niet: die draait op de hostnaam van de
  klant, en het gedeelde bestand staat op een domein dat de gebruiker kiest.

De prijs die we hiervoor betalen, naast de tragere review: bij installatie
toont Chrome "al je gegevens op alle websites lezen en wijzigen". Dat
schrikt af en blijft afschrikken, ook lang na de review.

Wil je daar later toch van af, dan is de weg: `host_permissions` beperken
tot `https://businesscentral.dynamics.com/*`, `optional_host_permissions`
toevoegen voor de rest, content scripts dynamisch registreren met
`chrome.scripting` en in de optiespagina een knop zetten waarmee een
on-prem gebruiker zijn eigen host toestaat. Dat is een gedragswijziging,
geen listing-keuze.
