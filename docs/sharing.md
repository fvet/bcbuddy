# Team file

One person sets up the colours, and everyone else in the team gets them
automatically. When that person changes something, it reaches everyone the
next day.

## Using your team's file

Someone in your team gives you a web address that ends in `.json`. Then:

1. Open the BC Buddy settings page and go to **Settings**.
2. Paste the address under **Shared configuration**.
3. Click **Synchronise**.

That is all. The team's rules appear at the bottom of your list, and BC Buddy
checks for changes every day.

You cannot change a shared rule. To adjust one, click its copy button: you get
your own version, which takes the place of the shared one.

To stop using the team's file, click the **X** next to *Shared rules*.

If your IT department set up BC Buddy for you, the address is already there,
with *Set by your organisation* under it. You cannot change it, and there is
no **X**.

## Publishing a file for your team

1. Set up your rules and styles and click **Export to file** under **Settings**. That
   saves `bc-buddy.json`, with your rules, your styles and your **Web client**
   settings.
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

The **Active** switch, which turns BC Buddy on or off, is never shared.

## Importing a file once

To load a file once, without daily updates, use **Import / export** →
**Import from file** under **Settings**:

- rules you already have are overwritten,
- new rules are added,
- rules that are not in the file stay as they are,
- the **Web client** settings in the file replace yours.

## For IT departments

You can install BC Buddy on every computer, with your team's file already set,
through Intune or Group Policy. See [Install with Intune](intune.md).
