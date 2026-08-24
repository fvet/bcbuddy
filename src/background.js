/*
 * BC Buddy - service worker.
 * Keeps the shared configuration (e.g. a raw GitHub URL) up to date.
 */
importScripts('/src/lib/i18n.js', '/src/lib/match.js', '/src/lib/settings.js');

var BCBuddy = self.BCBuddy;
var ALARM_SYNC = 'bcb-sync';

// A shared file that never answers must not leave the options page or the
// popup on "Synchronising..." with no way out.
var FETCH_TIMEOUT_MS = 15000;

// Far more than any realistic set of rules needs, and well under the storage
// quota. A file above this cannot be saved anyway, so it is refused up front
// with a readable message instead of failing later on chrome.storage.local.
var MAX_HOSTED_SIZE = 1024 * 1024;

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
  if (area !== 'local' || !changes[BCBuddy.STORAGE_KEY]) return;
  var before = BCBuddy.normalize(changes[BCBuddy.STORAGE_KEY].oldValue).hosted;
  var after = BCBuddy.normalize(changes[BCBuddy.STORAGE_KEY].newValue).hosted;
  if (before.url !== after.url || before.active !== after.active) {
    scheduleSync();
    if (after.url && before.url !== after.url) {
      syncHosted({ reason: 'url-changed', force: true });
    }
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.type) return;
  // Only options/popup (extension pages). Content scripts share our id but
  // their sender.url is the page they run in — refuse those.
  if (!isExtensionPage(sender)) return;
  if (message.type === 'bcb:sync') {
    syncHosted({ reason: 'manual', force: true }).then(sendResponse);
    return true; // async response
  }
});

/** True when the message came from one of our own extension pages. */
function isExtensionPage(sender) {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  var url = sender.url || '';
  return url.indexOf(chrome.runtime.getURL('/')) === 0;
}

/* ------------------------------------------------------------------ sync */

function scheduleSync() {
  return BCBuddy.loadSettings().then(function (settings) {
    // clearAll also drops any alarm name left by an older build.
    return chrome.alarms.clearAll().then(function () {
      if (!settings.hosted.url || !settings.hosted.active) return;
      return chrome.alarms.create(ALARM_SYNC, {
        delayInMinutes: 1,
        periodInMinutes: BCBuddy.SYNC_INTERVAL_MINUTES
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
      return { ok: true, rules: parsed.rules, name: parsed.name, hash: BCBuddy.hash(text), url: target };
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
 * Fetches the shared configuration and stores it as 'hosted.rules'.
 * Own rules are left alone; they take priority when matching.
 */
function syncHosted(options) {
  options = options || {};
  return BCBuddy.loadSettings().then(function (settings) {
    if (!settings.hosted.url) return { ok: false, error: BCBuddy.t('errNoHostedUrl') };
    // If the shared configuration is off, only a manual sync runs.
    if (!options.force && !settings.hosted.active) {
      return { ok: false, error: BCBuddy.t('errNotActive') };
    }
    return fetchHosted(settings.hosted.url).then(function (result) {
      var unchanged = result.hash === settings.hosted.lastHash;
      // Syncing turns the shared configuration on immediately: from now on it
      // is updated every day, until you clear it or empty the URL.
      settings.hosted.active = true;
      settings.hosted.rules = result.rules;
      settings.hosted.sourceName = result.name;
      settings.hosted.lastHash = result.hash;
      settings.hosted.lastSync = new Date().toISOString();
      settings.hosted.lastError = null;
      return BCBuddy.saveSettings(settings).then(function () {
        return { ok: true, count: result.rules.length, unchanged: unchanged, name: result.name };
      });
    }, function (err) {
      settings.hosted.lastError = String(err && err.message || err);
      settings.hosted.lastSync = new Date().toISOString();
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
