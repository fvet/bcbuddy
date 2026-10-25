# Development

Working on BC Buddy itself. For what the extension does and how to use it, see
[README.md](README.md). Ideas not built yet, with what is known about them, are
in [IDEAS.md](IDEAS.md).

## 📁 Structure

```
manifest.json
managed_schema.json    the browser policies IT can set (shared file address,
                       area switches, Help & feedback)
_locales/              en (default), nl and fr; see TRANSLATING.md
src/
  background.js        service worker: synchronises the shared file, puts
                       policy and shared locks back after every write,
                       opens the side panel and the options page
  lib/i18n.js          fetching translations
  lib/match.js         parsing URLs, matching rules, tokens, colour helpers
  lib/settings.js      storage, defaults, normalisation, import/export
  lib/dropdowns.js     dropdown size: sizes BC's lookup dropdowns
  lib/panes.js         resize panes: drag handles on BC's side panes
  lib/bcstate.js       reading the choices BC stores per page (localStorage)
  lib/maximize.js      maximize: wide layout and list view on BC's own controls
  lib/actionbar.js     pin the action bar on BC's own pin button
  lib/factbox.js       hide the FactBox pane on BC's own toggle
  lib/copyvalues.js    copy values: the copy icon on read-only values
  lib/weeknumbers.js   week numbers in the date picker
  lib/errorreport.js   Report a problem link in BC's error dialogs
  lib/shortcuts.js     the BC Buddy icon in the top bar, the floating
                       shortcuts panel and the feed for the side panel
  sidepanel/           the browser side panel: start view and keyboard
                       shortcuts (sidepanel.js), Help & feedback (help.js)
  support/             Help & feedback's area selection and drawing editor,
                       injected into the tab only while one runs
  content/content.js   draws frame, banner, ribbon, title and favicon;
                       starts maximize, the dropdown sizer, the pane
                       handles, the copy icon, week numbers, the row tint,
                       the BC Buddy icon in the top bar
  content/content.css  the accompanying styling
  content/calm.js      page-world half of Turn off animations (FastTabs)
  options/             options.html/css; options.js plus helpers, cards, hosted;
                       theme.js: light or dark for the options page
examples/              bc-buddy.json: the samples Load samples adds, and the
                       example of a shared configuration (schema version 3);
                       intune/: scripts and a .reg file that set the policy
                       for IT, and the ExtensionSettings value that limits
                       its hosts
tests/                 test pages + runner
icons/                 logo.svg, build-icons.ps1, the PNGs;
                       settings/: one SVG per Web client setting
tools/                 build-package.ps1: the ZIP for the store;
                       get-cws-token.ps1: one-off OAuth setup for releases;
                       mkdocs_assets.py, mkdocs_nav_icons.py and
                       requirements-docs.txt: the website;
                       check-shortcut-docs.mjs: shortcuts against Microsoft's article
store/                 listing copy and screenshots
docs/                  the website (its mkdocs.yml lives in the root)
```

## 📦 Settings model

Stored settings use schema version 3 (`SCHEMA_VERSION` in `settings.js`).
Exports carry `"app": "bc-buddy"` and `"version": 3`.

There is no switch for the whole extension. Each area has its own, checked
through `webClientOn()`, `environmentsOn()` and `feedbackOn()`, which count
only a stored `true`:

- `webClientEnabled` — the Web client tweaks and the keyboard shortcuts. On
  for a new install.
- `environmentsEnabled` — own and shared rules, on every site. Off for a new
  install, so nothing gets coloured until someone (or IT) turns it on.
- `feedbackEnabled` — Help & feedback in the side panel. Off by default.

- A **rule** holds identity and matching: `id`, `name`, `conditions`,
  `color`, `styleId`, and `favicon.text` (at most two letters). Appearance
  fields no longer live on the rule. A rule has no switch: one that exists
  colours. `liveRules()` drops a rule an older version stored with
  `enabled: false`, wherever rules come in (storage, an import, the shared
  file), so a rule that was off never starts colouring by itself.
- A **style** holds appearance: `border`, `banner`, `ribbon`, `title`, and
  `favicon.enabled`. Favicon letters stay on the rule; styles keep
  `favicon.text` empty.
