# Roadmap

What BC Buddy builds next, and why. Contributor-facing: what users see of a
feature goes into `CHANGELOG.md`, `README.md` and `docs/` when it lands, not
here. Drafted 2026-10-06 from the research summarised at the bottom.

BC Buddy has two halves, and the roadmap keeps both:

- **Environment marking** (colours, ribbon, frame, banner, tab title, favicon).
  No other Business Central browser extension does this.
- **Web client tweaks** (Maximize pages, Dropdown size). Small fixes to the BC
  client itself, each a switch under **Web client** in the options.

Every new tweak follows the shape of the existing ones: a switch in the Web
client panel, off when the extension as a whole is off, limited to
`isWebClientTarget()` URLs, and CSS first wherever CSS can do it. A CSS rule
that stops matching after a BC update does nothing; a script that clicks the
wrong thing does damage.

## Planned, in priority order

| # | Feature | Effort | Default |
|---|---|---|---|
| 1 | Turn off animations | S | on |
| 2 | FactBox pane collapsed or open by default | M | BC standard |
| 3 | Copy a cell value | M | on |
| 4 | Keep BC tabs awake | S | on |

S: mostly CSS or one event handler. M: drives BC's own controls or needs a
page-level listener, like Maximize. The defaults are a proposal and still open.

### 1. Turn off animations

**Why.** "Disable webclient animations" (117 votes, Under Review). Pages
slide in and FastTabs and panes animate open. Someone entering data all day
waits for that hundreds of times.

**What.** Pages, dialogs, FastTabs and panes appear at once.

**How.**
- Check first whether BC already honours `prefers-reduced-motion`. If it does,
  the switch may only need to force that behaviour, and the docs should mention
  the Windows setting.
- Do not use `transition: none`. BC may wait for `transitionend` or
  `animationend` before it finishes opening something, and with no transition
  those events never fire. Shorten instead: `transition-duration` and
  `animation-duration` of `0.01ms !important`, the usual reduced-motion reset.
  The events still fire.
- Leave the progress and "working" indicators animated. Without them a busy
  client looks frozen. Find their classes in the live client and exclude them.
- Test: open a page from a list, open and close a FastTab, open the FactBox
  pane, open a dialog and a lookup, open Search. Nothing may hang half-open.

**Settings.** `noAnimations: { enabled }`, on by default. It changes how BC
feels for everyone, so the switch sits under **Web client** in the options.

**Findings from the live client.** BC has no `prefers-reduced-motion` rules
of its own. Most motion is CSS on stable classes (`.animate`, the
`ms-nav-layout-*` regions that Maximize and the FactBox pane move), but
FastTabs slide with `element.animate()`, which CSS durations cannot reach,
and BC waits for it before it finishes; `calm.js` (MAIN world) gives those
calls a duration of 0.

### 2. FactBox pane collapsed or open by default

**Why.** "Restore collapsing of factboxes" (177) and "FactBox default
Collapsed/Expanded" (109), both Under Review. The FactBox pane takes room from
the page itself on smaller screens. Others want it always open.

**What.** A choice: *BC standard*, *Collapsed* or *Open*. On *Collapsed* or
*Open*, every page that has a FactBox pane opens that way.

**How.**
- Same pattern as `maximize.js`: find BC's own FactBox pane toggle in the top
  view only (`spa-view` that is not `spa-not-top-most` and not `[inert]`), read
  its pressed or expanded state, and click it only when it differs from the
  choice. Handle each page once, keyed by its form in a `WeakMap`, so a page
  you opened or closed yourself is left alone. Maximize has already solved this
  part; reuse its top-view and per-form bookkeeping instead of copying it.
- Check first: 2025 wave 1 made the FactBox pane resizable and remembers it per
  page. If BC now also remembers open or closed per page, decide whether we
  override that memory, or only apply the choice on pages BC has no memory for.
  Pick whichever is less surprising and document it.
- Cover dialogs that have FactBoxes too, and pages opened from Search.
- Tests: extend the Maximize test fixtures in `tests/test-core.html` with a
  FactBox toggle in both states.

**Settings.** `factbox: { mode: 'bc' | 'collapsed' | 'open' }`.

### 3. Copy a cell value

**Why.** "'Copy Cell Value' on list pages" (177 votes, Under Review). The No.
column is a link, so you cannot select its text to copy it. Copying one value
now means opening the record or copying the whole row.

**What.** A small copy icon appears when you hover a value in a list or a
field on a card. Click it to copy the value as it is shown. Afterwards the icon
briefly shows a tick.

**How.**
- One pointer listener on the document finds the grid cell or field under the
  mouse, and shows a single reused icon positioned over it. No icon in every
  cell: lists render and recycle many rows.
- Copy the text BC shows (formatted number, date as displayed), not a raw
  value. That is what you see and what you would type elsewhere.
- Clipboard: use `navigator.clipboard.writeText` from the click. On an on-prem
  site over plain HTTP that API is missing; fall back to a hidden textarea with
  `document.execCommand('copy')`.
- Maybe also a modifier-click. Not decided, because both obvious choices clash:
  - Ctrl+click may already mean multi-select in BC lists. Check first.
  - Alt+click downloads links in Chrome.
  - Ctrl+Shift+C opens DevTools.
  If no combination is safe, ship the icon alone.
- The icon must not get in the way: no layout shift, never over the dropdown
  arrow or lookup button of an editable field, hidden while typing.

**Settings.** `copyCell: { enabled }`.

### 4. Keep BC tabs awake

