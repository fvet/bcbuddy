/*
 * BC Buddy - popup.
 * Toont welke regel op het actieve tabblad van toepassing is en biedt
 * een snelkoppeling om er meteen een regel voor aan te maken.
 */
(function () {
  'use strict';

  var BCEM = self.BCEM;
  var t = BCEM.t;
  var el = {};
  var current = { settings: null, ctx: null, rule: null, isHosted: false, tab: null };

  init();

  function init() {
    BCEM.applyI18n();
    ['brandDot', 'parsed', 'enabled', 'addRule', 'openOptions', 'syncNow', 'status']
      .forEach(function (id) { el[id] = document.getElementById(id); });

    Promise.all([
      BCEM.loadSettings(),
      chrome.tabs.query({ active: true, currentWindow: true })
    ]).then(function (results) {
      current.settings = results[0];
      current.tab = results[1] && results[1][0];
      current.ctx = BCEM.parseUrl((current.tab && current.tab.url) || '');
      var rules = BCEM.effectiveRules(current.settings);
      current.rule = current.settings.enabled ? BCEM.findRule(rules, current.ctx) : null;
      // Op positie bepalen, niet op id: een eigen regel mag hetzelfde id hebben
      // als een gedeelde (dat gebeurt na een import uit hetzelfde bestand).
      current.isHosted = !!current.rule &&
        rules.indexOf(current.rule) >= current.settings.rules.length;
      render();
    });

    el.enabled.addEventListener('change', function () {
      current.settings.enabled = el.enabled.checked;
      BCEM.saveSettings(current.settings).then(function () {
        setStatus(t(el.enabled.checked ? 'popupEnabledMsg' : 'popupDisabledMsg'));
      });
    });

    el.openOptions.addEventListener('click', function () {
      chrome.runtime.openOptionsPage();
      window.close();
    });

    el.syncNow.addEventListener('click', function () {
      setStatus(t('syncing'));
      chrome.runtime.sendMessage({ type: 'bcem:sync' }).then(function (result) {
        if (!result || !result.ok) {
          setStatus((result && result.error) || t('syncFailedShort'), true);
          return;
        }
        setStatus(t('syncLoaded', result.count));
      });
    });

    el.addRule.addEventListener('click', function () {
      var draft = BCEM.draftFromContext(current.ctx);
      draft.color = BCEM.PALETTE[current.settings.rules.length % BCEM.PALETTE.length];
      chrome.storage.local.set({ pendingRule: draft }).then(function () {
        chrome.runtime.openOptionsPage();
        window.close();
      });
    });
  }

  function render() {
    var rule = current.rule;
    el.enabled.checked = current.settings.enabled;
    el.brandDot.style.fill = rule ? rule.color : 'var(--muted)';
    // Past er al een regel, dan valt er niets toe te voegen.
    el.addRule.hidden = !!rule;

    // De actieve regel staat vooraan, in dezelfde lijst als wat we uit de URL
    // lezen. Van de rest tonen we enkel wat deze URL prijsgeeft; leeg is ruis.
    // De tenant blijft weg: een GUID zegt niemand iets.
    var pairs = [
      [t('labelEnvironment'), current.ctx.environment],
      [t('labelCompany'), current.ctx.company]
    ].filter(function (pair) { return pair[1]; });

    el.parsed.textContent = '';
    el.parsed.appendChild(row(t('labelRule'), ruleText(rule), ruleTitle(rule)));
    if (!pairs.length) {
      var empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = t('nothingRecognised');
      el.parsed.appendChild(empty);
    }
    pairs.forEach(function (pair) {
      el.parsed.appendChild(row(pair[0], pair[1] || '', pair[1] || ''));
    });
  }

  function row(label, value, title) {
    var wrap = document.createElement('div');
    var dt = document.createElement('dt');
    dt.textContent = label;
    var dd = document.createElement('dd');
    dd.textContent = value;
    dd.title = title;
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    return wrap;
  }

  /** Zonder passende regel zegt het veld waarom er niets gebeurt. */
  function ruleText(rule) {
    if (rule) return rule.name;
    if (!current.settings.enabled) return t('popupDisabled');
    return t(current.ctx.isbc ? 'popupBcNoMatch' : 'popupNotBc');
  }

  /** Waar de regel vandaan komt hoort niet in het rijtje thuis, wel in de tooltip. */
  function ruleTitle(rule) {
    if (!rule) return ruleText(rule);
    return rule.name + ' — ' + t(current.isHosted ? 'popupShared' : 'popupOwnRule');
  }

  function setStatus(text, isError) {
    el.status.textContent = text;
    el.status.className = 'status' + (isError ? ' status--error' : '');
  }
})();
