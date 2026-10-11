/*
 * BC Buddy - a way into the options from Business Central's gear menu.
 *
 * In BC online the gear icon opens the Settings pane of the Microsoft 365
 * shell. That pane lives in the top window, not in BC's iframe, and is built
 * from scratch every time it opens: div#FlexPane_Overflow_Container appears as
 * a direct child of <body> and is removed again when the pane closes. Inside
 * it, div#O365_Settings_navbardatalinks holds the "Dynamics 365 Business
 * Central" section. We add a "BC Buddy" section with one link right after it,
 * above "Microsoft 365".
 *
 * The shell's class names are hashed and change between its releases, so
 * nothing is hard-coded: the new section copies the classes of BC's own
 * section, element by element, and looks like it on whatever release is live.
 *
 * Cost: one observer on the direct children of <body>, which change when a
 * shell pane opens or closes and hardly ever otherwise. Only while the pane is
 * open, a second observer watches that pane, a few dozen elements and no grid.
 * On-prem has no Microsoft 365 shell; there the first observer simply never
 * finds a pane.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var CONTAINER_ID = 'FlexPane_Overflow_Container';
  var ANCHOR_ID = 'O365_Settings_navbardatalinks';
  var SECTION_ID = 'bcb-gear-section';
  var TITLE = 'BC Buddy';

  /**
   * Shallow copies of the elements from just below `top` down to `target`,
   * nested the same way. Returns [outermost, innermost], or null when target
   * is not inside top. Ids are dropped and labels renamed, so the copy never
   * claims to be BC's section.
   */
  function copyPath(top, target) {
    var chain = [];
    for (var el = target; el && el !== top; el = el.parentElement) chain.unshift(el);
    if (!chain.length || !target || chain[0].parentElement !== top) return null;
    var outer = null;
    var inner = null;
    chain.forEach(function (node) {
      var copy = node.cloneNode(false);
      copy.removeAttribute('id');
      if (copy.hasAttribute('aria-label')) copy.setAttribute('aria-label', TITLE);
      if (inner) inner.appendChild(copy);
      else outer = copy;
      inner = copy;
    });
    return [outer, inner];
  }

  /**
   * Our section, shaped like BC's: a divider (taken from the Microsoft 365
   * section below, which has one), then a heading and a list with one link.
   * Null when BC's section does not have the shape we know.
   */
  function build(doc, anchor, label, onOpen) {
    var box = anchor.firstElementChild;
    var heading = anchor.querySelector('h3');
    var list = anchor.querySelector('ul');
    var model = anchor.querySelector('a');
    if (!box || !heading || !list || !model) return null;
    var headPath = copyPath(box, heading);
    var listPath = copyPath(box, list);
    if (!headPath || !listPath) return null;

    var section = doc.createElement('div');
    section.id = SECTION_ID;
    var next = anchor.nextElementSibling;
    var divider = next && next.firstElementChild;
    if (divider && divider.tagName === 'DIV' && !divider.firstChild) {
      section.appendChild(divider.cloneNode(false));
    }

    headPath[1].textContent = TITLE;
    var link = doc.createElement('a');
    link.className = model.className;
    link.setAttribute('role', 'link');
    link.tabIndex = 0;
    link.textContent = label;
    // BC's own links are anchors without an href, as is this one, so Enter
    // and Space are ours to handle. A click the page made up (isTrusted false)
    // is ignored: only the person at the keyboard opens the options.
    link.addEventListener('click', function (event) {
      if (event.isTrusted) onOpen();
    });
    link.addEventListener('keydown', function (event) {
      if (!event.isTrusted || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      onOpen();
    });
    var item = doc.createElement('li');
    item.appendChild(link);
    listPath[1].appendChild(item);

    var copy = box.cloneNode(false);
    copy.removeAttribute('id');
    copy.appendChild(headPath[0]);
    copy.appendChild(listPath[0]);
    section.appendChild(copy);
    return section;
  }

  /**
   * Starts adding the section to the gear menu of this document. options.label
   * is the link text, options.onOpen runs when it is used. Returns a handle
   * whose detach() stops it and takes the section out again.
   */
  function attach(doc, options) {
    var win = doc.defaultView;
    var detached = false;
    var watched = null;

    var shell = new win.MutationObserver(findPane);
    var pane = new win.MutationObserver(insert);

    if (doc.body) start();
    else doc.addEventListener('DOMContentLoaded', start, { once: true });

    function start() {
      if (detached || !doc.body) return;
      shell.observe(doc.body, { childList: true });
      findPane();
    }

    function findPane() {
      var container = doc.getElementById(CONTAINER_ID);
      if (container === watched) return;
      pane.disconnect();
      watched = container;
      if (!container) return;
      // The shell may switch the open pane (Settings, Help, Notifications)
      // without closing it, so the pane is watched for as long as it is open.
      pane.observe(container, { childList: true, subtree: true });
      insert();
    }

    function insert() {
      if (detached || doc.getElementById(SECTION_ID)) return;
      var anchor = doc.getElementById(ANCHOR_ID);
      if (!anchor || !anchor.parentNode) return;
      var section = build(doc, anchor, options.label, options.onOpen);
      if (section) anchor.parentNode.insertBefore(section, anchor.nextSibling);
    }

    function detach() {
      detached = true;
      shell.disconnect();
      pane.disconnect();
      watched = null;
      var section = doc.getElementById(SECTION_ID);
      if (section) section.remove();
    }

    return { detach: detach };
  }

  BCBuddy.GearMenu = {
    CONTAINER_ID: CONTAINER_ID,
    ANCHOR_ID: ANCHOR_ID,
    SECTION_ID: SECTION_ID,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
