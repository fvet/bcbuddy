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

- **Reset to defaults** under **Web client** puts every switch and slider back
  to how BC Buddy starts out, or to your team's choices when you use a shared
  file. **Undo** takes it back.
- **Load samples** under **Environments** adds four ready-made rules of your
  own: Master Data in yellow, Production in green, UAT in red and Development
  in blue. Rules you already have stay as they are. Not shown when your IT
  department installed BC Buddy or set a shared file.
- **Several values in one condition**: **contains** and **does not contain**
  take a list separated by commas, so one rule can cover several
  environments, for example **Environment** **contains** `DEV, UAT, QA`.

### Changed

- **Environments** now fills in **Test URL** from your open Business Central
  tab as soon as you open it, so the green ticks show right away which rules
  fit that tab.

### Fixed

- A rule on **Company** now fits a company with a `+` in its name, such as
  `R+D Solutions`. BC Buddy used to read the `+` as a space.
- An address without an environment, such as
  `businesscentral.dynamics.com/contoso.com`, opens your default environment,
  and BC Buddy now reads it as **Production**. Rules on Production used to miss
  it.

<!-- --8<-- [start:released] -->

## 1.0.14 — 2026-10-17

### Added

- **Striped rows**: every other row in a list gets a light grey, so you stay
  on the right line in a wide list. Off by default; switch it on under
  **Web client** in the options.
- **Keyboard shortcuts**: a keyboard icon in the top bar of Business Central
  shows the shortcuts that work where you are: the page's own actions, such
  as Post (F9), what works in the lines, the list, the card or the date field
  you are in, and a few that work anywhere, with a link to Microsoft's full
  list. The panel stays open while you work, changes along when you open
  another page, and you can drag it by its title.
  Off by default; switch it on under **Web client** in the options.
- **Set up by your IT department**: IT can install BC Buddy on every computer
  and fill in your team's shared file for you, for example with Intune. The
  address then says *Set by your organisation* and cannot be changed.
  Instructions for IT are at the bottom of *Sharing with your team*.

### Changed

- A shared file that could not be loaded is tried again after 1, 2, 4 and 8
  hours, instead of only the next day.

### Fixed

- A **RegEx** condition can no longer freeze your browser. A pattern too
  complex to check safely does not match, and the condition says why.

## 1.0.13 — 2026-10-16

Maintenance release - nothing that changes what you see.

## 1.0.12 — 2026-10-11

### Added

- **Copy values**: rest the mouse on a value in a list or a FactBox, or on a
  field that is a link on a card (Balance (LCY)), and a small copy icon
  appears. Click it to copy the value exactly as Business Central shows it —
  also a No. or an amount that is a link, which you could not select before. Works on values you cannot edit. On by default; it is the
  first switch under **Web client** in the options.
- **Week numbers in the date picker**: the calendar that opens from a date
  field shows the week number in front of each week. They are Business
  Central's own week numbers, which it keeps hidden until you press
  Shift+Home in the calendar; BC Buddy turns them on for you. Press Shift+Home
  to turn them off again, and Business Central remembers it. On by default;
  switch it off under **Web client** in the options.
- **Hide the notifications icon**: the bell at the top right of Business
  Central, which opens Notifications, is hidden. On by default; switch it off
  under **Web client** in the options to get the bell back.
- **Share your Web client settings**: **Export** now also saves the switches
  and sliders under **Web client**, so a team can hand out a set of defaults.
  Importing such a file applies them. Through a shared configuration they are
  defaults: each is applied on the first sync, and after that only when the
  team changes it in the file, so a colleague who switches something off
  keeps it off.
- **BC Buddy in the gear menu**: in Business Central online, the gear icon's
  Settings pane now has a **BC Buddy** section with a **Settings** link that
  opens the options. It is there whenever BC Buddy is installed, also while it
  is switched off.
- French support
- **Pin the action bar**: a page opens with the row of actions under its tabs
  pinned, instead of the way Business Central picks. Unpin it on a page and
  that page stays unpinned. On by default; switch it off under **Web client**
  in the options.

### Fixed

- **Maximize pages** no longer overrules you. A page you switched back to
  narrow or to tiles now stays that way the next time you open it, instead of
  being widened again.
- Layouts in a shared configuration now reach your colleagues. Until now a
  shared rule always looked like the plain default layout, whatever layout it
  had in the file.

- The text in a banner or corner ribbon could show up as a tiny dash while
  **Size** was on automatic. It now fits itself to the banner again.

## 1.0.11 — 2026-10-09

### Added

- **Turn off animations**: pages, dialogs, FastTabs and panes in Business
  Central appear at once instead of sliding or fading in. Progress indicators
  keep moving. On by default; switch it off under **Web client** in the options.

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
