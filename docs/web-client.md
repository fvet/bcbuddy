# Web client

BC Buddy makes the Business Central web client itself easier to work in. There
is nothing to set up: most of it is on from the moment you install it. Each
improvement has its own switch under **Web client** on the BC Buddy settings
page, so you can turn off whatever you do not like.

| Improvement | What you get in Business Central | Starts |
|---|---|---|
| [Copy values](#copy-values) | A copy icon on any value in a list or FactBox | On |
| [Maximize pages](#maximize-pages) | Every page uses the full width of your screen | On |
| [Pin the action bar](#pin-the-action-bar) | The row of actions under a page's tabs is pinned | On |
| [Dropdown size](#dropdown-size) | The list under a field shows all its columns | On |
| [Week numbers in the date picker](#week-numbers-in-the-date-picker) | Business Central's own week numbers in the calendar of a date field | On |
| [Keyboard shortcuts](#keyboard-shortcuts) | A keyboard icon in the top bar that shows the shortcuts for where you are | On |
| [Highlight the current line](#highlight-the-current-line) | The line you are on in a journal or order stands out | On |
| [Hide the notifications icon](#hide-the-notifications-icon) | No bell at the top right | On |
| [Striped rows](#striped-rows) | Every other row in a list a light grey | Off |
| [Turn off animations](#turn-off-animations) | Pages and dialogs appear at once | Off |

A change takes effect in Business Central straight away. The **Extension
active** switch at the top of the settings page pauses all of BC Buddy at once.

## Copy values

Rest the mouse on a value in a list or a FactBox for a moment, and a small copy
icon appears next to it. Click it and the value is copied, exactly as Business
Central shows it: an amount like `3.515,66`, a date, or a No. you could not
select before because it is a link. The icon briefly turns into a tick.

On a card, fields that are a link get the icon too, such as **Balance (LCY)**.
A field you can type in gets no icon: select its text and press Ctrl+C as usual.

## Maximize pages

Every page opens in wide layout, so you see more fields and columns without
scrolling. Pages that show tiles switch to a list.

BC Buddy only changes a page the first time it opens. Business Central
remembers per page how you left it, in your browser, so a page you switch back
to narrow or to tiles yourself stays that way, also the next time you open it.

## Pin the action bar

The row of actions under a page's tabs, such as **Start** or **Prepare**, has a
pin at its right end. Business Central remembers per page whether you pinned
it, but a page you never pinned opens the way Business Central picks. With this
on, such a page opens with the action bar pinned.

Unpin it on a page and that page stays unpinned: BC Buddy only pins a page
nobody set yet.

Switching **Maximize pages** or **Pin the action bar** off does not undo what
they already did: Business Central remembers those pages. Set a page back by
hand if you want it different.

## Dropdown size

The list that opens under a field, such as Country/Region Code or the item
number on a sales line, gets more room. There are two sliders:

- **Width**: the list gets as wide as its columns need, up to this maximum, so
  you no longer scroll sideways. It starts at the widest step.
- **Height**: shows more rows at once, up to about ten instead of five. It
  starts at the tallest step.

With both sliders all the way left, at *BC standard*, the list keeps Business
Central's own size.

## Week numbers in the date picker

The calendar that opens from a date field shows the week number in front of
each week. These are Business Central's own week numbers: Business Central has
them, but leaves them off until you press **Shift+Home** in the calendar. BC
Buddy turns them on for you, once.

To turn them off, or back on, press **Shift+Home** while the calendar is open.
Business Central remembers that, and BC Buddy leaves it.

Business Central counts the weeks as the **Region** in **My Settings** says.
With Dutch, for example, weeks start on Monday and week 1 is the week with the
first Thursday of the year.

## Keyboard shortcuts

BC Buddy adds a keyboard icon to the top bar of Business Central, next to the
question mark. Click it to see the shortcuts that work where you are:

- **On this page**: the page's own actions that have a shortcut, such as
  **Post** (F9). Each one also gets a small label on the action itself.
- What works in the lines of a journal or order, in a list, on a card or in a
  date field, depending on where your cursor is.
- A few that work anywhere, such as Alt+Q to find a page.

Press **Esc** or click anywhere else to close it; your cursor goes back to
where it was. A link at the bottom opens Microsoft's full list of shortcuts.

Actions in a menu you have not opened yet are not listed: Business Central only
builds those when you open the menu.

<details>
<summary>Opening it with a key, or on Business Central on your own server</summary>

You can give the panel a key of your own. In Chrome, go to
`chrome://extensions/shortcuts`; in Edge, `edge://extensions/shortcuts`. Next to
**BC Buddy**, set a key for *Show the keyboard shortcuts for this Business
Central page*. Pick one Business Central does not use itself.

Business Central on your own server (on-premises) has a different top bar,
without the icon. There this key is the way to open the panel.

</details>

## Highlight the current line

On the lines of a sales order or in a journal, Business Central shows the line
you are on with only a small arrow at the far left. With this on, the whole line
gets a light tint, so you do not lose your place on a wide line.

## Hide the notifications icon

The bell at the top right of Business Central is hidden. Switch this off to get
it back.

## Striped rows

Every other row in a list gets a light grey, so your eye stays on the right
line when you read across a wide list such as **General Ledger Entries**. The
line you are on and the lines you select keep Business Central's own colours.

This one is off until you switch it on.

## Turn off animations

Business Central slides or fades in pages, dialogs and FastTabs, so opening a
card or a dialog takes a moment each time. With this on they appear at once.
Progress indicators keep moving, so you can still see when Business Central is
busy.

This one is off until you switch it on.

Something not working as described? See [Troubleshooting](troubleshooting.md).