- `resolveRule()` merges them for drawing: appearance from the chosen style,
  letters from the rule. Without a style it falls back to the defaults, so
  drawing never crashes.

Beside rules and styles sit the settings for the **Web client** panel,
listed in `WEB_CLIENT_KEYS` and normalised by `normalizeWebClient()`. They
travel in an export and in the shared file as `webClient`, and each one is
on only while `webClientEnabled` is (`tweakOn()`):

- `maximize.enabled` — wide layout and list view, on by default.
- `pinActionBar.enabled` — pin the action bar of a page that opens with it
  floating, on by default.
- `hideFactBox.enabled` — collapse the FactBox pane on a page nobody set it
  on yet, off by default. Shares Maximize's once-per-page pass.
- `highlightRow.enabled` — the current-line tint, on by default.
- `stripeRows.enabled` — every other list row a see-through grey, off by
  default. Keyed on BC's `aria-rowindex`, since BC reuses its `<tr>`
  elements while scrolling.
- `dropdown.width` and `dropdown.height` — slider steps 1–5, stored as the step
  and never as pixels. Step 1 is BC standard; width defaults to 5, height to 1.
  `normalize()` rounds and clamps them, so a hand-edited or garbled value can
  only ever land on a valid step. The feature is on when either is above 1.
- `resizePanes.enabled`: drag handles on Help, Copilot, Page Inspection and
  the Personalization field list, on by default. The widths people drag are
  not settings: they live under their own `paneWidths` key in
  `chrome.storage.local` (`{ inspect, design, side }` in px), are never
  exported or shared, and are read through `Panes.normalizeWidths()`.
- `noAnimations.enabled` — turn off BC's animations, off by default.
- `hideNotifications.enabled` — hide the notifications bell in the top bar, off
  by default (BC online uses it). One `data-bcb-no-bell` attribute on `<html>` and one id rule in
  `content.css` (`#notifications_container`, in the top document).
- `copyValues.enabled` — the copy icon on read-only values, on by default.
- `weekNumbers.enabled` — turns on BC's own week numbers in the date picker
  where nobody set them, on by default.
- The keyboard shortcuts have no switch of their own (`shortcutsOn()` is
  `webClientOn()`): the BC Buddy icon in BC's top bar (two people) and the
  shortcuts view are there while the Web client area or Help & feedback is
  on.

The **Help & feedback** settings, listed in `FEEDBACK_KEYS` and normalised by
`normalizeFeedback()`:

- `feedbackEnabled` — the area switch above.
- `feedbackEmail` — the helpdesk address for the `mailto:` link: one plain
  address of at most 254 characters, or `''`.
- `feedbackPriorities` — `[]` for no priority field (also when never
  stored, or when nothing in it is valid), or 1 to 10 names of at most 40
  characters, each once. There is no built-in list.
