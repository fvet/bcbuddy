# Development

Working on BC Buddy itself. For what the extension does and how to use it, see
[README.md](README.md). Ideas not built yet, with what is known about them, are
in [IDEAS.md](IDEAS.md).

## 📁 Structure

```
manifest.json
managed_schema.json    the browser policy IT can set (sharedConfigUrl)
_locales/              en (default), nl and fr; see TRANSLATING.md
src/
  background.js        service worker: synchronises the shared file
  lib/i18n.js          fetching translations
  lib/match.js         parsing URLs, matching rules, tokens, colour helpers
  lib/settings.js      storage, defaults, normalisation, import/export
  lib/dropdowns.js     dropdown size: sizes BC's lookup dropdowns
  lib/bcstate.js       reading the choices BC stores per page (localStorage)
  lib/maximize.js      maximize: wide layout and list view on BC's own controls
  lib/actionbar.js     pin the action bar on BC's own pin button
  lib/copyvalues.js    copy values: the copy icon on read-only values
  lib/weeknumbers.js   week numbers in the date picker
  lib/gearmenu.js      the BC Buddy section in BC's gear menu (Settings pane)
  lib/shortcuts.js     keyboard shortcuts: the top bar icon and its panel
  content/content.js   draws frame, banner, ribbon, title and favicon;
                       starts maximize, the dropdown sizer, the copy icon,
                       week numbers, the row tint, the gear menu section
                       and the keyboard shortcuts icon
  content/content.css  the accompanying styling
  content/calm.js      page-world half of Turn off animations (FastTabs)
  options/             options.html/css; options.js plus helpers, cards, hosted
examples/              example of a shared configuration (schema version 2);
                       intune/: scripts that set the policy for IT, and
                       the ExtensionSettings value that limits its hosts
tests/                 test pages + runner
icons/                 logo.svg, build-icons.ps1, the PNGs
tools/                 build-package.ps1: the ZIP for the store;
                       get-cws-token.ps1: one-off OAuth setup for releases;
                       mkdocs_assets.py + requirements-docs.txt: the website
store/                 listing copy and screenshots
docs/                  the website (its mkdocs.yml lives in the root)
```

## 📦 Settings model

Stored settings use schema version 2 (`SCHEMA_VERSION` in `settings.js`).
Exports carry `"app": "bc-buddy"` and `"version": 2`.

- A **rule** holds identity and matching: `id`, `name`, `enabled`,
  `conditions`, `color`, `textColor`, `layoutId`, and `favicon.text` (at most
  two letters). Appearance fields no longer live on the rule.
- A **layout** holds appearance: `border`, `banner`, `ribbon`, `title`, and
  `favicon.enabled`. Favicon letters stay on the rule; layouts keep
  `favicon.text` empty.
- `resolveRule()` merges them for drawing: appearance from the chosen layout,
  letters from the rule. Without a layout it falls back to the defaults, so
  drawing never crashes.

Beside rules and layouts sit the settings for the **Web client** panel,
listed in `WEB_CLIENT_KEYS` and normalised by `normalizeWebClient()`. They
travel in an export and in the shared file as `webClient`; the master switch
`enabled` does not:

- `maximize.enabled` — wide layout and list view, on by default.
- `pinActionBar.enabled` — pin the action bar of a page that opens with it
  floating, on by default.
- `highlightRow.enabled` — the current-line tint, on by default.
- `stripeRows.enabled` — every other list row a see-through grey, off by
  default. Keyed on BC's `aria-rowindex`, since BC reuses its `<tr>`
  elements while scrolling.
- `columns.width` — slider steps 1–4 (`COLUMN_WIDTHS`: BC standard, 90%,
  80%, 75%), stored as the step. Columns narrow because BC sizes them in
  `ex` of the `<th>` font; `content.css` has a rule per percentage, keyed on
  the `data-bcb-columns` attribute on `<html>`, set once like the row tint.
  Lists and editable grids alike; the text keeps its size.
- `dropdown.width` and `dropdown.height` — slider steps 1–5, stored as the step
  and never as pixels. Step 1 is BC standard; width defaults to 5, height to 1.
  `normalize()` rounds and clamps them, so a hand-edited or garbled value can
  only ever land on a valid step. The feature is on when either is above 1.
- `noAnimations.enabled` — turn off BC's animations, off by default.
- `hideNotifications.enabled` — hide the notifications bell in the top bar, on
  by default. One `data-bcb-no-bell` attribute on `<html>` and one id rule in
  `content.css` (`#notifications_container`, in the top document).
- `copyValues.enabled` — the copy icon on read-only values, on by default.
- `weekNumbers.enabled` — turns on BC's own week numbers in the date picker
  where nobody set them, on by default.
- `shortcuts.enabled` — the keyboard icon in BC's top bar and its panel, on
  by default.

`normalize()` always ensures every rule points at a valid layout: a
configuration with no layouts gets a Default, and a rule whose `layoutId` names
nothing follows the first layout in the set. Display fields on a rule object are
dropped. Hosted (shared) rules go through the same path.

There is no migration path from an older shape. The extension had no public
release before schema 2, so `normalize()` reads the current schema only —
unknown fields are dropped rather than translated.

## ⚙️ How the content script behaves

The Business Central client is an SPA that redraws its DOM continuously. The
content script is therefore fully idempotent: it re-examines the page on every
DOM change and on URL changes, and does nothing as long as everything is already
right.

On pages that need no marking — extension off, no rules, or a non-BC host with
no matching rule — it goes idle: the MutationObserver and the poll stop. It
wakes again on navigation (`popstate` / `hashchange`) or when settings change.
BC SaaS hosts and pages where a ribbon was already seen keep watching, so
on-prem and SPA redraws are not missed.

Parts of the BC client run in an iframe. The ribbon is therefore looked for in
every frame, while frame, banner, title and favicon are drawn only in the main
window.

## 🔍 Finding the ribbon

The ribbon is located by text ("Dynamics 365 Business Central") and not by a
fixed CSS class, so an update of the BC client does not break it straight away.
The bar itself is the topmost element that contains that text and spans the full
width of the window.

