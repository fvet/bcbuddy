# CLAUDE.md

## Language

Do all development in English: source comments, commit messages, test harness
output, build-script messages, and docs meant for contributors.

Exceptions that stay Dutch on purpose:

- `_locales/nl/messages.json` — the Dutch UI locale
- `store/*.txt` — store listing notes and Dutch listing copy

## Documentation

`README.md` and `docs/` describe the same features for different readers, so a
behaviour change usually touches both. Check the counterpart in the same commit:

| README section | Site page |
|---|---|
| Getting started | `docs/getting-started.md` |
| How matching works | `docs/matching.md` |
| Rules and layouts · What a layout can show · Tokens | `docs/layouts.md` |
| Sharing settings with your team | `docs/sharing.md` |
| Troubleshooting | `docs/troubleshooting.md` |
| Installing | `docs/index.md` |

A change people notice also gets a line under `## Unreleased` in `CHANGELOG.md`,
in the same commit that makes it. That file is for users, so it is written in
their words and about what they see; build, CI, dependency and refactoring work
stays out of it. The release workflow dates the `Unreleased` section, uses it as
the GitHub release body and opens an empty one for next time — so an entry that
was never written is a release note nobody gets.

`DEVELOPMENT.md` is contributor-facing and overlaps neither; it drifts against
code rather than against prose, so re-read it when `.github/workflows/`,
`mkdocs.yml`, `manifest.json`, or the release or permission story changes.

Prefer single sourcing over a second copy wherever it is cheap. `docs/privacy.md`
and `docs/whats-new.md` are `pymdownx.snippets` includes of `PRIVACY.md` and
`CHANGELOG.md`, and `tools/mkdocs_assets.py` adds the `store/` screenshots and
`examples/bc-buddy.json` to the MkDocs build instead of duplicating them.

`docs/whats-new.md` includes only the `released` section of `CHANGELOG.md`, the
part below the `<!-- --8<-- [start:released] -->` marker. Leave that marker
directly under `## Unreleased`: the release workflow matches on it, and it is
what keeps unreleased notes off the site.

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
