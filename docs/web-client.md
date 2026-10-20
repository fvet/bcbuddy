# Web client

BC Buddy makes the Business Central web client itself easier to work in. There
is nothing to set up: most of it is on from the moment you install it. Each
improvement has its own switch under **Web client** on the BC Buddy settings
page, so you can turn off whatever you do not like.

Click an improvement to read more.

<details class="faq" id="copy-values" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-copy-values:</span>Copy values<span class="bcb-summary-text">A copy icon on any value in a list or FactBox</span></summary>

<p class="bcb-starts bcb-starts--on">On from the start</p>

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

The **Page Inspection** pane (Ctrl+Alt+F1) has the icon too: on **Page**, on
**Table**, and on the value of each field under **Table Fields**.

</details>

<details class="faq" id="maximize-pages" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-maximize:</span>Maximize pages<span class="bcb-summary-text">Every page uses the full width of your screen</span></summary>

<p class="bcb-starts bcb-starts--on">On from the start</p>

Every page opens in wide layout, so you see more fields and columns without
scrolling. Pages that show tiles switch to a list.

=== "With BC Buddy"

    ![A customer card in wide layout, using the full width of the screen](assets/screenshots/with-maximize.jpg){ loading=lazy }

=== "Without BC Buddy"

    ![The same customer card as a narrower window, with the customer list still visible behind it](assets/screenshots/without-maximize.jpg){ loading=lazy }

BC Buddy only changes a page the first time it opens. Business Central
remembers per page how you left it, in your browser, so a page you switch back
to narrow or to tiles yourself stays that way, also the next time you open it.

</details>

<details class="faq" id="pin-the-action-bar" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-pin-action-bar:</span>Pin the action bar<span class="bcb-summary-text">The row of actions under a page's tabs is pinned</span></summary>

<p class="bcb-starts bcb-starts--on">On from the start</p>

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

</details>

<details class="faq" id="dropdown-size" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-dropdown:</span>Dropdown size<span class="bcb-summary-text">The list under a field shows all its columns</span></summary>

<p class="bcb-starts bcb-starts--on">On from the start</p>

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

</details>

<details class="faq" id="resize-panes" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-resize-panes:</span>Resize panes<span class="bcb-summary-text">Make Help, Copilot or Page Inspection wider by dragging its edge</span></summary>

<p class="bcb-starts bcb-starts--on">On from the start</p>

Business Central opens some panes on the right at a fixed width: **Help**,
**Copilot**, **Page Inspection** (Ctrl+Alt+F1) and the field list of
**Personalize**. With BC Buddy you can make them wider or narrower, the way you
already can with the FactBox pane:

1. Point at the left edge of the pane. The pointer turns into a double arrow.
2. Drag the edge to the left to make the pane wider, or to the right to make it
   narrower.

BC Buddy remembers the width, for each kind of pane, in every Business Central
tab. To go back to Business Central's own width, double-click the edge.

The pane always leaves some room for the page next to it, so in a small
window it stops growing before it covers the page.

</details>

<details class="faq" id="week-numbers-in-the-date-picker" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-week-numbers:</span>Week numbers in the date picker<span class="bcb-summary-text">Business Central's own week numbers in the calendar of a date field</span></summary>

<p class="bcb-starts bcb-starts--on">On from the start</p>

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

</details>

<details class="faq" id="highlight-the-current-line" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-highlight-row:</span>Highlight the current line<span class="bcb-summary-text">The line you are on in a journal or order stands out</span></summary>

<p class="bcb-starts bcb-starts--on">On from the start</p>

On the lines of a sales order or in a journal, Business Central shows the line
you are on with only a small arrow at the far left. With this on, the whole line
gets a light tint, so you do not lose your place on a wide line.

=== "With BC Buddy"

    ![The lines of a sales order where line 3, the one with the cursor, has a light teal tint across the whole line](assets/screenshots/crop-with-current-line.png){ loading=lazy }

=== "Without BC Buddy"

    ![The same lines where only a small arrow at the far left shows which line the cursor is on](assets/screenshots/crop-without-current-line.png){ loading=lazy }

</details>

<details class="faq" id="hide-the-notifications-icon" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-hide-notifications:</span>Hide the notifications icon<span class="bcb-summary-text">No bell at the top right</span></summary>

<p class="bcb-starts bcb-starts--on">On from the start</p>

