# Privacy policy - BC Buddy

_Last updated: 17 October 2026_

BC Buddy is a browser extension that colours and labels Business Central
environments so you can tell them apart. **It does not collect, transmit or
sell any personal data.** There is no server behind it, no analytics and no
tracking of any kind.

## What the extension stores

Everything BC Buddy knows lives in `chrome.storage.local`, on your own machine:

- your rules (name, conditions, colours, favicon letters),
- your layouts (ribbon, frame, banner, tab title, favicon settings),
- your web client preferences (whether pages are maximized, and the dropdown
  size steps),
- the URL of a shared configuration file, if you configured one, plus the
  rules it returned and the timestamp of the last synchronisation.

This data never leaves your browser. Uninstalling the extension removes it.

## What the extension reads

To decide whether a page should be marked, the content script looks at the
URL of the page it runs in and at the page's own DOM (to find the Business
Central ribbon, and to size the dropdown lists that Business Central opens).
In Business Central it also reads the settings Business Central keeps in your
browser for each page, such as whether a page is wide or its action bar is
pinned, so it leaves a page alone that you already set. It writes one of
those settings itself: it turns on Business Central's week numbers in the date
picker where they were never set.
This happens entirely inside your browser. Nothing that is read is stored,
logged or sent anywhere.

If your organisation manages your browser, BC Buddy also reads the one browser
policy it knows: the address of a shared configuration file
(`sharedConfigUrl`, in `chrome.storage.managed`). Your IT department sets it;
BC Buddy only reads it.

## Network requests

BC Buddy makes exactly one kind of network request: an HTTPS `GET` of the
shared configuration file, to the URL **you** entered in the options page or
that your organisation set by browser policy.
Plain HTTP is refused. The request is sent without cookies or credentials
(`credentials: 'omit'`), and only if such a URL is set. If that field is
empty, the extension makes no network requests at all.

Treat that URL as trusted: the file can define rules that mark any site. Use
a location you control (for example your team's repository).

The operator of the server hosting that file (GitHub, for example) will see
that request the same way it sees any other download. BC Buddy adds nothing
to it.

## Permissions

- `storage` - keep your settings.
- `alarms` - check the shared configuration file once a day, or every hour
  while it could not be loaded.
- host permissions (`<all_urls>`) - rules may match any URL, because a
  Business Central on-premises server runs on your own host name, and your
  shared configuration file can be hosted anywhere. The extension only uses
  this access to draw its own markers on pages that match one of your rules,
  and to apply its web client improvements on pages that are Business
  Central.

## Contact

Questions or concerns: open an issue at
<https://github.com/fvet/bcbuddy/issues>.