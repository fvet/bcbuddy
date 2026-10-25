/*
 * BC Buddy - service worker.
 * Keeps the shared configuration (e.g. a raw GitHub URL) up to date.
 */
importScripts('/src/lib/i18n.js', '/src/lib/match.js', '/src/lib/settings.js');

var BCBuddy = self.BCBuddy;
var ALARM_SYNC = 'bcb-sync';

// The language someone picked on the options page, for the error messages
// this worker writes. Reloaded when the choice changes.
var languageReady = BCBuddy.loadLanguage();

// A shared file that never answers must not leave the options page on
// "Synchronising..." with no way out.
var FETCH_TIMEOUT_MS = 15000;

// Far more than any realistic set of rules needs, and well under the storage
// quota. A file above this cannot be saved anyway, so it is refused up front
// with a readable message instead of failing later on chrome.storage.local.
var MAX_HOSTED_SIZE = 1024 * 1024;

chrome.runtime.onInstalled.addListener(function (details) {
  var install = details.reason === 'install';
  // The samples go in before the policy's address starts the first sync, so
  // that sync finds them and its shared rules can take over (syncHosted). An
  // update stores settings from an older version in the current shape first.
  (install ? seedSamples() : migrate()).then(enforcePolicy).then(function () {
    scheduleSync();
    if (install) welcome();
    else syncHosted({ reason: 'install' });
  });
});

/**
 * The packaged samples file, the same file Load samples reads, with its
 * styles named in the picked language.
 */
function packagedSamples() {
  return languageReady.then(function () {
    return fetch(chrome.runtime.getURL(BCBuddy.SAMPLES_PATH));
  }).then(function (response) {
    if (!response.ok) throw new Error(String(response.status));
    return response.text();
  }).then(function (text) {
    return BCBuddy.localizeSamples(BCBuddy.parseImport(text));
  });
}

/**
 * Settings saved by a version before the area switches are brought over once
 * (see BCBuddy.normalize), so every page reads the same answer from storage.
 * Never fails: loading migrates again until a save works.
 */
function migrate() {
  return chrome.storage.local.get(BCBuddy.STORAGE_KEY).then(function (obj) {
    var stored = obj && obj[BCBuddy.STORAGE_KEY];
    if (BCBuddy.isLegacy(stored)) return BCBuddy.saveSettings(stored);
  }).catch(function () {});
}

/**
 * A first install starts with the samples, with environment colours off (see
 * BCBuddy.seedSamples). Never fails: without them BC Buddy keeps its built-in
 * Default.
 */
function seedSamples() {
  return packagedSamples().then(function (samples) {
    return BCBuddy.loadSettings().then(function (settings) {
      if (BCBuddy.seedSamples(settings, samples)) return BCBuddy.saveSettings(settings);
    });
  }).catch(function () {});
}

/**
 * A first install opens the options page, unless IT installed BC Buddy by
 * policy: then it lands on hundreds of laptops at once, and a tab nobody asked
 * for is the last thing those people need. getSelf needs no permission.
 */
function welcome() {
  Promise.resolve().then(function () {
    return chrome.management.getSelf();
  }).then(function (info) {
    if (info.installType !== 'admin') chrome.runtime.openOptionsPage();
  }, function () {
    chrome.runtime.openOptionsPage();
  });
}

// The toolbar icon has no popup. With Help & feedback on, the browser opens
// the side panel itself (syncActionBehavior), and this click
// never comes. Otherwise it opens the options page on the Web client panel,
// or brings an open one to the front and switches it there.
chrome.action.onClicked.addListener(function () {
  openOptions('webclient');
});

/**
 * Lets the toolbar icon open the side panel while Help & feedback is on.
 * sidePanel.open() only works during the click itself, and reading the
 * settings first would be too late, so the browser does it: the behaviour
 * outlives the worker. The panel then shows its start view, since nobody
 * asked for another one (see sidePanels below).
 */
function syncActionBehavior() {
  if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) return;
  BCBuddy.loadSettings().then(function (settings) {
    var help = BCBuddy.feedbackOn(settings);
    return chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: help });
  }).catch(function () { /* settings unreadable: leave it */ });
}

syncActionBehavior();

/**
 * Opens the options page on `panel`. openOptionsPage() takes no address, so
 * the panel goes through session storage: a page that loads reads it, and a
 * page that is already open hears it change. Opened any other way, the page
 * shows the panel it was last left on.
 */
function openOptions(panel) {
  var request = {};
  request[BCBuddy.OPEN_PANEL_KEY] = panel;
  chrome.storage.session.set(request).catch(function () {}).then(function () {
    chrome.runtime.openOptionsPage();
  });
}

