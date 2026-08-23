/*
 * BC Buddy - service worker.
 * Houdt de gedeelde configuratie (bv. een raw GitHub-URL) actueel.
 */
importScripts('/src/lib/i18n.js', '/src/lib/match.js', '/src/lib/settings.js');

var BCEM = self.BCEM;
var ALARM_SYNC = 'bcem-sync';

chrome.runtime.onInstalled.addListener(function (details) {
  scheduleSync();
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  } else {
    syncHosted({ reason: 'install' });
  }
});

chrome.runtime.onStartup.addListener(function () {
  scheduleSync();
  syncHosted({ reason: 'startup' });
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === ALARM_SYNC) syncHosted({ reason: 'alarm' });
});

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== 'local' || !changes[BCEM.STORAGE_KEY]) return;
  var before = BCEM.normalize(changes[BCEM.STORAGE_KEY].oldValue).hosted;
  var after = BCEM.normalize(changes[BCEM.STORAGE_KEY].newValue).hosted;
  if (before.url !== after.url || before.active !== after.active) {
    scheduleSync();
    if (after.url && before.url !== after.url) {
      syncHosted({ reason: 'url-changed', force: true });
    }
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.type) return;
  if (message.type === 'bcem:sync') {
    syncHosted({ reason: 'manual', force: true }).then(sendResponse);
    return true; // async antwoord
  }
  if (message.type === 'bcem:preview') {
    fetchHosted(message.url).then(sendResponse, function (err) {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    });
    return true;
  }
});

/* ------------------------------------------------------------------ sync */

function scheduleSync() {
  BCEM.loadSettings().then(function (settings) {
    chrome.alarms.clear(ALARM_SYNC);
    if (!settings.hosted.url || !settings.hosted.active) return;
    chrome.alarms.create(ALARM_SYNC, {
      delayInMinutes: 1,
      periodInMinutes: BCEM.SYNC_INTERVAL_MINUTES
    });
  });
}

function fetchHosted(url) {
  var target = BCEM.toRawUrl(url);
  if (!target) return Promise.reject(new Error(BCEM.t('errNoUrl')));
  return fetch(target, { cache: 'no-cache', credentials: 'omit' })
    .then(function (response) {
      if (!response.ok) throw new Error(BCEM.t('errHttp', [response.status, response.statusText]));
      return response.text();
    })
    .then(function (text) {
      var parsed = BCEM.parseImport(text);
      return { ok: true, rules: parsed.rules, name: parsed.name, hash: BCEM.hash(text), url: target };
    });
}

/**
 * Haalt de gedeelde configuratie op en schrijft ze weg als 'hosted.rules'.
 * Eigen regels blijven ongemoeid; ze hebben voorrang bij het matchen.
 */
function syncHosted(options) {
  options = options || {};
  return BCEM.loadSettings().then(function (settings) {
    if (!settings.hosted.url) return { ok: false, error: BCEM.t('errNoHostedUrl') };
    // Staat de gedeelde configuratie uit, dan loopt enkel een handmatige sync.
    if (!options.force && !settings.hosted.active) {
      return { ok: false, error: BCEM.t('errNotActive') };
    }
    return fetchHosted(settings.hosted.url).then(function (result) {
      var unchanged = result.hash === settings.hosted.lastHash;
      // Synchroniseren zet de gedeelde configuratie meteen aan: vanaf nu wordt
      // ze elke dag bijgewerkt, tot je ze wist of de URL leeghaalt.
      settings.hosted.active = true;
      settings.hosted.rules = result.rules;
      settings.hosted.sourceName = result.name;
      settings.hosted.lastHash = result.hash;
      settings.hosted.lastSync = new Date().toISOString();
      settings.hosted.lastError = null;
      return BCEM.saveSettings(settings).then(function () {
        return { ok: true, count: result.rules.length, unchanged: unchanged, name: result.name };
      });
    }, function (err) {
      settings.hosted.lastError = String(err && err.message || err);
      settings.hosted.lastSync = new Date().toISOString();
      return BCEM.saveSettings(settings).then(function () {
        return { ok: false, error: settings.hosted.lastError };
      });
    });
  });
}

