---
title: Tell your Business Central environments apart
---

<div class="bcb-hero" markdown>

# BC Buddy

<p class="bcb-tagline">If you work across several customers or environments, all
your Business Central tabs start to look the same. Posting in production while
you thought you were in a sandbox is easily done. BC Buddy gives every
environment its own colour.</p>

[Getting started](getting-started.md){ .md-button .md-button--primary }
[Download](https://github.com/fvet/bcbuddy/releases/latest){ .md-button }
[Source on GitHub](https://github.com/fvet/bcbuddy){ .md-button }

</div>

The most visible part is the bar at the top of the BC client, which takes your
colour and your own text:

<span class="bcb-ribbon bcb-production">Dynamics 365 Business Central — PRODUCTION · CRONUS BE</span>
<span class="bcb-ribbon bcb-sandbox">Dynamics 365 Business Central — CRONUS BE (Sandbox)</span>

Alongside that it can draw a coloured frame around the window, a banner, a
marked tab title and a coloured tab icon.

<figure markdown>
![Business Central with a red ribbon reading "CRONUS BE (Sandbox)", a red frame around the window and a diagonal Sandbox banner in the bottom-left corner](assets/screenshot-1-1280x800.png)
<figcaption>A marked environment: ribbon, frame and corner banner, all in the colour of the rule that matched.</figcaption>
</figure>

## What it does

- **Colour per environment.** You decide when each colour appears: per
  environment, per company or per customer. Production green, test orange,
  sandbox red — or whatever suits you.
- **Five ways to mark.** Ribbon, frame, banner, tab title and tab icon. Turn on
  as many as you find useful.
- **Online and on-premises.** Both are recognised, including the server
  instance in the URL of an on-prem installation.
- **Shared across a team.** Set the markings up once and your colleagues get
  them automatically, later changes included.
- **Nothing leaves your machine.** No server, no analytics, no tracking. See
  [Privacy](privacy.md).

BC Buddy is a Chrome and Edge extension (Manifest V3), and is available in
Dutch and English. It follows the language of your browser.

## Installing

1. Download the latest `bcbuddy-*.zip` from the
   [releases page](https://github.com/fvet/bcbuddy/releases/latest) and unpack
   it, or clone the repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the folder you just unpacked.
5. The options page opens automatically on first install.

Chrome 111 or newer is required.

[Set up your first environment](getting-started.md){ .md-button .md-button--primary }
