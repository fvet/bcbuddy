# Ideas

Ideas worth building, with what is already known about how Business Central
does it. Not a promise or a plan. When one ships, it moves to `CHANGELOG.md`
and leaves this file.

## Business Central only, with "all websites" as a choice

Today BC Buddy runs on every website (`<all_urls>` in `host_permissions` and
both content scripts), so that an on-premises server works without setup. The
price: Chrome warns "read and change all your data on all websites" at
install, the Web Store reviews it more strictly, the scripts load in every
tab, and a rule can colour a site that is not BC (the docs teach a
`Url contains businesscentral.dynamics.com` workaround for that). The idea:
run on Business Central online by default, add on-premises servers one by
one, and keep "all websites" as a switch for whoever wants it.

What it would look like:

- **By default** only `businesscentral.dynamics.com`, `-tie` and
  `*.bc.dynamics.com`: no on-prem guesswork, no rules on other sites.
- **My Business Central servers**: a short list in the options. Adding
  `bc.contoso.local` asks Chrome for that one host, and BC Buddy starts there
  at once. **From open tab** can offer the host of the tab it read.
- **All websites**: a switch, off by default, for test servers whose address
  changes, or for the old behaviour. It asks Chrome for every site.

A common way to build it: `host_permissions` and the manifest content script
cover only the vendor's own domain, and `optional_host_permissions` holds
`<all_urls>`. An *Enable on all websites* switch calls
`chrome.permissions.request`, and the service worker injects
the content script with `chrome.scripting.executeScript` on every
`tabs.onUpdated` (status `complete`) and on `permissions.onAdded`, so tabs
that are already open pick it up.

For BC Buddy, `chrome.scripting.registerContentScripts` fits better than
injecting per tab: registered scripts persist, and run at `document_start`
in all frames like the manifest ones do now. Injecting after `complete`
would show BC unmarked for a moment, and the ribbon colour would arrive late.

To settle first:

- **Updating existing users.** Taking `<all_urls>` out of the manifest
  removes it on update, and `permissions.request` needs a click, so on-prem
  users would lose their colours without warning. A release before that one
  could remember every on-prem host where BC was recognised (`bcSeen` /
  `bcPage` in `content.js`), so the options page can show "Allow
  bc.contoso.local" after the update.
- **IT rollout.** Check whether Chrome policy (`ExtensionSettings`,
  `runtime_allowed_hosts`) can grant those hosts, so an Intune rollout does
  not need a click on every computer, and whether `managed_schema.json` should
  carry the server list.
- **The shared file.** The service worker fetches it from anywhere. That works
  without a host permission only when the server sends CORS headers (GitHub
  raw does; SharePoint does not), so its host may need the same request.
- **Turn off animations** (`calm.js`, MAIN world) and the web client tweaks
  must follow the same scope. A listed server makes the guess in
  `isWebClientTarget()` (host starting with `bc`, path starting with `/BC`)
  unnecessary there.
- **Docs.** *Why rules also apply outside Business Central* in
  `docs/matching.md` disappears. On-premises setup gets its own short steps.
  The *Permissions* section in `DEVELOPMENT.md` already sketches the
  manifest side.

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

## Copy values in lookup dropdowns

The copy icon shows on read-only values in lists, FactBoxes and Page
Inspection, but not in a lookup dropdown (the list that opens under a field
such as **Nr.** on a line). That is on purpose: `LOOKUP_SEL` (`.spa-lookup`)
in `copyvalues.js` skips it. Users do ask for it, for example to copy an item
number while choosing one.

Why it was left out: a dropdown is a list to pick from. A click on a row picks
that record and closes the dropdown, and the icon swallows the press so BC
never sees it. A click that lands on the icon copies instead of picking, which
breaks a fast "open, click the item" habit and looks like a BC Buddy bug.

Options to weigh:

- **Everywhere in the dropdown.** Drop the `LOOKUP_SEL` check. The dropdown
  cells are ordinary `.edit-container-read` cells, so nothing else is needed.
- **Only on the first column** (the number, a link). That is the value people
  copy; Description and the other columns stay free for picking.
- **A longer rest** in dropdowns only, so the icon never shows while someone
  is just moving to the row they want.

To settle first: try each on a live dropdown (item lookup on a sales line)
with fast picking, and check that the icon follows the dropdown when it
scrolls its own rows and that it disappears when the dropdown closes.
