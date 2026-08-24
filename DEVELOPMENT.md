# Development

Working on BC Buddy itself. For what the extension does and how to use it, see
[README.md](README.md).

## 📁 Structure

```
manifest.json
_locales/              nl (default) and en
src/
  background.js        service worker: synchronises the shared file
  lib/i18n.js          fetching translations
  lib/match.js         parsing URLs, matching rules, tokens, colour helpers
  lib/settings.js      storage, defaults, normalisation, import/export
  content/content.js   draws frame, banner, ribbon, title and favicon
  content/content.css  the accompanying styling
  options/             options page (options.js + helpers, cards, hosted modules)
  popup/               popup on the extension icon
examples/              example of a shared configuration
tests/                 test pages + runner
icons/                 logo.svg, build-icons.ps1, the PNGs
tools/                 build-package.ps1: the ZIP for the store
store/                 listing copy, privacy answers and screenshots
```

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

## 🔗 URL parsing

Both BC SaaS and on-premises URLs are recognised, following the shape from
[Microsoft's documentation](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-web-client-urls):
`https://<host>[/<aadtenantid>][/<environment>]/?[company=...]&[tenant=...]`.
Tenant and environment are both optional; the tenant is a GUID or a domain name.
On-prem the server instance sits where the environment would be
(`/BC240/?company=...`) and the tenant comes from the query.

## 📄 Import format

The extension reads only its own format: an object with a `rules` array and
optionally a `layouts` array (as the export produces), or a bare array of rules.
Exports carry `"app": "bc-buddy"`, and a file naming a different app is
rejected. If there is no layout in the file, the rules that are read follow the
first layout of whoever imports them.

Importing merges: a rule you already have (same id, otherwise same name) is
overwritten in place, new rules are added, and rules that are not in the file are
left alone.

If you already had rules from before layouts were split out, layouts are derived
from them on the first read: rules that looked the same share a layout, so
existing markings stay unchanged.

## 🌍 Adding a language

The texts live in [`_locales/nl/messages.json`](_locales/nl/messages.json) and
[`_locales/en/messages.json`](_locales/en/messages.json); `nl` is the default and
the fallback. Adding a language comes down to a new folder with the same keys.

The tests check that both files contain the same keys, that every key the code
uses exists, that no unused keys are left lying around, and that the store
description stays under 132 characters — the Web Store rejects a package whose
description is longer, per locale.

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
matching rules, the tokens, building the options page and the popup, and what the
content script actually does to the DOM (rewriting and colouring the ribbon, the
frame, the corner ribbon, the title, the favicon).

```bash
powershell -ExecutionPolicy Bypass -File tests/run-tests.ps1
```

You can also just open the pages in a browser; `test-core.html` works anywhere,
while `test-options.html` and `test-popup.html` fetch the HTML and need the
`--allow-file-access-from-files` flag for that (the runner already sets it).

The runner looks for a browser in this order: `CHROME_PATH` if set, then the
usual Windows install paths for Chrome and Edge, then `chrome`,
`google-chrome`, `chromium` and `msedge` on `PATH`. Set `CHROME_PATH` when your
browser lives somewhere else — it beats editing the list.

## 🤖 Continuous integration

Two workflows, both on `windows-latest` because the runner scripts are
PowerShell and the image ships Chrome and Edge.

[`.github/workflows/tests.yml`](.github/workflows/tests.yml) runs the suites on
every push to `main`, on pull requests, and on demand. `run-tests.ps1` exits 1
when a check fails or a suite renders no results, so the step fails by itself —
no extra reporting glue.

[`.github/workflows/release.yml`](.github/workflows/release.yml) fires on a
`v*` tag. It first checks that the tag matches `version` in `manifest.json`,
then runs the tests, builds the package and attaches the ZIP to a GitHub
release. The version check runs before anything else: a release tagged `v1.0.2`
carrying a package that declares `1.0.1` is rejected by the store, and by then
the release already exists.

So cutting a release is: bump `version` in `manifest.json`, commit, tag
`v<version>`, push the tag.

Releasing is tag-driven rather than merge-driven on purpose. Every submission
costs review time, so it should be a deliberate act.

Publishing to the Chrome Web Store is *not* automated. The API can do it, but
it needs an item that already exists (the first submission has to go through
the dashboard by hand), a one-time OAuth setup in Google Cloud, and four repo
secrets. The trap there: if the OAuth consent screen stays in "Testing" mode,
refresh tokens expire after seven days and the pipeline breaks with an opaque
`invalid_grant`. And an API publish still enters review like any other — with
`<all_urls>` that is the slow queue, so a green tag would not mean users have
it.

## 🔑 Permissions

- `storage` — keeping settings.
- `alarms` — checking the shared file periodically.
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

## 🚀 Publishing

Build the package for the Chrome Web Store or Edge Add-ons with:

```bash
powershell -ExecutionPolicy Bypass -File tools/build-package.ps1
```

That puts `dist/bcbuddy-<version>.zip` in place with only what the extension
needs: manifest, `src`, `_locales` and the PNG icons. Tests, examples and the SVG
sources stay behind. The script checks that `manifest.json` ends up in the root
of the ZIP, which is the usual silent upload rejection.

The listing copy sits in [`store/description-nl.txt`](store/description-nl.txt)
and [`store/description-en.txt`](store/description-en.txt), the answers for the
privacy practices tab — single purpose and a justification per permission — in
[`store/privacy-practices.txt`](store/privacy-practices.txt), and the privacy
policy the store points at in [`PRIVACY.md`](PRIVACY.md). The screenshots for the
listing are in `store/`.