- `feedbackDefaultPriority` — one value of that list, or `''` for none.
- `feedbackSubjectBug`, `feedbackSubjectIdea` — the email subject for a
  problem and for feedback, one line of at most 200 characters with the
  placeholders `{prio}` `{type}` `{company}` `{environment}` `{tenant}`
  `{title}`, or `''` for the built-in one. `{type}` and `{tenant}` work but
  are listed nowhere for users (the options page's token line, docs): keep
  it that way.
- `feedbackUrgentText` — the notice the side panel shows above the priority
  while the last value of the effective priority list is picked: one line of
  at most 200 characters, or `''` for none. Shown with `textContent`, never
  put in the report.
- `feedbackUrgentLink` — `''` or the link on that notice, through
  `cleanUrgentLink()`: an `https:` URL of at most 500 characters (parsed with
  `URL()`, stored as its `href`, no whitespace, user name or password) or
  `tel:` followed by at most 30 of `+`, digits, spaces, `(`, `)`, `-`, `.`.
  Anything else is `''`. The side panel checks it again before it sets the
  `href`.

Every text field goes through `plainText()`: a line break, control character
or bidi override makes it invalid rather than repaired.

`hosted` keeps what the shared file said last time: `rules`, `styles`,
`webClient` and `areas` (defaults, see *Import format*), and `feedback`, the
Help & feedback values it names, which are locked while the shared
configuration is active (see *Locks* below).

`normalize()` always ensures every rule points at a valid style: a
configuration with no styles gets a Default, and a rule whose `styleId` names
nothing follows the first style in the set. A first install replaces that bare
Default with the styles and the four rules in `examples/bc-buddy.json`
(*Full* and *Subtle*): `seedSamples()`, called from `onInstalled` in
`background.js`. They colour nothing, since `environmentsEnabled` starts off.
**Load samples** adds the same while nothing is set up yet. Display fields on
a rule object are dropped. Hosted (shared) rules go through the same path.

### Migration from schema version 2

Version 2 had one master switch `enabled` for the whole extension, an
`enabled` per rule and `shortcuts.enabled`. `isLegacy()` spots such settings
(something stored, but no boolean `webClientEnabled`); `normalize()` passes
them through `migrate()`, and `onInstalled` saves the result once on an
update, so every page reads the same answer from storage:

- `webClientEnabled` takes the master switch.
- `environmentsEnabled` is on only when the master switch was and something
  coloured: an own rule that was on, or an active shared file with rules.
  Then the own rules that were off are dropped. With the area off, all own
  rules stay, since they colour nothing.
- `feedbackEnabled` stays on only when it and the master switch both were.
- `hosted.areas` records `environmentsEnabled: true` when the shared file
  had rules, so the next sync does not count that as new.
- `shortcuts.enabled` is dropped: the shortcuts come with the Web client.

Reading the same old settings again gives the same answer. Older shapes than
version 2 are not migrated: the extension had no public release before it,
and unknown fields are dropped rather than translated.

## ⚙️ How the content script behaves

The Business Central client is an SPA that redraws its DOM continuously. The
content script is therefore fully idempotent: it re-examines the page on every
DOM change and on URL changes, and does nothing as long as everything is already
right.

On pages that need no marking — environment colours off or no rules and no
Web client tweak that clicks BC, or a non-BC host with no matching rule — it
goes idle (`shouldWatch()`): the MutationObserver and the poll stop. It
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

How it works is in the comment at the top of [content.css](src/content/content.css).

After a BC update, open a sales order in edit mode and click through its lines:
the line you are on should carry the faint tint across its full width. If not,
check that the current row still has `real-current` and the grid
`ms-nav-grid-edit`.

## 📌 BC's own page settings

How it works is in the comment at the top of [bcstate.js](src/lib/bcstate.js).

After a BC update, open a card nobody pinned: it should open pinned, and a
`…:TCB<id>` key with `{"Pinned":true}` should appear. Unpin it, reopen it, and
it should stay unpinned. Do the same with the wide toggle and a `…:Layout:<id>`
key.

## 📐 Dropdown size

How it works is in the comment at the top of [dropdowns.js](src/lib/dropdowns.js).

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

How it works is in the comment at the top of [weeknumbers.js](src/lib/weeknumbers.js).

After a BC update, remove the `…:DatePicker` key, reload, and open a date
picker: the week numbers should be there, and Shift+Home should still turn
them off and write `{"showWeekNumbers":false}`.

## 📋 Copy values

How it works is in the comment at the top of [copyvalues.js](src/lib/copyvalues.js).

To look at the markup again on a live page:

```js
var f = [...document.querySelectorAll('iframe')].map(x => x.contentDocument).find(d => d && d.querySelector('table'));
[...f.querySelectorAll('.edit-container-read')].slice(0, 5).map(c => [c.tagName, c.className, !!c.querySelector('.stringcontrol-read.value')]);
```

## ↔️ Resize panes

How it works is in the comment at the top of [panes.js](src/lib/panes.js).

To look again after a BC update: open each pane and check that
`document.querySelector('.designer-design-pane.expanded')` (top window) and
`[...frame.body.children].find(n => n.style.getPropertyValue('--panel-width'))`
(client frame) still find it.

## 🔗 URL parsing

How it works is in the comment at the top of [match.js](src/lib/match.js).

## 🛡️ RegEx conditions

How it works is in the comment at the top of [match.js](src/lib/match.js).

## 📄 Import format

The extension reads only its own format: an object with a `rules` array and
optionally a `styles` array (as the export produces), or a bare array of rules.
A file naming a different `app` is rejected.

Styles were called layouts before. A file or stored setting with a `layouts`
array, or a rule with a `layoutId`, still reads the same (`stylesOf()` in
`settings.js`); only `styles` and `styleId` are ever written.

A file with no styles derives none: after the merge, `normalize()` points its
rules at the importer's own first style. Display fields on a rule in the file
are ignored — appearance only travels in a `styles` array.

Importing merges both lists (styles first, then rules): same id (else same
name) overwrites in place, new items are added, items missing from the file are
left alone. Styles go first so rules can point at something that already
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

The area switches `webClientEnabled` and `environmentsEnabled` may sit at the
top level of a file (`readAreas()`). An export leaves them out: they belong to
whoever runs the extension. IT may add them to a shared file, where they are
team defaults just like `webClient` (`applySharedAreas()`, with
`hosted.areas`). A shared file with rules that does not name
`environmentsEnabled` counts as `true` (`sharedAreas()`), since that is what
sharing rules is for. An import by hand takes them over (`applyAreas()`).

The Help & feedback fields (`FEEDBACK_KEYS`) also sit at the top level
(`readFeedback()`). An export carries them only when someone set Help &
feedback up (`feedbackSetUp()`), and without an empty address, so a
colleague's file does not switch it off for the team. An import by hand
takes them over (`applyFeedback()`). From a shared file they are locks, not
defaults: see below.

### Locks

`lockedKeys()` says which settings someone else decides, for the options page
to show read-only with *Set by your organisation.*: every key the policy sets
validly (`'policy'`), then, while the shared configuration is active, the
Help & feedback keys the shared file names (`'shared'`). The shared file's
area switches and Web client settings are defaults and never lock.
`enforceLocks()` (policy first through `applyPolicy()`, then
`applySharedLocks()`) writes the locked values over the local ones; the
service worker runs it after every settings write, so a value changed around
a lock (an options page open from before the policy, an edited export) is
put back. An import passes the locked keys to `applyImported()`, which skips
them and reports them, and the options page says *Some settings are set by
your organisation and were not changed.*

### Shared file set by policy

IT can set settings by browser policy in `chrome.storage.managed`, declared
in `managed_schema.json` (Windows registry:
`HKLM\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\<id>\policy`, and
`Google\Chrome` likewise; `examples/intune/`). The keys are `POLICY_KEYS` in
`settings.js`: the shared file's address `sharedConfigUrl`, the three area
switches and the Help & feedback fields. `policyValues()` checks each like
any other value and leaves out one that does not pass (an address that does
not resolve to HTTPS, an invalid email address, an empty text), rather than
locking a field on something unusable. The policy itself is never stored.
The service worker reads it on install, at browser start, when it changes
and after every settings write (`enforcePolicy()`), and `applyPolicy()`
writes the address into `hosted.url` with `active` on, and the other values
over the local ones; the usual settings change then starts the sync. So a
write from an options page cannot undo it. The options page reads the
policy too, only to lock the fields, hide the clear button and show *Set by
your organisation.* Removing the policy changes no settings: the fields
unlock and the values stay.

`syncIntervalMinutes()` sets the alarm: daily once the file has loaded, hourly
before the first try, and while it fails 1, 2, 4 and 8 hours after each failed
try in a row (`hosted.failures`), then daily. A laptop that was offline when the
policy arrived does not wait a day, and an address that stays broken settles at
one request a day. After a try, the alarm is set again with a first delay of a
whole interval, so a failure never brings the next try closer. A
force-install (`installType` `admin`) does not open the options page on first
install.

Nothing of this runs in BC tabs: only the service worker and the options page
read managed storage.

The manifest keeps `<all_urls>`: an on-premises server has no address the
extension could list in advance. IT, who knows those addresses, narrows it with
Chrome's `ExtensionSettings` policy instead: `runtime_blocked_hosts: ["*://*"]`
and the BC hosts plus the shared file's host in `runtime_allowed_hosts`
(`examples/intune/extension-settings.json`, documented in `docs/intune.md`).
Content scripts then no longer run anywhere else. Nothing in the code depends on
it; the extension simply never sees the other sites.

### Download warning for the report `.eml`

Edge and Chrome keep `.eml` on their list of file types that can be harmful,
so the `.eml` that *Email* saves (a blob URL of our own, no reputation) gets
*This file may be harmful. Keep it?* in the downloads panel. Nothing in the
extension API switches that off. IT can exempt the type with the browser
policy `ExemptFileTypeDownloadWarnings` (Edge and Chrome, Settings catalog
under Downloads), limited to downloads from our own origin:
`[{"file_extension": "eml", "domains": ["chrome-extension://<id>"]}]`
(`examples/intune/exempt-file-types.json`, documented in `docs/intune.md`).
It is a browser policy, not one of ours: the extension does not read it and
nothing in the code depends on it. If the warning stays, check
`edge://policy` first; whether the browser matches the `chrome-extension://`
origin of a blob download is not verified, and `["*"]` is the wider fallback.

### Where the web client tweaks run

`state.webClient`, worked out by `webClientHere()` once per `apply()`, decides
it for every tweak. Two things must hold:

1. **The address looks like Business Central** (`isWebClientTarget()` in
   `match.js`): `businesscentral.dynamics.com` or an embed app on
   `*.bc.dynamics.com`, a host name with a label starting with `bc`, or a path
   starting with `/bc`. Other `*.dynamics.com` hosts (Sales, Customer Service,
   Finance and Operations) never count, whatever their labels or path. That is
   cheap and catches the usual on-prem shapes, but also sites such as
   `www2.gov.bc.ca`.
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
panel, off while the Web client area is off, limited to frames where
`state.webClient` is true, and CSS first wherever CSS can do it. A CSS rule
that stops matching after a BC update does nothing; a script that clicks the
wrong thing does damage. A new one brings along:

- **Settings.** One `{ enabled }` object in `normalizeWebClient()`
  (`settings.js`), like `maximize` and `highlightRow`, with an `…On(settings)`
  helper built on `tweakOn()`, which also checks `webClientEnabled`. Add its key to
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
  entry where a feature can visibly fail. Both pages show these as cards
  that open on a click: copy the `<details class="faq" id="…" markdown>` of
  another feature, with the one-line "what you get" in its `<summary>`, its
  `bcb-starts` label and an `id` other pages link to, and the `??? faq "…"`
  of another question.
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
`icon16/32/48/128.png`. The letters are rasterised
along with it, so the extension does not depend on Segoe UI being present on
the user's machine.

The same script also writes `store-icon128.png`. That one follows different
rules: the Web Store wants the mark within 96x96 on a 128x128 canvas, with 16 px
of transparent padding around it, because the store draws its own frame and
shadow around the image. In the toolbar the opposite applies, so it is a separate
file and not a replacement for `icon128.png`. It does not go into the package
either; you upload it in the dashboard.

It also keeps the 512 px render itself as `icon512.png`, the logo on the
marketing deck's cover. That one stays out of the package too.

### Setting icons

Every switch under **Web client** has an icon, shown in three places: on its
row on the options page, on its card in `docs/web-client.md`, and in the feature
table of the README. All three read the same file in `icons/settings/`, named
after the setting's key in `settings.js` without `Enabled`
(`copyValuesEnabled` → `copy-values.svg`). Never paste a copy of the drawing
elsewhere.

**Drawing.** The same line style as the section icons in the options page's
left menu:

- A `0 0 16 16` viewBox, with the drawing kept between 1 and 15.
- Outline only. The root carries `fill="none" stroke="currentColor"
  stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"`. Put lines
  on the half pixel (`x="1.5"`) so they land sharp.
- Frames such as a window, a list or a calendar get `rx="1.5"`.
- One shade at most, for the part the setting is about (the pane that grows,
  the week column, the stripes): `fill="currentColor" fill-opacity=".22"
  stroke="none"`, drawn before the outline. Small solid marks such as dots or an
  arrow head: `fill="currentColor" stroke="none"`.
- No text or letters, no gradients, no second colour.
- Show what people see or gain in Business Central, not how BC Buddy does it.
  Where Business Central has its own icon for the same thing (the maximize
  arrows, the pin), follow it, so people recognise it.
- A line through the icon (`M2.5 2.5l11 11`) is for a switch that hides or
  stops something Business Central does: **Hide the notifications icon**,
  **Turn off animations**. Leave it off when the icon is Business Central's
  own button for the thing: **Hide the FactBox pane** shows the round *i* that
  opens and closes the pane, without a line.
- The root also carries `color="#009aa5"`: the colour the icon has in the
  README, where nothing can style it (3.4:1 on GitHub's white, 5.6:1 on its
  dark background). The options page uses the file only as a mask and the
  website sets its own colour, so this value does not show there.

**Tile and colours.** The lines are in the accent: the teal that the options
page uses for toggles, buttons, sliders and links, and the website for its
links. On the website the icon sits on a tile in a tint of the cyan of the
logo's sphere, `#00B7C3`; on the options page it stands bare in front of the
setting's name. The sphere's own cyan reaches only 2.4:1 on white, too pale for thin
lines or text, so the accent is a darker shade on light backgrounds:

| | Accent (lines) | Tile | Tile border |
|---|---|---|---|
| Light | `#007A83` | `#E3F6F8` | `#BFE8EC` |
| Dark | `#3CC8D1` | `#00B7C3` at 14% | `#00B7C3` at 32% |

On the options page the accent is `--accent` (through `--icon-fg`) in
`options.css`, an 18 px icon without a tile; on the website
`--md-typeset-a-color` and the `--bcb-icon-*` tokens in
`docs/assets/extra.css`, which also hold the tile. Change the accent in both files together.

**Adding one for a new setting:**

1. Draft three options in this style and show them at real size on a light and
   a dark background. The maintainer picks one.
2. Save it as `icons/settings/<name>.svg`. `tools/build-package.ps1` already
   ships that folder.
3. Options page: put
   `<span class="setting__icon setting__icon--<name>" aria-hidden="true"></span>`
   in front of the row's `.setting__text`, and add
   `.setting__icon--<name> { --icon: url(../../icons/settings/<name>.svg); }`
   to `options.css`. The row itself goes under **Works straight away** when
   the switch starts on, or under **Extras** (above **Turn off animations**)
   when it starts off, with a one-line `<key>Desc` message in a
   `.setting__desc` under its name.
4. Website: open the card's summary with
   `<summary markdown="span"><span class="bcb-setting-icon">:settings-<name>:</span>`.
   `pymdownx.emoji` in `mkdocs.yml` inlines the SVG from `icons/`.
5. README: put `<img src="icons/settings/<name>.svg" width="18" height="18" alt="">`
   in front of the name in the feature table.

## 🧪 Tests

The test pages run the real source in headless Chrome (or Edge): parsing URLs,
matching rules, the tokens, building the options page, and what the
content script actually does to the DOM (rewriting and colouring the ribbon, the
frame, every banner position, the title, the favicon). It also follows the page
as it stays open: new settings, an address that changes without a reload, 200
rules matched once per address rather than on every pass, and names that are
long or hold an emoji. The dropdown sizer runs
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

The settings checks in `test-core.html` cover Help & feedback too: its fields
through `normalize()`, export and import, locks and policy values. The side
panel and the overlay need a live browser and are not in the test pages: after
a change there, load the extension, open Business Central and walk through a
report with screenshots, a drawing and each of the four buttons.

The runner looks for a browser in this order: `CHROME_PATH` if set, then the
usual Windows install paths for Chrome and Edge, then `chrome`,
`google-chrome`, `chromium` and `msedge` on `PATH`. Set `CHROME_PATH` when your
browser lives somewhere else — it beats editing the list.

After the pages, the runner runs `tools/check-shortcut-docs.mjs` with Node. It
loads `SETS` and `DOCS` from `shortcuts.js` itself, looks up every key in the
Markdown source of Microsoft's *Keyboard Shortcuts* article (in
`MicrosoftDocs/dynamics365smb-docs` on GitHub), and checks that the panel's
link still opens. A key or link that is gone fails the run; being offline, or a
server error, is printed and fails nothing. Without `node` on `PATH` the check
is skipped. A key that is found is only mentioned somewhere in the article, not
proven to do the same thing there.

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