Elements inside the bar that paint a background themselves — the buttons on the
right — lose it, so no dark blocks are left between the icons. That happens with
CSS and, for backgrounds BC sets directly on the element, with an inline style
from the content script. Input fields and background images are left alone:
those need their background.

## 🖍️ Current line

In an editable grid BC marks the row you are on only with an arrow and the ⋮
cell at the far left. The content script sets `data-bcb-row` on `<html>` in
every frame, once, and `content.css` does the rest:

- The row is `tr.real-current` in `table.ms-nav-grid-edit` (document lines in
  edit mode, journals) and in `form.ms-nav-cardform table.ms-nav-grid-view`
  (list parts in view mode). A list page's grid sits in `ms-nav-listform` and
  already fills the current row, so it is left alone.
- The tint is a 6% `background-image` gradient over each cell, not a new
  background colour, so BC's own cell colours stay underneath. Under Dark
  Reader (`data-darkreader-scheme="dark"`) it is lighter and a little stronger.
- It costs nothing at runtime: no listener, observer or poll, and it does not
  wake the content script's watch loop. Moving the current row through a
  103-column sales line took ~14 ms with and without the tint; that time is
  BC restyling its own grid.

After a BC update, open a sales order in edit mode and click through its lines:
the line you are on should carry the faint tint across its full width. If not,
check that the current row still has `real-current` and the grid
`ms-nav-grid-edit`.

## 📌 BC's own page settings

Maximize and Pin the action bar click BC's own controls, and change only BC's
default: never a page someone already set. BC stores those choices per page in
the client frame's `localStorage`, written only when someone (or BC Buddy's
click) changes them, so no key means the page shows BC's default.
`lib/bcstate.js` reads them:

| Setting | Key ends in | Field |
|---|---|---|
| Wide layout | `:Layout:<id>` | `PageLayoutExpanded` |
| Size of a task dialog | `:TaskDialog:Layout:<id>` | `PageLayoutExpanded` |
| List, tiles | `:<list id>` (no prefix) | `Layout` |
| Pinned action bar | `:TCB<id>` | `Pinned` |

The key starts with `<BC user name>:<environment>:`, which the content script
cannot rebuild (the URL often leaves the environment out), so a key matches on
its end. Both ids start with the page number as eight hex digits
(`0000001a-0000-0001-0c00-…` is page 26); the page number comes from
`form.ms-nav-root-form[data-page-id]`. A choice in another environment of the
same tenant therefore counts too, and BC Buddy errs on leaving the page alone.

The page's own pin is the button with `i[data-icon-name="Pin"]` (floating) or
`"Unpin"` (pinned) in `.ms-nav-layout-menubar`; a part such as order lines has
its own in `.ms-nav-band-header`, which is left alone. BC's default differs per
page, and a bar that shows pinned is checked again on later passes in case BC
lets it float after all.

Runtime cost: one query in the page on screen per pass, and one walk over the
`localStorage` keys the first time a page is seen.

After a BC update, open a card nobody pinned: it should open pinned, and a
`…:TCB<id>` key with `{"Pinned":true}` should appear. Unpin it, reopen it, and
it should stay unpinned. Do the same with the wide toggle and a `…:Layout:<id>`
key.

## 📐 Dropdown size

When a lookup opens, BC adds a `div.spa-view.spa-lookup` as a **direct child**
of a `div.spa-container`, inside the client frame. Its stylesheet
(`desktoppreview.css` on the BC CDN) caps that popup and three containers inside
it at `max-width: 532px; max-height: 238px`. The sizer lifts those caps per
dropdown; BC keeps positioning the popup itself — below or above the field,
moved left when it runs out of room — and does so before the first paint.

It runs while people type, so it is built to cost nothing:

- **A narrow observer.** It watches the direct children of each
  `.spa-container` and of `body` (to notice a new container), never a subtree.
  Cell edits, validation and row redraws never reach it. When both sliders are
  at BC standard, or the extension is off, nothing is attached at all.
- **No layout reads per dropdown.** BC writes each column's width on the header
  cell as `width: 15ex`. The sizer adds those up and converts once: on the first
  dropdown in a frame it measures what an `ex` is and what the row selector and
  the popup's edges add. After that, sizing a dropdown is string parsing —
  measured at 0–1.5 ms per open on a live client, the first one 3–27 ms.
- **Relative to BC.** BC's own caps are read from the first dropdown before the
  sizer marks it, and each step is a factor of them (width ×1 to ×2, height ×1
  to ×1.5). If BC changes its standard size, the steps follow.
- **Set once per open.** The width goes on the popup as a CSS variable when it
  appears and is not touched again, so it does not change while you scroll.
  `content.css` applies the variables only to popups carrying
  `data-bcb-dropdown`. Not inline on the form: BC reuses that element between
  opens, and an inline style would follow it.

Things that were tried and dropped: a pure-CSS fit (letting the grid tables size
to their content) made the popup change width while scrolling; measuring each
dropdown's natural width costs 2–10 ms per open, every time.

Only a list to pick from is sized: a popup that holds a grid (`isList()`). A
field you cannot edit — a page in view mode, a read-only field — opens a record
card in the same `.spa-lookup` popup instead. BC adds `.spa-preview-lookup` to
that card only *after* inserting it, so on arrival it is recognised by its
`.ms-nav-previewlookupform` and by having no grid; `content.css` also drops the
caps from anything that later carries `.spa-preview-lookup`.

Out of scope on purpose: option fields (a `select`) and fields with a **…**
button, which open a full page rather than a dropdown.

### After a BC update

All of this leans on BC's internal class names and on `ex` column widths, and it
fails safe: an unrecognised popup is left alone, and columns without `ex` widths
get the slider's maximum. The tests run against a trimmed copy of BC's markup in
`test-core.html`, so they cannot notice BC changing. After a BC release, check
by hand: open the item **No.** dropdown on a sales line — with the default
setting it should be clearly wider than BC's 532 px, with no horizontal
scrollbar.

If it is not, compare the live markup with the copy in the tests. With a lookup
open, select the client frame in the DevTools console's context menu and run:

