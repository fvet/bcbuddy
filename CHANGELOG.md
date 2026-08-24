# What's new

What changed in each released version, written for the people who use BC Buddy.
Build, packaging and refactoring work is deliberately left out — it is in the
[commit history](https://github.com/fvet/bcbuddy/commits/main) if you want it.

## Unreleased

### Added

- **About** on the options page now links to the documentation site, alongside
  the link to the source code.
- The website has a *What's new* page, so you can see what changed in a version
  without reading the commit log.

## 1.0.2 — 2026-08-24

### Added

- A documentation website at <https://fvet.github.io/bcbuddy/>: getting
  started, how matching works, rules and layouts, sharing with a team,
  troubleshooting and the privacy policy. It is republished with every release,
  so it describes the version you can actually install.

### Fixed

- The README, the website and both store listings described production as red
  and sandbox as green, while the example configuration people import ships the
  opposite. The text now matches what you get: production green, sandbox red.
- Links in the body of the website pages rendered in the default indigo instead
  of the intended teal and cyan.

## 1.0.1 — 2026-08-24

First public release.

- **A colour per environment.** Rules match on environment, company or
  customer, for Business Central online and on-premises alike.
- **Five ways to mark a tab.** The bar at the top of the client, a frame around
  the window, a banner or corner ribbon, the tab title and the tab icon. Turn
  on as many as you find useful.
- **Shared settings.** Point a team at one configuration file and everyone gets
  the same markings, later changes included.
- **Dutch and English**, following the language of your browser.
- **Nothing leaves your machine.** No server, no analytics, no tracking.

Version 1.0.0 was a development version and never shipped, so the history
starts at 1.0.1.
