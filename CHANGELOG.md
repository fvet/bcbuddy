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

- **Report a problem** — a small panel on top of Business Central that lets
  anyone send a support request to your helpdesk without leaving the page.
  Open it from the BC Buddy icon in the browser toolbar, or from the *Report a
  problem* link BC Buddy adds next to the brand name in the Business Central
  ribbon, on any page it recognises as Business Central.
  Describe what went wrong, add screenshots if you like, choose a type and
  priority, and click *Send to support*: your email app opens with the address
  and subject filled in, and the report (description, environment, company,
  browser details and screenshots) is on the clipboard ready to paste. A
  description alone is enough to send. The helpdesk address, the panel colour
  and the ribbon link live under *Settings > Support* and travel with a shared
  configuration, so a whole team gets them at once.

- **Screenshots** — *Add a screenshot* lets you drag a rectangle over the part
  of the page that matters, and then opens the editor so you can point at it
  with arrows or freehand strokes in six colours before it is saved; *Save*
  adds it, Esc or the cross discards it. The button next to it captures the
  whole screen and lands as a thumbnail straight away. Click any thumbnail, or
  its pencil, to draw on it later. Up to nine screenshots per report, and they
  survive navigating to another page while you walk through a scenario.
  Screenshots are scaled down and compressed, so a report with all nine still
  fits in an email.

- **After sending** — the panel stays open with the two remaining steps in
  plain words (paste with Ctrl+V, click Send), a *Copy again* button in case
  something else overwrote the clipboard, and *Save report* to keep the report
  as a file and attach it yourself when no email opened or when you use webmail,
  where pasted pictures often go missing. Without a helpdesk
  address the panel says so, opens the email with an empty To field, and links
  to the settings.

- Closing the panel with unsent screenshots asks first, and Esc closes it
  too; the gear opens settings without closing the panel. The panel is
  available in Dutch.

- **Set up by your organisation** — IT can push the URL of the shared
  configuration through browser policy (Intune, Group Policy, the Google Admin
  console). BC Buddy then loads the company configuration by itself, on first
  install and at every browser start, shows the URL as *Set by your
  organisation* and no longer opens the options page after installing. The
  steps for each tool are on the site under *Deploying for your organisation*.

### Changed

- Clicking the BC Buddy toolbar icon opens the *Report a problem* panel instead
  of the popup. The switch, *Add rule* and *Sync* that lived there are on the
  options page.

### Fixed

- A shared configuration now brings its layouts along. Before, only the rules
  arrived, so shared rules were drawn with a default layout instead of the one
  the file chose for them.
### Fixed

- Ribbon colour is now preserved when the **Dark Reader** browser extension is active.

### Added

- **Report a problem** — a small panel on top of Business Central that lets
  anyone send a support request to your helpdesk without leaving the page.
  Open it from the BC Buddy icon in the browser toolbar, or from the *Report a
  problem* link BC Buddy adds next to the brand name in the Business Central
  ribbon, on any page it recognises as Business Central.
  Describe what went wrong, add screenshots if you like, choose a type and
  priority, and click *Send to support*: your email app opens with the address
  and subject filled in, and the report (description, environment, company,
  browser details and screenshots) is on the clipboard ready to paste. A
  description alone is enough to send. The helpdesk address, the panel colour
  and the ribbon link live under *Settings > Support* and travel with a shared
  configuration, so a whole team gets them at once.

- **Screenshots** — *Add a screenshot* lets you drag a rectangle over the part
  of the page that matters, and then opens the editor so you can point at it
  with arrows or freehand strokes in six colours before it is saved; *Save*
  adds it, Esc or the cross discards it. The button next to it captures the
  whole screen and lands as a thumbnail straight away. Click any thumbnail, or
  its pencil, to draw on it later. Up to nine screenshots per report, and they
  survive navigating to another page while you walk through a scenario.
  Screenshots are scaled down and compressed, so a report with all nine still
  fits in an email.

- **After sending** — the panel stays open with the two remaining steps in
  plain words (paste with Ctrl+V, click Send), a *Copy again* button in case
  something else overwrote the clipboard, and *Save report* to keep the report
  as a file and attach it yourself when no email opened or when you use webmail,
  where pasted pictures often go missing. Without a helpdesk
  address the panel says so, opens the email with an empty To field, and links
  to the settings.

- Closing the panel with unsent screenshots asks first, and Esc closes it
  too; the gear opens settings without closing the panel. The panel is
  available in Dutch.

- **Set up by your organisation** — IT can push the URL of the shared
  configuration through browser policy (Intune, Group Policy, the Google Admin
  console). BC Buddy then loads the company configuration by itself, on first
  install and at every browser start, shows the URL as *Set by your
  organisation* and no longer opens the options page after installing. The
  steps for each tool are on the site under *Deploying for your organisation*.

### Changed

- Clicking the BC Buddy toolbar icon opens the *Report a problem* panel instead
  of the popup. The switch, *Add rule* and *Sync* that lived there are on the
  options page.

### Fixed

- A shared configuration now brings its layouts along. Before, only the rules
  arrived, so shared rules were drawn with a default layout instead of the one
  the file chose for them.

<!-- --8<-- [start:released] -->

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
