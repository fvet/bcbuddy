# Troubleshooting

## Nothing changed after installing

Reload the Business Central tab (press F5). Tabs that were open before you
installed BC Buddy do not see it until they reload.

Still nothing? Open the BC Buddy settings page and check that **Extension
active**, at the top, is on.

## No BC Buddy in the gear menu

In Business Central, the gear icon at the top right has a **BC Buddy** section
with **Settings**. Not there? Reload the Business Central tab (press F5): a tab
that was open before you installed or updated BC Buddy does not see it yet.

Business Central on your own server (on-premises) has a different gear menu,
without BC Buddy. The BC Buddy icon in the toolbar always opens the settings
page.

## Web client

### No copy icon on a value

Rest the mouse on the value for a moment: the icon does not appear while the
mouse moves across the list.

Fields you can type in get no icon on purpose: select the text and press
Ctrl+C. The same goes for plain text on a card, check boxes, empty cells and
very narrow columns.

### A page stays narrow or in tiles

**Maximize pages** works once, when a page opens. If you switched a page back
to narrow or to tiles yourself, BC Buddy leaves it that way.

### A dropdown keeps its usual size

A field with a **…** button, such as City or Post Code, opens a whole page
instead of a dropdown, and that page keeps its size. A list with only two short
columns needs no extra width; it only grows taller if you raise **Height**.

### No week numbers in the date picker

They do not appear when Business Central is set to a language that writes dates
without spaces, such as Japanese or Chinese. The calendar itself works as usual.

### Something still slides or fades

**Turn off animations** is off until you switch it on. Progress indicators keep
moving on purpose, so you can still see when Business Central is busy. If
anything looks wrong while it is on, switch it off.

## Environment colours

### Nothing is coloured

Open **Environments** and click **From open tab** at the top. BC Buddy shows
what it reads from your Business Central tab, and a green tick on each rule
that fits. No tick anywhere means none of your rules fits that tab: compare
the environment and company it shows with the conditions of your rule.

### The wrong colour shows

The first rule that fits wins. Drag the rule you want above the other one. See
[Rules](matching.md#the-first-rule-that-fits-wins).

### The bar at the top keeps its usual colour

BC Buddy finds that bar by its text, *Dynamics 365 Business Central*. On a
Business Central that shows a different text there, the bar is not coloured.
The frame, banner, tab title and tab icon still work.

### A shared rule will not change

Rules from your team's file cannot be changed. Click the copy button on the
rule to get your own version. See [Sharing with your team](sharing.md).

## After a Business Central update

Microsoft changes Business Central regularly. If a web client improvement
suddenly stops working after an update, BC Buddy leaves that part of Business
Central alone rather than break it. Please
[report it](https://github.com/fvet/bcbuddy/issues) so it can catch up.

## Something else

Report it at
[github.com/fvet/bcbuddy/issues](https://github.com/fvet/bcbuddy/issues).
