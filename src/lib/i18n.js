/*
 * BC Buddy - translations.
 * By default the language follows the browser: Chrome picks between the
 * folders under _locales itself (en, nl, fr), with en as fallback.
 *
 * Someone can overrule that with the language picker on the options page. The
 * choice sits under its own storage key (personal, so never in an export or a
 * shared file), and loadLanguage() then reads that folder's messages.json
 * into memory; t() looks there first and falls back to Chrome. Extension
 * pages and the service worker read the file themselves; a content script
 * cannot without making it web-accessible, so it asks the service worker.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  // The folders under _locales; anything else in storage means "browser".
  var LANGUAGES = ['en', 'nl', 'fr'];
  var LANGUAGE_KEY = 'language';
  var FALLBACK = 'en';

  // { lang, messages } once loadLanguage() found an override, else null.
  var override = null;

  /**
   * Translates a key. $1, $2, ... in the message are replaced by the given
   * values. If the key is missing we show the key itself, so a forgotten
   * translation stands out instead of leaving empty text.
   */
  function t(key, substitutions) {
    var subs = substitutions == null ? [] :
      (Array.isArray(substitutions) ? substitutions : [substitutions]);
    subs = subs.map(String);
    var message = override ? fromOverride(key, subs) : '';
    if (message) return message;
    try {
      message = chrome.i18n.getMessage(key, subs);
    } catch (e) { /* outside an extension, e.g. on a test page */ }
    return message || key;
  }

  /** chrome.i18n's own rules: $1..$9 take a substitution, $$ is a dollar. */
  function fromOverride(key, subs) {
    var message = Object.prototype.hasOwnProperty.call(override.messages, key)
      ? override.messages[key] : '';
    if (!message) return '';
    return message.replace(/\$([1-9$])/g, function (all, which) {
      if (which === '$') return '$';
      var value = subs[Number(which) - 1];
      return value === undefined ? '' : value;
    });
  }

  /** A stored choice, checked against the list; '' means "follow the browser". */
  function normalizeLanguage(value) {
    return LANGUAGES.indexOf(value) >= 0 ? value : '';
  }

  /** The folder Chrome itself picks for this browser's UI language. */
  function browserLanguage() {
    var ui = '';
    try { ui = String(chrome.i18n.getUILanguage() || ''); } catch (e) { /* outside an extension */ }
    var base = ui.toLowerCase().split(/[-_]/)[0];
    return LANGUAGES.indexOf(base) >= 0 ? base : FALLBACK;
  }

  /** The language on screen: the override when there is one, else Chrome's pick. */
  function currentLanguage() {
    return override ? override.lang : browserLanguage();
  }

  /**
   * Reads the stored choice and, when it differs from what Chrome picks,
   * loads that language. Resolves with the override in use ('' for none) and
   * never rejects: whatever fails, the browser language stays.
   */
  function loadLanguage() {
    var area;
    try { area = chrome.storage.local; } catch (e) { area = null; }
    if (!area) return Promise.resolve('');
    return area.get(LANGUAGE_KEY).then(function (stored) {
      var lang = normalizeLanguage(stored && stored[LANGUAGE_KEY]);
      if (!lang || lang === browserLanguage()) {
        override = null;
        return '';
      }
      return requestMessages(lang).then(function (messages) {
        override = messages ? { lang: lang, messages: messages } : null;
        return override ? lang : '';
      });
    }).catch(function () {
      override = null;
      return '';
    });
  }

  /** Stores a choice from the picker; '' goes back to the browser language. */
  function saveLanguage(value) {
    var lang = normalizeLanguage(value);
    if (!lang) return chrome.storage.local.remove(LANGUAGE_KEY);
    var payload = {};
    payload[LANGUAGE_KEY] = lang;
    return chrome.storage.local.set(payload);
  }

  function isExtensionContext() {
    try {
      return root.location.href.indexOf(chrome.runtime.getURL('/')) === 0;
    } catch (e) { return false; }
  }

  function requestMessages(lang) {
    if (isExtensionContext()) return readMessages(lang);
    try {
      return chrome.runtime.sendMessage({ type: 'bcb:messages', lang: lang })
        .then(cleanMessages)
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  // The parsed files, per language, for the service worker's answers.
  var cache = {};

  /**
   * Reads one of our own messages.json files. Extension pages and the service
   * worker only: a web page's origin cannot reach them. Resolves with
   * { key: text } or null.
   */
  function readMessages(value) {
    var lang = normalizeLanguage(value);
    if (!lang) return Promise.resolve(null);
    if (cache[lang]) return Promise.resolve(cache[lang]);
    return fetch(chrome.runtime.getURL('_locales/' + lang + '/messages.json'))
      .then(function (response) { return response.json(); })
      .then(function (data) {
        var messages = {};
        Object.keys(data || {}).forEach(function (key) {
          var entry = data[key];
          if (entry && typeof entry.message === 'string') messages[key] = entry.message;
        });
        cache[lang] = cleanMessages(messages);
        return cache[lang];
      })
      .catch(function () { return null; });
  }

  /** Keeps only string values, in an object without a prototype. */
  function cleanMessages(data) {
    if (!data || typeof data !== 'object') return null;
    var out = Object.create(null);
    var count = 0;
    Object.keys(data).forEach(function (key) {
      if (typeof data[key] === 'string') {
        out[key] = data[key];
        count++;
      }
    });
    return count ? out : null;
  }

  /**
   * Aligns <html lang> with the language of the strings on screen, so
   * assistive tech matches them. The attribute in the HTML files is only a
   * pre-JS fallback (default_locale).
   */
  function applyDocumentLang() {
    try {
      var lang = override ? override.lang : chrome.i18n.getUILanguage();
      if (lang) document.documentElement.lang = lang;
    } catch (e) { /* outside an extension */ }
  }

  /**
   * Fills in the texts in a piece of HTML:
   *   data-i18n              element text
   *   data-i18n-title        title attribute
   *   data-i18n-label        aria-label
   *   data-i18n-placeholder  placeholder
   */
  function apply(scope) {
    // Always on the document: card-scoped applies must not leave lang stale.
    applyDocumentLang();
    var root = scope || document;
    each(root, 'data-i18n', function (el, key) { el.textContent = t(key); });
    each(root, 'data-i18n-title', function (el, key) { el.title = t(key); });
    each(root, 'data-i18n-label', function (el, key) { el.setAttribute('aria-label', t(key)); });
    each(root, 'data-i18n-placeholder', function (el, key) { el.placeholder = t(key); });
  }

  function each(root, attribute, fn) {
    var nodes = root.querySelectorAll('[' + attribute + ']');
    Array.prototype.forEach.call(nodes, function (el) {
      fn(el, el.getAttribute(attribute));
    });
  }

  BCBuddy.t = t;
  BCBuddy.applyI18n = apply;
  BCBuddy.applyDocumentLang = applyDocumentLang;
  BCBuddy.LANGUAGES = LANGUAGES.slice();
  BCBuddy.LANGUAGE_KEY = LANGUAGE_KEY;
  BCBuddy.normalizeLanguage = normalizeLanguage;
  BCBuddy.currentLanguage = currentLanguage;
  BCBuddy.loadLanguage = loadLanguage;
  BCBuddy.saveLanguage = saveLanguage;
  BCBuddy.readMessages = readMessages;
})(typeof self !== 'undefined' ? self : this);
