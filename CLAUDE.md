# CLAUDE.md

## Language

Do all development in English: source comments, commit messages, test harness
output, build-script messages, and docs meant for contributors.

Exceptions that stay Dutch or French on purpose:

- `_locales/nl/messages.json` — the Dutch UI locale
- `_locales/fr/messages.json` — the French UI locale
- `store/*.txt` — store listing notes and Dutch listing copy;
  `store/description-fr.txt` is the French listing copy

## Documentation

Read the **Documentation rules** section of [DEVELOPMENT.md](DEVELOPMENT.md)
before you add or change a feature, switch, setting, label or screenshot, or
edit `README.md`, `docs/`, `store/`, `CHANGELOG.md`, `extDescription` or
`marketing/`. It holds the README-to-site map, the writing style, the store
listing rules, the `CHANGELOG.md` rules and the new-feature checklist. Skip it
for pure code, test or workflow work.

Two rules stay here because they apply to every change:

- Every new feature, switch or noticeable fix gets a line under `## Unreleased`
  in `CHANGELOG.md`, in the same commit.
- Beta features stay out of every document. Ctrl+click / middle-click to open a
  link in a new tab (`src/lib/newtab.js`) is beta and undocumented on purpose:
  never mention it in `README.md`, `docs/`, `CHANGELOG.md`, `DEVELOPMENT.md`,
  `store/`, `marketing/`, release notes or UI strings, and give it no switch in
  the options, until the maintainer says it leaves beta. Its notes live in the
  code comments at the top of `newtab.js`.

## Performance

BC Buddy runs inside every Business Central tab while people scroll lists of
thousands of rows and type through journals. A tweak that makes that feel
slower is worse than no tweak, so weigh the runtime cost of every change to
`src/content/` or `src/lib/`, and state it in the commit message: what runs,
how often, and on how many elements.

- **CSS before script.** A rule keyed on one attribute on `<html>` costs
  nothing per row and nothing per keystroke. Give every selector a specific
  rightmost part (`tr.real-current > td`, not `td` alone or `*`), so the
  browser rejects non-matching elements at once.
- **Nothing per row, scroll or keystroke.** No document-wide listeners for
  `scroll`, `input`, `keydown`, `mousemove` or `pointermove`; no
  MutationObserver with `subtree: true` on a grid; no `getComputedStyle` or
  layout reads inside a loop. When a feature must react to BC, watch the
  narrowest container, as the dropdown sizer does (`childList` on each
  `.spa-container`, no subtree).
- **Keep the shared loop cheap.** While a BC tab is awake, `apply()` in
  `content.js` runs after every burst of DOM changes (250 ms) and on an 800 ms
  poll. Work in it must be constant-time and return early when nothing changed.
  A feature that only has to be set once must not make `shouldWatch()` wake
  that loop.
- **No layout thrash.** Read every measurement first, then write. Never put
  inline styles on elements BC re-renders or reuses; it reuses lookup forms
  and grid rows.
- **Paint.** No `filter`, `backdrop-filter`, `will-change`, transitions or
  animations on grid cells or rows, and nothing that gives each row its own
  compositing layer.
- **Check it.** Before calling a change done, scroll a long list (G/L Entries,
  Item Ledger Entries) and type quickly through a journal with the change on.
  Look for anything that is not instant.

## Security

BC Buddy is force-installed on hundreds of computers and may run in every
frame of every website. A slip here is a hole on all of them at once, so
weigh every change to `src/`, `manifest.json` or `.github/workflows/` against
the rules below, and state in the commit message what a hostile page, a
hostile shared file or a hijacked dependency could now do that it could not
before (usually: nothing).

Treat as untrusted: everything on the page (DOM, URL, events,
`localStorage`), every imported or shared file, and every message a content
script sends. Settings are untrusted too: an own rule may come from a typo, a
shared rule from whoever can edit that file.

- **No HTML from data.** Put text on the page with `textContent`, attributes
  with `setAttribute`. `innerHTML`, `outerHTML`, `insertAdjacentHTML` and
  `document.write` only ever take fixed strings from our own code or
  translations. No `eval`, `new Function`, string `setTimeout`, remote scripts
  or code from a fetched file: the shared file is data, never code.
- **Everything through normalize.** Every value from storage, an import or the
  shared file goes through `normalize()` and its helpers in `settings.js`
  before use: colours through `toHex()`, numbers through `num()` with bounds,
  choices against their list, text through `str()`. A new field gets the same
  treatment in the same commit. CSS gets only values that went through that.
- **RegEx only through `safeRegexTest()`.** Never `new RegExp()` on a user or
  shared pattern anywhere else; the budget in `match.js` is what keeps a
  pattern from freezing every tab. A new place that matches on user input
  follows the same shape: bounded input, bounded work, fail closed.
- **Fail closed.** When something cannot be checked safely, the condition
  does not match and the tweak does not run. A wrong colour on Production is
  worse than no colour.
- **Only act on Business Central.** Anything that changes a page, clicks,
  listens for clicks or writes to a site's `localStorage` is gated on
  `state.webClient`, which needs BC's own page structure, never on the
  address alone. Rules may colour any site; nothing else touches one.
- **Real clicks only.** A handler that opens a tab, opens our options or
  changes settings checks `event.isTrusted`, so a page cannot fire it.
- **Messages are checked where they arrive.** `background.js` handles a fixed
  list of message types, checks `sender.id`, and keeps anything that changes
  settings or fetches to extension pages (`isExtensionPage()`). A value from a
  content script is checked again there: `bcb:open-tab` only opens `https`
  addresses on the sender tab's own origin. No `externally_connectable`, no
  `web_accessible_resources`.
- **One kind of network request.** The only request is the HTTPS `GET` of
  the shared file: `credentials: 'omit'`, a timeout and a size cap. No
  telemetry, analytics or other endpoint. A new request, permission or host
  permission updates `PRIVACY.md`, the 🔑 Permissions section of
  `DEVELOPMENT.md` and the store justification in the same commit, and needs
  the maintainer's yes first.
- **Policy wins.** A value IT sets by policy (`chrome.storage.managed`) is
  validated like any other (HTTPS only), overrules local settings and is
  re-applied when a local write tries to undo it. No secrets in any storage.
- **Page world stays tiny.** `calm.js` is the only script in the page's own
  world (`"world": "MAIN"`). It reads nothing from the page and exposes nothing.
  A second one needs a reason no isolated-world script can meet.
- **Supply chain.** `src/` has no third-party code; keep it that way. In
  workflows, pin every action to a full commit SHA with its version in a
  comment, keep the default token read-only, and never run a third-party
  action in a job that holds the deploy key, the store secrets or the package
  before upload.
- **Check it.** Before calling a change done, ask what a page could do by
  crafting DOM, firing events or choosing its URL, and what a shared file
  could do with the worst values its fields allow. Run `tests/run-tests.ps1`.
  Run `/security-review` on the branch before it is merged.