The bell at the top right of Business Central is hidden. Switch this off to get
it back.

</details>

<details class="faq" id="keyboard-shortcuts" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-shortcuts:</span>Keyboard shortcuts<span class="bcb-summary-text">A keyboard icon in the top bar that shows the shortcuts for where you are</span></summary>

<p class="bcb-starts">Off until you switch it on</p>

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

<details markdown>
<summary>Opening it with a key, or on Business Central on your own server</summary>

You can give the panel a key of your own. In Chrome, go to
`chrome://extensions/shortcuts`; in Edge, `edge://extensions/shortcuts`. Next to
**BC Buddy**, set a key for *Show the keyboard shortcuts for this Business
Central page*. Pick one Business Central does not use itself.

Business Central on your own server (on-premises) has a different top bar,
without the icon. There this key is the way to open the panel.

</details>

</details>

<details class="faq" id="striped-rows" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-stripe-rows:</span>Striped rows<span class="bcb-summary-text">Every other row in a list a light grey</span></summary>

<p class="bcb-starts">Off until you switch it on</p>

Every other row in a list gets a light grey, so your eye stays on the right
line when you read across a wide list such as **General Ledger Entries**. The
line you are on and the lines you select keep Business Central's own colours.

=== "With BC Buddy"

    ![The Sales Orders list with every other row a light grey](assets/screenshots/crop-with-striped-rows.png){ loading=lazy }

=== "Without BC Buddy"

    ![The same Sales Orders list with all rows white](assets/screenshots/crop-without-striped-rows.png){ loading=lazy }

</details>

<details class="faq" id="hide-the-factbox-pane" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-hide-fact-box:</span>Hide the FactBox pane<span class="bcb-summary-text">Pages open without the pane on the right</span></summary>

<p class="bcb-starts">Off until you switch it on</p>

Cards, documents and lists show a pane on the right with extra details, such
as **Customer Statistics** or **Sales History**. That is the FactBox pane. With
this on, a page opens with the pane closed, so the page itself gets the room.

=== "With BC Buddy"

    ![A customer card using the full width, with the FactBox pane closed](assets/screenshots/crop-with-hide-factbox.png){ loading=lazy }

=== "Without BC Buddy"

    ![The same customer card with the FactBox pane open on the right](assets/screenshots/crop-without-hide-factbox.png){ loading=lazy }

Need the details on a page? Open the pane with the **i** button at the top
right of the page, or press Alt+F2. Business Central remembers that for that
page, and BC Buddy leaves it open from then on.

BC Buddy only closes the pane on a page you open for the first time in this
browser. Business Central stores the pane together with wide layout, so a page
you used before, also one **Maximize pages** made wide, keeps its pane the way
it was. Close it there once yourself, and Business Central remembers that.

</details>

<details class="faq" id="turn-off-animations" markdown>
<summary markdown="span"><span class="bcb-setting-icon">:settings-no-animations:</span>Turn off animations<span class="bcb-summary-text">Pages and dialogs appear at once</span></summary>

<p class="bcb-starts">Off until you switch it on</p>

Business Central slides or fades in pages, dialogs and FastTabs, so opening a
card or a dialog takes a moment each time. With this on they appear at once.
Progress indicators keep moving, so you can still see when Business Central is
busy.

</details>

## Switching them on and off

A change takes effect in Business Central straight away. The **Extension
active** switch at the top of the settings page pauses all of BC Buddy at once.

Changed too much? **Reset to defaults**, above the list, puts every switch and
slider back to how BC Buddy starts out. **Undo**, right next to the message,
takes it back. When your team shares a file, the button reads **Reset to your
team's defaults** and takes the team's choices from that file; see
[Team file](sharing.md#web-client-settings-in-the-file).

Something not working as described? See [Troubleshooting](troubleshooting.md).

## Extra tips

BC Buddy has no dark theme or blue light filter of its own. Tools that do only
that already do it well, so use one of these instead:

- **Dark mode**: [Dark Reader](https://darkreader.org/). It darkens every
  website, Business Central and BC Buddy included.
- **A warmer screen in the evening**: **Night light** in Windows, under
  **Settings** > **System** > **Display**. It works for every program, not only
  your browser. See
  [Microsoft's steps](https://support.microsoft.com/en-us/windows/set-your-display-for-night-time-in-windows-18fe903a-e0a1-8326-4c68-fd23d7aaf136).