How it works is in the comment at the top of [calm.js](src/content/calm.js).

After a BC update, open a card, toggle a FastTab, Maximize and the FactBox
pane (I), and log `transitionrun` and `getAnimations()` for anything slow.

## ⌨️ Keyboard shortcuts

How it works is in the comment at the top of [shortcuts.js](src/lib/shortcuts.js).

## 🆘 Help & feedback

How it works is in the comment at the top of [help.js](src/sidepanel/help.js).

## 🔑 Permissions

- `storage` — keeping settings.
- `alarms` — checking the shared file periodically.
- `scripting` — injecting Help & feedback's area selection and drawing
  editor (`src/support/`) into a Business Central tab when someone starts
  one from the side panel. Only with Help & feedback switched on; the
  screenshots use `tabs.captureVisibleTab`, which the host permission covers.
- `downloads`, `downloads.open` — **optional** (`optional_permissions`),
  requested by `chrome.permissions.request()` on the first click on *Email*
  in Help & feedback, first thing in the click handler so the user gesture
  still counts. With them the panel saves the report's `.eml` through
  `downloads.download()` (a blob URL of our own) and `downloads.open()`s it
  when it is complete, so Outlook shows the new email at once. Only that one
  download id is ever touched. Refused, or any call failing (`open()` needs a
  user gesture and may be too late), the panel falls back to a plain
  `<a download>` and says where to find the file. Optional, so installing or
  updating BC Buddy shows no new warning and the automatic update is not
  held up.
