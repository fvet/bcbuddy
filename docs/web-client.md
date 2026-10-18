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
| [Highlight the current line](#highlight-the-current-line) | The line you are on in a journal or order stands out | On |
| [Hide the notifications icon](#hide-the-notifications-icon) | No bell at the top right | On |
| [Keyboard shortcuts](#keyboard-shortcuts) | A keyboard icon in the top bar that shows the shortcuts for where you are | Off |
| [Striped rows](#striped-rows) | Every other row in a list a light grey | Off |
| [Turn off animations](#turn-off-animations) | Pages and dialogs appear at once | Off |

A change takes effect in Business Central straight away. The **Extension
active** switch at the top of the settings page pauses all of BC Buddy at once.

Changed too much? **Reset to defaults**, above the list, puts every switch and
slider back to how BC Buddy starts out. **Undo**, right next to the message,
takes it back. When your team shares a file, the button reads **Reset to your
team's defaults** and takes the team's choices from that file; see
[Team file](sharing.md#web-client-settings-in-the-file).

## Copy values

Rest the mouse on a value in a list or a FactBox for a moment, and a small copy
icon appears next to it. Click it and the value is copied, exactly as Business
Central shows it: an amount like `3.515,66`, a date, or a No. you could not
select before because it is a link. The icon briefly turns into a tick.

=== "With BC Buddy"

    ![The Customers list with the mouse on customer No. 20000, Trey Research. A small copy icon appears right next to the number](assets/screenshots/crop-with-copy-values.png){ loading=lazy }

=== "Without BC Buddy"

    ![The same Customers list with no copy icon next to the numbers](assets/screenshots/crop-without-copy-values.png){ loading=lazy }

On a card, fields that are a link get the icon too, such as **Balance (LCY)**.
A field you can type in gets no icon: select its text and press Ctrl+C as usual.

## Maximize pages

Every page opens in wide layout, so you see more fields and columns without
scrolling. Pages that show tiles switch to a list.

=== "With BC Buddy"

    ![A customer card in wide layout, using the full width of the screen](assets/screenshots/with-maximize.jpg){ loading=lazy }

=== "Without BC Buddy"

    ![The same customer card as a narrower window, with the customer list still visible behind it](assets/screenshots/without-maximize.jpg){ loading=lazy }

BC Buddy only changes a page the first time it opens. Business Central
remembers per page how you left it, in your browser, so a page you switch back
to narrow or to tiles yourself stays that way, also the next time you open it.

## Pin the action bar

The row of actions under a page's tabs, such as **Start** or **Prepare**, has a
pin at its right end. Business Central remembers per page whether you pinned
it, but a page you never pinned opens the way Business Central picks. With this
on, such a page opens with the action bar pinned.

=== "With BC Buddy"

    ![A sales order with the action bar pinned: the row of actions under the tabs, such as Post and Release, stays open](assets/screenshots/crop-with-pin-action-bar.png){ loading=lazy }

=== "Without BC Buddy"

    ![The same sales order with only the tabs Home, Prepare, Print/Send and so on, and no actions under them](assets/screenshots/crop-without-pin-action-bar.png){ loading=lazy }

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

With both sliders all the way left, the list keeps Business Central's own size.
Point at a slider to see how big the list gets.

=== "With BC Buddy"

    ![The item list under the No. field of a sales line, wide enough to show every column: No., Description, Base Unit of Measure, Unit Price and Inventory](assets/screenshots/crop-with-dropdown.png){ loading=lazy }

=== "Without BC Buddy"

    ![The same list at Business Central's own size: only No. and Description fit, with a scroll bar to reach the other columns](assets/screenshots/crop-without-dropdown.png){ loading=lazy }

## Week numbers in the date picker

The calendar that opens from a date field shows the week number in front of
each week. These are Business Central's own week numbers: Business Central has
them, but leaves them off until you press **Shift+Home** in the calendar. BC
Buddy turns them on for you, once.

=== "With BC Buddy"

    ![The calendar of the Due Date field with a column of week numbers in front of each week](assets/screenshots/crop-with-week-numbers.png){ loading=lazy }

=== "Without BC Buddy"

    ![The same calendar without week numbers](assets/screenshots/crop-without-week-numbers.png){ loading=lazy }

To turn them off, or back on, press **Shift+Home** while the calendar is open.
Business Central remembers that, and BC Buddy leaves it.

Business Central counts the weeks as the **Region** in **My Settings** says.
With Dutch, for example, weeks start on Monday and week 1 is the week with the
first Thursday of the year.

## Highlight the current line

On the lines of a sales order or in a journal, Business Central shows the line
you are on with only a small arrow at the far left. With this on, the whole line
gets a light tint, so you do not lose your place on a wide line.

=== "With BC Buddy"

    ![The lines of a sales order where line 3, the one with the cursor, has a light teal tint across the whole line](assets/screenshots/crop-with-current-line.png){ loading=lazy }

=== "Without BC Buddy"

    ![The same lines where only a small arrow at the far left shows which line the cursor is on](assets/screenshots/crop-without-current-line.png){ loading=lazy }

## Hide the notifications icon

The bell at the top right of Business Central is hidden. Switch this off to get
it back.

## Keyboard shortcuts

BC Buddy adds a keyboard icon to the top bar of Business Central, next to the
question mark. Click it to see the shortcuts that work where you are:

- **On this page**: the page's own actions that have a shortcut, such as
  **Post** (F9). Buttons in one part of a page, such as the lines of an
  order, are listed when your cursor is in that part.
- What works in the lines of a journal or order, in a list, on a card or in a
  date field, depending on where your cursor is.
- A few that work anywhere, such as Alt+Q to find a page.

The panel stays open while you work in Business Central, and changes along
when you open another page. Drag it by its title to move it out of the way;
it opens in that spot again until you close the tab. Click **×** or the
keyboard icon to close it; your cursor goes back to where it was. A link at
the bottom opens Microsoft's full list of shortcuts.

<figure markdown>
![The keyboard shortcuts panel under the keyboard icon in the top bar, listing the shortcuts on this page, in these lines and anywhere](assets/screenshots/crop-with-keyboard-shortcuts.png){ loading=lazy }
</figure>

Actions in a menu you have not opened yet are not listed: Business Central only
builds those when you open the menu.

This one is off until you switch it on.

<details>
<summary>Opening it with a key, or on Business Central on your own server</summary>

You can give the panel a key of your own. In Chrome, go to
`chrome://extensions/shortcuts`; in Edge, `edge://extensions/shortcuts`. Next to
**BC Buddy**, set a key for *Show the keyboard shortcuts for this Business
Central page*. Pick one Business Central does not use itself.

Business Central on your own server (on-premises) has a different top bar,
without the icon. There this key is the way to open the panel.

</details>

## Striped rows

Every other row in a list gets a light grey, so your eye stays on the right
line when you read across a wide list such as **General Ledger Entries**. The
line you are on and the lines you select keep Business Central's own colours.

=== "With BC Buddy"

    ![The Sales Orders list with every other row a light grey](assets/screenshots/crop-with-striped-rows.png){ loading=lazy }

=== "Without BC Buddy"

    ![The same Sales Orders list with all rows white](assets/screenshots/crop-without-striped-rows.png){ loading=lazy }

This one is off until you switch it on.

## Turn off animations

Business Central slides or fades in pages, dialogs and FastTabs, so opening a
card or a dialog takes a moment each time. With this on they appear at once.
Progress indicators keep moving, so you can still see when Business Central is
busy.

This one is off until you switch it on.

Something not working as described? See [Troubleshooting](troubleshooting.md).
