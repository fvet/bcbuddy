# Development

Working on BC Buddy itself. For what the extension does and how to use it, see
[README.md](README.md).

## 📁 Structure

```
manifest.json
_locales/              en (default) and nl
src/
  background.js        service worker: synchronises the shared file
  lib/i18n.js          fetching translations
  lib/match.js         parsing URLs, matching rules, tokens, colour helpers
  lib/settings.js      storage, defaults, normalisation, import/export
  content/content.js   draws frame, banner, ribbon, title and favicon
  content/content.css  the accompanying styling
  options/             options.html/css; options.js plus helpers, cards, hosted
  popup/               popup on the extension icon
examples/              example of a shared configuration (schema version 2)
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

That filter is conservative, not complete — whether an arbitrary pattern
backtracks catastrophically is not decidable from a source scan. It covers the
shapes that occur in practice; the length caps are what bound the rest.

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

## 🌍 Adding a language

The texts live in [`_locales/en/messages.json`](_locales/en/messages.json) and
[`_locales/nl/messages.json`](_locales/nl/messages.json); `en` is the default and
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
therefore happens inline.

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
checks like any other. Read them anyway before merging: `release.yml` and the
Pages deploy do **not** run on pull requests, so a bad bump to
`softprops/action-gh-release`, `upload-pages-artifact` or `deploy-pages` would
only show up at the next release. The pip entry stays quiet by design, because
the requirements are pinned to a range; it earns its place through the security
alerts rather than through version bumps.

Alerts for known vulnerabilities are a separate switch, under Settings →
Advanced Security, and do not come from this file.

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
3. **The store upload happens last.** The Web Store refuses a version it already
   holds, so a version number cannot be retried. A failure anywhere earlier
   costs nothing; a failure here costs that number and you release again with
   the next one.

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
needs: manifest, `src`, `_locales` and the PNG icons. Tests, examples, the SVG
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