- `sidePanel` — the browser's side panel (`src/sidepanel/`): the keyboard
  shortcuts and Help & feedback. `sidePanel.open()` needs Chrome 116, hence
  `minimum_chrome_version`.
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
needs: manifest, `managed_schema.json`, `src`, `_locales`, the PNG icons, the
setting icons in `icons/settings/` that the options page shows, and
`examples/bc-buddy.json`, which **Load samples** on the options page and the
first install in `background.js` read with `chrome.runtime.getURL` (no network). Tests, the other examples, the logo
SVG and these tools stay behind. The script checks that `manifest.json` ends
up in the root of the ZIP, which is the usual silent upload rejection.

The listing copy sits in [`store/description-en.txt`](store/description-en.txt),
[`store/description-nl.txt`](store/description-nl.txt) and
[`store/description-fr.txt`](store/description-fr.txt), and the screenshots
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

Screenshots live in `store/` because the store listing is built from there,
the before-and-after shots of the web client live in `marketing/screenshots/`
because the deck uses them too, and `examples/bc-buddy.json` is the shared
configuration people point at, and the samples the extension packages.
[`tools/mkdocs_assets.py`](tools/mkdocs_assets.py) is an MkDocs hook that adds
those originals to the build instead of keeping a second copy in `docs/`; every
`.png` and `.jpg` in `marketing/screenshots/` is served under
`assets/screenshots/`. The Web client page shows them in content tabs
(`pymdownx.tabbed`), and the Site workflow runs on a pull request that changes
that folder. It
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

