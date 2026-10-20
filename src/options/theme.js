/**
 * Light or dark for the options page, from the button in the header.
 *
 * Loaded in <head>, before the body exists, so the first paint is already in
 * the right theme. It always puts the theme in effect on <html data-theme>;
 * options.css keys its dark colours on that alone. Until someone clicks,
 * that follows the system and nothing is stored. A click stores the choice
 * in this page's own localStorage: it is read synchronously, so there is no
 * flash, and it is a convenience for this page only, not a setting, so it
 * stays out of the settings, the export and the shared file. Another options
 * page that is open follows through the storage event.
 */
(function () {
  'use strict';

  var KEY = 'bcb:theme';
  var root = document.documentElement;
  var system = window.matchMedia('(prefers-color-scheme: dark)');

  /** The stored choice, 'light' or 'dark', or '' to follow the system. */
  function stored() {
    var value = '';
    try { value = localStorage.getItem(KEY) || ''; } catch (e) { /* blocked */ }
    return value === 'light' || value === 'dark' ? value : '';
  }

  function apply() {
    var theme = stored() || (system.matches ? 'dark' : 'light');
    root.setAttribute('data-theme', theme);
    var button = document.getElementById('themeToggle');
    if (button) button.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) apply();
  });

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('themeToggle');
    if (!button) return;
    button.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) { /* blocked: this visit only */ }
      root.setAttribute('data-theme', next);
      button.setAttribute('aria-pressed', String(next === 'dark'));
    });
    apply();
  });
})();
