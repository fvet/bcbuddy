# TODO

Ideas and follow-ups that are not scheduled yet. Once something ships, its
line moves to `CHANGELOG.md`.

## Report a problem

- **Send without the email app.** The current handoff (mailto + clipboard)
  can never be one click: the user has to find the email window and press
  Ctrl+V, and webmail (Gmail, Outlook on the web) often strips the pasted
  images. Long-term path: a helpdesk endpoint an admin sets under
  *Helpdesk* and shares with the team JSON — for example a Power
  Automate "When an HTTP request is received" flow, or any webhook, that
  receives the report (JSON with the description, context and PNGs) and
  creates the email or ticket itself. Then *Send to support* really sends,
  and the done view can confirm delivery instead of explaining a paste.
- **Guidance.** There is no README section, no `docs/support.md`, no first-run
  tip and no store screenshot for the panel. An admin has nothing to send
  their users. Add: a docs page with a screenshot (mirrored in README per
  `CLAUDE.md`), a one-time three-step tip inside the panel, and a store
  screenshot.
- **Store and deck.** Once it leaves the branch: the "want more?" line in
  `store/` and `extDescription` (it starts off), a slide in
  `marketing/deck/` and screenshots for `docs/`.