### Menu icons

Each top-level item of the site's left menu has an icon in the line style of
the options page's own menu (the drawing rules under *Setting icons* apply).
The drawings are in `overrides/.icons/bcb/`, and
[`tools/mkdocs_nav_icons.py`](tools/mkdocs_nav_icons.py) says which item gets
which, for pages and sections alike. A new top-level item gets an icon there in
the same commit; renaming a section in the nav of `mkdocs.yml` means renaming
its key there too, or the build stops.

### One-time setup: turning Pages on

**Settings → Pages → Build and deployment → Source: GitHub Actions.** Without
that, `deploy-pages` fails with a message about Pages not being enabled; the
default ("Deploy from a branch") looks for committed HTML, which this repository
does not have.

Nothing is published until the first deployment runs, and deployments run on
release. To put the site up before the next one, start the **Site** workflow by
hand from the Actions tab.

## 📝 Documentation rules

`README.md` and `docs/` describe the same features for different readers, so a
behaviour change usually touches both. Check the counterpart in the same commit:

| README section | Site page |
|---|---|
| Getting started | `docs/getting-started.md` |
| Web client | `docs/web-client.md` |
| Environment colours | `docs/matching.md`, `docs/styles.md` |
| Sharing settings with your team | `docs/sharing.md`, `docs/intune.md` |
| Troubleshooting | `docs/troubleshooting.md` |
| Installing | `docs/index.md` |

