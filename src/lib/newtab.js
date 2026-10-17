/*
 * BC Buddy - open in a new tab.
 *
 * A value that is a link in Business Central (a No. in a list, Customer No.
 * in a FactBox, Balance (LCY) on a card) has no address: it is an
 * <a href="javascript:;">, and BC's server decides which page it opens. So
 * this lets BC open it, the way a click would, takes the address BC then puts
 * in the address bar (page=21&bookmark=..., with the filter for a list), goes
 * back with BC's own Back button and has the service worker open that address
 * in a new tab. Meanwhile a rule in content.css keeps the page BC opened out
 * of sight, so you stay on the page you were on.
 *
 * It starts from a Ctrl+click on a link outside a list, or a middle-click on
 * any link. In a list BC uses Ctrl+click to select rows, so there it stays
 * BC's. Which values count as a link is decided as for the copy icon
 * (copyvalues.js), so the two agree.
 *
 * What runs: one click and one auxclick listener on the document, which look
 * at the modifier keys first and do nothing on a plain click. Only after you
 * ask for a new tab does a 50 ms poll run, for a few seconds at most.
 *
 * BETA, AND UNDOCUMENTED ON PURPOSE. This is a best-effort try, kept for the
 * maintainer's own testing. It has no switch in the options (it follows the
 * master switch only) and must not appear in README.md, docs/, CHANGELOG.md,
 * DEVELOPMENT.md, the store listing or the UI strings until it leaves beta.
 * It is beta because several cases do not work yet:
 *   - A page that greets you with a message as it opens, such as a sales
 *     order opened from the list with "not released yet": the message
 *     blocks the page, so it cannot be taken back and moved to a new tab.
 *   - A link that opens its page with RunModal instead of Run: the address
 *     does not change, so there is nothing to open in a new tab. That page is
 *     shown and left to BC after DIALOG_MS, the same as a lookup or a dialog.
 *
 * Found on the live client (BC SaaS, 2026-10-11):
 *   - The client runs in a same-origin iframe. Pages are sibling .spa-view
 *     elements, position: absolute with a rising z-index, and the ones below
 *     stay rendered. That is what lets the rule in content.css hide the page
 *     BC opened while yours stays in view.
 *   - The address arrives in the top window about a second after the click.
 *     A drill-down to a list keeps its filter there
 *     (page=9305&filter='Sales Header'.'Sell-to Customer No.' IS '10000').
 *   - The tab is opened by chrome.tabs.create in background.js, which needs
 *     no permission. window.open from the page is caught by the popup blocker
 *     once the round trip has used up the click's user activation, and BC's
 *     own Open in new window button opens a pop-up window, not a tab.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  // On <html> while a link is being moved to a new tab, and on the page you
  // were on: content.css hides every page BC stacks above it.
  var BUSY_ATTR = 'data-bcb-newtab';
  var ORIGIN_ATTR = 'data-bcb-origin';

  // From the live client (BC SaaS, 2026-10-11): every page has a Back button
  // whose icon name is not translated.
  var BACK_SEL = 'button:has(i[data-icon-name="Back"])';
  var GRID_SEL = 'table.ms-nav-grid-data-table';

  var POLL_MS = 50;
  // How long BC gets to open the page: about 1 s on BC SaaS.
  var OPEN_MS = 10000;
  // A page that opens without a new address is a dialog (a lookup, an error
  // message): it is shown and left to BC after this long.
  var DIALOG_MS = 1500;
  // How long the Back button gets to take the page away again.
  var BACK_MS = 5000;

  /** The link in a cell that can open in a new tab, or null. */
  function linkOf(cell) {
    var value = BCBuddy.CopyValues.valueOf(cell);
    return value && value.tagName === 'A' ? value : null;
  }

  /** In a frame the top window's address counts: that is where BC puts it. */
  function topHref(win) {
    try { return win.top.location.href; } catch (e) { return win.location.href; }
  }

  function click(el) {
    try { el.click(); } catch (e) { /* BC tore it down mid-render */ }
  }

  /**
   * Starts it in this document. openTab(url, active) hands the address to the
   * service worker. options, for the tests: { hrefOf(win), dialogMs,
   * trusted(event) }.
   * Returns { open(link, active), detach() }; open resolves to 'tab' once
   * the new tab was asked for, or 'kept' when BC opened something without an
   * address and keeps it in place.
   */
  function attach(doc, openTab, options) {
    options = options || {};
    var win = doc.defaultView;
    var hrefOf = options.hrefOf || topHref;
    var dialogMs = options.dialogMs || DIALOG_MS;
    // Only a click by the person at the mouse opens a tab: one the page made
    // up (isTrusted false) is left to BC, so a page cannot open tabs with it.
    var trusted = options.trusted || function (event) { return event.isTrusted; };
    var Maximize = BCBuddy.Maximize;
    var busy = false;

    doc.addEventListener('click', onClick, true);
    doc.addEventListener('auxclick', onAuxClick, true);

    /** The link under a click, when that click may be ours. */
    function linkAt(target, inLists) {
      var cell = target && target.closest ? target.closest('.edit-container-read') : null;
      var link = linkOf(cell);
      if (!link || !link.contains(target)) return null;
      if (!inLists && cell.closest(GRID_SEL)) return null;
      return link;
    }

    function onClick(event) {
      if (event.button !== 0 || !(event.ctrlKey || event.metaKey) || !trusted(event)) return;
      var link = linkAt(event.target, false);
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      open(link, event.shiftKey);
    }

    function onAuxClick(event) {
      if (event.button !== 1 || !trusted(event)) return;
      var link = linkAt(event.target, true);
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      open(link, event.shiftKey);
    }

    function wait(test, ms) {
      var until = Date.now() + ms;
      return new Promise(function (resolve) {
        (function look() {
          var found = test();
          if (found || Date.now() >= until) resolve(found || null);
          else setTimeout(look, POLL_MS);
        })();
      });
    }

    function open(link, active) {
      var origin = Maximize.topView(doc);
      if (busy || origin === doc || !link.isConnected) return Promise.resolve('kept');
      busy = true;
      var before = hrefOf(win);
      var seen = 0;
      origin.setAttribute(ORIGIN_ATTR, '');
      doc.documentElement.setAttribute(BUSY_ATTR, '');
      click(link);

      // The page BC opened, once the address is there too. BC changes the
      // address a moment before or after it swaps the page.
      return wait(function () {
        var view = Maximize.topView(doc);
        if (view === origin) return null;
        if (hrefOf(win) !== before) return view;
        if (!seen) seen = Date.now();
        return Date.now() - seen >= dialogMs ? 'dialog' : null;
      }, OPEN_MS).then(function (view) {
        if (!view || view === 'dialog') return done('kept');
        var url = hrefOf(win);
        return wait(function () { return view.querySelector(BACK_SEL); }, BACK_MS).then(function (back) {
          if (!back) return done('kept');
          click(back);
          return wait(function () { return Maximize.topView(doc) === origin; }, BACK_MS).then(function () {
            openTab(url, active);
            return done('tab');
          });
        });
      });

      function done(result) {
        origin.removeAttribute(ORIGIN_ATTR);
        doc.documentElement.removeAttribute(BUSY_ATTR);
        busy = false;
        return result;
      }
    }

    function detach() {
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('auxclick', onAuxClick, true);
    }

    return { open: open, detach: detach };
  }

  BCBuddy.NewTab = {
    BUSY_ATTR: BUSY_ATTR,
    ORIGIN_ATTR: ORIGIN_ATTR,
    linkOf: linkOf,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
