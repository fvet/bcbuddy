# TODO

Ideas and follow-ups that are not scheduled yet. Once something ships, its
line moves to `CHANGELOG.md`.

## Help & feedback (Report a problem)

- **Send without the email app.** The current handoff (mailto + clipboard)
  can never be one click: the user has to find the email window and press
  Ctrl+V, and webmail (Gmail, Outlook on the web) often strips the pasted
  images. Long-term path: a helpdesk endpoint an admin sets under
  *Help & feedback* and shares with the team JSON — for example a Power
  Automate "When an HTTP request is received" flow, or any webhook, that
  receives the report (JSON with the description, context and PNGs) and
  creates the email or ticket itself. Then *Send to support* really sends,
  and the done view can confirm delivery instead of explaining a paste.
- **First-run tip.** A one-time three-step tip inside the panel (write the
  message, take a screenshot, Email), for people who open it for the first
  time.
- **Deck and screenshots.** A slide in `marketing/deck/` (recipe in
  `marketing/README.md`), the "With / Without BC Buddy" screenshots for
  `docs/`, a store screenshot of the panel, and new options-page screenshots
  (area switches, Help & feedback fields, Sharing). Needs the maintainer at
  Chrome.
- **BC's own Help & support details in the report.** BC's *Help & support*
  page has *View the last known error* and a block under *Copy the text below
  and add it to your support request*. Idea: when the tab in front shows that
  page, the panel offers one button that attaches both (as text, size-capped)
  to the report. Needs a live look at that page's DOM first (it is localized,
  so find it by structure, not by caption).
- **Known problems first.** IT puts a short notice in the shared file
  ("Posting in Production is slow, we are on it"); the panel shows it at the
  top before anyone starts typing, so the helpdesk does not get the same
  ticket fifty times. Plain text through `normalize()`, locked like the other
  Help & feedback fields, with an optional end date so it does not linger.
- **Add the BC error by itself.** When BC shows an error dialog, the panel
  offers "Add the error message" and attaches BC's full error details as
  text, without copy and paste. Capturing BC's *Copy error details* is known
  to work (see the error details notes); BC keeps nothing once the dialog
  closes, so it has to be caught while it is open.
- **Live checks of round 2.** In real Chrome: the optional downloads
  permission prompt and whether `downloads.open()` still opens the `.eml`
  after the download (else the hint shows); Outlook opening the `.eml`; Esc
  cancelling an area selection while the panel has focus; the top bar icon
  position (before the gear online, before Help on-prem).

## Top bar

- **When to show the BC Buddy icon.** Today it is there while the Web client
  area or Help & feedback is on. To decide: whether it should depend on
  something else (a switch of its own, only when Help & feedback is set up,
  ...).
