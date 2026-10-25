# Help & feedback

Something does not work, or you have an idea? With **Help & feedback** you
send your helpdesk a clear report straight from Business Central: what you
did, step by step, with a screenshot of each step. The helpdesk sees exactly
what you saw, and does not have to ask which company or page you were on.

!!! note "Not there yet?"

    Help & feedback starts off. Your IT department or helpdesk usually switches
    it on for you. To do it yourself, see
    [Switching it on](#switching-it-on) below.

![The Report a problem panel with a priority, two steps with their text and screenshots, and the Email button](assets/screenshots/crop-with-help-feedback.png){ loading=lazy width="260" }

## Opening it

In Business Central, click the **BC Buddy** icon in the top bar: the two
people, just before the gear. A panel opens next to Business Central. Choose:

- **Report a problem**: something does not work as it should.
- **Feedback or a suggestion**: an idea, or a question about something new.

The BC Buddy icon in the browser toolbar opens the same panel.

The panel stays open while you move around Business Central, and it is never
in your screenshots. Closed it by accident? Open it again: your report is
still there. The bin at the top throws the report away and takes you back to
the start.

## From an error message

When Business Central shows an error, **Report a problem** sits on the right of
**Share details** in the message. Click it and the report opens with:

- a screenshot of the error as a step,
- the error message as that step's text, and
- the details Business Central gives under **Share details** > **Copy error
  details**: the session IDs, the time and, for errors in the application's
  code, the call stack. They are folded under the step; open them to read.

You no longer have to copy and paste them yourself. Your helpdesk gets what it
needs to find the error. Add what you were doing, then send the report as
usual. When you were already writing a report, the error is added as its next
step; an error that is already in the report is not added twice.

!!! note
    This replaces what is on your clipboard, as **Copy error details** does.
    The error stays open until you close it.

## Three steps

### 1. Write what happened

Type in the box what you were doing and what went wrong. Keep it to this one
step, for example *I open the sales order and click Post*. **Ctrl+B**,
**Ctrl+I** and **Ctrl+U** make text bold, italic or underlined.

A report can have up to 9 screenshots. For an idea, text alone is fine.

If there is a **Priority** list, pick how urgent it is. When you pick the most
urgent one, your IT team may show a short message above it, such as a phone
number to call.

### 2. Take a screenshot

Go to the screen that shows the step, then:

- **Whole screen** for everything you see, or
- **Region** and drag over the part of the page that matters.

Something that disappears when you move the mouse, such as an error message
that only shows while you hover its icon? Take the screenshot yourself with
**Print Screen** or **Win+Shift+S** while it is showing, click in the box and
paste with **Ctrl+V**. The picture becomes the next step.

Your text goes with that screenshot, and the box is empty again for the next
step. Repeat for every step: write, then take a screenshot. You can still
change the text under each screenshot afterwards, and drag a screenshot up
or down to change the order of the steps; its text moves with it. With many
steps the list of **Steps** scrolls, so the box and the buttons stay in
view. **Tab** jumps from one step's text to the next.

To point something out, click **Draw on this screenshot**:

- **Arrow** and **Box** to show where to look,
- **Pen** to draw freely, with a colour of your choice,
- **Blur** to hide a name, an amount or anything else that is private,
- **Undo** (**Ctrl+Z**) takes back the last stroke, **Clear all** starts
  the drawing over.

Click **Save** (or press **Enter**) when you are done, or the **×** (or **Esc**)
to leave the screenshot out.

### 3. Send it

Click **Email**. BC Buddy creates the email, with the screenshots inside, and
opens it in your email app. Check it and click **Send**.

The first time, Chrome or Edge asks whether BC Buddy may open the files it
downloads. Say yes, and from then on the email opens by itself. Said no? Then
the email is saved in your Downloads folder: open it from the top of the
browser.

Other ways are under the arrow next to **Email**:

- **Email (draft)**: opens a new email in your email app and puts the report on
  the clipboard. Click in the email and press **Ctrl+V**.
- **Download**: saves the report as a web page (`.html`), to attach to an
  email or a ticket.
- **Copy**: puts the report on the clipboard, to paste anywhere.

Text left in the box when you click **Email** counts as the last step, without
a screenshot.

Once the report is out, **Email** turns into **Done**. Click it when the
email is sent: that throws the report away and closes the panel. Need another
way after all? The arrow still has them all.

## Tips

- **One step per screenshot.** Short text, then the screenshot that shows it.
  Three small steps say more than one long story.
- **Draw an arrow** at the button, the field or the error.
- **Blur what is private**, such as customer names, bank details or salaries,
  before you send.
- **Show the error itself.** Take the screenshot while the error message is
  still on the screen.
- **Text only is fine** too: for an idea, a few lines without a screenshot are
  enough.

## When something does not work

??? faq "The email does not open"

    Look at the top right of the browser for the download, and open the file
    from there: it opens in your email app.

    Still nothing? Click the arrow next to the main button, choose **Email
    (draft)** and press **Ctrl+V** in the new email. Working in Gmail or
    Outlook on the web? Pictures often do not paste there. Then choose
    **Download** under the same arrow and attach the file to your email.

??? faq "No BC Buddy icon in the top bar"

    Reload the Business Central tab (press F5). Still not there? Help &
    feedback may be off: see [Switching it on](#switching-it-on). The icon
    also shows while **Web client** is on. Business Central on your own server
    has a different top bar without the icon; use the BC Buddy icon in the
    browser toolbar instead.

??? faq "Why Download replaces Email"

    The panel does not know where to send the report yet. Ask your helpdesk or
    IT department, or fill in the address yourself under **Help & feedback** in
    the settings. Until then **Download** takes the place of **Email**: save
    the report and attach it to an email yourself.

??? faq "I cannot take a screenshot"

    Screenshots work on a Business Central page only. Click in the Business
    Central tab first, and try again.

??? faq "A field says Set by your organisation"

    Your IT department or your team's shared file chose that setting for you,
    so you cannot change it. Ask them if it should be different.

## For admins and IT

### Switching it on

On the BC Buddy settings page, go to **Help & feedback** and turn on the switch
in front of the heading. The dot next to **Help & feedback** in the menu turns
green.

Then fill in:

- **Email**: the helpdesk address the reports go to. Only one address.
- **Priorities**: one per line, for example *Normal*, *High*, *Critical*;
  **Load examples** in the empty box fills in a list to start from. Leave it
  empty and there is no priority field: the three settings below are then
  hidden too.
- **Default priority**: the priority a new report starts with.
- **Message for urgent problems**: a short line shown above the priority when
  someone picks the last priority in the list, for example *Urgent? Call the
  helpdesk on 03 123 45 67.* It is only
  a hint on screen: it does not go into the report. Leave it empty for no
  message. One line, at most 200 characters.
- **Link (optional)**: makes that message a link people can click: an address
  that starts with `https://`, such as a Teams link, or `tel:` followed by a
  phone number, such as `tel:+00 000 00 00 00`. Other links are refused.
- **Email subject for a problem** and **Email subject for feedback**: each
  shows the standard subject until you change it. Empty it to go back to
  the standard one.

### Email subjects

A subject can hold placeholders such as `{prio}`, `{company}` and `{title}`.
The subject fields list them all, and BC Buddy fills them in when the email is
created. A subject is one line of at most 200 characters.

### Several languages

When your people use Business Central in different languages, write the
texts once per language. **Priorities**, **Message for urgent problems** and
the two **Email subject** fields show the text for the language chosen at the
top of the settings page; choose another language there and the same fields
show, and save, the text for that one. A note under a field says when it has
no text in the language shown yet: people in that language then see the text
of another language, English first.

People get the text in the language Business Central is in. When that is a
language BC Buddy does not have, they get the language BC Buddy is in. BC
Buddy has English, Dutch and French. The email carries what the user saw, so
a Dutch user's report says *Hoog* and a French user's says *Haute*.

Priorities line up by position: line two in every language is the same
priority, so the message for urgent problems always belongs to the last one.
Removing a line removes that priority in every language. The default priority
can be written in any language, and the link, the email address and the
switches are the same for everyone.

### The same settings for the whole team

Set it up once and give everyone the same settings:

- **With the team file.** Set up **Help & feedback**, then click **Export to
  file** under **Sharing**: the file carries these settings along with the
  rules. While someone uses that file, the settings it holds are locked for
  them, with *Set by your organisation* next to each one. See
  [Team file](sharing.md#help-feedback-in-the-file).
- **With Intune or Group Policy.** Every setting above can also be set by
  policy, and then nobody can change it. See
  [Install with Intune](intune.md#2-set-the-shared-file-and-settings).
