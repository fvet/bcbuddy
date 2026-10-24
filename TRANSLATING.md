# Translating BC Buddy

Adding a language to a product whose maintainers do not speak that language is
mostly a question of what you can check without reading it. This page splits the
work into the part the tests already guarantee, the part a glossary settles, and
the small remainder that genuinely needs a native speaker.

For where the files live and how the code reaches them, see
[DEVELOPMENT.md](DEVELOPMENT.md#-adding-a-language).

## What the tests already guarantee

`tests/run-tests.ps1` checks every folder under `_locales/`, so none of this
needs a review by hand:

- the folder name is one the Web Store accepts (`fr`, `pt_BR` — underscore, not
  hyphen); anything else is rejected at upload
- the file is valid JSON, valid UTF-8, and has no byte order mark
- the keys match `en` exactly: nothing missing, nothing invented
- every message has text
- every message keeps the same `$1`, `$2`, … as the English one — a dropped
  placeholder ships a broken sentence
- every English message that uses a placeholder carries a `description`
- the store description stays under 132 characters, per language
- the language is translated rather than copied: more than 40% of the messages
  still reading as English fails the run

A message that is identical to the English one is printed as a `NOTE` and fails
nothing — plenty of words really are the same in two languages. Read the list
once per language, though: it is where a half-finished translation shows.

## Terminology comes from Microsoft, not from a translator

About twenty strings are Dynamics 365 Business Central terms. They have an
official translation in every language Business Central ships in, and guessing
at them is what makes an extension feel foreign to the people who use it all
day. Take them from one of these, in order of effort:

1. **A Business Central sandbox with the UI language switched**
   (*My Settings* → *Language*). Ground truth for the exact label, including the
   environment and company pickers. Copying a string out of a screenshot needs
   no knowledge of the language.
2. **Microsoft Terminology Search / the Microsoft Language Portal.** Microsoft's
   own terminology database, per language, free.
3. **The translated base application `.xlf` files** that ship with the Business
   Central artifacts, if you would rather grep than click.

| Term | `en` | `nl` | `fr` | Where it comes from |
|---|---|---|---|---|
| Environment | Environment | Omgeving | Environnement | Business Central UI |
| Company | Company | Bedrijf | Société | Business Central UI |
| Tenant | Tenant | Tenant | Locataire | Business Central UI |
| Sandbox | Sandbox | Sandbox | Bac à sable | Business Central UI (an environment *name* such as `Sandbox` stays as it is) |
| Production | production | productie | production | Business Central UI |
| Company Information | Company Information | Bedrijfsgegevens | Informations société | Name of a Business Central page |
| Web client | Web client | Webclient | Client Web | Business Central documentation |
| Card | card | kaart | fiche | Business Central UI |
| FactBox | FactBox | feitenblok | récapitulatif | Business Central UI |
| FastTab | FastTab | sneltabblad | raccourci | Business Central UI |
| Sales lines | sales lines | verkoopregels | lignes vente | Business Central UI |
| Journal | journal | dagboek | feuille | Business Central UI |
| Notifications | Notifications | Berichten | Notifications | Business Central UI |
| Style (this extension's) | Style | Stijl | Style | A saved set of appearance settings; not a Business Central report layout (*présentation* in French) |
| Business Central | Business Central | Business Central | Business Central | Product name, never translated |
| BC Buddy | BC Buddy | BC Buddy | BC Buddy | Product name, never translated |
| URL | Url | Url | URL | Unchanged in most languages |
| RegEx | RegEx | RegEx | RegEx | Unchanged in most languages |
| JSON, HTTPS, HTTP | as written | as written | as written | Format and protocol names |
| CRONUS BE | CRONUS BE | CRONUS BE | CRONUS BE | Microsoft's demo company |
| bc-buddy.json | as written | as written | as written | File name |

> **Note on Company Information.** `previewTitle` is the name of a real
> Business Central page, drawn on the mock page in the preview. It has to read
> as that page reads in the target language — not as a translation of the words.
> This is exactly the sort of string that stays English by accident: it did in
> Dutch until the check below started printing it.

> **Note on French typography.** `fr` follows the Microsoft French style: a
> non-breaking space (`\u00a0` in the file) before `:`, `;` and `?`, and
> « » quotes with the same space inside. Keep the escapes, so the spaces stay
> visible in a review.

Add a column when you add a language, and fill it from the sources above rather
than from the translation. A reviewer then checks the table instead of
re-arguing every term.

## False friends

These are the ones a competent translator and every machine will get wrong
without being told, because the obvious reading is a different concept. Each has
a `description` in `_locales/en/messages.json` saying so; keep those descriptions
up to date, they are the only context a translator gets.

| Key | Reads as | Actually means |
|---|---|---|
| `ribbonToggle`, `ribbonText` | The Office / Business Central ribbon toolbar | The bar at the very top of the Business Central client, the one with the product name, in the rule's colour |
| `posTopRight`, `posBottomLeft`, … | The Office / Business Central ribbon toolbar | A diagonal coloured strip across a corner of the page |
| `stylesHeading`, `styleLabel`, … | A Business Central report layout, or the style BC gives a field | This extension's own saved set of appearance settings |
| `tokenName`, `tokenCompany`, … | A security or access token | A placeholder such as `{name}` that the user types into a text |
| `titleToggle`, `titleText` | The title of the Business Central page | The title of the browser tab |
| `opContains`, `opEquals`, … | Standalone buttons | Words in the middle of a sentence, hence lowercase |
| `defaultStyleName` | The setting "default" | A name in a list, the way somebody would name a style |
| `fullStyleName`, `subtleStyleName` | Descriptions of a setting | Names of the two ready-made styles, given once when they are added; short words somebody would pick as a style name |

## Working process

1. **Fill the glossary column first**, from Business Central itself. Everything
   downstream then has one right answer to work from.
2. **Translate the whole file in one go**, not string by string — a translator
   who sees `deleteRule`, `deleteStyle` and `deleteConfirm` together keeps them
   consistent. Hand over the English file *including its `description` fields*
   plus the glossary and the false friends table.
3. **Back-translate to verify.** Have a second, independent pass translate the
   result back into English cold, without sight of the original, and diff that
   against `_locales/en/messages.json`. Dropped negations (`opNotContains`,
   `matchNo`), swapped placeholders and false friends all surface as a diff you
   can read in English. This is the closest thing to a correctness check
   available to somebody who does not speak the language.
4. **Add it to the language picker.** The new folder name goes in `LANGUAGES`
   in `src/lib/i18n.js` and as an `<option>` under `<select id="language">` in
   `src/options/options.html`, named in its own language. The tests fail until
   both list every folder.
5. **Look at the options page in the new locale.** French runs some 15–20%
   longer than English and German around 35%. Truncated buttons and wrapped
   labels are visible without reading a word.
6. **Get one native sign-off.** Everything above lands on "very probably right";
   only a speaker gets to "correct". Make it a twenty-minute job: a pull request
   with English and the translation side by side, the glossary rows, and the
   back-translation diff already resolved.

## Choosing which languages to take on

`syncLoaded` and friends read `$1 rule(s)`. That English shortcut degrades
acceptably in French, German, Spanish, Italian and Dutch. It falls apart in
Polish, Russian and Arabic, which need real plural forms — and `chrome.i18n` has
no plural support to fall back on. Adding one of those means restructuring those
messages first.

A language nobody maintains is not a disaster: Chrome falls back to `en` for
anything missing. Mark community-contributed languages as such in the README and
leave a way to report a bad string.

## What is not translated

- **What users type themselves** — rule names, banner texts, style names. The
  extension shows those back exactly as entered.
- **Keys in `bc-buddy.json`** — the shared configuration format is English on
  both sides of the wire.
- **`docs/` and the website** — English only, deliberately. Translating those is
  an order of magnitude more upkeep than 162 UI strings.
- **The store listing.** `_locales/` covers the extension; the listing is
  separate. A new language needs its own `store/description-<code>.txt` and a
  listing translation entered in the Web Store dashboard, and the screenshots
  stay as they are unless somebody re-shoots them.
