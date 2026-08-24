# Getting started

The options page opens on **Environments**. To mark your first environment:

1. Click **Add rule**.
2. Give it a name — that name is what `{name}` produces in your texts, so
   something like `PRODUCTION` or the customer's name works well.
3. Set a condition. The simplest is *environment* *equals* `Production`. If you
   are unsure what to match on, paste a real BC URL into the **Test URL** field
   at the top; the page shows you which environment, company and tenant it read
   out of it, and previews the result live.
4. Pick a colour. Red for production is the obvious start.
5. Add a second rule for your sandbox in a different colour.

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
| **Environments** | Your layouts and rules |
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
