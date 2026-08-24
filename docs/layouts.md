# Layouts

A layout says how a marking looks. Several rules can share one, so you set it up
once and every environment that uses it follows.

<figure markdown>
![The Default layout in the options page, with a live preview at the top and checkboxes below for ribbon, frame thickness, banner position, text and opacity, and tab title](assets/screenshot-2-1280x800.png)
<figcaption>The preview at the top updates as you change the layout, so you see the marking before you meet it in the client.</figcaption>
</figure>

## What a layout can show

**Ribbon**
: The bar at the top of the BC client takes the colour of the rule and a text of
  your own.

**Frame**
: A coloured border around the whole window, 1 to 5 px wide (3 by default).

**Banner**
: A bar along the bottom, or a diagonal ribbon in one of the four corners.

**Tab title**
: For example `[TEST] Company Information`.

**Favicon**
: A coloured tab icon with the first letters, so you spot the right tab straight
  away in a row of tabs.

## Colours

Text colour is *automatic* by default: white or black, whichever is readable on
the colour you picked. Set it by hand if you would rather decide yourself.

## Tokens

You can use tokens in every text:

| Token | Becomes |
|---|---|
| `{name}` | The name of the rule that matched |
| `{environment}` or `{env}` | The environment from the URL |
| `{company}` | The company from the URL |
| `{title}` | The original tab title |

Empty tokens are cleaned up: if there is no company in the URL, no stray dashes
or empty brackets are left behind.

!!! example

    A ribbon text of `{name} - {company}` gives `PRODUCTION - CRONUS BE` on a
    URL that carries a company, and simply `PRODUCTION` on one that does not.
