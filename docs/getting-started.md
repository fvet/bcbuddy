# Getting started

## Web client

Three tweaks to the Business Central web client itself are on from the start —
no setup needed. All three live under **Web client** in the options.

**Maximize pages** expands every page to wide layout and switches tile pages to
list view. Turn its switch off to stop it. Switching **Extension active** off
pauses it along with everything else.

**Dropdown size** gives the list that opens under a field — Country/Region Code,
or the item number on a sales line — more room:

- **Width** — the list gets as wide as its columns need, up to this
  maximum. A list with two short columns keeps BC's own width; one with many
  columns stops scrolling sideways. Starts at the middle step.
- **Height** — shows more rows at once, up to about ten instead of
  five. Starts at *BC standard*.

**Highlight the current line** shows which line you are on in editable lists —
the lines of a sales order, a journal. Business Central marks it only with a
small arrow and the ⋮ button at the far left, which is easy to lose on a wide
line. With this on, the whole line gets a light tint. Read-only lists such as
Customers already highlight the current line, and stay as they are. Turn its
switch off to stop it.

**Turn off animations** makes pages, dialogs, FastTabs and the FactBox pane
appear at once. Business Central normally slides or fades them in, so opening
a card from a list, maximizing it or showing the FactBox pane takes a moment
each time. Progress indicators keep moving, so you can still see when Business
Central is busy. Turn its switch off to get the animations back.

Each slider has five steps; the first is *BC standard*. With both there, the
feature is off. BC still decides where the list opens, so a bigger list flips
above the field or moves left when there is no room.

## Environments

The options page opens on **Environments**. To mark your first environment:

1. Click **Add rule**.
2. Give it a name — that name is what `{name}` produces in your texts, so
   something like `PRODUCTION` or the customer's name works well.
3. Set a condition. The simplest is *environment* *equals* `Production`. If you
   are unsure what to match on, paste a real BC URL into the **Test URL** field
   at the top; the page shows you which environment, company and tenant it read
   out of it, and previews the result live.
4. Pick a colour — green for production.
5. Add a second rule for your sandbox in red.

<figure markdown>
![The Rules list with rules for Production, Sandbox, QA, UAT and Cronus UK. The QA rule is expanded, showing its condition environment equals QA, the colour palette, text colour, layout and favicon letters](assets/screenshot-3-1280x800.png)
<figcaption>The rules list, with one rule expanded.</figcaption>
</figure>

!!! tip "Order decides priority"

    The first rule that fits is applied, so put your most specific rules at the
    top. A rule for one customer's production environment belongs above the
    general "anything called Production" rule.

## Finding your way around

The options page has a navigation on the left:

| Section | What lives there |
|---|---|
| **Web client** | Wide layout, list view, dropdown size, current line and animations, all on by default |
| **Environments** | Your rules and layouts |
| **Settings** | Shared configuration, import and export |
| **About** | Version and links |

## Rules and layouts

Two lists, with a clear division of labour:

- A **rule** says *which* environment you recognise and *which colour* it gets:
  name, conditions, colour, text colour and the letters on the tab icon.
- A **layout** says *how* a marking looks: ribbon, frame, banner, tab title and
  whether there is a tab icon. Several rules can use the same layout, so you
  maintain those settings in one place.

There is always at least one layout, and new rules get *Default*. Delete a
layout and the rules that hung on it fall back to the first one in the list.

Next: [how matching works](matching.md), or [what a layout can show](layouts.md).
