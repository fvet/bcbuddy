/*
 * BC Buddy - the keyboard shortcuts in the browser's side panel.
 *
 * The keyboard icon in BC's top bar (shortcuts.js), or the browser shortcut,
 * asks the service worker to open this panel in the window; a second press
 * closes it again. The panel follows the tab in front: it connects to that
 * tab's top frame, whose content script sends the sections to show and sends
 * them again when the page or the cursor's place changes (listen() in
 * shortcuts.js). A tab that is not Business Central does not answer, and the
 * panel says to open one. When the tab it showed BC in goes to another site,
 * the panel closes itself. It takes the zoom of the tab in front.
 *
 * What arrives over the port was partly read from the page (action names
 * from tooltips), so it is checked and capped here and only ever put on the
 * page as text.
 */
(function () {
  'use strict';

  var BCBuddy = self.BCBuddy;
  var MAX_SECTIONS = 8;
  var MAX_ROWS = 60;
  var MAX_TEXT = 160;

  var list = document.getElementById('list');
  var empty = document.getElementById('empty');
  var windowId = null;
  var tabId = null;
  var tabPort = null;
  // The origin of the tab in front once it showed BC shortcuts, else ''.
  var bcOrigin = '';

  BCBuddy.loadLanguage().then(start);

  function start() {
    BCBuddy.applyI18n();
    var docs = document.getElementById('docs');
    docs.href = BCBuddy.Shortcuts.DOCS[0][1];

    document.getElementById('settings').addEventListener('click', function (event) {
      if (!event.isTrusted) return;
      chrome.runtime.sendMessage({ type: 'bcb:open-options' }).catch(function () {});
    });

    chrome.windows.getCurrent().then(function (win) {
      windowId = win.id;
      register();
      chrome.tabs.query({ active: true, windowId: windowId }).then(function (tabs) {
        if (tabs[0]) follow(tabs[0].id);
      });
    });

    // The panel is shown at the zoom of the tab in front, like the page.
    chrome.tabs.onZoomChange.addListener(function (info) {
      if (info.tabId === tabId) zoom(info.newZoomFactor);
    });
    chrome.tabs.onActivated.addListener(function (info) {
      if (info.windowId === windowId) follow(info.tabId);
    });
    // A reload or another address in the same tab: its content script is new.
    chrome.tabs.onUpdated.addListener(function (id, change) {
      if (id !== tabId) return;
      // The tab left the site it showed Business Central on: the panel
      // closes, so it is not in the way elsewhere. Moving around in BC keeps
      // the same origin.
      if (change.url && bcOrigin && origin(change.url) !== bcOrigin) {
        window.close();
        return;
      }
      if (change.status === 'complete') follow(id, true);
    });
  }

  /**
   * Tells the service worker this window has the panel open, so the icon
   * closes it next time. Again after the worker was stopped and restarted.
   */
  function register() {
    var port = chrome.runtime.connect({ name: 'bcb-sidepanel' });
    port.postMessage({ type: 'hello', windowId: windowId });
    port.onMessage.addListener(function (message) {
      if (message && message.type === 'close') window.close();
    });
    port.onDisconnect.addListener(function () { setTimeout(register, 500); });
  }

  function zoom(factor) {
    if (typeof factor !== 'number' || !(factor >= 0.25 && factor <= 5)) factor = 1;
    document.documentElement.style.zoom = String(factor);
  }

  function origin(url) {
    try { return new URL(url).origin; } catch (e) { return ''; }
  }

  /** Remembers where the tab in front shows Business Central. */
  function rememberOrigin(id) {
    chrome.tabs.get(id).then(function (tab) {
      if (id === tabId && tab.url) bcOrigin = origin(tab.url);
    }).catch(function () {});
  }

  function follow(id, again) {
    if (id === tabId && tabPort && !again) return;
    if (id !== tabId) bcOrigin = '';
    if (tabPort) tabPort.disconnect();
    tabId = id;
    tabPort = null;
    show(null);
    chrome.tabs.getZoom(id).then(function (factor) {
      if (id === tabId) zoom(factor);
    }).catch(function () {});
    var port;
    try {
      port = chrome.tabs.connect(id, { name: 'bcb-shortcuts', frameId: 0 });
    } catch (e) { return; }
    tabPort = port;
    port.onMessage.addListener(function (message) {
      if (port !== tabPort || !message) return;
      if (message.type === 'sections') {
        if (!bcOrigin) rememberOrigin(id);
        show(clean(message.sections));
      } else if (message.type === 'none') show(null);
    });
    port.onDisconnect.addListener(function () {
      void chrome.runtime.lastError; // no BC Buddy in that tab
      if (port === tabPort) { tabPort = null; show(null); }
    });
  }

  function text(value) {
    return typeof value === 'string' ? value.slice(0, MAX_TEXT) : '';
  }

  /** [{ title, note, rows: [[keys, text]] }] with every field a short string. */
  function clean(sections) {
    if (!Array.isArray(sections)) return null;
    return sections.slice(0, MAX_SECTIONS).map(function (section) {
      section = section || {};
      var rows = Array.isArray(section.rows) ? section.rows.slice(0, MAX_ROWS) : [];
      return {
        title: text(section.title),
        note: text(section.note),
        rows: rows.filter(Array.isArray).map(function (row) { return [text(row[0]), text(row[1])]; })
          .filter(function (row) { return row[0] && row[1]; })
      };
    }).filter(function (section) { return section.title && section.rows.length; });
  }

  function el(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  }

  function keys(value) {
    var dt = el('dt');
    BCBuddy.Shortcuts.keyParts(value).forEach(function (alt, a) {
      if (a) dt.appendChild(el('span', 'glue', '/'));
      alt.forEach(function (combo, c) {
        if (c) dt.appendChild(el('span', 'glue', ','));
        combo.forEach(function (key, k) {
          if (k) dt.appendChild(el('span', 'glue', '+'));
          dt.appendChild(el('kbd', '', key));
        });
      });
    });
    return dt;
  }

  function show(sections) {
    list.textContent = '';
    empty.hidden = !!(sections && sections.length);
    if (!sections) return;
    sections.forEach(function (section) {
      var card = el('section', 'card');
      card.appendChild(el('h2', '', section.title));
      if (section.note) card.appendChild(el('p', 'note', section.note));
      var dl = el('dl');
      section.rows.forEach(function (row) {
        dl.appendChild(keys(row[0]));
        dl.appendChild(el('dd', '', row[1]));
      });
      card.appendChild(dl);
      list.appendChild(card);
    });
  }
})();
