# TODO — translate Dutch comments to English

The README, the store copy and the extension's English locale are done. What is
left is the Dutch still sitting *inside* the source: roughly 510 comment lines
across the extension, the tests and the build scripts.

Work through it file by file and tick as you go. Nothing here changes behaviour,
so the test suite should stay green after every file:

```bash
powershell -ExecutionPolicy Bypass -File tests/run-tests.ps1
```

## Conventions

Decide these once, before starting, so the result reads as one voice:

- Keep the existing tone. The comments explain *why*, not *what* — translate
  that intent rather than the words. Several are small arguments ("without a
  source there is nothing to update"); keep the argument.
- Keep BC vocabulary in English as the client uses it: ribbon, environment,
  company, tenant, sandbox, production.
- Keep the domain words the code already uses in English: rule, layout,
  condition, token, favicon, banner, frame.
- Leave `{name}` / `{environment}` / `{company}` / `{title}` tokens untouched.
- Where a comment names a UI label, use the English label from
  `_locales/en/messages.json`, not a fresh translation.

## Extension source (ships to users) — ~393 lines

Highest value: this is what a reviewer or contributor reads first.

- [ ] `src/lib/settings.js` — 79 lines. The densest file. Includes the block
      comments on `normalizeActive`, `str()` and `effectiveLayout`, which are
      full paragraphs of reasoning.
- [ ] `src/options/options.js` — 116 lines. Most comments are short and inline.
- [ ] `src/content/content.js` — 74 lines. Explains the idempotency and the
      ribbon hunt; take care with the DOM reasoning.
- [ ] `src/lib/match.js` — 40 lines. URL parsing rules, several referencing
      Microsoft's URL shapes.
- [ ] `src/lib/i18n.js` — 17 lines (of only 49 — proportionally the most).
- [ ] `src/popup/popup.js` — 13 lines.
- [ ] `src/background.js` — 12 lines, including the file header.
- [ ] `src/options/options.css` — 28 lines.
- [ ] `src/content/content.css` — 7 lines.
- [ ] `src/popup/popup.css` — 4 lines.
- [ ] `src/options/options.html` — 2 lines.
- [ ] `src/popup/popup.html` — 1 line.

## Tests — ~108 lines

- [ ] `tests/test-options.html` — 54 lines.
- [ ] `tests/test-core.html` — 42 lines.
- [ ] `tests/test-popup.html` — 10 lines.
- [ ] `tests/run-tests.ps1` — 2 lines, plus the usage block at the top.

## Build scripts — ~13 lines

- [ ] `icons/build-icons.ps1` — 8 lines, including the two `<# … #>` headers.
- [ ] `tools/build-package.ps1` — 5 lines, including the header.

## Decide separately — not comments

These are Dutch too, but translating them is a different call and should not be
folded into the sweep above:

- [ ] **Test check labels.** Every assertion is named in Dutch
      (`check('opties: geen intervalkeuze meer', …)`) — several hundred strings
      across the three test pages. They are test output, not comments. Worth
      doing for consistency, but it is a bigger job than all the comments
      combined and it churns every line of the suites.
- [ ] **PowerShell console output.** `Write-Host` messages in the three scripts
      ("Pakket klaar", "Alles geslaagd", "Geen Chrome of Edge gevonden").
      User-facing, but only for you.
- [ ] **`store/*.txt`.** Deliberately Dutch — those are notes for filling in the
      dashboard, and `description-nl.txt` is the listing copy itself. Leave.
- [ ] **`_locales/nl/messages.json`.** Must stay Dutch. It is the Dutch
      translation.

## Not part of this

The `BCEM` namespace and the `bcem-` prefixes on CSS classes, alarm names and
message types (`bcem:sync`, `bcem:preview`) are identifiers, not language.
Renaming them is a separate refactor with real risk — the CSS prefix appears in
both the content script and the stylesheet, and the alarm name is persisted by
Chrome. Leave them alone unless you decide to rename deliberately.
