# Ideas

Ideas worth building, with what is already known about how Business Central
does it. Not a promise or a plan. When one ships, it moves to `CHANGELOG.md`
and leaves this file.

## Keep an error's details for a later report

A user gets an error, closes it, and only later wants to report it. By then
the details are usually gone. What BC offers (live BC28 client, 2026-10-11):

- **BC's own last error.** Help & Support > Troubleshooting > *View the last
  known error* opens page 9180 *Latest Error*, which still holds the error
  after it was closed: error text, error code (`NSValidateField:Dialog`) and
  the AL call stack (`Item(Table 27)."Type - OnValidate"(Trigger) line 8 -
  Base Application by Microsoft version 28.5…`). Limits:
  - per server session, which in practice is one tab: a reload or a new tab
    starts a new session and loses it, so the page must be reached in-session
    (Help pane > Help & Support > the link), not by URL;
  - only the latest error, and only errors raised by AL code. A field
    validation such as an unknown code in a related field (`ZZ` in
    Country/Region Code) does not register.
- **Copy error details.** Errors carry BC's share menu (Copy error details,
  Share details via Teams, Share details via email; the capability
  `SupportsShareErrorDetailsMenu`, on for desktop). The copied text has the
  error message, internal session ID, Application Insights session ID, client
  activity id, timestamp and user telemetry id: what Microsoft or a partner
  needs to find the error in telemetry. No call stack for a validation error.
  The details exist only in BC's memory while the error is shown, never in the
  DOM.
  - BC copies through a one-off capturing `copy` listener on `document` and
    `execCommand('copy')`. A content-script `copy` listener on `window`
    (capture) that adds a `once` capture listener on `document` runs after
    BC's and can read `clipboardData.getData('text/plain')`: tried live.
  - A scripted click on *Copy error details* copies nothing: Chrome needs a
    real user click. BC Buddy can catch the details when the user copies them,
    not fetch them itself.
- **The visible message** is in the DOM while an error dialog or error
  tooltip is shown.

So a later *report a problem* could combine three sources: what BC Buddy
noted when the error appeared (message, time, page), the last *Copy error
details* the user made (session ids), and the *Latest Error* page read in the
same tab (call stack). Startup errors ("Something went wrong") print time,
tenant, environment and operation id on the page itself.

## FastTabs open, or "Show more", on first use

BC remembers per FastTab whether it is collapsed and whether *Show more* is
open: LocalState `{"Collapsed", "MoreFieldsShown"}` under the group's own id,
written only when the user changes it (capability
`shouldUsePersistedExpandCollapseState`, on for desktop). The same rule as
Maximize and Pin the action bar would fit: change BC's default the first time
a FastTab shows, never a stored choice (`lib/bcstate.js`).

## `expandAllFastTabs` in the URL

BC reads `expandAllFastTabs=true` from the address when the client starts and
then opens every FastTab on every page for that session. Cheap to offer, for
example as an option on links BC Buddy builds, but it only takes effect on a
fresh load.