chrome.runtime.onStartup.addListener(function () {
  enforcePolicy().then(function () {
    scheduleSync(true);
    syncHosted({ reason: 'startup' });
  });
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === ALARM_SYNC) syncHosted({ reason: 'alarm' });
});

chrome.storage.onChanged.addListener(function (changes, area) {
  // IT set, changed or removed the policy.
  if (area === 'managed') {
    enforcePolicy();
    return;
  }
  if (area === 'local' && changes[BCBuddy.LANGUAGE_KEY]) languageReady = BCBuddy.loadLanguage();
  if (area !== 'local' || !changes[BCBuddy.STORAGE_KEY]) return;
  syncActionBehavior();
  // A write may have moved a value IT or the shared file sets, e.g. from an
  // options page that was open before the policy arrived, or an edited
  // export. enforcePolicy() puts it back, and saves only when it had to, so
  // its own write ends here.
  enforcePolicy();
  var before = BCBuddy.normalize(changes[BCBuddy.STORAGE_KEY].oldValue).hosted;
  var after = BCBuddy.normalize(changes[BCBuddy.STORAGE_KEY].newValue).hosted;
  if (before.url !== after.url || before.active !== after.active) {
    scheduleSync(!!(after.url && before.url !== after.url));
    if (after.url && before.url !== after.url) {
      syncHosted({ reason: 'url-changed', force: true });
    }
  } else if (BCBuddy.syncIntervalMinutes(before) !== BCBuddy.syncIntervalMinutes(after)) {
    // A try just ended: the first sync worked, a working one started to
    // fail, or a failing one failed again and waits longer.
    scheduleSync(true);
  }
});

// The browser shortcut someone set for the keyboard shortcuts panel (Chrome:
// chrome://extensions/shortcuts). It has no key of its own, so it never
// takes one from Business Central. Only the tab's top frame listens.
chrome.commands.onCommand.addListener(function (command, tab) {
  if (command !== 'show-shortcuts' || !tab || tab.id === undefined) return;
  toggleSidePanel(tab, 'shortcuts', true).then(function (ok) {
    if (ok) return;
    return chrome.tabs.sendMessage(tab.id, { type: 'bcb:toggle-shortcuts' }, { frameId: 0 });
  }).catch(function () { /* no BC Buddy in that tab */ });
});

// The side panel (src/sidepanel/) open in each window, by window id: the port
// it connected with and the view it shows, 'home', 'shortcuts' or 'help'. Only our
// own extension pages count.
var sidePanels = {};
// The view asked for while the panel was still opening, by window id. The
// panel asks for it when it connects; without one it shows its start view,
// as when the toolbar icon opened it.
var pendingViews = {};

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name !== 'bcb-sidepanel' || !isExtensionPage(port.sender)) return;
  var windowId = null;
  port.onMessage.addListener(function (message) {
    if (!message) return;
    if (message.type === 'hello' && typeof message.windowId === 'number') {
      windowId = message.windowId;
      var view = pendingViews[windowId] || null;
      delete pendingViews[windowId];
      sidePanels[windowId] = { port: port, view: view };
      try { port.postMessage({ type: 'view', view: view }); } catch (e) { /* closed */ }
    } else if (message.type === 'shown' && windowId !== null && sidePanels[windowId] &&
        (message.view === 'home' || message.view === 'shortcuts' || message.view === 'help')) {
      sidePanels[windowId].view = message.view;
    }
  });
  port.onDisconnect.addListener(function () {
    if (windowId !== null && sidePanels[windowId] && sidePanels[windowId].port === port) delete sidePanels[windowId];
  });
});

/**
 * Shows `view` in the side panel of the tab's window. With `toggle`, a panel
 * that already shows it closes instead, as the browser shortcut does; with
 * 'any', an open panel closes whatever it shows, as the logo does.
 * sidePanel.open() only works during a click or a key press, so it is called
 * straight away, before anything asynchronous. Resolves false when the
 * browser has no side panel to open.
 */
