/*
 * BC Buddy - popup.
 * Shows which rule applies to the active tab and offers a shortcut to create
 * a rule for it straight away.
 */
(function () {
  'use strict';

  var BCBuddy = self.BCBuddy;
  var t = BCBuddy.t;
  var el = {};
  var current = { settings: null, ctx: null, rule: null, isHosted: false, tab: null };

  init();

  function init() {
    BCBuddy.applyI18n();
    ['brandDot', 'parsed', 'enabled', 'addRule', 'openOptions', 'syncNow', 'status']
      .forEach(function (id) { el[id] = document.getElementById(id); });

    Promise.all([
      BCBuddy.loadSettings(),
      chrome.tabs.query({ active: true, currentWindow: true })
    ]).then(function (results) {
      current.settings = results[0];
      current.tab = results[1] && results[1][0];
      current.ctx = BCBuddy.parseUrl((current.tab && current.tab.url) || '');
      var rules = BCBuddy.effectiveRules(current.settings);
      current.rule = current.settings.enabled ? BCBuddy.findRule(rules, current.ctx) : null;
      // Decide by position, not by id: an own rule may share an id with a
      // shared one (that happens after an import from the same file).
      current.isHosted = !!current.rule &&
        rules.indexOf(current.rule) >= current.settings.rules.length;
      render();
    });

    el.enabled.addEventListener('change', function () {
      current.settings.enabled = el.enabled.checked;
      BCBuddy.saveSettings(current.settings).then(function () {
        setStatus(t(el.enabled.checked ? 'popupEnabledMsg' : 'popupDisabledMsg'));
      });
    });

    el.openOptions.addEventListener('click', function () {
      chrome.runtime.openOptionsPage();
      window.close();
    });

    el.syncNow.addEventListener('click', function () {
      if (el.syncNow.hidden) return;
      setStatus(t('syncing'));
      chrome.runtime.sendMessage({ type: 'bcb:sync' }).then(function (result) {
        if (!result || !result.ok) {
          setStatus((result && result.error) || t('syncFailedShort'), true);
          return;
        }
        setStatus(t('syncLoaded', result.count));
      }, function () {
        // The service worker never answered — restarted mid-sync, for example.
        // Without this the status stays on "Synchronising..." for good.
        setStatus(t('syncFailedShort'), true);
      });
    });

    el.addRule.addEventListener('click', function () {
      var draft = BCBuddy.draftFromContext(current.ctx);
      draft.color = BCBuddy.PALETTE[current.settings.rules.length % BCBuddy.PALETTE.length];
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
    // If a rule already matches, there is nothing to add.
    el.addRule.hidden = !!rule;
    // Sync only makes sense when a shared HTTPS URL is configured — same
    // gate as the options page. Without one, Options is the place to set it.
    var hostedUrl = current.settings.hosted && current.settings.hosted.url;
    el.syncNow.hidden = !hostedUrl || !BCBuddy.hostedUrlAllowed(hostedUrl);

    // The active rule comes first, in the same list as what we read from the
    // URL. Of the rest we only show what this URL reveals; empty is noise.
    // The tenant stays out: a GUID tells nobody anything.
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

  /** Without a matching rule the field explains why nothing happens. */
  function ruleText(rule) {
    if (rule) return rule.name;
    if (!current.settings.enabled) return t('popupDisabled');
    return t(current.ctx.isbc ? 'popupBcNoMatch' : 'popupNotBc');
  }

  /** Where the rule comes from does not belong in the row, but in the tooltip. */
  function ruleTitle(rule) {
    if (!rule) return ruleText(rule);
    return rule.name + ' — ' + t(current.isHosted ? 'popupShared' : 'popupOwnRule');
  }

  function setStatus(text, isError) {
    el.status.textContent = text;
    el.status.className = 'status' + (isError ? ' status--error' : '');
  }
})();
