# Styles

A **style** decides what a marking looks like: the coloured bar at the top, a
frame, a banner. The colour itself comes from the rule.

Several rules can share one style, so you set it up once. You start with two:

- *Full* shows everything below: the bar at the top, a frame, a banner in the
  bottom-left corner, the tab title and the tab icon. New rules get this one.
- *Subtle* only colours the bar at the top and leaves its text as it is.

Pick one on each rule, change them, or add your own. They are named in the
language you install BC Buddy in: *Volledig* and *Subtiel* in Dutch, *Complet*
and *Discret* in French.

<figure markdown>
![The Default style in the options page, with a live preview at the top and checkboxes below for ribbon, frame thickness, banner position, text and opacity, and tab title](assets/screenshot-2-1280x800.png)
<figcaption>The preview at the top shows the result while you change the style.</figcaption>
</figure>

The preview uses the colour and name of the rule that fits the address under
**Test**. When no rule fits, it shows Business Central's own colour.

## What a style can show

Tick the ones you want:

**Ribbon**
: The bar at the top of Business Central, in the colour of the rule, with a
  text of your own.

**Frame**
: A coloured border around the whole window, 1 to 5 pixels wide.

**Banner**
: A bar along the bottom, or a diagonal ribbon in one of the corners, with a
  text such as `SANDBOX`. At **Size** all the way left, the text shrinks to
  fit; further right it is larger.

**Tab title**
: The name of the browser tab with a marking added, for example
  `[TEST] Company Information`.

**Favicon**
: A coloured icon on the browser tab with one or two letters, so you spot the
  right tab in a row of tabs. You type the letters on the rule.

The text colour is *Automatic*: white or black, whichever is easiest to read on
the colour of the rule.

## Your own text

In the ribbon, banner and tab title you can type plain text, and add these
placeholders, which BC Buddy fills in for you:

| Type | Becomes |
|---|---|
| `{name}` | The name of the rule, such as `PRODUCTION` |
| `{environment}` or `{env}` | The environment, such as `Sandbox` |
| `{company}` | The company, such as `CRONUS BE` |
| `{title}` | The original name of the browser tab |

!!! example

    A ribbon text of `{name} - {company}` shows `PRODUCTION - CRONUS BE`. On a
    page without a company it simply shows `PRODUCTION`: a placeholder that
    stays empty takes the dash next to it along.