**Why.** People come back to "We paused while you were away" and lose where
they were. Fenwick traces much of it to Chrome's Memory Saver and Edge's
Sleeping Tabs, which discard background tabs.

**What.** The browser no longer puts Business Central tabs to sleep.

**How.**
- Service worker: on `chrome.tabs.onUpdated`, set
  `chrome.tabs.update(tabId, { autoDiscardable: false })` for tabs whose URL
  passes `isWebClientTarget()`. Our `<all_urls>` host permission already exposes
  the tab URL, so no extra permission is needed. Verify that before relying on
  it.
- `isWebClientTarget()` lives in `content.js` today. Move it to `lib/match.js`
  so the service worker can use the same test.
- Do not accept a "keep me awake" message from content scripts. The background
  refuses content-script messages on purpose (`isExtensionPage`), and this does
  not need to change that.
- Set `autoDiscardable` back to `true` when the switch is turned off.
- Be honest in the docs about the limit. It stops the browser discarding the
  tab. BC's own idle-session timeout on the server stays exactly as it is, and
  we do not send keep-alive traffic to get around it: some organisations rely
  on that timeout.
- Unverified: whether Edge's Sleeping Tabs honour `autoDiscardable`. Test in
  Edge with a short sleep timeout before writing the docs.

**Settings.** `keepAwake: { enabled }`.

## Work every feature brings along

- **Settings.** One `{ enabled }` object per tweak in `normalize()`
  (`settings.js`), like `maximize` and `highlightRow`, with an `…On(settings)`
  helper that also checks `settings.enabled`. Tweaks are personal and are not
  part of `toExport()`.
- **Options.** One card per feature in the Web client panel
  (`options.html`, `options.js`), with strings in `_locales/en` and
  `_locales/nl`.
- **Content script.** One `apply…()` per feature, called from `apply()` in
  `content.js` and undone in `clearAll()` or when its switch goes off.
  `shouldWatch()` wakes the watch loop only for a tweak that keeps acting on
  BC, as Maximize does. One that is set once (the row tint) stays out of it;
  see *Performance* in `CLAUDE.md`.
- **Tests.** Normalisation defaults in `tests/test-core.html`, and an options
  check in `tests/test-options.html`.
- **Docs, in the same commit** (see `CLAUDE.md`): a line under `## Unreleased`
  in `CHANGELOG.md`, the Web client part of README *Getting started* together
  with `docs/getting-started.md`, and a troubleshooting entry where a feature
  can visibly fail (copy over HTTP, the keep-awake limit).
- **Live check.** Each feature is tried against a current BC online client and
  one on-prem version before it ships.

## Backlog

Not planned yet. Roughly in order of value for the effort.

- **Same page in another environment or company** from the popup, e.g.
  Sandbox ↔ Production. Keeps page and filter, and falls back to the page alone
  when the record does not exist there. No tool offers this.
- **Dropdown columns.** Hide or reorder lookup columns, as the next step after
  Dropdown size. "More modification possibilities for DropDown fieldgroup",
  263 votes.
- **Ctrl+Enter presses OK** in dialogs and request pages (76 votes), with a
  per-rule switch to turn it off in Production.
- **Show the full text of truncated cells** (wrap or hover).
- **Show that a filter is active** on the filter icon (65 votes).
- **Sturdier tile → list.** BC25.1 added `layout=list` to the URL, which
  could replace some of Maximize's clicking.
- **Sum, count and average of selected rows** in normal lists. BC does this only
  in analysis mode.
- **Remember sort order; open a chosen view by default** (79 + 151 votes).
- **Copy the filter as text, or a link that keeps it.** BC's Copy link drops
  filters.
- **Optional NAV keyboard set:** F4 lookup, Ctrl+Shift+A clear filters, Ctrl+E
  Excel, Ctrl+PgUp/PgDn. Unverified whether BC accepts simulated keys.
- **Compact rows, week numbers in the date picker (40), combine filters from a
  lookup (305).**

### Decided against

- **Dark mode.** Popular (211+ votes, declined by Microsoft three times), but
  it breaks with every BC release. Stay compatible with Dark Reader instead.
- **Command palette / jump to a record.** Already covered by other extensions
  and by BC's own Alt+Q.
- **Session keep-alive traffic.** Defeats a timeout some organisations want.
- **Platform features** an extension cannot deliver: saved views that keep
  columns (662 votes), filtering on FlowFields, personalising role centre tiles.

## Research behind this

Gathered 2026-10-06.

- **Ideas portal.** Microsoft's Business Central ideas portal, category
  *General*, the top 200 ideas by votes (pages 1–20 of the *Top* view, 662 down
  to 39 votes). Ideas marked Completed are left out. Ideas Microsoft declined
  stay in, because they are room for an extension. The portal no longer shows
  user comments.
- **Community and docs.** Forums (dynamicsuser.net, mibuso), blogs (yzhums.com,
  Fenwick), and Microsoft Learn release plans and keyboard-shortcut pages,
  checked against what Microsoft has already shipped. Reddit could not be
  reached. Microsoft stopped publishing release plans in September 2026, so
  overlap with future BC versions is harder to predict.
- **Other extensions:**
  - **BC Maximizer** (~860 users) overlaps with Maximize pages.
  - **BC Tools** by Agolution has six small CSS/DOM toggles, including a copy
    icon. It runs on BC online only.
  - Other small tools resize panes, add dark mode or add navigation menus.
  - No Business Central extension marks environments. The Finance & Operations
    equivalents (DevTools for D365F&O, StageSentinel) show the demand.
  - Nobody else resizes dropdowns.
