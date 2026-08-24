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
