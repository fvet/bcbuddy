# Team file

One person sets up the colours, and everyone else in the team gets them
automatically. When that person changes something, it reaches everyone the
next day.

## Using your team's file

Someone in your team gives you a web address that ends in `.json`. Then:

1. Open the BC Buddy settings page and go to **Sharing**.
2. Paste the address under **Shared configuration**.
3. Click **Synchronise**.

That is all. The team's rules appear at the bottom of your list, environment
colours are switched on, and BC Buddy checks for changes every day. The [sample rules](matching.md#samples) you did
not change make way for them.

You cannot change a shared rule. To adjust one, click its copy button: you get
your own version, which takes the place of the shared one.

The team's styles appear below your own. You cannot change those either, but
you can pick them on your own rules.

To stop using the team's file, click the **X** next to *Shared rules*.

If your IT department set up BC Buddy for you, the address is already there,
with *Set by your organisation* under it. You cannot change it, and there is
no **X**.

## Publishing a file for your team

1. Set up your rules and styles and click **Export to file** under **Sharing**.
   That saves `bc-buddy.json`, with your rules, your styles, your **Web
   client** settings and, if you set it up, **Help & feedback**.
2. Put that file somewhere everyone can open it with an address starting with
   `https://`, such as a GitHub repository. An ordinary GitHub page link works;
   BC Buddy turns it into the right download link by itself.
3. Give your team that address.

!!! danger "Only use an address you control"

    The file decides what BC Buddy colours. Keep it somewhere only you or your
    team can change, not on a public place anyone can edit.

To see how it works before you publish your own, try this example file. It has
the same rules that [**Load samples**](matching.md#samples) adds:

```
https://fvet.github.io/bcbuddy/examples/bc-buddy.json
```

### Web client settings in the file

The **Web client** switches and sliders in the file are a starting point, not
an order:

- On the first sync, each one is applied.
- After that, a setting only changes when the team changes it in the file. A
  colleague who switches something off keeps it off.
- To share only some of them, delete the others from the `webClient` part of
  the file. Without that part, everyone keeps their own.
- **Reset to your team's defaults** under **Web client** brings a colleague
  back to what the file says. Settings the file leaves out go back to how BC
  Buddy starts out.

### Which parts are on

A file with rules switches environment colours on for the team. The switches
in front of **Web client** and **Rules** are starting points too, just like
the Web client settings: a colleague can still turn them off.

To choose for the team, add `webClientEnabled` or `environmentsEnabled` to
the file yourself; **Export to file** leaves them out.

??? info "Example"

    ```json
    {
      "app": "bc-buddy",
      "version": 3,
      "webClientEnabled": true,
      "environmentsEnabled": false,
      "rules": []
    }
    ```

    `environmentsEnabled: false` keeps colours off, even with rules in the
    file. Leave a key out and everyone keeps their own choice, except that a
    file with rules switches environment colours on.

### Help & feedback in the file { #help-feedback-in-the-file }

The [Help & feedback](help-feedback.md) settings in the file are not a
starting point: while someone uses the team file, they are locked, with *Set
by your organisation* next to each one. That way every report goes to the
right helpdesk address. Settings the file leaves out stay free to change.

??? info "The keys"

    `feedbackEnabled`, `feedbackEmail`, `feedbackPriorities`,
    `feedbackDefaultPriority`, `feedbackSubjectBug`, `feedbackSubjectIdea`,
    `feedbackUrgentText` and `feedbackUrgentLink`. What each one holds is on the
    [Help & feedback](help-feedback.md#the-same-settings-for-the-whole-team)
    page.

    The subjects and the message for urgent problems are one text for
    everyone, or a text per language (`en`, `nl`, `fr`); a priority is the same.
    Priorities line up by position, and a language that has no text for one
    shows the English text:

    ```json
    "feedbackPriorities": [
      { "en": "Low", "nl": "Laag", "fr": "Faible" },
      { "en": "Normal", "nl": "Normaal", "fr": "Normal" },
      { "en": "Urgent", "nl": "Dringend", "fr": "Urgent" }
    ],
    "feedbackUrgentText": { "en": "Urgent? Call us.", "nl": "Dringend? Bel ons." }
    ```

When the team stops using the file, the fields unlock and keep their values.

## Importing a file once

To load a file once, without daily updates, use **Import / export** →
**Import from file** under **Sharing**:

- rules you already have are overwritten,
- new rules are added,
- rules that are not in the file stay as they are,
- the **Web client** and **Help & feedback** settings in the file replace
  yours.

An import never changes a setting marked *Set by your organisation*. The page
says so when the file held one.

## For IT departments

You can install BC Buddy on every computer, with your team's file already set,
through Intune or Group Policy. A policy can also set which parts are on and
every Help & feedback setting. What a policy sets is locked and wins over the
team file. See [Install with Intune](intune.md).
