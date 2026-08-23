/*
 * BC Buddy - vertalingen.
 * De taal volgt de taal van de browser: Chrome kiest zelf tussen _locales/nl
 * en _locales/en, met nl als terugval. Er is dus geen schakelaar en geen flits.
 */
(function (root) {
  'use strict';
  var BCEM = root.BCEM || (root.BCEM = {});

  /**
   * Vertaalt een sleutel. $1, $2, ... in het bericht worden vervangen door de
   * meegegeven waarden. Ontbreekt de sleutel, dan tonen we ze zelf, zodat een
   * vergeten vertaling opvalt in plaats van een lege tekst achter te laten.
   */
  function t(key, substitutions) {
    var subs = substitutions == null ? [] :
      (Array.isArray(substitutions) ? substitutions : [substitutions]);
    var message = '';
    try {
      message = chrome.i18n.getMessage(key, subs.map(String));
    } catch (e) { /* buiten een extensie, bv. in een testpagina */ }
    return message || key;
  }

  /**
   * Vult de teksten in een stuk HTML in:
   *   data-i18n              tekst van het element
   *   data-i18n-title        title-attribuut
   *   data-i18n-label        aria-label
   *   data-i18n-placeholder  placeholder
   */
  function apply(scope) {
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

  BCEM.t = t;
  BCEM.applyI18n = apply;
})(typeof self !== 'undefined' ? self : this);