```js
var l = document.querySelector('.spa-view.spa-lookup');
[getComputedStyle(l).maxWidth, getComputedStyle(l).maxHeight, l.parentElement.className,
  Array.from(l.querySelectorAll('table.ms-nav-grid-header-table thead tr:last-child th'),
    function (th) { return th.style.width; })];
```

## 📅 Week numbers in the date picker

BC's date picker is Fluent UI v9's `Calendar`, and BC does wire up Fluent's
`showWeekNumbers`: **Shift+Home** in an open picker toggles it (live client,
2026-10-11). BC stores the choice per user and environment, not per page, as
`<user>:<environment>:DatePicker` = `{"showWeekNumbers":true|false}`, and reads
it each time a picker opens; without the key the numbers are off.

`lib/weeknumbers.js` writes `{"showWeekNumbers":true}` under that key for every
user and environment that has none yet, and never touches a stored value, so
Shift+Home stays the user's switch. It is started and stopped by
`applyWeekNumbers()` in `content.js`.

The prefix comes from `BCState.prefixes()`: BC writes
`<user>:<environment>:NavBar` (the navigation bar's measured width) each time
it starts, so every such key names a user and environment that ran BC here.
An environment that starts for the first time while the tab is open is caught
by the `storage` event: BC writes from the client frame, and the content
script in the top frame hears it.

The numbers are BC's: `firstWeekOfYear` and `firstDayOfWeek` come from the
user's Region (`calendarWeekRule` in BC's formatting info). A Dutch region
gives ISO 8601 weeks, as `Date2DWY`; a US region need not. BC draws them as
`th.fui-CalendarDayGrid__weekNumberCell`, the first cell of each row, and
widens the picker from 220 to 250px. Its label for that cell reads
"Weeknummer undefined", a gap in BC's own strings.

Runtime: one walk over the `localStorage` keys when the switch turns on or a
page loads, and a suffix check on each `storage` event, which BC raises a few
times per session. Nothing runs in the picker itself.

After a BC update, remove the `…:DatePicker` key, reload, and open a date
picker: the week numbers should be there, and Shift+Home should still turn
them off and write `{"showWeekNumbers":false}`.

## 📋 Copy values

`lib/copyvalues.js`, started and stopped by `applyCopyValues()` in
`content.js` like the dropdown sizer: attached once when the switch turns on,
detached when it turns off, one comparison per `apply()` otherwise.

It is the one place with a document-wide pointer listener, which the
performance rules otherwise forbid; a hover icon has to know what is under the
pointer. It is kept as small as it can be:

- one passive `pointerover` listener per frame, only while the switch is on.
  It fires when the pointer crosses into another element, not per pixel. The
  handler does one `closest()` and resets one timer; no style or layout reads;
- after 300 ms of rest it checks the cell and reads its one
  `getBoundingClientRect()`, then moves the icon with a `transform`;
- the icon is one `button#bcb-copy` per frame, our own, in `body`. Nothing is
  written into BC's cells or onto its elements;
- `scroll`, `keydown`, `pointerdown` and `pointerout` listeners exist only while
  the icon shows, and hide it.

Which cells qualify (live client, 2026-10-11): `.edit-container-read` with a
`.stringcontrol-read.value` inside, not `.empty`, `.ms-nav-hidden` or an
`.empty-anchor-link`, inside `table.ms-nav-grid-data-table` or
`.ms-nav-layout-factbox-content-area`, and not in a `.spa-lookup` dropdown.
That covers `td` grid cells and FactBox `div`s. Card fields use the same markup
in a FastTab (`.collapsibleTab`); there only a value that is a link
(`a.stringcontrol-read.value`, e.g. Balance (LCY)) qualifies, since plain text
can be selected with the mouse. Editable card fields also carry
`.edit-container-read` but hold an `input` or `select`, never a value element. Editable cells are `.edit-container` without
`-read`, with an `input`. A `.right` cell (amounts) gets the icon on the left,
just before the text; every other cell gets it at its right edge. The text is
measured with a `Range` over the value (one more rect read): in lists and
FactBoxes the value is an `inline-block` as wide as its text, but on a card it
is a `block` as wide as the field.

