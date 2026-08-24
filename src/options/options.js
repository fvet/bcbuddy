/*
 * BC Buddy - options page.
 * Changes are saved automatically (after a short delay).
 */
(function () {
  'use strict';

  var BCBuddy = self.BCBuddy;
  var t = BCBuddy.t;

  var page = {
    state: {
      settings: null,
      testUrl: '',
      panel: 'environments',
      ctx: null,
      // Hash of the settings we last wrote ourselves, to tell our own change
      // event apart from someone else's.
      lastWriteHash: '',
      saveTimer: null,
      // Which rule is being dragged right now (null = none).
      dragIndex: null,
      // Which rules are expanded, by id. Rules start collapsed so a long list
      // stays easy to scan.
      expanded: {}
    },
    el: {},
    t: t,
    TRIMMED_TYPES: ['text', 'url', 'search'],
    UI_KEY: 'ui',
    PENDING_KEY: 'pendingRule',
    SAMPLE_URL: 'https://businesscentral.dynamics.com/453d817a-d5b1-49c1-bdcf-d9474180a702/' +
      'Sandbox?company=CRONUS%20BE&page=1'
  };

  page.state.testUrl = page.SAMPLE_URL;

  /* -------------------------------------------------------------- rendering */

  page.renderAll = function () {
    page.el.globalEnabled.checked = page.state.settings.enabled;
    page.el.hostedUrl.value = page.state.settings.hosted.url;
    page.el.testUrl.value = page.state.testUrl;

    page.refreshContext();
    page.renderHosted();
  };

  page.refreshContext = function () {
    page.state.ctx = BCBuddy.parseUrl(page.state.testUrl);
    page.renderParsed();
    page.renderRules();
    page.renderHosted();
    page.renderLayouts();
  };

  page.renderParsed = function () {
    var ctx = page.state.ctx;
    // Only what the URL actually reveals; empty fields are noise.
    var pairs = [
      [t('labelEnvironment'), ctx.environment],
      [t('labelCompany'), ctx.company],
      [t('labelTenant'), ctx.tenant]
    ].filter(function (pair) { return pair[1]; });

    page.el.parsed.textContent = '';
    if (!pairs.length) {
      var empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = t('nothingRecognised');
      page.el.parsed.appendChild(empty);
    }
    pairs.forEach(function (pair) {
      var wrap = document.createElement('div');
      var dt = document.createElement('dt');
      dt.textContent = pair[0] + ':';
      var dd = document.createElement('dd');
      dd.textContent = pair[1] || '';
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      page.el.parsed.appendChild(wrap);
    });

    var active = BCBuddy.findRule(BCBuddy.effectiveRules(page.state.settings), ctx);
    page.el.brandDot.style.fill = active ? active.color : "var(--muted)";
  };

  page.renderRules = function () {
    page.el.ruleList.textContent = '';
    page.state.settings.rules.forEach(function (rule, index) {
      page.el.ruleList.appendChild(page.createCard(rule, index, { kind: 'rule', readOnly: false }));
    });
    page.renderEmptyState();
  };

  page.renderHosted = function () {
    var hosted = page.state.settings.hosted.rules;
    page.el.hostedList.textContent = '';
    hosted.forEach(function (rule, index) {
      page.el.hostedList.appendChild(page.createCard(rule, index, { kind: 'rule', readOnly: true }));
    });
    page.el.sharedHead.hidden = !hosted.length;
    page.renderEmptyState();
    page.renderHostedStatus();
  };

  page.renderLayouts = function () {
    page.el.layoutList.textContent = '';
    page.state.settings.layouts.forEach(function (layout, index) {
      page.el.layoutList.appendChild(page.createCard(layout, index, { kind: 'layout', readOnly: false }));
    });

    page.el.hostedLayoutList.textContent = '';
    page.state.settings.hosted.layouts.forEach(function (layout, index) {
      page.el.hostedLayoutList.appendChild(page.createCard(layout, index, { kind: 'layout', readOnly: true }));
    });

    page.el.emptyLayouts.hidden = page.state.settings.layouts.length > 0 ||
      page.state.settings.hosted.layouts.length > 0;
  };

  page.renderEmptyState = function () {
    page.el.emptyRules.hidden = page.state.settings.rules.length > 0 ||
      page.state.settings.hosted.rules.length > 0;
  };

  /** Layout a new rule gets: Default, otherwise the first one. */
  page.defaultLayoutId = function () {
    var layouts = page.state.settings.layouts;
    var preferred = BCBuddy.findById(layouts, BCBuddy.DEFAULT_LAYOUT_ID);
    if (preferred) return preferred.id;
    return layouts.length ? layouts[0].id : '';
  };

  /**
   * Records what we are about to store, so the change event it causes can be
   * recognised as our own. See the storage listener in init().
   */
  page.markOwnWrite = function (settings) {
    page.state.lastWriteHash = BCBuddy.hash(BCBuddy.normalize(settings));
  };

  page.save = function () {
    if (page.state.saveTimer) clearTimeout(page.state.saveTimer);
    page.state.saveTimer = setTimeout(function () {
      page.markOwnWrite(page.state.settings);
      // Saving is silent; only report when it fails.
      BCBuddy.saveSettings(page.state.settings).then(null, function (err) {
        page.setStatus(t('saveFailed', err.message), true);
      });
    }, 250);
  };

  /**
   * Picks the open-tab URL the user probably means: a Business Central tab
   * wins, then the most recently used tab. Tabs without an http(s) URL (like
   * this options page) are skipped.
   */
  page.pickBrowsingTab = function (tabs) {
    var usable = (tabs || []).filter(function (tab) {
      return /^https?:/i.test(tab && tab.url ? tab.url : '');
    });
    if (!usable.length) return '';

    function score(tab) {
      // lastAccessed is not in every Chrome version; then "active" counts.
      return tab.lastAccessed || (tab.active ? 1 : 0);
    }
    usable.sort(function (a, b) {
      var bc = (BCBuddy.parseUrl(b.url).isbc ? 1 : 0) - (BCBuddy.parseUrl(a.url).isbc ? 1 : 0);
      return bc || score(b) - score(a);
    });
    return usable[0].url;
  };

  page.saveUi = function () {
    var payload = {};
    payload[page.UI_KEY] = { testUrl: page.state.testUrl, panel: page.state.panel };
    chrome.storage.local.set(payload);
  };

  BCBuddy.OptionsHelpers.install(page);
  BCBuddy.OptionsCards.install(page);
  BCBuddy.OptionsHosted.install(page);

  var state = page.state;
  var el = page.el;

  init();

  function init() {
    document.title = t('optionsTitle');
    BCBuddy.applyI18n();
    [
      'status', 'globalEnabled', 'testUrl', 'useCurrentTab', 'parsed', 'ruleList', 'emptyRules',
      'addRule', 'hostedUrl', 'syncNow',
      'hostedStatus', 'hostedList', 'importFile', 'importFileBtn', 'importStatus',
      'exportDownload', 'exportStatus',
      'addLayout', 'layoutList', 'hostedLayoutList', 'emptyLayouts',
      'sharedHead', 'clearShared',
      'brandDot'
    ].forEach(function (id) { el[id] = document.getElementById(id); });

    Promise.all([
      BCBuddy.loadSettings(),
      chrome.storage.local.get([page.UI_KEY, page.PENDING_KEY])
    ]).then(function (results) {
      state.settings = results[0];
      var stored = results[1] || {};
      var ui = stored[page.UI_KEY] || {};
      state.testUrl = ui.testUrl || page.SAMPLE_URL;
      state.panel = ui.panel || 'environments';

      var pending = stored[page.PENDING_KEY];
      if (pending) {
        var draft = BCBuddy.newRule(pending);
        state.settings.rules.unshift(draft);
        state.expanded[page.expandKey('rule', draft, false)] = true;
        chrome.storage.local.remove(page.PENDING_KEY);
        page.save();
      }
      bind();
      page.renderAll();
    }).catch(function (err) {
      // Otherwise the page stays blank with no clue why.
      page.setStatus(String(err && err.message || err), true);
      throw err;
    });

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes[BCBuddy.STORAGE_KEY]) return;
      var incoming = BCBuddy.normalize(changes[BCBuddy.STORAGE_KEY].newValue);
      // Our own write comes back as an event too. Compare what arrived against
      // what we last sent, rather than swallowing the next event whatever it
      // is: the service worker may write between our save and this callback,
      // and that update must not be the one we discard.
      if (BCBuddy.hash(incoming) === state.lastWriteHash) return;
      state.settings = incoming;
      page.renderAll();
    });
  }

  /* --------------------------------------------------------------- binding */

  function bind() {
    el.globalEnabled.addEventListener('change', function () {
      state.settings.enabled = el.globalEnabled.checked;
      page.save();
    });

    el.testUrl.addEventListener('input', function () {
      state.testUrl = el.testUrl.value;
      page.saveUi();
      page.refreshContext();
    });
    el.testUrl.addEventListener('change', function () {
      if (page.trimField(el.testUrl)) el.testUrl.dispatchEvent(new Event('input'));
    });

    el.useCurrentTab.addEventListener('click', function () {
      // The options page is the active tab itself, so look at every other tab.
      chrome.tabs.query({}).then(function (tabs) {
        var url = page.pickBrowsingTab(tabs);
        if (!url) {
          page.setStatus(t('noUsableTab'), true);
          return;
        }
        el.testUrl.value = url;
        el.testUrl.dispatchEvent(new Event('input'));
      });
    });

    el.addRule.addEventListener('click', function () {
      // The test URL is what the user has in mind; reuse it.
      var draft = BCBuddy.draftFromContext(state.ctx);
      var rule = BCBuddy.newRule({
        name: draft.name,
        color: BCBuddy.PALETTE[state.settings.rules.length % BCBuddy.PALETTE.length],
        conditions: draft.conditions,
        layoutId: page.defaultLayoutId()
      });
      state.settings.rules.push(rule);
      state.expanded[page.expandKey('rule', rule, false)] = true; // a new rule starts expanded
      page.save();
      page.renderRules();
      var cards = el.ruleList.querySelectorAll('.rule');
      var last = cards[cards.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Name selected so you can overwrite the suggested name right away.
        last.querySelector('.rule__name').select();
      }
    });

    el.addLayout.addEventListener('click', function () {
      var layout = BCBuddy.newLayout({ name: t('newLayoutName') });
      state.settings.layouts.push(layout);
      state.expanded[page.expandKey('layout', layout, false)] = true;
      page.save();
      page.renderLayouts();
      page.renderRules(); // rule dropdowns now include the new layout
      var cards = el.layoutList.querySelectorAll('.rule');
      var last = cards[cards.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        last.querySelector('.rule__name').select();
      }
    });

    [el.ruleList, el.layoutList].forEach(function (list) {
      list.addEventListener('input', page.onRuleInput);
      list.addEventListener('change', page.onRuleInput);
      list.addEventListener('click', page.onRuleClick);
    });
    // Shared rules and layouts are read-only, but can still be expanded.
    el.hostedList.addEventListener('click', page.onRuleClick);
    el.hostedLayoutList.addEventListener('click', page.onRuleClick);

    el.clearShared.addEventListener('click', page.clearSharedRules);

    bindReorder();
    bindNav();
    page.bindHosted();
    page.bindImportExport();
  }

  /* ------------------------------------------------------------- drag */

  /**
   * Order decides which rule wins, so it must be easy to change: grab a card
   * by its grip and drop it where it belongs. Own rules only; shared rules keep
   * the order from the shared file.
   */
  function bindReorder() {
    var list = el.ruleList;

    // Only the grip starts a drag; otherwise you cannot select text in the header.
    list.addEventListener('mousedown', function (event) {
      var card = event.target.closest('[data-grip]') && event.target.closest('.rule');
      if (card) card.draggable = true;
    });
    // Released without dragging: the card is a normal card again.
    list.addEventListener('mouseup', clearDrag);

    list.addEventListener('dragstart', function (event) {
      var card = event.target.closest('.rule');
      if (!card || !card.draggable) return;
      state.dragIndex = Number(card.dataset.index);
      card.classList.add('rule--dragging');
      event.dataTransfer.effectAllowed = 'move';
      // Without payload some browsers refuse to start the drag.
      event.dataTransfer.setData('text/plain', card.dataset.index);
    });

    list.addEventListener('dragover', function (event) {
      if (state.dragIndex === null) return;
      // The browser only accepts a drop here after preventDefault.
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      var over = event.target.closest('.rule');
      list.querySelectorAll('.rule').forEach(function (card) {
        card.classList.remove('rule--drop-before', 'rule--drop-after');
      });
      if (!over || Number(over.dataset.index) === state.dragIndex) return;
      over.classList.add(dropsAfter(over, event) ? 'rule--drop-after' : 'rule--drop-before');
    });

    list.addEventListener('drop', function (event) {
      if (state.dragIndex === null) return;
      event.preventDefault();
      var from = state.dragIndex;
      var to = dropIndex(event);
      clearDrag();
      if (to === null || to === from) return;
      page.move(state.settings.rules, from, to);
      page.save();
      page.renderRules();
      page.renderParsed(); // a different order may let another rule win
    });

    list.addEventListener('dragend', clearDrag);

    // Without a mouse: focus the grip and move with the arrow keys.
    list.addEventListener('keydown', function (event) {
      if (!event.target.closest('[data-grip]')) return;
      var step = event.key === 'ArrowUp' ? -1 : (event.key === 'ArrowDown' ? 1 : 0);
      if (!step) return;
      event.preventDefault();
      var from = Number(event.target.closest('.rule').dataset.index);
      var to = from + step;
      if (to < 0 || to >= state.settings.rules.length) return;
      page.move(state.settings.rules, from, to);
      page.save();
      page.renderRules();
      page.renderParsed();
      var moved = list.querySelectorAll('.rule')[to];
      if (moved) moved.querySelector('[data-grip]').focus();
    });
  }

  /** If the pointer is in the lower half of the card, the rule belongs below. */
  function dropsAfter(card, event) {
    var box = card.getBoundingClientRect();
    return event.clientY > box.top + box.height / 2;
  }

  /** The list index as it looks without the dragged rule. */
  function dropIndex(event) {
    var over = event.target.closest('.rule');
    if (!over) return null;
    var to = Number(over.dataset.index) + (dropsAfter(over, event) ? 1 : 0);
    return to > state.dragIndex ? to - 1 : to;
  }

  function clearDrag() {
    state.dragIndex = null;
    el.ruleList.querySelectorAll('.rule').forEach(function (card) {
      card.draggable = false;
      card.classList.remove('rule--dragging', 'rule--drop-before', 'rule--drop-after');
    });
  }

  /**
   * Left navigation switches between panels. We remember which was open so the
   * page reopens where you left off.
   */
  function bindNav() {
    document.querySelectorAll('.nav__item').forEach(function (button) {
      button.addEventListener('click', function () {
        showPanel(button.dataset.panel);
        state.panel = button.dataset.panel;
        page.saveUi();
      });
    });
    showPanel(state.panel);
  }

  function showPanel(name) {
    var panels = document.querySelectorAll('.panel');
    var known = false;
    panels.forEach(function (panel) {
      if (panel.dataset.panel === name) known = true;
    });
    if (!known) name = 'environments';

    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== name;
    });
    document.querySelectorAll('.nav__item').forEach(function (button) {
      if (button.dataset.panel === name) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    });
  }
})();