function toggleSidePanel(tab, view, toggle) {
  var open = sidePanels[tab.windowId];
  if (open) {
    try {
      if (toggle === 'any' || (toggle && open.view === view)) open.port.postMessage({ type: 'close' });
      else open.port.postMessage({ type: 'view', view: view });
      open.view = view;
      return Promise.resolve(true);
    } catch (e) { delete sidePanels[tab.windowId]; }
  }
  if (!chrome.sidePanel || !chrome.sidePanel.open) return Promise.resolve(false);
  pendingViews[tab.windowId] = view;
  return chrome.sidePanel.open({ windowId: tab.windowId })
    .then(function () { return true; }, function () {
      delete pendingViews[tab.windowId];
      return false;
    });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.type) return;
  // The messages a content script or the side panel may send: the BC Buddy
  // logo toggling the side panel, Open in a new tab, a request for our own
  // options page, which can ask for nothing else, and the texts of the
  // language picked on the options page, which are our own packaged files
  // (see i18n.js).
  if (message.type === 'bcb:messages') {
    if (!sender || sender.id !== chrome.runtime.id) return;
    BCBuddy.readMessages(message.lang).then(sendResponse);
    return true; // async response
  }
  if (message.type === 'bcb:open-tab') {
    openTab(message, sender);
    return;
  }
  // The BC Buddy logo in BC's top bar, from a tab's top frame: opens the
  // panel on its start view, or closes it when it is open. The panel itself
  // checks which entries are switched on.
  if (message.type === 'bcb:toggle-side-panel') {
    var tab = sender && sender.tab;
    if (!tab || tab.windowId === undefined || sender.id !== chrome.runtime.id || sender.frameId !== 0) return;
    toggleSidePanel(tab, 'home', 'any').then(function (ok) { sendResponse({ ok: ok }); });
    return true; // async response
  }
  if (message.type === 'bcb:open-options') {
    // The side panel's Help & feedback view asks for its own settings
    // panel; anything else gets Web client.
    if (sender && sender.id === chrome.runtime.id) {
      openOptions(message.panel === 'feedback' ? 'feedback' : 'webclient');
    }
    return;
  }
  // Only the options page (an extension page). Content scripts share our id but
  // their sender.url is the page they run in — refuse those.
  if (!isExtensionPage(sender)) return;
  if (message.type === 'bcb:sync') {
    syncHosted({ reason: 'manual', force: true }).then(sendResponse);
    return true; // async response
  }
});

/**
 * Open in a new tab (beta, undocumented; see lib/newtab.js): a content script
 * hands over the address Business Central showed for a link. It opens next to the tab that asked, and only when it is
 * on the same site as that tab, so a page cannot use this to open anything
 * else. Opening a tab needs no permission; reading the tab's address is what
 * the host permission already allows.
 */
function openTab(message, sender) {
  var tab = sender && sender.tab;
  if (!tab || sender.id !== chrome.runtime.id) return;
  var url, from;
  try {
    url = new URL(String(message.url));
    from = new URL(tab.url || sender.url);
  } catch (e) { return; }
  if (!/^https?:$/.test(url.protocol) || url.origin !== from.origin) return;
  chrome.tabs.create({
    url: url.href,
    windowId: tab.windowId,
    index: tab.index + 1,
    openerTabId: tab.id,
    active: !!message.active
  }).catch(function () { /* the window closed meanwhile */ });
}

/** True when the message came from one of our own extension pages. */
function isExtensionPage(sender) {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  var url = sender.url || '';
  return url.indexOf(chrome.runtime.getURL('/')) === 0;
}

/* ------------------------------------------------------------------ sync */

/**
 * Applies what IT set by policy and, while the shared configuration is
 * active, the Help & feedback values of the shared file (see
 * BCBuddy.enforceLocks). Saves only when that changed something; a new
 * address starts the sync through the listener above. Never rejects: startup
 * must go on without a policy, or without managed storage.
 */
function enforcePolicy() {
  return BCBuddy.readPolicy().then(function (policy) {
    return BCBuddy.loadSettings().then(function (settings) {
      if (BCBuddy.enforceLocks(settings, policy)) return BCBuddy.saveSettings(settings);
    });
  }).catch(function () {});
}

/**
 * Sets the sync alarm. afterTry: a sync just ran or is running, so the first
 * alarm waits a whole interval; otherwise it fires in a minute.
 */
function scheduleSync(afterTry) {
  return BCBuddy.loadSettings().then(function (settings) {
    // clearAll also drops any alarm name left by an older build.
    return chrome.alarms.clearAll().then(function () {
      if (!settings.hosted.url || !settings.hosted.active) return;
      var period = BCBuddy.syncIntervalMinutes(settings.hosted);
      return chrome.alarms.create(ALARM_SYNC, {
        delayInMinutes: afterTry ? period : 1,
        periodInMinutes: period
      });
    });
  }).catch(function () {
    // Nothing sensible to do here and nobody to tell: there is no UI on the
    // service worker. The alarm stays as it is and the next startup retries.
  });
}

