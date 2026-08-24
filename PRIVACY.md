# Privacy policy - BC Buddy

_Last updated: 24 August 2026_

BC Buddy is a browser extension that colours and labels Business Central
environments so you can tell them apart. **It does not collect, transmit or
sell any personal data.** There is no server behind it, no analytics and no
tracking of any kind.

## What the extension stores

Everything BC Buddy knows lives in `chrome.storage.local`, on your own machine:

- your rules (name, conditions, colours, favicon letters),
- your layouts (ribbon, frame, banner, tab title, favicon settings),
- the URL of a shared configuration file, if you configured one, plus the
  rules it returned and the timestamp of the last synchronisation.

This data never leaves your browser. Uninstalling the extension removes it.

## What the extension reads

To decide whether a page should be marked, the content script looks at the
URL of the page it runs in and at the page's own DOM (to find the Business
Central ribbon). This happens entirely inside your browser. Nothing that is
read is stored, logged or sent anywhere.

## Network requests

BC Buddy makes exactly one kind of network request: an HTTPS `GET` of the
shared configuration file, to the URL **you** entered in the options page.
Plain HTTP is refused. The request is sent without cookies or credentials
(`credentials: 'omit'`), and only if you configured such a URL. If you leave
that field empty, the extension makes no network requests at all.

Treat that URL as trusted: the file can define rules that mark any site. Use
a location you control (for example your team's repository).

The operator of the server hosting that file (GitHub, for example) will see
that request the same way it sees any other download. BC Buddy adds nothing
to it.

## Permissions

- `storage` - keep your settings.
- `alarms` - check the shared configuration file once a day.
- host permissions (`<all_urls>`) - rules may match any URL, because a
  Business Central on-premises server runs on your own host name, and your
  shared configuration file can be hosted anywhere. The extension only uses
  this access to draw its own markers on pages that match one of your rules.

## Contact

Questions or concerns: open an issue at
<https://github.com/fvet/bcbuddy/issues>.