What is copied is `value.textContent.trim()`: the full text even when CSS cuts
it off, without a layout read. Not `title`: on a link it is an action ("Record
10000 openen"), on an amount it adds the currency. The clipboard is
`navigator.clipboard.writeText()` (allowed in BC's client frame, same origin);
on-prem over plain HTTP it falls back to a hidden `textarea` and
`execCommand('copy')`.

To look at the markup again on a live page:

```js
var f = [...document.querySelectorAll('iframe')].map(x => x.contentDocument).find(d => d && d.querySelector('table'));
[...f.querySelectorAll('.edit-container-read')].slice(0, 5).map(c => [c.tagName, c.className, !!c.querySelector('.stringcontrol-read.value')]);
```

## 🔗 URL parsing

Both BC SaaS and on-premises URLs are recognised, following the shape from
[Microsoft's documentation](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-web-client-urls):
`https://<host>[/<aadtenantid>][/<environment>]/?[company=...]&[tenant=...]`.
Tenant and environment are both optional; the tenant is a GUID or a domain name.
On-prem the server instance sits where the environment would be
(`/BC240/?company=...`) and the tenant comes from the query.

## 🛡️ RegEx conditions

A `regex` condition runs a pattern that came from the user or from a shared
file, so `safeRegexTest()` in `match.js` bounds it: the pattern is capped at 200
characters, the subject at 2048, and patterns are rejected when a group or class
is quantified while its body already holds a quantifier — `(a+)+` — or when a
quantified group contains alternation — `(a|a)+`. Anything rejected fails
closed: the condition simply does not match, exactly as a syntax error does.

That filter misses ungrouped quantifiers, and the length caps alone do not
bound those: `.*.*.*.*.*.*Q` kept a tab busy for 45 s on a 100-character URL.
So every pattern also gets a backtracking budget (`REGEX_BUDGET`). Each
quantifier multiplies an estimate by the lengths it can take — 2 for `?`, the
range for `{n,m}`, the subject's length for `*`, `+` and `{n,}` — and an
unanchored pattern is multiplied by the subject's length once more, for every
start position. Over the budget, the pattern fails closed on that subject. A
leading or trailing `.*` is dropped first, since it changes nothing for
`test()`, so `.*CRONUS.*` costs no more than `CRONUS`. At the budget the worst
pattern measured takes about 60 ms in Chrome; real patterns run in well under
1 ms. `regexProblem()` gives the reason (`invalid` or `heavy`), which the
options page shows on the condition.

The estimate is an upper bound, so it refuses some patterns that would run
fast, such as `[^/]+/[^/]+/Sandbox` on a URL over 256 characters; anchoring
with `^` lifts that. Deciding whether an arbitrary pattern backtracks
catastrophically is not possible from a source scan, so it errs that way.

The content script keeps the matched rule until the URL or the rules change,
so a pattern runs once per page, not on every pass of `apply()`.

## 📄 Import format

The extension reads only its own format: an object with a `rules` array and
optionally a `layouts` array (as the export produces), or a bare array of rules.
A file naming a different `app` is rejected.

A file with no layouts derives none: after the merge, `normalize()` points its
rules at the importer's own first layout. Display fields on a rule in the file
are ignored — appearance only travels in a `layouts` array.

Importing merges both lists (layouts first, then rules): same id (else same
name) overwrites in place, new items are added, items missing from the file are
left alone. Layouts go first so rules can point at something that already
exists.

An optional `webClient` object carries the Web client settings, shaped as they
are stored (`{ "maximize": { "enabled": true }, "dropdown": { "width": 5,
"height": 1 }, … }`). `readWebClient()` keeps only the settings the file names,
so a file can share just one; a file without the object reads as `null` and
changes nothing. An import by hand applies them (`applyWebClient()`). A sync
treats them as defaults (`applySharedWebClient()`): `hosted.webClient` keeps
what the file said last time, and only a setting whose value in the file
changed since then is passed on, so a colleague's own choice survives the
daily sync. Clearing the shared rules forgets it, so the next sync applies the
file's settings again.

### Shared file set by policy

IT can set the shared file's address by browser policy: `sharedConfigUrl` in
`chrome.storage.managed`, declared in `managed_schema.json` (Windows registry:
`HKLM\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\<id>\policy`, and
`Google\Chrome` likewise). The policy itself is never stored. The service
worker reads it on install, at browser start and when it changes, and
`applyPolicy()` writes the address into `hosted.url` with `active` on; the
usual settings change then starts the sync. It runs again whenever the address
or `active` changes, so a write from an options page cannot undo it. The
options page reads the policy too, only to lock the field, hide the clear
button and show *Set by your organisation*. A value that does not resolve to
HTTPS is ignored. Removing the policy changes no settings: the field unlocks
and the address and shared rules stay.

`syncIntervalMinutes()` sets the alarm: daily once the file has loaded, hourly
while it never has or the last try failed, so a laptop that was offline when
the policy arrived does not wait a day. A force-install (`installType`
`admin`) does not open the options page on first install.

Nothing of this runs in BC tabs: only the service worker and the options page
read managed storage.

The manifest keeps `<all_urls>`: an on-premises server has no address the
extension could list in advance. IT, who knows those addresses, narrows it with
Chrome's `ExtensionSettings` policy instead: `runtime_blocked_hosts: ["*://*"]`
and the BC hosts plus the shared file's host in `runtime_allowed_hosts`
(`examples/intune/extension-settings.json`, documented in `docs/sharing.md`).
Content scripts then no longer run anywhere else. Nothing in the code depends on
it; the extension simply never sees the other sites.

### Where the web client tweaks run

`state.webClient`, worked out by `webClientHere()` once per `apply()`, decides
it for every tweak. Two things must hold:

1. **The address looks like Business Central** (`isWebClientTarget()`):
   `*.dynamics.com`, a host name with a label starting with `bc`, or a path
   starting with `/bc`. That is cheap and catches the usual on-prem shapes, but
   also sites such as `www2.gov.bc.ca`.
2. **The page is Business Central.** On BC online (`ctx.isbc`) the host says
   so. Anywhere else the document must hold one of BC's own classes,
   `designer-client-frame` (the client's frame, in the top window) or
   `spa-container` (where its pages stack, inside that frame), or the ribbon
   search must have found the brand name (`state.bcSeen`).

When only the address matches, `probeForBC()` looks for those classes on a
timer instead of waking the observer and the poll: every second, then every
2 s after 10 s. It stops at once when they appear, and gives up 10 s after the
page's load event (or after the address changed, for a page that loaded long
before), within a minute in any case. The client builds its frame with script
as the page finishes loading, so later than that it is not coming: a
look-alike page gets about ten looks, then none for that address. A BC page
that does turn up later is still caught when a rule matches it, because the
800 ms poll that keeps its colours checks again on every pass. It reads two live `getElementsByClassName`
collections made once, which the browser answers from cache while the page
does not change (measured: 0.003 ms, against 2.3 ms for one `querySelector`
over 60,000 elements). Before this, a look-alike address woke the full
observer and the 800 ms poll for good.

A frame of BC that holds neither class, such as an add-in's frame, gets no
tweak, which none of them needs. On-prem has the same client, so the same
classes; that was reasoned from the shared code, not seen on a live server.

## 🧩 Adding a web client tweak

Every tweak follows the shape of the existing ones: a switch in the Web client
panel, off when the extension as a whole is off, limited to frames where
`state.webClient` is true, and CSS first wherever CSS can do it. A CSS rule
that stops matching after a BC update does nothing; a script that clicks the
wrong thing does damage. A new one brings along:

- **Settings.** One `{ enabled }` object in `normalizeWebClient()`
  (`settings.js`), like `maximize` and `highlightRow`, with an `…On(settings)`
  helper that also checks `settings.enabled`. Add its key to
  `WEB_CLIENT_KEYS`, so it travels in an export and in the shared file.
- **Options.** One card in the Web client panel (`options.html`,
  `options.js`), with strings in `_locales/en`, `_locales/nl` and `_locales/fr`.
- **Content script.** One `apply…()`, called from `apply()` in `content.js` and
  undone in `clearAll()` or when its switch goes off. `shouldWatch()` wakes the
  watch loop only for a tweak that keeps acting on BC, as Maximize does; one
  that is set once (the row tint) stays out of it. See *Performance* in
  `CLAUDE.md`.
- **Tests.** Normalisation defaults in `tests/test-core.html`, and an options
  check in `tests/test-options.html`.
- **Docs, in the same commit** (see `CLAUDE.md`): a line under `## Unreleased`
  in `CHANGELOG.md`, a row in the table under README *Web client* together
  with a section in `docs/web-client.md` (and a bullet in step 2 of
  `docs/getting-started.md` if it is on by default), and a troubleshooting
  entry where a feature can visibly fail.
- **Live check.** Try it against a current BC online client and one on-prem
  version before it ships.

## 🌍 Adding a language

The texts live in [`_locales/en/messages.json`](_locales/en/messages.json),
[`_locales/nl/messages.json`](_locales/nl/messages.json) and
[`_locales/fr/messages.json`](_locales/fr/messages.json); `en` is the default and
the fallback. Adding a language comes down to a new folder with the same keys.
The folder name has to be one the Web Store accepts — `fr`, `pt_BR`, with an
underscore rather than a hyphen — because upload rejects anything else.

English is the source language, and its file carries a `description` per message
for whoever translates it: what `$1` gets replaced with, which terms come from
Business Central, and which words mean something other than they appear to. A
message that uses a placeholder must have one; the tests insist. Write it when
you add the message, not when somebody asks.

The tests read every folder under `_locales/` rather than a fixed pair, so a new
language is covered the moment it exists. They check the folder name, the
encoding (UTF-8, no BOM), that the keys match `en` exactly, that every message
has text, that the placeholders survive translation, that English explains its
own placeholders, that a language is translated rather than copied, and that the
store description stays under 132 characters — the Web Store rejects a package
whose description is longer, per locale. Anything identical to the English is
printed as a `NOTE`, which fails nothing but is worth reading.

What no check can settle — the Business Central terminology, the false friends,
and how to be sure a translation is right in a language you do not read — is in
[TRANSLATING.md](TRANSLATING.md).

## 🎨 Logo and icons

The mark is the letter pair **BC** with a bite taken out at the bottom right
where a sphere rests against it. Colours come from the
[control add-in style guide](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-control-addin-style):
Primary `#00B7C3` for the sphere. The setting is Segoe UI Semibold.

The letters are lighter than the Secondary `#505C6D` from that guide: `#737C8A`.
The icon sits in the toolbar, and that is light or dark depending on the browser
theme — a fixed PNG cannot adapt to it. With `#505C6D` the contrast on a dark
toolbar reached only 1.8:1; `#737C8A` is the shade in that range with the highest
lowest contrast (2.9:1 on both light and dark). On the options page the Secondary
still applies: that SVG is inline and follows the theme through `--brand-mark`.

Every size comes from `logo.svg`: in the toolbar, on the extensions page and on
the options page the same mark belongs. At 16 px that is tight — a simplified
variant keeping only the C and the sphere was tried and dropped — but
recognisability weighs heavier.

```bash
powershell -ExecutionPolicy Bypass -File icons/build-icons.ps1
```

That renders the SVG at 512 px in headless Chrome and scales it back to
`icon16/32/48/128.png`. The letters are rasterised along with it, so the
extension does not depend on Segoe UI being present on the user's machine.

The same script also writes `store-icon128.png`. That one follows different
rules: the Web Store wants the mark within 96x96 on a 128x128 canvas, with 16 px
of transparent padding around it, because the store draws its own frame and
shadow around the image. In the toolbar the opposite applies, so it is a separate
file and not a replacement for `icon128.png`. It does not go into the package
either; you upload it in the dashboard.

## 🧪 Tests

The test pages run the real source in headless Chrome (or Edge): parsing URLs,
matching rules, the tokens, building the options page, and what the
content script actually does to the DOM (rewriting and colouring the ribbon, the
frame, the corner ribbon, the title, the favicon). The dropdown sizer runs
against a trimmed copy of BC's lookup markup and its caps; see
[After a BC update](#after-a-bc-update) for what that copy cannot catch.

```bash
powershell -ExecutionPolicy Bypass -File tests/run-tests.ps1
```

You can also just open the pages in a browser; `test-core.html` works anywhere,
while `test-options.html` fetches the HTML and needs the
`--allow-file-access-from-files` flag for that (the runner already sets it).

The runner passes the folder names under `_locales/` along in the URL, because a
page cannot list a directory: that way a folder with a name the Web Store would
reject still reaches the checks instead of being skipped. Opened by hand the
page probes for the locales it knows about instead, which finds every valid one.

The runner looks for a browser in this order: `CHROME_PATH` if set, then the
usual Windows install paths for Chrome and Edge, then `chrome`,
`google-chrome`, `chromium` and `msedge` on `PATH`. Set `CHROME_PATH` when your
browser lives somewhere else — it beats editing the list.

## 🤖 Continuous integration

Three workflows. The two that touch the extension itself run on
`windows-latest`, because the runner scripts are PowerShell and the image ships
Chrome and Edge; the one that builds the website runs on `ubuntu-latest`.

[`.github/workflows/tests.yml`](.github/workflows/tests.yml) runs the suites on
every push to `main`, on pull requests, and on demand. `run-tests.ps1` exits 1
when a check fails or a suite renders no results, so the step fails by itself —
no extra reporting glue.

[`.github/workflows/release.yml`](.github/workflows/release.yml) is started by
hand from the Actions tab and does everything a release needs. See
[Releasing](#-releasing) below.

It is one workflow rather than two on purpose. A push made with `GITHUB_TOKEN`
does not trigger other workflows, so a tag pushed from a job would never start a
tag-triggered job: the release would silently produce nothing. Everything
therefore happens in this one run, split over jobs that each get only what they
need:

| Job | Gets | Does |
|---|---|---|
| `release` | the deploy key (`RELEASE_SSH_KEY`), GitHub's own actions only | tests, versions, builds, commits, tags, pushes; hands the ZIP and notes on as an artifact, its SHA-256 as a job output |
| `github-release` | `contents: write`, the artifact | runs `softprops/action-gh-release`, the one third-party action |
| `store` | the `CWS_*` secrets, the artifact | checks the ZIP against the SHA-256, uploads to the Web Store |
| `site` | Pages permissions | builds the site from the tag (`pages.yml`) |

The split is a supply-chain measure. The deploy key may push to `main` past the
ruleset, and the store upload reaches every installed copy, so neither may sit
on a runner where a third-party action has run: such an action could rewrite
files, `GITHUB_ENV` or `GITHUB_PATH` for every later step of its job. The
workflow token is read-only except in `github-release`. `github-release` and
`store` run side by side after the push; the hash is what keeps an artifact
replaced in the meantime from reaching the store.

Every action is pinned to a full commit SHA, with the version in a trailing
comment (`@3d3c42e… # v7.0.1`). A tag can be moved to other code; a commit
cannot. Dependabot understands this form and bumps SHA and comment together.

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds and deploys
the website. Release calls it as a reusable workflow for the same reason: a
`release` event raised with `GITHUB_TOKEN` starts nothing either. See
[Website](#-website) below.

### Dependency updates

[`.github/dependabot.yml`](.github/dependabot.yml) watches the only two things
here that come from somewhere else: the actions the workflows call, and the two
packages in `tools/requirements-docs.txt`. The extension ships no runtime
dependencies at all — `src/lib/` is our own code — so there is nothing else to
track, and that is worth keeping true.

Action bumps arrive as one grouped pull request a month, which `tests.yml`
checks like any other. They change a commit SHA, so check that the comment
beside it names a real release of that action. Read them anyway before merging: `release.yml` and the
Pages deploy do **not** run on pull requests, so a bad bump to
`softprops/action-gh-release`, `upload-pages-artifact` or `deploy-pages` would
only show up at the next release. The pip entry stays quiet by design, because
the requirements are pinned to a range; it earns its place through the security
alerts rather than through version bumps.

Alerts for known vulnerabilities are a separate switch, under Settings →
Advanced Security, and do not come from this file.

## 🐢 Turn off animations

BC does not honour `prefers-reduced-motion`. The content script sets
`data-bcb-calm` on `<html>` in every frame, once, and two pieces do the rest:

- `content.css` shortens CSS transitions and animations to `0.01ms` (not
  `none`, so `transitionend` and `animationend` still fire) and zeroes their
  delays. It targets stable classes only: `.animate`, the `ms-nav-layout-*`
  regions that Maximize and the FactBox pane move, FastTab captions and
  fields. The busy indicator and spinners are left out.
- FastTabs slide with `element.animate()` (500 ms on `margin-top`), and BC
  waits for it to finish before it marks the FastTab open or closed.
  `calm.js` runs in the page's own world (`"world": "MAIN"`, Chrome 111+) and
  wraps `Element.prototype.animate` to use a duration of 0 while the
  attribute is set; animations with infinite iterations keep their timing.
  It patches nothing until the attribute first appears, so other sites only
  carry one attribute-filtered observer on `<html>`.

Runtime cost: one attribute per frame, class-keyed CSS, and one
`hasAttribute` per `animate()` call (on a card, only FastTab toggles call it).
After a BC update, open a card, toggle a FastTab, Maximize and the FactBox
pane (I), and log `transitionrun` and `getAnimations()` for anything slow.

## ⚙️ Gear menu

In BC online the gear icon opens the Settings pane of the Microsoft 365 shell.
That pane is in the **top window**, not in BC's client iframe, and it is built
from scratch on every open: `div#FlexPane_Overflow_Container` is added as a
direct child of `body` and removed again on close. Inside it,
`div#O365_Settings_navbardatalinks` holds the *Dynamics 365 Business Central*
section; `gearmenu.js` inserts `#bcb-gear-section` right after it, above
*Microsoft 365*.

- **No hard-coded classes.** The shell's class names are hashed and change with
  its releases. The section copies, element by element, the classes of BC's own
  section (heading, list, link) and the divider of the Microsoft 365 section, so
  it looks native on whatever release is live. Ids are not copied.
- **Cost.** One `childList` observer on `body` (no subtree), top window only,
  where `state.webClient` is true. Only while the pane is open, a second observer
  watches the pane's own subtree — a few dozen elements — because the shell can
  switch between Settings, Help and Notifications without closing it.
- **Always on.** It does not follow the extension's on/off switch and has no
  switch of its own: when BC Buddy is off, this link is the quickest way back.
- **Opening the options.** A content script cannot call
  `chrome.runtime.openOptionsPage()`, so the link sends `bcb:open-options` to
  the service worker, which accepts it from a content script; messages that
  change something, such as `bcb:sync`, must come from an extension page. The link ignores clicks and
  keys with `isTrusted` false, so the BC page itself cannot open the options.

On-prem has no Microsoft 365 shell; there the `body` observer never finds a
pane. After a shell update, open the gear menu and check that **BC Buddy** sits
between the two sections with the same heading and link style. If it is gone,
compare the live markup with `gearPane()` in `test-core.html`:

```js
var a = document.getElementById('O365_Settings_navbardatalinks');
[!!document.getElementById('FlexPane_Overflow_Container'), !!a,
  a && a.outerHTML.slice(0, 600), a && a.nextElementSibling.outerHTML.slice(0, 300)];
```

## ⌨️ Keyboard shortcuts

`shortcuts.js` adds a keyboard button to BC's top bar and opens a panel with
the shortcuts for where the cursor is.

- **Where.** BC online shows the client in `iframe.designer-client-frame`,
  same origin, under the Microsoft 365 top bar. Icon and panel live in the top
  window; the panel reads the client's document directly. The icon goes just
  before `#O365_MainLink_Help_container` and copies its classes and those of
  the Help button, element by element, like the gear menu section does.
- **What it lists.** *On this page* is read when the panel opens: BC ends an
  action's tooltip with its shortcut, `"... (F9)"`, and `tooltipKey()` takes
  that. It is right for the BC version, the language and any extension, but
  only sees rendered actions; a closed submenu is not in the DOM. The rest
  comes from `SETS`: short, hand-picked lists from Microsoft's
  *Keyboard Shortcuts* article, only shortcuts BC has had for years. Keep
  them short; the panel links to Microsoft's article for everything else.
- **Where the cursor is.** `context()` looks at the client's
  `activeElement`: an editable grid, a view grid, a card, a date field (an
  input with BC's `.icon-Date` button beside it). The button cancels its own
  `mousedown`, because BC drops the field focus as soon as its frame loses
  focus; the panel then takes the focus and gives it back on close.
- **Cost.** One observer on the top window's `body` (subtree) while the
  switch is on: BC's grids live in the iframe's document, so the top window
  changes rarely, and each change costs one `getElementById`. Panel, page
  scan and key badges exist only while the panel is open, and so do its
  `pointerdown` listeners. No key listener in the page.
- **Browser shortcut.** The manifest declares a `show-shortcuts` command
  without a default key, so it never takes one from BC. Someone who sets a
  key gets `chrome.commands.onCommand` in the service worker, which sends
  `bcb:toggle-shortcuts` to the tab's top frame. On-prem, without the
  Microsoft 365 top bar, that key is the only way in.

## 🔑 Permissions

- `storage` — keeping settings.
- `alarms` — checking the shared file periodically.
- `storage.managed_schema` is not a permission and shows no warning, so adding
  a policy key does not hold up the automatic update. `chrome.management.getSelf`
  needs no permission either.
- `<all_urls>` — rules may match on any URL (on-premises servers included), and
  the shared JSON file can live anywhere.

The broad host permission is deliberate and comes at a price: the Web Store
flags it for a more thorough review, and Chrome shows "read and change all your
data on all websites" at install. It was kept anyway, because `activeTab` only
grants access after an explicit click on the extension icon — while BC Buddy has
to mark automatically at `document_start` — and a fixed host list cannot cover
on-prem, which runs on the customer's own host name.

To narrow it later: restrict `host_permissions` to
`https://businesscentral.dynamics.com/*`, add `optional_host_permissions` for
the rest, register content scripts dynamically with `chrome.scripting`, and put
a button on the options page for an on-prem user to grant their own host. That
is a behaviour change, not a manifest tweak.

## 🚀 Releasing

Cutting a release is one button: **Actions → Release → Run workflow**, on
`main`. Pick how the version should move (`patch` / `minor` / `major`, or type
an exact one), and what should happen at the store.

The workflow computes the version, writes it into `manifest.json`, dates the
`Unreleased` section of `CHANGELOG.md`, builds the package, commits, tags,
publishes a GitHub release with the ZIP attached, and optionally uploads to the
Chrome Web Store. Because it sets both the manifest version and the tag, the two
cannot disagree — the old failure of a `v1.0.2` tag carrying a package that
declares `1.0.1` is not reachable any more.

The step order is deliberate:

1. **Tests run before the version is touched**, so a red `main` cannot leave a
   bumped manifest behind.
2. **Nothing is pushed until the package is built and verified.** The ZIP's own
   `manifest.json` is read back and compared with the expected version; if the
   build or that check fails, `main` is untouched and the version is still free.
3. **The store upload happens after the push**, in its own job, beside the
   GitHub release. The Web Store refuses a version it already holds, so a
   version number cannot be retried. A failure anywhere before the push costs
   nothing; a failure in the store job costs that number and you release again
   with the next one. A failed GitHub release job can simply be re-run.

A version must be one to four dot-separated integers, each 0–65535 — Chrome
takes no suffix, so `1.2.0-rc.1` is not a version you can ship. The workflow
also refuses a version that is not above the current one.

### Release notes

[`CHANGELOG.md`](CHANGELOG.md) is written by hand, for users. Every change
people notice gets a line under `## Unreleased` in the commit that makes it;
dependency bumps, CI work and refactoring get nothing. On release the workflow
renames that heading to the version and today's date, appends an empty
`## Unreleased` above it, and passes the section to the GitHub release as its
body. The file is also the site's *What's new* page, through the same
`pymdownx.snippets` include used for the privacy policy.

The site gets only part of it. `CHANGELOG.md` carries a marker line:

```markdown
<!-- --8<-- [start:released] -->
```

and `docs/whats-new.md` includes `CHANGELOG.md:released`, which is everything
from that marker to the matching `[end:released]` at the bottom of the file. The
release workflow keeps `## Unreleased` above the marker and writes each new
version below it, so two things follow. Notes waiting for a release never reach
the site — the same rule the whole site is built on. And the empty `Unreleased`
heading is not published: the site is only ever built from a release tag, which
is precisely the commit where the workflow has just emptied that section, so
otherwise every deploy would carry a bare heading and a dead entry in the page's
table of contents.

The workflow matches on the marker as well as on the heading. A marker that has
been moved or deleted fails the release rather than quietly publishing notes on
the wrong side of the line.

Writing them by hand is the point. `generate_release_notes` produced a list of
merged pull requests — accurate, in the wording of whoever wrote the code, and
led by whatever Dependabot happened to bump that week. Deciding what is worth
telling people is a judgement, and it is cheapest to make while the change is
fresh rather than on release day.

An empty `Unreleased` section does not fail the run: a release cut for a
dependency or a store requirement is legitimate. It logs a warning and the notes
read *Maintenance release*.

### Draft or publish

`store: draft` (the default) uploads the package and leaves it as a draft: the
version already published stays live, and you submit from the dashboard when you
are ready. `store: publish` uploads and submits for review. `store: none` skips
the store entirely and only produces the GitHub release.

Draft is the default because with `<all_urls>` the review queue is slow anyway,
so auto-submitting saves a minute and costs the chance to catch a bad upload
before it enters review.

Either way the store still reviews it. A green workflow run does not mean users
have the update.

### One-time setup: letting the workflow push to main

The workflow commits the version bump to `main`, which a protected branch will
refuse. Grant the bot an exception in a **repository ruleset** (Settings →
Rules → Rulesets): open the ruleset guarding `main`, and under **Bypass list**
choose *Add bypass* → **Repository admin** and the **GitHub Actions** app.

Classic branch protection has no equivalent — its bypass list does not accept
`GITHUB_TOKEN`. If the repository still uses classic rules, either convert them
to a ruleset (Settings → Branches offers this) or give the workflow a personal
access token instead of the built-in one. The ruleset is the smaller change.

`permissions: contents: write` in the workflow is required as well, and is
already set.

### One-time setup: the Chrome Web Store secrets

The API can only *update* an item that already exists, so **the first
submission has to go through the dashboard by hand**. Do that first; only then
is there an item ID to automate against.

Four repository secrets are needed (Settings → Secrets and variables → Actions
→ *New repository secret*):

| Secret | Where it comes from |
|---|---|
| `CWS_EXTENSION_ID` | The 32-character id of your item, from its dashboard URL |
| `CWS_CLIENT_ID` | Google Cloud OAuth client |
| `CWS_CLIENT_SECRET` | Same client |
| `CWS_REFRESH_TOKEN` | `tools/get-cws-token.ps1`, below |

In the [Google Cloud console](https://console.cloud.google.com/):

1. Create or pick a project.
2. **APIs & Services → Library →** enable the **Chrome Web Store API**.
3. **OAuth consent screen →** User type *External*. Fill in the app name,
   support email and developer contact. Then **publish it — set it to "In
   production"**. This is the step people skip: while the screen is in
   *Testing*, Google expires refresh tokens after seven days and the workflow
   starts failing with an opaque `invalid_grant`.
4. **Credentials → Create credentials → OAuth client ID →** application type
   **Desktop app**. Copy the client id and client secret.

Then swap those for a refresh token:

```bash
pwsh -File tools/get-cws-token.ps1 -ClientId <id> -ClientSecret <secret>
```

It opens a browser, catches Google's redirect on `localhost`, and prints the
refresh token. Google will warn that the app is unverified — expected for an app
only you use; choose *Advanced* and continue. The script prints the token and
writes nothing to disk, so it cannot be committed by accident.

Sign in with the account that **owns the store item**. A refresh token belongs
to the account that granted it; one from a different Google account will
authenticate fine and then fail on the item as "not found".

### The package

The ZIP the workflow uploads is the one this produces locally too:

```bash
powershell -ExecutionPolicy Bypass -File tools/build-package.ps1
```

That puts `dist/bcbuddy-<version>.zip` in place with only what the extension
needs: manifest, `managed_schema.json`, `src`, `_locales` and the PNG icons. Tests, examples, the SVG
sources and these tools stay behind. The script checks that `manifest.json` ends
up in the root of the ZIP, which is the usual silent upload rejection.

The listing copy sits in [`store/description-nl.txt`](store/description-nl.txt)
and [`store/description-en.txt`](store/description-en.txt), and the screenshots
in `store/`. For the privacy practices tab at submission — single purpose and a
justification per permission — and for the privacy policy URL the store points
at, use [`PRIVACY.md`](PRIVACY.md) — the store field takes a URL, so point it
at <https://fvet.github.io/bcbuddy/privacy/>, which is that same file published
by the site.

## 🌐 Website

[fvet.github.io/bcbuddy](https://fvet.github.io/bcbuddy/) is built from `docs/`
with [MkDocs](https://www.mkdocs.org/) and the
[Material](https://squidfunk.github.io/mkdocs-material/) theme. Configuration is
in [`mkdocs.yml`](mkdocs.yml); the pages are plain Markdown.

Preview it locally:

```bash
pip install -r tools/requirements-docs.txt
mkdocs serve
```

That serves on `http://127.0.0.1:8000/bcbuddy/` — under the same path as GitHub
Pages, because `site_url` carries it — and reloads as you edit. `site/` and
`.cache/` are build output and are ignored.

### When it goes live

**On a release, and not before.** Documentation lands on `main` well ahead of the
release that ships the feature, and a site that describes a button nobody has yet
sends people looking for something that is not there. Erring behind the
extension is cheap; erring ahead of it is a support message.

`pages.yml` therefore has three ways in:

| Trigger | What happens |
|---|---|
| Called by `release.yml` | Builds from the tag that run created, then deploys |
| Pull request | Builds only, so a broken link fails review, not release day |
| Run by hand | Builds and deploys — for a correction that should not wait |

The manual run is the escape hatch. Release-gating is right for feature
documentation; it would be silly if fixing a typo or a privacy line needed a
store submission.

Note that even a deployed site is not in step with what people have installed:
the store still reviews the upload, and Chrome rolls updates out over days.
"Never ahead" is achievable, "exactly equal" is not.

### Files from outside docs/

Screenshots live in `store/` because the store listing is built from there, and
`examples/bc-buddy.json` is the shared configuration people point at.
[`tools/mkdocs_assets.py`](tools/mkdocs_assets.py) is an MkDocs hook that adds
those originals to the build instead of keeping a second copy in `docs/`. It
registers them as files rather than copying them in afterwards, so `--strict`
still catches a page pointing at a screenshot that has been renamed.

`docs/privacy.md` and `docs/whats-new.md` are one-line includes of
[`PRIVACY.md`](PRIVACY.md) and [`CHANGELOG.md`](CHANGELOG.md) through
`pymdownx.snippets`, for the same reason: the policy and the release notes on
the site cannot drift from the ones in the repository. Both are files that get
edited in a hurry, which is exactly when a second copy is forgotten. The
changelog include takes only its `released` section — see
[Release notes](#release-notes) for why.

The rest of the pages are their own copy of what the README covers. Single
sourcing that too was possible and not worth it — the README is a pitch that
ends in a link, the site is eight pages with a navigation.

### One-time setup: turning Pages on

**Settings → Pages → Build and deployment → Source: GitHub Actions.** Without
that, `deploy-pages` fails with a message about Pages not being enabled; the
default ("Deploy from a branch") looks for committed HTML, which this repository
does not have.

Nothing is published until the first deployment runs, and deployments run on
release. To put the site up before the next one, start the **Site** workflow by
hand from the Actions tab.

## 📄 Licence

MIT, in [`LICENSE`](LICENSE) at the root of the repository. There is no CLA: a
contribution is offered under the same terms as the rest of the project, which
is what opening a pull request against a public repository already means.

The licence text carries a copyright year. It is the year the notice was written,
not a range to keep current — MIT does not require it to move, and a yearly
commit that changes nothing else is noise.
