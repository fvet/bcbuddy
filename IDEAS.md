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

## Known problems first

IT puts a short notice in the shared file ("Posting in Production is slow, we
are on it"); the panel shows it at the top before anyone starts typing, so the
helpdesk does not get the same ticket fifty times. Plain text through
`normalize()`, locked like the other Help & feedback fields, with an optional
end date so it does not linger.
