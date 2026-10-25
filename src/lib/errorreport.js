/*
 * BC Buddy - "Report a problem" in Business Central's error dialog.
 *
 * An error dialog (div.spa-dialog in a div.spa-container) has a Share details
 * menu whose first entry, Copy error details, puts everything a helpdesk needs
 * on the clipboard: the message, the session and activity ids, the time and
 * the AL call stack. That text is never in the DOM; it only exists when BC
 * copies it. So we add a link on the Share details row, and one real click on
 * it does what the user would otherwise do by hand:
 *
 *   1. the service worker takes a screenshot of the tab (the dialog is in it),
 *   2. we open Share details and click Copy error details from script,
 *   3. a copy listener reads what BC puts on the clipboard,
 *   4. the report in the side panel opens with the screenshot and the text.
 *
 * Chrome only lets a script copy within a few seconds of a real click in the
 * page, which is why the link is in the page and not in the side panel. The
 * clipboard is overwritten: it is BC's own copy.
 *
 * Cost: one childList observer per .spa-container, as the dropdown sizer has.
 * A new dialog gets a short-lived observer on itself (a dozen elements, for a
 * few seconds) until its Share details button is there. Nothing runs per row,
 * scroll or keystroke.
 *
 * The text read from the clipboard is data from the page: it is capped here
 * and everywhere it goes after, and only ever shown with textContent.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var CONTAINER_CLASS = 'spa-container';
  var DIALOG_CLASS = 'spa-dialog';
  // The message in the dialog, and the row BC puts Share details on.
  var CAPTION_SEL = '.error-dialog-caption';
  var SHARE_SEL = '.error-dialog-troubleshoot-container button.fui-MenuButton';
  var PROVIDER_SEL = '.fui-FluentProvider';
  // The menu BC opens for Share details is drawn outside the dialog.
  var ITEM_SEL = '.fui-MenuPopover [role="menuitem"]';
  // Share via Teams and Ask Copilot are not what we want to click.
  var NOT_COPY_RE = /teams|copilot/i;

  var LINK_CLASS = 'bcb-error-link';
  var MARK = 'data-bcb-error-link';
  // On <html> while we copy: content.css hides BC's menu so it does not flash.
  var CAPTURING = 'data-bcb-capturing';

  var MAX_MESSAGE = 1000;
  var MAX_DETAILS = 12000;
  // How long to wait for BC's menu, and for its copy.
  var MENU_WAIT_MS = 1500;
  var COPY_WAIT_MS = 1000;
  // A dialog that never gets a Share details button stops being watched.
  var PLACE_WAIT_MS = 5000;

  /** A text from the page, as it goes into the report: capped, no control characters. */
  function clean(value, max) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
  }

  /** The dialog is an error dialog with a Share details menu. */
  function isErrorDialog(node) {
    return node.nodeType === 1 && node.classList.contains(DIALOG_CLASS) &&
      !!node.querySelector(CAPTION_SEL) && !!node.querySelector(SHARE_SEL);
  }

  /** The entry that copies: the first one that is not Teams or Copilot. */
  function pickCopyItem(items) {
    for (var i = 0; i < items.length; i++) {
      if (!NOT_COPY_RE.test(items[i].textContent || '')) return items[i];
    }
    return null;
  }

  /**
   * Starts adding the link to the error dialogs in this document.
   * options.t(key) gives a text, options.shot() asks the service worker for a
   * screenshot and resolves when it has one, options.report({ message,
   * details }) hands the result to the service worker, which opens the panel.
   * Returns a handle whose detach() removes it all.
   */
  function attach(doc, options) {
    var win = doc.defaultView;
    var detached = false;
    var busy = false;
    var containers = new win.MutationObserver(onContainers);
    var dialogs = new win.MutationObserver(onDialogs);
    var waiting = [];

    if (doc.body) start();
    else doc.addEventListener('DOMContentLoaded', start, { once: true });

    function start() {
      if (detached || !doc.body) return;
      containers.observe(doc.body, { childList: true });
      var children = doc.body.children;
      for (var i = 0; i < children.length; i++) watch(children[i]);
    }

    function watch(node) {
      if (node.nodeType !== 1 || !node.classList.contains(CONTAINER_CLASS)) return;
      dialogs.observe(node, { childList: true });
      for (var i = 0; i < node.children.length; i++) prepare(node.children[i]);
    }

    function onContainers(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) watch(added[j]);
      }
    }

    function onDialogs(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) prepare(added[j]);
      }
    }

    /** A new dialog: the link now, or as soon as BC has drawn Share details. */
    function prepare(node) {
      if (node.nodeType !== 1 || !node.classList.contains(DIALOG_CLASS)) return;
      if (place(node)) return;
      var watcher = new win.MutationObserver(function () {
        if (detached || place(node)) stop();
      });
      var timer = setTimeout(stop, PLACE_WAIT_MS);
      function stop() {
        clearTimeout(timer);
        watcher.disconnect();
        var at = waiting.indexOf(watcher);
        if (at !== -1) waiting.splice(at, 1);
      }
      waiting.push(watcher);
      watcher.observe(node, { childList: true, subtree: true });
    }

    /** Puts the link on the Share details row. True when it is there. */
    function place(dialog) {
      if (dialog.querySelector('[' + MARK + ']')) return true;
      if (!isErrorDialog(dialog)) return false;
      var share = dialog.querySelector(SHARE_SEL);
      var provider = share.closest(PROVIDER_SEL);
      if (!provider) return false;

      var link = doc.createElement('button');
      link.type = 'button';
      link.className = LINK_CLASS;
      link.setAttribute(MARK, '');
      var label = doc.createElement('span');
      label.textContent = options.t('bpBug');
      var icon = BCBuddy.Shortcuts && BCBuddy.Shortcuts.peopleSvg ? BCBuddy.Shortcuts.peopleSvg(doc) : null;
      if (icon) link.appendChild(icon);
      link.appendChild(label);
      // The same colour as Share details next to it, so a theme follows.
      link.style.color = win.getComputedStyle(share).color;
      link.addEventListener('click', function (event) {
        if (!event.isTrusted) return;
        event.preventDefault();
        event.stopPropagation();
        run(dialog, share);
      });
      // First in the row, floated to the right: BC's own button keeps its place.
      provider.insertBefore(link, provider.firstChild);
      return true;
    }

    /** The whole job, from the user's click. */
    function run(dialog, share) {
      if (busy || detached) return;
      busy = true;
      var caption = dialog.querySelector(CAPTION_SEL);
      var message = clean(caption ? (caption.textContent || caption.getAttribute('title') || '') : '', MAX_MESSAGE);
      doc.documentElement.setAttribute(CAPTURING, '');

      // The screenshot first, while the dialog is the only thing on screen;
      // the click is still recent enough for the copy that follows.
      Promise.resolve(options.shot()).catch(function () { return null; }).then(function () {
        return copyDetails(share);
      }).then(function (details) {
        options.report({ message: message, details: details });
      }).catch(function () {
        options.report({ message: message, details: '' });
      }).then(function () {
        doc.documentElement.removeAttribute(CAPTURING);
        busy = false;
      });
    }

    /**
     * Opens Share details, clicks Copy error details and reads what BC
     * copied. Resolves '' when anything is not as expected.
     */
    function copyDetails(share) {
      return new Promise(function (resolve) {
        var text = '';
        var finished = false;
        var timer = 0;

        function finish() {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          win.removeEventListener('copy', onWindowCopy, true);
          // Leave the menu closed whatever happened.
          if (share.getAttribute('aria-expanded') === 'true') share.click();
          resolve(clean(text, MAX_DETAILS));
        }

        // BC copies with a one-off capturing listener on the document and
        // execCommand('copy'). Ours is added on the window, which runs first,
        // and adds one on the document that runs after BC's has filled in the
        // clipboard data.
        function onWindowCopy() {
          doc.addEventListener('copy', function (event) {
            try { text = event.clipboardData.getData('text/plain'); } catch (e) { text = ''; }
            setTimeout(finish, 0);
          }, { capture: true, once: true });
        }
        win.addEventListener('copy', onWindowCopy, true);

        timer = setTimeout(finish, MENU_WAIT_MS + COPY_WAIT_MS);
        share.click();
        var started = Date.now();
        (function pick() {
          if (finished) return;
          var item = pickCopyItem(doc.querySelectorAll(ITEM_SEL));
          if (item) { item.click(); return; }
          if (Date.now() - started > MENU_WAIT_MS) { finish(); return; }
          setTimeout(pick, 30);
        })();
      });
    }

    function detach() {
      detached = true;
      containers.disconnect();
      dialogs.disconnect();
      waiting.forEach(function (watcher) { watcher.disconnect(); });
      waiting = [];
      doc.documentElement.removeAttribute(CAPTURING);
      var links = doc.querySelectorAll('[' + MARK + ']');
      for (var i = 0; i < links.length; i++) links[i].remove();
    }

    return { detach: detach };
  }

  BCBuddy.ErrorReport = {
    MARK: MARK,
    CAPTURING: CAPTURING,
    MAX_MESSAGE: MAX_MESSAGE,
    MAX_DETAILS: MAX_DETAILS,
    clean: clean,
    isErrorDialog: isErrorDialog,
    pickCopyItem: pickCopyItem,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
