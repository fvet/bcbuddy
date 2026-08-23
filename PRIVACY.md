# Privacy policy - BC Buddy

_Last updated: 23 August 2026_

BC Buddy is a browser extension that colours and labels Business Central
environments so you can tell them apart. **It does not collect, transmit or
sell any personal data.** There is no server behind it, no analytics and no
tracking of any kind.

## What the extension stores

Everything BC Buddy knows lives in `chrome.storage.local`, on your own machine:

- your rules (name, conditions, colours, favicon letters),
- your layouts (ribbon, frame, banner, tab title, favicon settings),
- the URL of a shared configuration file, if you configured one, plus the
  rules it returned and the timestamp of the last synchronisation.

This data never leaves your browser. Uninstalling the extension removes it.

## What the extension reads

To decide whether a page should be marked, the content script looks at the
URL of the page it runs in and at the page's own DOM (to find the Business
Central ribbon). This happens entirely inside your browser. Nothing that is
read is stored, logged or sent anywhere.

## Network requests

BC Buddy makes exactly one kind of network request: an HTTP `GET` of the
shared configuration file, to the URL **you** entered in the options page.
It is sent without cookies or credentials (`credentials: 'omit'`), and only
if you configured such a URL. If you leave that field empty, the extension
makes no network requests at all.

The operator of the server hosting that file (GitHub, for example) will see
that request the same way it sees any other download. BC Buddy adds nothing
to it.

## Permissions

- `storage` - keep your settings.
- `alarms` - check the shared configuration file once a day.
- host permissions (`<all_urls>`) - rules may match any URL, because a
  Business Central on-premises server runs on your own host name, and your
  shared configuration file can be hosted anywhere. The extension only uses
  this access to draw its own markers on pages that match one of your rules.

## Contact

Questions or concerns: open an issue at
<https://github.com/fvet/bcbuddy/issues>.

---

# Privacyverklaring - BC Buddy

_Laatst bijgewerkt: 23 augustus 2026_

BC Buddy kleurt en labelt je Business Central-omgevingen zodat je ze uit
elkaar houdt. **De extensie verzamelt, verstuurt en verkoopt geen enkele
persoonsgegevens.** Er staat geen server achter, er zit geen analytics in en
er wordt niets gevolgd.

## Wat de extensie bewaart

Alles staat in `chrome.storage.local`, op je eigen machine: je regels, je
layouts, en - als je er een instelde - de URL van het gedeelde
configuratiebestand met de regels die daaruit kwamen en het tijdstip van de
laatste synchronisatie. Die gegevens verlaten je browser niet. Verwijder je
de extensie, dan zijn ze weg.

## Wat de extensie leest

Om te beslissen of een pagina gemarkeerd moet worden, kijkt het content
script naar de URL van de pagina waarin het draait en naar de DOM van die
pagina (om de ribbon van Business Central te vinden). Dat gebeurt volledig
in je browser. Niets daarvan wordt bewaard, gelogd of doorgestuurd.

## Netwerkverkeer

BC Buddy doet precies een soort verzoek: een HTTP `GET` van het gedeelde
configuratiebestand, naar de URL die **jij** in de optiespagina invulde,
zonder cookies of credentials. Vul je die niet in, dan doet de extensie
helemaal geen netwerkverzoeken.

## Rechten

- `storage` - je instellingen bewaren.
- `alarms` - het gedeelde bestand een keer per dag controleren.
- hostrechten (`<all_urls>`) - regels mogen op elke URL matchen, want een
  on-premises Business Central draait op je eigen hostnaam en je gedeelde
  bestand kan overal staan. De extensie gebruikt die toegang enkel om haar
  eigen markeringen te tekenen op pagina's die aan een van je regels voldoen.

## Contact

Vragen of opmerkingen: open een issue op
<https://github.com/fvet/bcbuddy/issues>.