The README is the short version, not a recap of the site: each section a few
lines, at most one screenshot, and a link to its site page. Details, edge cases,
IT setup and the full troubleshooting list live in `docs/` only. The *Web
client* table is the exception: every switch keeps its row there.

Write both for back-office users and data clerks with little IT or BC
background. Plain words, short steps, the UI's own labels in bold; technical
detail (URL fields, RegEx, on-premises, JSON) goes at the bottom of a page or in
a collapsed block. Getting started stays three short steps. Web client
improvements come before environment colours, everywhere: README, `docs/`,
`store/` and UI strings. Installing goes through the Chrome Web Store only;
loading from source belongs under *For developers* in the README, nowhere on
the site.

The store listing (`store/description-*.txt`, and `extDescription` in
`_locales/*/messages.json` for the 132-character summary) is a pitch, not a
manual. Open with a one-line hook, put each part under a short heading that
names what people gain, keep every bullet to one line, and close with a short
checklist of facts (where it runs, languages, free). Switches that start off go
in one "want more?" line, not among the things that work straight away. Leave
out setup for IT or admins (Intune, policies, a managed shared file): that
belongs in `docs/`. Keep English, Dutch and French saying the same thing.

New functionality gets a line under `## Unreleased` in `CHANGELOG.md`, in the
same commit that adds it: a new feature or switch, or a fix people notice. Small
changes to how existing settings and screens look or behave stay out: a
different default, a reworded label, a slider in place of a field, a control
moved or dropped. So do build, CI, dependency and refactoring work. That file is
for users, so it is written in their words and about what they see. The
release workflow dates the `Unreleased` section, uses it as
the GitHub release body and opens an empty one for next time — so an entry that
was never written is a release note nobody gets.

