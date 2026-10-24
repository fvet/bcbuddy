# Marketing material

Screenshots and decks that show what BC Buddy adds to Business Central, for
presentations and for announcing BC Buddy on LinkedIn. Nothing in this folder
goes into the extension package: `tools/build-package.ps1` only takes
`manifest.json`, `src`, `_locales` and the icons.

The website uses the same screenshots: `tools/mkdocs_assets.py` serves
`screenshots/` as `assets/screenshots/`, and `docs/web-client.md` shows the
crops (and the full maximize shots) in "With BC Buddy" / "Without BC Buddy"
tabs. A re-shoot under the same file name updates the deck (after uploading
the asset) and the site (at the next release) at once. Renaming or removing a
file breaks the site build until the page is updated, which is on purpose.

- `screenshots/without-*.jpg` and `screenshots/with-*.jpg`: full Business
  Central screens, 1512×794, before and after.
- `screenshots/crop-*.png`: the part of each screen the slides show.
- The management deck is a Claude Slides artifact:
  <https://claude.ai/artifact/WFftWKXnE8RWyNWsneMbtY> (private until shared).

## Recreating the screenshots

This is the recipe for Claude Code with Claude in Chrome. Ask Claude to
"recreate the marketing material" and it follows these steps. When a feature is
added, add a row to the shot list, a slide to the deck and the tabs to its
section in `docs/web-client.md`.

### Before you start

1. Chrome, with the window **in front**: Chrome does not capture a tab in a
   window that is hidden, and the screenshot call times out.
2. BC Buddy loaded unpacked from this repository (`chrome://extensions` >
   **Developer mode** > **Load unpacked**), so unreleased features are in it.
   Turn off the Chrome Web Store version so they don't both run. Claude
   cannot open `chrome://` or `chrome-extension://` pages: any change on the
   BC Buddy settings page is done by the maintainer.
3. Business Central: the maintainer's tenant (the address is not kept in this
   repository), company **CRONUS BE**. Use only demo data in CRONUS, and only basic pages:
   Customers, Vendors, Sales Orders.
4. Business Central in **English**: **My Settings** > **Language** = English
   (United States); **Region** stays Belgian (3.515,66, 9-6-2026). The
   maintainer changes it; some CRONUS BE data (item descriptions, units)
   stays Dutch.

### Privacy: hide the company and the user

No screenshot may show the organisation's logo or tenant address, nor the
user's name or picture. The screenshot tool captures the page only, so the
address bar is never in it. Before **every** screenshot, run this in the page; a full
navigation brings the logo back, so run it again after each one:

```js
const me = document.querySelector('#O365_MainLink_Me');            // name + avatar
if (me) me.style.visibility = 'hidden';
const logo = document.querySelector('#O365_MainLink_TenantLogoImg'); // tenant logo
if (logo) logo.style.visibility = 'hidden';
```

Check the result before using it: the top bar should show only
*Dynamics 365 Business Central* and the icons on the right.

### Shot list

