# BC Buddy

> **Business Central, easier to work in** ✨

BC Buddy is a free extension for Chrome and Edge. It makes the Business Central
web client easier to work in, and gives every environment its own colour, so
you never post in production by mistake.

- **An easier web client**, straight away: copy any value with one click, wide
  pages, bigger dropdowns, week numbers in the date picker and more.
- **A colour for every environment**: production green, sandbox red, or
  whatever suits you.

Full documentation: **<https://fvet.github.io/bcbuddy/>** · What's new in each
version: [CHANGELOG.md](CHANGELOG.md)

## 📥 Installing

Install it from the
[Chrome Web Store](https://chromewebstore.google.com/detail/bc-buddy/jpgpcfecpdcocjlepdfceahamliimjdl)
and click **Add to Chrome**. Edge first asks whether to allow extensions from
other stores; say yes. You need Chrome or Edge 116 or newer.

## 🚀 Getting started

1. **Install BC Buddy.** Its settings page opens by itself. Later, click the
   BC Buddy icon in the toolbar to open it again, or in Business Central click
   the gear icon at the top right and choose **Settings** under **BC Buddy**.
2. **Open Business Central**, or reload a tab where it was already open. The
   web client improvements below are already working.
3. **Give your environments a colour.** On the settings page, go to
   **Environments**. Four sample rules are already there, switched off. Click
   **Load samples** to switch them on: Production turns green, test
   environments red. Or switch on only the ones you want.

Not sure what your environment is called? Open **Environments** while a
Business Central tab is open: under **Test**, at the bottom, BC Buddy shows
the environment and company of that tab.

## 🖥️ Web client

No setup needed. Each improvement has its own switch under **Web client** on
the settings page.

| Improvement | What you get in Business Central | Starts |
|---|---|---|
| <img src="icons/settings/copy-values.svg" width="18" height="18" alt=""> **Copy values** | A copy icon on any value in a list or FactBox, and on links on a card | On |
| <img src="icons/settings/maximize.svg" width="18" height="18" alt=""> **Maximize pages** | Every page in wide layout, tile pages as a list | On |
| <img src="icons/settings/pin-action-bar.svg" width="18" height="18" alt=""> **Pin the action bar** | Every page opens with the row of actions under its tabs pinned | On |
| <img src="icons/settings/dropdown.svg" width="18" height="18" alt=""> **Dropdown size** | The list under a field as wide as its columns need, and taller if you like | On |
| <img src="icons/settings/resize-panes.svg" width="18" height="18" alt=""> **Resize panes** | Drag Help, Copilot, Page Inspection and the Personalization field list wider or narrower | On |
| <img src="icons/settings/week-numbers.svg" width="18" height="18" alt=""> **Week numbers in the date picker** | Business Central's own week numbers in the calendar of a date field; Shift+Home turns them off | On |
| <img src="icons/settings/highlight-row.svg" width="18" height="18" alt=""> **Highlight the current line** | The line you are on in a journal or order stands out | On |
| <img src="icons/settings/shortcuts.svg" width="18" height="18" alt=""> **Keyboard shortcuts** | The BC Buddy logo in the top bar shows the shortcuts for where you are in a side panel | Off |
| <img src="icons/settings/stripe-rows.svg" width="18" height="18" alt=""> **Striped rows** | Every other row in a list a light grey | Off |
| <img src="icons/settings/hide-fact-box.svg" width="18" height="18" alt=""> **Hide the FactBox pane** | Pages open without the FactBox pane on the right, so the page gets the room | Off |
| <img src="icons/settings/hide-notifications.svg" width="18" height="18" alt=""> **Hide the notifications icon** | No bell in the top bar | Off |
| <img src="icons/settings/no-animations.svg" width="18" height="18" alt=""> **Turn off animations** | Pages, dialogs and FastTabs appear at once instead of sliding in | Off |

**Reset to defaults**, above the list, puts every switch and slider back to
how BC Buddy starts out. When your team shares a file, the button reads
**Reset to your team's defaults** and takes the team's choices from that file.
Clicked by mistake? **Undo** sits right next to the message.

Looking for a dark theme or a blue light filter? BC Buddy leaves those to tools
that do them well: [Dark Reader](https://darkreader.org/) for dark mode, and
**Night light** in Windows for a warmer screen.

What each one does, in detail:
[Web client](https://fvet.github.io/bcbuddy/web-client/) on the website.

## 🎨 Environment colours

Ten tabs open, one of them is Production, and a test order gets posted in the
live company. It happens because a test environment and the real one look
exactly alike. BC Buddy colours the bar at the top of Business Central, with
your own text, and can add a bar above it, a coloured frame, a banner, a
marked tab title and a coloured tab icon.

![The Sales Orders list in Business Central with a green top bar, a green frame around the page and a diagonal Production banner in the bottom-left corner. The keyboard shortcuts side panel is open on the right](store/screenshot-4-sales-orders-1280x800.png)

You set this up under **Environments** on the settings page:

- A **rule** says which environment gets which colour, for example
  **Environment** **equals** `Production`. The first rule that fits wins.
- A **style** says what the marking looks like. *Full* shows every marking,
  *Subtle* only colours the bar at the top.

BC Buddy comes with four sample rules, switched off: Production green, test
environments red, development blue and master data companies yellow.
**Load samples** switches them on. When your team's shared file brings rules,
those take the place of the samples you did not change.

More on the website: [Rules](https://fvet.github.io/bcbuddy/matching/) ·
[Styles](https://fvet.github.io/bcbuddy/styles/).

## 👥 Sharing settings with your team

One person sets up the colours and everyone else gets them automatically.

1. Click **Export to file** on the settings page. That saves `bc-buddy.json`,
   with your rules, styles and **Web client** settings.
2. Put it somewhere everyone can open it over `https://`, such as a
   repository. Only use an address you control: the file decides what BC Buddy
   colours.
3. Your colleagues paste that address under **Settings** > **Shared
   configuration** and click **Synchronise**. BC Buddy checks for changes every
   day.

To try it out, use `https://fvet.github.io/bcbuddy/examples/bc-buddy.json`, the
same file as [`examples/bc-buddy.json`](examples/bc-buddy.json).

IT can install BC Buddy on every computer and set the shared file for everyone
with Intune or Group Policy; the scripts are in
[`examples/intune/`](examples/intune/).

More on the website: [Team file](https://fvet.github.io/bcbuddy/sharing/) ·
[Install with Intune](https://fvet.github.io/bcbuddy/intune/).

## 🛟 Troubleshooting

**Nothing changed after installing.** Reload the Business Central tab (F5), and
check that **Active**, below the menu on the left of the settings page, is on.

**A page stays narrow, in tiles or with the action bar unpinned.** BC Buddy only
changes a page nobody set yet. Business Central remembers your own choice per
page, and BC Buddy leaves it.

**Nothing is coloured.** Open **Environments** with your Business Central tab
still open. The rule that tab gets has a border all round in its colour; no
such border means none of your rules fits it.

**Something stopped working after a Business Central update.** Please
[open an issue](https://github.com/fvet/bcbuddy/issues).

More on the website: [Troubleshooting](https://fvet.github.io/bcbuddy/troubleshooting/).

## 🌍 Languages

BC Buddy is in English, Dutch and French, and follows the language of your browser.
To use another one, pick it in the language list at the top right of the BC Buddy
settings. Business Central keeps its own language. The texts you type yourself in a rule or style appear exactly as you type
them. Would you like it in your own language? See
[TRANSLATING.md](TRANSLATING.md).

## 🔒 Privacy

Everything stays on your own computer. No server, no account, no tracking. The
only thing BC Buddy ever downloads is your team's shared file, from the address
you enter yourself. Full text in [PRIVACY.md](PRIVACY.md).

## 🛠️ For developers

Working on the extension itself is covered in [DEVELOPMENT.md](DEVELOPMENT.md).
To run it from source: open `chrome://extensions` (or `edge://extensions`), turn
on **Developer mode**, click **Load unpacked** and pick a clone of this
repository or an unpacked `bcbuddy-*.zip` from the
[releases page](https://github.com/fvet/bcbuddy/releases/latest).

## 📄 Licence

MIT — the full text is in [LICENSE](LICENSE). Use it, change it and pass it on,
inside a company as well; the copyright notice and the licence text have to
travel with it.

## ⚖️ Disclaimer

BC Buddy is an independent open-source project. It is not affiliated with,
endorsed by or supported by Microsoft. Microsoft, Dynamics 365 and Business
Central are trademarks of the Microsoft group of companies.

BC Buddy is provided as is, without warranty of any kind, and its authors are
not liable for any damage that comes from using it. The full terms are in
[LICENSE](LICENSE).
