# Troubleshooting

Click a question to see the answer.

## Getting started

??? faq "Nothing changed after installing"

    Reload the Business Central tab (press F5). Tabs that were open before you
    installed BC Buddy do not see it until they reload.

    Still nothing? Open the BC Buddy settings page and look at the menu on the
    left. A green dot next to **Web client**, **Environments** or **Help &
    feedback** means that part is on, a grey one that it is off. To turn a part
    on, open it and turn on the switch in front of its heading (for
    Environments, in front of **Rules**). Environment colours and Help &
    feedback start off.

??? faq "A setting says Set by your organisation"

    Your IT department set it by policy, or it comes from your team's shared
    file. You cannot change it on the settings page, and an import from file
    leaves it alone too. Ask your IT department if it should be different.

??? faq "How do I open the settings?"

    Click the BC Buddy icon in the browser toolbar. Do you see the BC Buddy
    panel instead? Then click the gear at the top of the panel. In Business
    Central, the BC Buddy icon in the top bar (two people, before the gear)
    opens the same panel.

## Web client

??? faq "No copy icon on a value"

    Rest the mouse on the value for a moment: the icon does not appear while
    the mouse moves across the list.

    Fields you can type in get no icon on purpose: select the text and press
    Ctrl+C. The same goes for plain text on a card, check boxes, empty cells and
    very narrow columns.

??? faq "A page stays narrow or in tiles"

    **Maximize pages** only changes a page nobody set yet. Once a page was
    switched back to narrow or to tiles in this browser, Business Central
    remembers that and BC Buddy leaves it. Click the wide toggle at the top
    right, or pick list view, once: Business Central remembers that instead.

??? faq "The action bar floats on a page"

    **Pin the action bar** likewise only pins a page nobody set yet. Click the
    pin at the right end of the action bar once, and Business Central keeps the
    page pinned from then on.

??? faq "The FactBox pane stays open on a page"

    **Hide the FactBox pane** starts off; switch it on under **Web client** on
    the settings page. It then only closes the pane on a page you open for the
    first time in this browser. Business Central stores the pane together with
    wide layout, so a page you used before, also one **Maximize pages** made
    wide, keeps its pane. Close the pane once on that page, with the **i**
    button at the top right or Alt+F2, and Business Central keeps it closed
    from then on.

??? faq "A dropdown keeps its usual size"

    A field with a **…** button, such as City or Post Code, opens a whole page
    instead of a dropdown, and that page keeps its size. A list with only two
    short columns needs no extra width; it only grows taller if you raise
    **Height**.

??? faq "A pane will not get wider"

    Only **Help**, **Copilot**, **Page Inspection** and the **Personalize**
    field list get the handle; the FactBox pane has Business Central's own.
    Point at the very left edge of the pane until the pointer turns into a
    double arrow. A pane always leaves room for the page next to it, so in a
    small window it stops growing early. Double-click the edge to go back to
    Business Central's own width.

??? faq "No BC Buddy icon in the top bar"

    The icon, two people just before the gear, shows while **Web client** or
    **Help & feedback** is on. Check the dots in the menu of the settings page,
    and reload the Business Central tab (F5). Business Central on your own
    server has a different top bar without the icon; there you can open the
    panel with a key of your own, see
    [Keyboard shortcuts](web-client.md#keyboard-shortcuts).

??? faq "No week numbers in the date picker"

    Press **Shift+Home** while the calendar is open. That turns Business
    Central's week numbers on or off, and someone may have turned them off that
    way: Business Central remembers it, and BC Buddy leaves it.

    The weeks are counted as the **Region** in **My Settings** says. If they are
    counted differently than you expect, check that setting.

??? faq "Something still slides or fades"

    **Turn off animations** is off until you switch it on. Progress indicators
    keep moving on purpose, so you can still see when Business Central is busy.
    If anything looks wrong while it is on, switch it off.

??? faq "Something stopped working after a Business Central update"

    Microsoft changes Business Central regularly. If a web client improvement
    suddenly stops working after an update, BC Buddy leaves that part of
    Business Central alone rather than break it. Please
    [report it](https://github.com/fvet/bcbuddy/issues) so it can catch up.

## Environment colours

??? faq "Nothing is coloured"

    First check that the switch in front of **Rules** under **Environments**
    is on: environment colours start off.

    Then open **Environments** with your Business Central tab still open. At the
    top, BC Buddy shows what it reads from that tab, and the rule that tab gets
    has a border all round in its colour. No such border means none of your
    rules fits that tab: compare the environment and company it shows with the
    conditions of your rule.

??? faq "The wrong colour shows"

    The first rule that fits wins. Drag the rule you want above the other one.
    See [Rules](matching.md#the-first-rule-that-fits-wins).

??? faq "The bar at the top keeps its usual colour"

    BC Buddy finds that bar by its text, *Dynamics 365 Business Central*. On a
    Business Central that shows a different text there, the bar is not
    coloured. The frame, banner, tab title and tab icon still work.

??? faq "A shared rule will not change"

    Rules from your team's file cannot be changed. Click the copy button on the
    rule to get your own version. See [Sharing with your team](sharing.md).

## Help & feedback

??? faq "The email does not open"

    Look at the top right of the browser for the download and open the file:
    it opens in your email app. Or use **Email (draft)** under the arrow next
    to **Email**, and press **Ctrl+V** in the new email. In Gmail or Outlook on
    the web, pictures often do not paste: use **Download** and attach the file.
    See [Help & feedback](help-feedback.md#when-something-does-not-work).

??? faq "No support address set up yet"

    The report has nowhere to go yet. Ask your helpdesk or IT department, or
    fill in the address under **Help & feedback** on the settings page.

## Something else

Report it at
[github.com/fvet/bcbuddy/issues](https://github.com/fvet/bcbuddy/issues).