| File | Page and action | BC Buddy |
|---|---|---|
| `without-copy-values` | Customers (page 22), mouse in the far corner | on (the icon only shows on hover) |
| `with-copy-values` | Customers, mouse resting on the text of No. 20000 (Trey Research) | on |
| `without-maximize` | Customer card 20000, wide layout switched **off** with BC's own button (*Toggle wide layout*, top right) | on |
| `with-maximize` | Same card, wide layout on. Switch it back on afterwards | on |
| `without-pin-action-bar` | Sales order 101004 Alpine Ski House, action bar unpinned with BC's own pin (right end of the action row), then click the page title so the row closes | off |
| `with-pin-action-bar` | Same order, action bar pinned again with BC's pin. Leave it pinned | on |
| `without-dropdown` | Sales order 101004, line 1, dropdown arrow in **No.** | off |
| `with-dropdown` | Same | on |
| `without-week-numbers` | Sales order 101004, calendar icon of **Due Date** | off |
| `with-week-numbers` | Same | on |
| `without-current-line` | Sales order 101001 Adatum (several lines), click the **Description** of line 3; type nothing, leave with Escape | off |
| `with-current-line` | Same | on |
| `with-keyboard-shortcuts` | Sales order 101001, click the **Description** of line 3, then the keyboard icon in the top bar; take the whole window with the side panel open. Close the side panel with **×** afterwards. No "without" shot: the slide shows only the panel | on, **Keyboard shortcuts** switched on |
| `without-striped-rows` | Sales Orders list (page 9305); Customers has too few rows | off |
| `with-striped-rows` | Same | on, **Striped rows** switched on |
| `crop-without-hide-factbox` | Customer card 20000, FactBox pane open (BC's own **i** button, top right) | on |
| `crop-with-hide-factbox` | Same card, pane closed with the **i** button: the same click BC Buddy makes on a page nobody set. Open it again afterwards | on |
| `without-env-colours` | Customers opened as `…/{tenant}/Production?company=CRONUS%20BE&page=22` | off |
| `with-env-colours` | Same address, rule **PRODUCTION**: **Environment** equals `Production`, green, *Default* style with a corner banner | on |

Order of work, to switch BC Buddy as few times as possible: first every
"with" shot plus copy values and maximize (BC Buddy on), then the maintainer
switches **Extension active** off for the remaining "without" shots.

Move the mouse to the far bottom-right corner before every shot except
copy values: the pointer is captured in the screenshot.

Crops (`crop-*.png`). Sharper than cropping the JPEG: capture the area with
the Chrome tool's `zoom` action, which returns a PNG at screen resolution.
Areas (x0, y0, x1, y1 on the 1512×794 screenshot): copy values 40, 140, 620,
375 · dropdown 95, 440, 1110, 700 · week numbers 795, 285, 1045, 552 ·
current line 100, 590, 1045, 794, then keep only the first 525 px (Type to
Description; the columns further right have red error marks in CRONUS) ·
pin action bar: cropped from the JPEG at 90, 55, size 910 × 185.
Striped rows was taken later in a 1568×735 window: 45, 135, 1085, 700.
Keyboard shortcuts needs the browser's side panel, which the Chrome tool
cannot capture: the maintainer takes the window (page plus side panel,
without tab strip and address bar, 1508×800), the logo, name and picture
are painted over in the bar's colour, and the crop is 880, 0, 1508, 800
(the top bar icon and the side panel). Hide the FactBox pane was taken in an
894×848 window, cropped to the page under the top bar: 60, 60, 834, 660 (this
also leaves out an environment-colour frame or banner). Zoom at full scale: `scale` below 1 also
shrinks the PNG it saves.

The tooltip of a button (where BC shows an action's shortcut) is the
browser's own and never shows in a screenshot.

The copy-values and current-line slides add an orange ring or frame over the
screenshot (a pinned `<div>` on the slide) to point at the icon and the line;
BC Buddy's own tint is a soft 6 % teal, too faint to see on a projector.

### Things that go wrong

- **Never change data.** Leave a dropdown or a calendar with Escape, and close
  a card with the back arrow. Don't type in a field that has focus.
- BC remembers wide layout per page. If the customer card already opens wide,
  the "without" shot needs BC's own wide-layout button. BC Buddy deliberately
  leaves a stored choice alone.
- The tenant link without an environment (`…/{tenant}?company=…`) gives
  BC Buddy no environment to read, so an **Environment** rule doesn't match.
  Put `/Production` after the tenant in the address.
- The first navigation after closing a card sometimes shows the old page.
  Navigate a second time.
- **Highlight the current line** needs a sales order with several lines; use
  101001. Escape in a line cell closes the order: that is fine, nothing was
  typed.
- Pinning, unpinning and wide layout are stored by BC per page, and BC Buddy
  never overrules a stored choice. That is why the "with" shots for those two
  are made with BC's own button: the same click BC Buddy makes on a page
  without a stored choice. Leave both pinned and wide afterwards.
- BC sometimes shows a newer top bar (black, a round avatar with an initial,
  no tenant logo). The hiding snippet then also needs
  `button[aria-label="User Account"]`.
- Navigating away from an open card or order can trigger a *Leave site?*
  dialog. Close the card with its back arrow first.
- CSS zoom on BC's page (to get bigger screenshots) breaks BC Buddy's hover
  detection and opens field tooltips. Don't.
- The Chrome tool saves every screenshot under the session's `tool-results`
  folder. Copy the ones you keep into `screenshots/` under the names above,
  then crop them with `System.Drawing` in PowerShell.

### The deck

Fourteen slides: cover, architecture (UI / AL / SQL and how each one is
customised), why it's safe, then the web client improvements in the order of
`docs/web-client.md` (copy values, maximize pages, pin the action bar,
dropdown size, week numbers, highlight the current line, keyboard shortcuts,
striped rows, hide the FactBox pane), environment colours, getting started.

**To present:** open `deck/present.html` in Chrome or Edge (double-click it
in Explorer) and press **F** for full screen. Next slide: →, ↓, Page Down,
Space or a click. Previous: ←, ↑, Page Up. Home and End jump to the first and
last slide; Esc leaves full screen. A presentation clicker works too: it sends
Page Up and Page Down. The fonts come from Google Fonts, so without internet
the page falls back to Arial; everything else is in the repo.

`present.html` is generated: after changing a slide, run
`powershell -ExecutionPolicy Bypass -File marketing\deck\build-present.ps1`
and commit the result with the slide. Change the page around the slides
(keys, scaling) in `present.template.html`. The script swaps each `/_blob/`
image address for the file in the table below and draws the `<x-icon>`
icons; it stops with an error on an image or element it doesn't know.

The source is in `deck/project/`, laid out the way the Slides artifact stores
it: `deck.json` (title, slide order, sections, fonts) and one
`slides/<id>.html` per slide. Publish changes from there with the Artifact
tool: `url` = the deck above, `root` = `marketing/deck`, `file_path` = the
changed file. Send `deck.json` along only when the order or the sections
change. Pull edits made in the deck editor back into the repo first (Artifact
`read` with the file paths and `out_dir` = `marketing/deck`).

Images are uploaded to the artifact as assets, and the slides point at them
by asset URL. For a new screenshot, upload it (`asset: true`) and replace the
`src`:

| Slide | Asset | File |
|---|---|---|
| cover | `/_blob/d5d4269ac0d2f7c4d225856646e6921a` | `../../icons/icon512.png` (`icons/logo.svg` at 512 px, written by `icons/build-icons.ps1`) |
| copy | `/_blob/45e5c32bbe176b133035d872f1bcfe57` | `crop-without-copy-values.png` |
| copy | `/_blob/b83c3c20645de7777c200dbe28242b83` | `crop-with-copy-values.png` |
| maximize | `/_blob/49d1904a43219c8f1547216b7ca1b486` | `without-maximize.jpg` |
| maximize | `/_blob/8d8d3b1bbe3de89ba735fd3251917441` | `with-maximize.jpg` |
| pin | `/_blob/b69a95fb6519404ca99ee53e655df60a` | `crop-without-pin-action-bar.png` |
| pin | `/_blob/03a7ccee0d99abe13b8242dedf5773fc` | `crop-with-pin-action-bar.png` |
| dropdown | `/_blob/378c3400f229e0005bc1d59350b01a08` | `crop-without-dropdown.png` |
| dropdown | `/_blob/2396056c0c385b8347eeed1cf5fffc09` | `crop-with-dropdown.png` |
| weeks | `/_blob/c707810d8fba7cee35ef4e9fae39c52a` | `crop-without-week-numbers.png` |
| weeks | `/_blob/994a6c3781cb1d5a15bc719c069b2eae` | `crop-with-week-numbers.png` |
| line | `/_blob/d70a63132784cd3481ea19db750c0746` | `crop-without-current-line.png` |
| line | `/_blob/15dcc4b67044a519f2901594d453e1e9` | `crop-with-current-line.png` |
| shortcuts | `/_blob/713db8844a4ea6c0053779dccff5edf8` | `crop-with-keyboard-shortcuts.png` |
| stripes | `/_blob/10bf7cb2b2055cc5fc817e54da4517b1` | `crop-without-striped-rows.png` |
| stripes | `/_blob/f3cc093f6f6c883fc0262f3678ec9d81` | `crop-with-striped-rows.png` |
| factbox | `/_blob/bdef8623d9456cae2883fedd94f0fec5` | `crop-without-hide-factbox.png` |
| factbox | `/_blob/a6b12f951802a3baa0926db313607a65` | `crop-with-hide-factbox.png` |
| envcolours | `/_blob/f45f098d2f97fa1261c3c5c82610bc54` | `without-env-colours.jpg` |
| envcolours | `/_blob/34b09d6a87dde8d87ecdfd226505e1fc` | `with-env-colours.jpg` |
