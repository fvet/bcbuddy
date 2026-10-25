# Help & feedback

Something does not work, or you have an idea? With **Help & feedback** you
send your helpdesk a clear report straight from Business Central: what you
did, step by step, with a screenshot of each step. The helpdesk sees exactly
what you saw, and does not have to ask which company or page you were on.

!!! note "Not there yet?"

    Help & feedback starts off. Your IT department or helpdesk usually switches
    it on for you. To do it yourself, see
    [Switching it on](#switching-it-on) below.

## Opening it

In Business Central, click the **BC Buddy** icon in the top bar: the two
people, just before the gear. A panel opens next to Business Central. Choose:

- **Report a problem**: something does not work as it should.
- **Feedback or a suggestion**: an idea, or a question about something new.

The BC Buddy icon in the browser toolbar opens the same panel.

The panel stays open while you move around Business Central, and it is never
in your screenshots. Closed it by accident? Open it again: your report is
still there.

## Three steps

### 1. Write what happened

Type in the box what you were doing and what went wrong. Keep it to this one
step, for example *I open the sales order and click Post*. **Ctrl+B**,
**Ctrl+I** and **Ctrl+U** make text bold, italic or underlined.

If there is a **Priority** list, pick how urgent it is.

### 2. Take a screenshot

Go to the screen that shows the step, then:

- **Add a screenshot** and drag over the part of the page that matters, or
- **Whole screen** for everything you see.

Your text goes with that screenshot, and the box is empty again for the next
step. Repeat for every step: write, then take a screenshot. You can still
change the text under each screenshot afterwards.

To point something out, click **Draw on this screenshot**:

- **Arrow** and **Box** to show where to look,
- **Pen** to draw freely,
- **Blur** to hide a name, an amount or anything else that is private,
- **Clear all** to start the drawing over.

Click **Save** (or press Enter) when you are done.

### 3. Send it

Click **Email**. BC Buddy creates the email, with the screenshots inside, and
opens it in your email app. Check it and click **Send**.

The first time, Chrome or Edge asks whether BC Buddy may open the files it
downloads. Say yes, and from then on the email opens by itself. Said no? Then
the email is saved in your Downloads folder: open it from the top of the
browser.

Other ways, under the arrow next to **Email**, and next to it:

- **Email (draft)**: opens a new email in your email app and puts the report on
  the clipboard. Click in the email and press **Ctrl+V**.
- **Download**: saves the report as a web page (`.html`), to attach to an
  email or a ticket.
- **Copy**: puts the report on the clipboard, to paste anywhere.

When it is sent, click **Close**. That throws the report away, so the panel is
empty for the next one.

## What the helpdesk receives

One email with:

- the date and time,
- where you were: the tenant, the environment and the company,
- the priority, if you picked one,
- each step: the page title and its address, your text and the screenshot.

The subject says what kind of report it is, and starts with the first line of
what you wrote, for example *[BC] Problem - High - CRONUS BE: Posting a sales
order fails*.

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

    Still nothing? Use **Email (draft)** and press **Ctrl+V** in the new email.
    Working in Gmail or Outlook on the web? Pictures often do not paste there.
    Then use **Download** and attach the file to your email.

??? faq "No BC Buddy icon in the top bar"

    Reload the Business Central tab (press F5). Still not there? Help &
    feedback may be off: see [Switching it on](#switching-it-on). Business
    Central on your own server has a different top bar without the icon; use
    the BC Buddy icon in the browser toolbar instead.

??? faq "No support address set up yet"

    The panel does not know where to send the report yet. Ask your helpdesk or
    IT department, or fill in the address yourself under **Help & feedback** in
    the settings. Until then **Email** stays greyed out and **Download** is the
    highlighted button: save the report and attach it to an email yourself.

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
- **Priorities**: one per line, at most 6. Leave it empty for the standard
  list: *Normal*, *High*, *Critical*, shown in each user's own language. Tick
  **No priority field** to leave priority out of the report.
- **Default priority**: the priority a new report starts with.
- **Email subject for a problem** and **Email subject for feedback**: leave
  them empty for the standard subject.

### Email subjects

A subject can hold these placeholders. BC Buddy fills them in when the email
is created:

| Placeholder | Becomes |
|---|---|
| `{prio}` | the priority |
| `{type}` | *Problem* or *Feedback* |
| `{company}` | the company of the Business Central page |
| `{environment}` | the environment |
| `{tenant}` | the tenant |
| `{title}` | the first line of the message |

The standard subjects are `[BC] Problem - {prio} - {company}: {title}` and
`[BC] Feedback - {prio} - {company}: {title}`. A subject is one line of at
most 200 characters.

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

??? info "The settings in the JSON file"

    | Key | Value |
    |---|---|
    | `feedbackEnabled` | `true` or `false` |
    | `feedbackEmail` | one address, such as `"helpdesk@example.com"` |
    | `feedbackPriorities` | a list of 1 to 6 names of at most 40 characters; `[]` for no priority field, `null` for the standard list |
    | `feedbackDefaultPriority` | one of the priorities |
    | `feedbackSubjectBug` | the subject for a problem |
    | `feedbackSubjectIdea` | the subject for feedback |

    ```json
    {
      "app": "bc-buddy",
      "version": 3,
      "rules": [],
      "feedbackEnabled": true,
      "feedbackEmail": "helpdesk@example.com",
      "feedbackPriorities": ["Low", "Normal", "Urgent"],
      "feedbackDefaultPriority": "Normal",
      "feedbackSubjectBug": "[BC] {type} - {prio} - {company}: {title}",
      "feedbackSubjectIdea": "[BC] {type} - {company}: {title}"
    }
    ```

    A value that is not valid, such as two addresses or a seventh priority,
    is ignored.