function fetchHosted(url) {
  var target;
  try {
    target = BCBuddy.resolveHostedUrl(url);
  } catch (err) {
    return Promise.reject(err);
  }
  return fetch(target, {
    cache: 'no-cache',
    credentials: 'omit',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })
    .then(function (response) {
      if (!response.ok) throw new Error(BCBuddy.t('errHttp', [response.status, response.statusText]));
      if (tooLarge(response.headers.get('content-length'))) throw oversized();
      return response.text();
    })
    .then(function (text) {
      // The header is advisory and may be missing or wrong, so the body has
      // the last word. Characters rather than bytes is close enough for a
      // guard, and errs on the safe side for multi-byte text.
      if (tooLarge(text.length)) throw oversized();
      var parsed = BCBuddy.parseImport(text);
      return {
        ok: true,
        rules: parsed.rules,
        styles: parsed.styles,
        webClient: parsed.webClient,
        areas: BCBuddy.sharedAreas(parsed),
        feedback: parsed.feedback,
        name: parsed.name,
        hash: BCBuddy.hash(text),
        url: target
      };
    })
    .catch(function (err) {
      // AbortSignal.timeout() rejects with a TimeoutError whose own message
      // ("signal timed out") is neither translated nor informative.
      if (err && err.name === 'TimeoutError') {
        throw new Error(BCBuddy.t('errTimeout', [FETCH_TIMEOUT_MS / 1000]));
      }
      throw err;
    });
}

function tooLarge(size) {
  var n = parseInt(size, 10);
  return !isNaN(n) && n > MAX_HOSTED_SIZE;
}

function oversized() {
  return new Error(BCBuddy.t('errTooLarge', [Math.round(MAX_HOSTED_SIZE / 1024)]));
}

/**
 * Fetches the shared configuration and stores its rules and styles under
 * 'hosted'. Own rules are left alone; they take priority when matching. The
 * file's Web client settings are defaults: only the ones that changed in the
 * file since the last sync are passed on (see applySharedWebClient()).
 */
function syncHosted(options) {
  options = options || {};
  // Wait for the picked language: the errors below end up on the options page.
  var policy = {};
  return languageReady.then(function () {
    return BCBuddy.readPolicy();
  }).then(function (read) {
    policy = read;
    return BCBuddy.loadSettings();
  }).then(function (settings) {
    if (!settings.hosted.url) return { ok: false, error: BCBuddy.t('errNoHostedUrl') };
    // If the shared configuration is off, only a manual sync runs.
    if (!options.force && !settings.hosted.active) {
      return { ok: false, error: BCBuddy.t('errNotActive') };
    }
    return fetchHosted(settings.hosted.url).then(function (result) {
      // The first shared rules take over from the samples nobody edited.
      var firstRules = !settings.hosted.rules.length && result.rules.length;
      return (firstRules ? packagedSamples().catch(function () { return null; }) : Promise.resolve(null))
        .then(function (samples) {
          if (samples) BCBuddy.dropSamples(settings, samples);
          return result;
        });
    }).then(function (result) {
      var unchanged = result.hash === settings.hosted.lastHash;
      // Syncing turns the shared configuration on immediately: from now on it
      // is updated every day, until you clear it or empty the URL.
      settings.hosted.active = true;
      settings.hosted.rules = result.rules;
      settings.hosted.styles = result.styles;
      BCBuddy.applySharedWebClient(settings, result.webClient);
      // The area switches are team defaults too, but never over the policy.
      BCBuddy.applySharedAreas(settings, result.areas, BCBuddy.lockedKeys(settings, policy));
      // The Help & feedback settings in the file are the team's: locked while
      // the shared configuration is active, below the policy. A file that
      // does not mention them leaves the local choice alone.
      settings.hosted.feedback = result.feedback || {};
      BCBuddy.enforceLocks(settings, policy);
      settings.hosted.sourceName = result.name;
      settings.hosted.lastHash = result.hash;
      settings.hosted.lastSync = new Date().toISOString();
      settings.hosted.lastError = null;
      settings.hosted.failures = 0;
      return BCBuddy.saveSettings(settings).then(function () {
        return { ok: true, count: result.rules.length, unchanged: unchanged, name: result.name };
      });
    }, function (err) {
      settings.hosted.lastError = String(err && err.message || err);
      settings.hosted.lastSync = new Date().toISOString();
      settings.hosted.failures = (settings.hosted.failures || 0) + 1;
      return BCBuddy.saveSettings(settings).then(function () {
        return { ok: false, error: settings.hosted.lastError };
      });
    });
  }).catch(function (err) {
    // Anything that got past the handler above — a failed read, or a save that
    // hits the storage quota — still has to produce an answer. Every caller
    // either reports it or ignores it; none of them may be left waiting.
    return { ok: false, error: String(err && err.message || err) };
  });
}
