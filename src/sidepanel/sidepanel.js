/*
 * BC Buddy - the browser's side panel. It opens on a start view with one
 * entry per thing it can do: Report a problem and Feedback or a suggestion
 * (both Help & feedback, help.js, with the type set by the entry), and the
 * keyboard shortcuts. Each shows only while its switch is on. The back arrow
 * in the header returns to the start view; a report in progress is kept.
 *
 * The BC Buddy logo in BC's top bar (shortcuts.js), and the toolbar icon
 * while Help & feedback is on, open the panel on the start view; the logo
 * closes it again. The browser shortcut goes straight to the shortcuts. The
 * service worker says which view to show when the panel connects, and again
 * when it is asked for another one while the panel is open.
 *
 * The shortcuts view follows the tab in front: it connects to that
 * tab's top frame, whose content script sends the sections to show and sends
 * them again when the page or the cursor's place changes (listen() in
 * shortcuts.js). A tab that is not Business Central does not answer, and the
 * panel says to open one. When the tab it showed BC in goes to another site,
 * the shortcuts view closes the panel; Help & feedback stays, since the
 * report in progress is not about the page in front. The panel takes the
 * zoom of the tab in front.
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
  // 'home', 'shortcuts' or 'help', once known.
  var view = '';
  // Help & feedback and the keyboard shortcuts are switched on; a view whose
  // switch is off is not offered.
  var helpOn = false;
  var shortcutsOn = false;

  var VIEW_TIMEOUT_MS = 800;

  // Which entry Help & feedback was opened from: 'Bug' or 'Improvement'.
  var helpType = 'Bug';

  Promise.all([BCBuddy.loadLanguage(), BCBuddy.loadSettings().catch(function () { return null; })]).then(function (r) {
    var settings = r[1];
    helpOn = !!(settings && (BCBuddy.feedbackOn ? BCBuddy.feedbackOn(settings) : settings.feedbackEnabled));
    shortcutsOn = !!(settings && BCBuddy.shortcutsOn(settings));
    start();
  });

  /**
   * The language picked on the options page applies here at once: the
   * fixed texts, the title and everything Help & feedback drew. The report
   * in progress stays as it is.
   */
  function relocalize() {
    BCBuddy.loadLanguage().then(function () {
      BCBuddy.applyI18n();
      showTitle();
      if (BCBuddy.HelpPanel.relocalize) BCBuddy.HelpPanel.relocalize();
    });
  }

  function showTitle() {
    var title = BCBuddy.t(view === 'help' ? (helpType === 'Improvement' ? 'bpIdea' : 'bpBug')
      : view === 'shortcuts' ? 'scIconLabel' : 'bpTitle');
    document.getElementById('title').textContent = title;
    document.title = title;
  }

  function start() {
    BCBuddy.applyI18n();
    var docs = document.getElementById('docs');
    docs.href = BCBuddy.Shortcuts.DOCS[0][1];

    document.getElementById('settings').addEventListener('click', function (event) {
      if (!event.isTrusted) return;
      // Each view's gear opens its own settings panel.
      var message = { type: 'bcb:open-options' };
      if (view === 'help') message.panel = 'feedback';
      chrome.runtime.sendMessage(message).catch(function () {});
    });

    document.getElementById('back').addEventListener('click', function (event) {
      if (event.isTrusted) setView('home');
    });
    document.getElementById('go-bug').addEventListener('click', function (event) {
      if (event.isTrusted) setView('help', null, 'Bug');
    });
    document.getElementById('go-idea').addEventListener('click', function (event) {
      if (event.isTrusted) setView('help', null, 'Improvement');
    });
    document.getElementById('go-shortcuts').addEventListener('click', function (event) {
      if (event.isTrusted) setView('shortcuts');
    });
    document.getElementById('go-bug').hidden = !helpOn;
    document.getElementById('go-idea').hidden = !helpOn;
    document.getElementById('go-shortcuts').hidden = !shortcutsOn;
    document.getElementById('home-empty').hidden = helpOn || shortcutsOn;

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes[BCBuddy.LANGUAGE_KEY]) relocalize();
    });

    chrome.windows.getCurrent().then(function (win) {
      windowId = win.id;
      register();
      // Should the service worker not answer, the panel still shows something.
      setTimeout(function () { if (!view) setView(null); }, VIEW_TIMEOUT_MS);
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
      if (view === 'shortcuts' && change.url && bcOrigin && origin(change.url) !== bcOrigin) {
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
      if (!message) return;
      if (message.type === 'close') window.close();
      else if (message.type === 'view') setView(message.view, port);
    });
    port.onDisconnect.addListener(function () { setTimeout(register, 500); });
    panelPort = port;
  }

  var panelPort = null;

  var VIEWS = ['home', 'shortcuts', 'help'];

  /**
   * Shows one view. Without a request, the start view; a view whose switch
   * is off shows the start view too. Help & feedback takes the type its entry
   * on the start view gave it, 'Bug' or 'Improvement'; asked for by the
   * service worker it is a problem report.
   */
  function setView(want, port, type) {
    if (VIEWS.indexOf(want) === -1) {
      // A reconnect after the worker restarted asks again; keep what is shown.
      want = view || 'home';
    }
    if ((want === 'help' && !helpOn) || (want === 'shortcuts' && !shortcutsOn)) want = 'home';
    view = want;
    document.getElementById('view-home').hidden = want !== 'home';
    document.getElementById('view-help').hidden = want !== 'help';
    document.getElementById('view-shortcuts').hidden = want !== 'shortcuts';
    document.getElementById('back').hidden = want === 'home';
    document.getElementById('help-discard').hidden = true;
    // Help & feedback is titled after the entry it was opened from.
    if (want === 'help' && type) helpType = type === 'Improvement' ? 'Improvement' : 'Bug';
    showTitle();
    if (want === 'help') {
      BCBuddy.HelpPanel.start(windowId);
      BCBuddy.HelpPanel.shown(helpType);
    }
    try { (port || panelPort).postMessage({ type: 'shown', view: want }); } catch (e) { /* reconnecting */ }
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
