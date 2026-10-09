# What's new

What changed in each released version, written for the people who use BC Buddy.
Build, packaging and refactoring work is deliberately left out — it is in the
[commit history](https://github.com/fvet/bcbuddy/commits/main) if you want it.

<!-- Entries for the next release go under Unreleased, as they land. The website
     includes only what sits below the marker, so a note never reaches the site
     before the release that ships it — and an Unreleased section that is empty,
     which is its usual state, is not published as a bare heading. -->

## Unreleased

### Added

- **Turn off animations**: pages, dialogs, FastTabs and panes in Business
  Central appear at once instead of sliding or fading in. Progress indicators
  keep moving. On by default; switch it off under **Web client** in the options.

<!-- --8<-- [start:released] -->

## 1.0.10 — 2026-10-06

### Added

- **Highlight the current line** — in editable lists, such as the lines of a
  sales order or a journal, the line you are on gets a light tint across its
  full width. Business Central itself only shows a small arrow at the far
  left. Read-only lists keep their own highlight. On by default; switch it off
  under **Web client**.

### Changed

- The options take less reading. **Web client** and **Import / export** are
  short lists: each setting has its name with its switch or button on the
  right. Hover a setting to see what it does; a link under Web client leads to
  the documentation.
- Under **Environments**, your rules now come first and layouts second.
- A layout lists its parts — ribbon, frame, banner, tab title and favicon — as
  rows: its name, its settings and a switch on the right. Hover the name to see
  what it does; a part that is off shows only its name and switch. The tokens
  you can use in the texts (`{name}`, `{environment}`, `{company}`, `{title}`)
  are on one line at the bottom, instead of behind a question mark beside
  every text field. The banner's **Opacity** is a slider of five steps, like
  the frame's thickness.
- A rule's on/off switch no longer has the word *On* beside it, and the
  popup's **Extension active** is now the same switch as in the options.
- **Shared configuration** fits on one line: the URL with **Synchronise**
  beside it.

## 1.0.9 — 2026-10-06

### Added

- **Dropdown size** — the list that opens under a field (Country/Region Code,
  the item number on a sales line, …) gets more room: as wide as its columns
  need, up to a maximum you set with a slider, and optionally taller. On by
  default with wider lists and BC's usual height; slide both to *BC standard*
  to turn it off.

### Changed

- The **Maximize** section of the options is now called **Web client**. It
  holds both *Maximize pages* and the new *Dropdown size*.

### Fixed

- Ribbon colour is now preserved when the **Dark Reader** browser extension is active.
- Turning BC Buddy off with **Extension active** now stops **Maximize pages**
  too. It no longer switches pages to wide layout and list view while the
  extension is off.
- **Maximize pages** works again in current Business Central versions. Tile
  pages switch to list view again, and a page you open from inside BC is
  widened too, not just the first page you opened. That includes a page that
  opens as a window over another one, for example from **Search**, and the list
  behind **Select from full list** on a field, which now opens maximized.

## 1.0.8 — 2026-09-14

Maintenance release - nothing that changes what you see.

## 1.0.7 — 2026-09-12

### Added

- **Maximize** — new option (on by default) that automatically expands every
  Business Central page to wide layout and switches tile pages to list view.
  Works on SaaS (`*.dynamics.com`) and on-premises environments, including
  servers where the URL contains `/BC` in the path or the hostname starts with
  `bc` (e.g. `bc`, `bcdev`, `bcprod`).

## 1.0.4 — 2026-08-24

### Added

- BC Buddy is published under the MIT licence: use it at work, change it and
  pass it on.

## 1.0.3 — 2026-08-24

### Added

- The website has a *What's new* page, so you can see what changed in a version
  without reading the commit log.

## 1.0.2 — 2026-08-24

### Added

- A documentation website at <https://fvet.github.io/bcbuddy/>: getting
  started, how matching works, rules and layouts, sharing with a team,
  troubleshooting and the privacy policy. It is republished with every release,
  so it describes the version you can actually install.

## 1.0.1 — 2026-08-24

First public release.

- **A colour per environment.** Rules match on environment, company or
  customer, for Business Central online and on-premises alike.
- **Five ways to mark a tab.** The bar at the top of the client, a frame around
  the window, a banner or corner ribbon, the tab title and the tab icon. Turn
  on as many as you find useful.
- **Shared settings.** Point a team at one configuration file and everyone gets
  the same markings, later changes included.
- **Nothing leaves your machine.** No server, no analytics, no tracking.

<!-- --8<-- [end:released] -->
