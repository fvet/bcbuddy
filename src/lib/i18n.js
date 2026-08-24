/*
 * BC Buddy - translations.
 * Language follows the browser: Chrome picks between _locales/en and
 * _locales/nl itself, with en as fallback. So there is no switch and no flash.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  /**
   * Translates a key. $1, $2, ... in the message are replaced by the given
   * values. If the key is missing we show the key itself, so a forgotten
   * translation stands out instead of leaving empty text.
   */
  function t(key, substitutions) {
    var subs = substitutions == null ? [] :
      (Array.isArray(substitutions) ? substitutions : [substitutions]);
    var message = '';
    try {
      message = chrome.i18n.getMessage(key, subs.map(String));
    } catch (e) { /* outside an extension, e.g. on a test page */ }
    return message || key;
  }

  /**
   * Aligns <html lang> with the UI language Chrome chose for messages, so
   * assistive tech matches the strings on screen. The attribute in the HTML
   * files is only a pre-JS fallback (default_locale).
   */
  function applyDocumentLang() {
    try {
      var lang = chrome.i18n.getUILanguage();
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
})(typeof self !== 'undefined' ? self : this);