A new feature or switch is not done until every place that lists features has
it. Go through this list before calling it finished, and say which items you
skipped and why:

- `README.md`: a row in the feature table and its own section.
- `docs/`: the same on the counterpart page from the table above.
- `CHANGELOG.md`: a line under `## Unreleased`.
- `store/` and `extDescription`: only when it works straight away; a switch
  that starts off goes in the "want more?" line.
- The marketing deck (`marketing/deck/`): a slide in the order of
  `docs/web-client.md`, made with the recipe in `marketing/README.md`. The
  screenshots need the maintainer at Chrome, so ask for them instead of
  leaving the slide out. Skip it only when there is nothing to see in a
  screenshot, as with *Hide the notifications icon* and *Turn off animations*.
- The same screenshots on the feature's section in `docs/web-client.md`:
  "With BC Buddy" and "Without BC Buddy" tabs pointing at
  `assets/screenshots/`, which the MkDocs hook serves from
  `marketing/screenshots/`. Never copy them into `docs/`.
- A Web client switch gets an icon in `icons/settings/`, shown on its options
  row, its card in `docs/web-client.md` and its row in the README table. Draw,
  colour and wire it up as *Setting icons* in `DEVELOPMENT.md` says: three
  drafts in that style for the maintainer to pick from, not an icon taken
  as-is from a library, and never a second copy of the drawing.

`DEVELOPMENT.md` is contributor-facing and overlaps neither; it drifts against
code rather than against prose, so re-read it when `.github/workflows/`,
`mkdocs.yml`, `manifest.json`, or the release or permission story changes.

Prefer single sourcing over a second copy wherever it is cheap. `docs/privacy.md`
and `docs/whats-new.md` are `pymdownx.snippets` includes of `PRIVACY.md` and
`CHANGELOG.md`, and `tools/mkdocs_assets.py` adds the `store/` screenshots, the
deck's screenshots in `marketing/screenshots/` and `examples/bc-buddy.json` to
the MkDocs build instead of duplicating them.

`docs/whats-new.md` includes only the `released` section of `CHANGELOG.md`, the
part below the `<!-- --8<-- [start:released] -->` marker. Leave that marker
directly under `## Unreleased`: the release workflow matches on it, and it is
what keeps unreleased notes off the site.

## 📄 Licence

MIT, in [`LICENSE`](LICENSE) at the root of the repository. There is no CLA: a
contribution is offered under the same terms as the rest of the project, which
is what opening a pull request against a public repository already means.

The licence text carries a copyright year. It is the year the notice was written,
not a range to keep current — MIT does not require it to move, and a yearly
commit that changes nothing else is noise.
