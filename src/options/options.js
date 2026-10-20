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
      // The shared file's address when IT set it by browser policy; the field
      // is locked then.
      policyUrl: '',
      // How BC Buddy was installed (chrome.management); 'admin' when IT
      // pushed it. Empty until known, and then the samples stay hidden.
      installType: '',
      testUrl: '',
      panel: 'webclient',
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
    SAMPLE_URL: 'https://businesscentral.dynamics.com/c1cf0fd8-6b50-4d5a-8627-9ea2c09c6811/' +
      'Sandbox?company=CRONUS%20BE&page=1'
  };

  page.state.testUrl = page.SAMPLE_URL;

  /* -------------------------------------------------------------- rendering */

  page.renderAll = function () {
    page.el.globalEnabled.checked = page.state.settings.enabled;
    // Settings changed under us (or the page just opened): an undo from
    // before would now put back something else.
    page.setResetStatus('');
    page.renderWebClient();
    page.el.hostedUrl.value = page.state.settings.hosted.url;
    page.el.testUrl.value = page.state.testUrl;

    page.refreshContext();
    page.renderHosted();
  };

  page.renderWebClient = function () {
    page.el.copyValuesEnabled.checked = page.state.settings.copyValues.enabled;
    page.el.weekNumbersEnabled.checked = page.state.settings.weekNumbers.enabled;
    page.el.shortcutsEnabled.checked = page.state.settings.shortcuts.enabled;
    page.el.maximizeEnabled.checked = page.state.settings.maximize.enabled;
    page.el.pinActionBarEnabled.checked = page.state.settings.pinActionBar.enabled;
    page.el.hideFactBoxEnabled.checked = page.state.settings.hideFactBox.enabled;
    page.el.highlightRowEnabled.checked = page.state.settings.highlightRow.enabled;
    page.el.resizePanesEnabled.checked = page.state.settings.resizePanes.enabled;
    page.el.stripeRowsEnabled.checked = page.state.settings.stripeRows.enabled;
    page.el.noAnimationsEnabled.checked = page.state.settings.noAnimations.enabled;
    page.el.hideNotificationsEnabled.checked = page.state.settings.hideNotifications.enabled;
    page.renderDropdown();
    var team = page.teamDefaults();
    page.el.resetWebClientLabel.textContent = t(team ? 'resetWebClientTeam' : 'resetWebClient');
    page.el.resetWebClient.title = t(team ? 'resetWebClientTeamTitle' : 'resetWebClientTitle');
  };

  /** True when Reset to defaults takes values from the shared file. */
  page.teamDefaults = function () {
    var hosted = page.state.settings.hosted;
    return hosted.active && Object.keys(hosted.webClient || {}).length > 0;
  };

  /**
   * Puts the Web client settings back to the defaults (see
   * BCBuddy.webClientDefaults) and offers to undo it. The master switch is not
   * part of it, as it is not part of an export.
   */
  page.resetWebClient = function () {
    var settings = page.state.settings;
    var before = BCBuddy.webClientOf(settings);
    var changed = BCBuddy.applyWebClient(settings, BCBuddy.webClientDefaults(settings));
    if (!changed) {
      page.setResetStatus(t('resetWebClientNone'), 'ok');
      return;
    }
    page.save();
    page.renderWebClient();
    page.setResetStatus(t('resetWebClientDone', [changed]), 'ok', function () {
      BCBuddy.applyWebClient(page.state.settings, before);
      page.save();
      page.renderWebClient();
      page.setResetStatus(t('resetWebClientUndone'), 'ok');
    });
  };

  /** The line under the Web client card; with `undo`, an Undo link after the text. */
  page.setResetStatus = function (text, kind, undo) {
    var status = page.el.resetStatus;
    status.textContent = text;
    status.className = 'sync-status' + (kind ? ' sync-status--' + kind : '');
    if (!undo) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'sync-status__action';
    button.textContent = t('undo');
    button.addEventListener('click', undo);
    status.appendChild(button);
  };

  page.renderDropdown = function () {
    var dropdown = page.state.settings.dropdown;
    var Dropdowns = BCBuddy.Dropdowns;
    page.el.dropdownWidth.value = dropdown.width;
    page.el.dropdownHeight.value = dropdown.height;
    // No value beside the track: the slider's tooltip and what a screen
    // reader announces say how big the list gets.
    [[page.el.dropdownWidth, Dropdowns.WIDTH_FACTORS, dropdown.width],
      [page.el.dropdownHeight, Dropdowns.HEIGHT_FACTORS, dropdown.height]].forEach(function (slider) {
      var label = page.dropdownLabel(slider[1], slider[2]);
      slider[0].title = label;
      slider[0].setAttribute('aria-valuetext', label);
    });
  };

  /** A step says how much bigger than BC standard it is, rather than pixels. */
  page.dropdownLabel = function (factors, step) {
    if (step <= 1) return t('dropdownStandard');
    return Math.round(BCBuddy.Dropdowns.factor(factors, step) * 100) + '%';
  };

  page.refreshContext = function () {
    page.state.ctx = BCBuddy.parseUrl(page.state.testUrl);
    page.renderParsed();
    page.renderRules();
    page.renderHosted();
    page.renderStyles();
  };

  page.renderParsed = function () {
    var ctx = page.state.ctx;
    // Only what the URL actually reveals; empty fields are noise. Broadest
    // first, the way a BC URL nests them: tenant, environment, company.
    var pairs = [
      [t('labelTenant'), ctx.tenant],
      [t('labelEnvironment'), ctx.environment],
      [t('labelCompany'), ctx.company]
    ].filter(function (pair) { return pair[1]; });

    page.el.parsed.textContent = '';
    // An empty field has nothing to recognise yet: say nothing.
    var typed = String(page.state.testUrl || '').trim() !== '';
    if (!pairs.length && typed) {
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
    page.markWinner();
  };

  /**
   * The rule a BC tab at the test URL gets has its colour all round
   * (.rule--wins), so it stands out from rules that come later. Same order as
   * in the tab: own rules first, then the shared ones.
   */
  page.markWinner = function () {
    var settings = page.state.settings;
    var ctx = page.state.ctx;
    var found = false;
    [[page.el.ruleList, settings.rules], [page.el.hostedList, settings.hosted.rules]].forEach(function (pair) {
      var winner = -1;
      if (!found) {
        for (var i = 0; i < pair[1].length; i++) {
          if (BCBuddy.matchRule(pair[1][i], ctx)) { winner = i; found = true; break; }
        }
      }
      pair[0].querySelectorAll('.rule').forEach(function (card) {
        var wins = Number(card.dataset.index) === winner;
        card.classList.toggle('rule--wins', wins);
        var label = card.querySelector('[data-match]');
        if (label) label.textContent = wins ? t('matchYes') : '';
      });
    });
    // The style previews show the winner's colour.
    page.refreshStylePreviews();
  };

  page.renderHosted = function () {
    var hosted = page.state.settings.hosted.rules;
    page.el.hostedList.textContent = '';
    hosted.forEach(function (rule, index) {
      page.el.hostedList.appendChild(page.createCard(rule, index, { kind: 'rule', readOnly: true }));
    });
    page.el.sharedHead.hidden = !hosted.length;
    page.renderEmptyState();
    page.markWinner();
    page.renderHostedStatus();
  };

  page.renderStyles = function () {
    page.el.styleList.textContent = '';
    page.state.settings.styles.forEach(function (style, index) {
      page.el.styleList.appendChild(page.createCard(style, index, { kind: 'style', readOnly: false }));
    });

    page.el.hostedStyleList.textContent = '';
    page.state.settings.hosted.styles.forEach(function (style, index) {
      page.el.hostedStyleList.appendChild(page.createCard(style, index, { kind: 'style', readOnly: true }));
    });

    page.el.emptyStyles.hidden = page.state.settings.styles.length > 0 ||
      page.state.settings.hosted.styles.length > 0;

    // "The last style cannot go" no longer holds once there is a second one,
    // however it got there: Add style, Load samples, an import.
    if (page.state.settings.styles.length > 1 &&
        page.el.stylesStatus.textContent === t('lastStyle')) {
      page.setStylesStatus('', '');
    }
  };

  page.renderEmptyState = function () {
    var samples = page.samplesAllowed();
    page.el.emptyRules.hidden = page.state.settings.rules.length > 0 ||
      page.state.settings.hosted.rules.length > 0;
    page.el.loadSamples.hidden = !samples;
    page.renderEmptyText(samples);
  };

  /**
   * "Click Add rule, Load samples or import a configuration", with each of
   * those a link that does it. The placeholders are numbered, so a
   * translation can put them in any order; control characters stand in for
   * them while the text is split, as no translation contains one.
   */
  page.renderEmptyText = function (samples) {
    var el = page.el;
    var links = [[t('addRule'), function () { el.addRule.click(); }]];
    if (samples) links.push([t('loadSamples'), function () { el.loadSamples.click(); }]);
    links.push([t('emptyRulesImport'), function () {
      // The import result shows under the button there, so go along.
      goToPanel('settings');
      el.importFile.click();
    }]);
    var marks = links.map(function (link, index) { return String.fromCharCode(1 + index); });
    var text = t(samples ? 'emptyRulesSamples' : 'emptyRules', marks);
    el.emptyRules.textContent = '';
    text.split(/([\u0001-\u0003])/).forEach(function (part) {
      var link = part.length === 1 && links[part.charCodeAt(0) - 1];
      if (!link) {
        if (part) el.emptyRules.appendChild(document.createTextNode(part));
        return;
      }
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'empty__action';
      button.textContent = link[0];
      button.addEventListener('click', link[1]);
      el.emptyRules.appendChild(button);
    });
  };

  /**
   * The samples are for people who set BC Buddy up themselves. Where IT
   * installed it or set the shared file, the team's rules come from there,
   * and own rules from a sample would be checked before them. Fails closed:
   * an install type we do not know hides them too.
   */
  page.samplesAllowed = function () {
    var type = page.state.installType;
    return !page.state.policyUrl && (type === 'normal' || type === 'development');
  };

  /** Resolves to how BC Buddy was installed, or '' when that cannot be told. */
  page.readInstallType = function () {
    return Promise.resolve().then(function () {
      return chrome.management.getSelf();
    }).then(function (info) {
      return String(info && info.installType || '');
    }, function () {
      return '';
    });
  };

  /** Style a new rule gets: Default, otherwise the first one. */
  page.defaultStyleId = function () {
    var styles = page.state.settings.styles;
    var preferred = BCBuddy.findById(styles, BCBuddy.DEFAULT_STYLE_ID);
    if (preferred) return preferred.id;
    return styles.length ? styles[0].id : '';
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

  // The language picked in the header has to be in before the first text.
  BCBuddy.loadLanguage().then(init);

  function init() {
    document.title = t('optionsTitle');
    BCBuddy.applyI18n();
    [
      'status', 'globalEnabled', 'testUrl', 'useCurrentTab', 'parsed', 'ruleList', 'emptyRules',
      'addRule', 'loadSamples', 'samplesStatus', 'stylesStatus', 'language', 'hostedUrl', 'syncNow',
      'hostedStatus', 'hostedList', 'importFile', 'importFileBtn',
      'exportDownload', 'transferStatus',
      'addStyle', 'styleList', 'hostedStyleList', 'emptyStyles',
      'sharedHead', 'clearShared', 'hostedManaged',
      'brandDot', 'maximizeEnabled', 'pinActionBarEnabled', 'highlightRowEnabled', 'noAnimationsEnabled',
      'hideNotificationsEnabled', 'copyValuesEnabled', 'weekNumbersEnabled', 'shortcutsEnabled',
      'resizePanesEnabled', 'hideFactBoxEnabled',
      'stripeRowsEnabled', 'resetWebClient', 'resetWebClientLabel', 'resetStatus',
      'dropdownWidth', 'dropdownHeight'
    ].forEach(function (id) { el[id] = document.getElementById(id); });

    bindLanguage();

    Promise.all([
      BCBuddy.loadSettings(),
      chrome.storage.local.get(page.UI_KEY),
      takeOpenPanel(),
      BCBuddy.readPolicy(),
      // A tab that is gone or locked must not keep the page from opening.
      chrome.tabs.query({}).catch(function () { return []; }),
      page.readInstallType()
    ]).then(function (results) {
      state.settings = results[0];
      state.policyUrl = BCBuddy.policyUrl(results[3]);
      state.installType = results[5];
      var stored = results[1] || {};
      var ui = stored[page.UI_KEY] || {};
      // An open BC tab beats the remembered URL, so the previews show the
      // page you came from. Other sites only count when you ask for them.
      var tabUrl = page.pickBrowsingTab(results[4]);
      var fromTab = tabUrl && BCBuddy.parseUrl(tabUrl).isbc;
      state.testUrl = fromTab ? tabUrl : ui.testUrl || page.SAMPLE_URL;
      state.panel = results[2] || ui.panel || 'webclient';
      // The Web client panel used to be called Maximize.
      if (state.panel === 'maximize') state.panel = 'webclient';
      bind();
      page.renderAll();
      if (fromTab && tabUrl !== ui.testUrl) page.saveUi();
    }).catch(function (err) {
      // Otherwise the page stays blank with no clue why.
      page.setStatus(String(err && err.message || err), true);
      throw err;
    });

    chrome.storage.onChanged.addListener(function (changes, area) {
      // IT set, changed or removed the policy while this page was open. The
      // service worker writes the address itself; this only (un)locks.
      if (area === 'managed') {
        BCBuddy.readPolicy().then(function (policy) {
          state.policyUrl = BCBuddy.policyUrl(policy);
          if (state.settings) page.renderHosted();
        });
        return;
      }
      // The toolbar icon was clicked while this page was open.
      if (area === 'session' && changes[BCBuddy.OPEN_PANEL_KEY] &&
        changes[BCBuddy.OPEN_PANEL_KEY].newValue) {
        takeOpenPanel().then(function (panel) {
          if (panel && state.settings) goToPanel(panel);
        });
        return;
      }
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

  /* -------------------------------------------------------------- language */

  /**
   * The picker in the header. Until someone picks, it shows the language
   * Chrome chose from the browser's, and nothing is stored, so BC Buddy keeps
   * following the browser. A new choice reloads the page, which is the
   * simplest way to redraw every text; another options page that is open
   * follows through the storage event.
   */
  function bindLanguage() {
    var key = BCBuddy.LANGUAGE_KEY;
    chrome.storage.local.get(key).then(function (stored) {
      el.language.value = BCBuddy.normalizeLanguage(stored && stored[key]) || BCBuddy.currentLanguage();
    });
    el.language.addEventListener('change', function () {
      var lang = BCBuddy.normalizeLanguage(el.language.value);
      if (!lang) return;
      BCBuddy.saveLanguage(lang).then(function () { location.reload(); });
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes[key]) return;
      var lang = BCBuddy.normalizeLanguage(changes[key].newValue) || BCBuddy.currentLanguage();
      if (lang !== el.language.value) location.reload();
    });
  }

  /* --------------------------------------------------------------- binding */

  function bind() {
    el.globalEnabled.addEventListener('change', function () {
      state.settings.enabled = el.globalEnabled.checked;
      page.save();
    });

    el.copyValuesEnabled.addEventListener('change', function () {
      state.settings.copyValues.enabled = el.copyValuesEnabled.checked;
      page.save();
    });

    el.resizePanesEnabled.addEventListener('change', function () {
      state.settings.resizePanes.enabled = el.resizePanesEnabled.checked;
      page.save();
    });

    el.weekNumbersEnabled.addEventListener('change', function () {
      state.settings.weekNumbers.enabled = el.weekNumbersEnabled.checked;
      page.save();
    });

    el.shortcutsEnabled.addEventListener('change', function () {
      state.settings.shortcuts.enabled = el.shortcutsEnabled.checked;
      page.save();
    });

    el.maximizeEnabled.addEventListener('change', function () {
      state.settings.maximize.enabled = el.maximizeEnabled.checked;
      page.save();
    });

    el.pinActionBarEnabled.addEventListener('change', function () {
      state.settings.pinActionBar.enabled = el.pinActionBarEnabled.checked;
      page.save();
    });

    el.hideFactBoxEnabled.addEventListener('change', function () {
      state.settings.hideFactBox.enabled = el.hideFactBoxEnabled.checked;
      page.save();
    });

    el.highlightRowEnabled.addEventListener('change', function () {
      state.settings.highlightRow.enabled = el.highlightRowEnabled.checked;
      page.save();
    });

    el.stripeRowsEnabled.addEventListener('change', function () {
      state.settings.stripeRows.enabled = el.stripeRowsEnabled.checked;
      page.save();
    });

    el.noAnimationsEnabled.addEventListener('change', function () {
      state.settings.noAnimations.enabled = el.noAnimationsEnabled.checked;
      page.save();
    });

    el.hideNotificationsEnabled.addEventListener('change', function () {
      state.settings.hideNotifications.enabled = el.hideNotificationsEnabled.checked;
      page.save();
    });

    [['width', el.dropdownWidth], ['height', el.dropdownHeight]].forEach(function (pair) {
      pair[1].addEventListener('input', function () {
        state.settings.dropdown[pair[0]] = Number(pair[1].value);
        page.renderDropdown();
        page.save();
      });
    });

    el.resetWebClient.addEventListener('click', page.resetWebClient);
    // Changing a setting by hand after a reset: undoing would throw that away.
    el.resetWebClient.closest('section').querySelector('.card').addEventListener('change', function () {
      page.setResetStatus('');
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
        styleId: page.defaultStyleId()
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

    el.addStyle.addEventListener('click', function () {
      var style = BCBuddy.newStyle({ name: t('newStyleName') });
      state.settings.styles.push(style);
      state.expanded[page.expandKey('style', style, false)] = true;
      page.save();
      page.renderStyles();
      page.renderRules(); // rule dropdowns now include the new style
      var cards = el.styleList.querySelectorAll('.rule');
      var last = cards[cards.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        last.querySelector('.rule__name').select();
      }
    });

    [el.ruleList, el.styleList].forEach(function (list) {
      list.addEventListener('input', page.onRuleInput);
      list.addEventListener('change', page.onRuleInput);
      list.addEventListener('click', page.onRuleClick);
    });
    // Shared rules and styles are read-only, but can still be expanded.
    el.hostedList.addEventListener('click', page.onRuleClick);
    el.hostedStyleList.addEventListener('click', page.onRuleClick);

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
    // Only the sections: Help is a plain link to the documentation site.
    document.querySelectorAll('.nav__item[data-panel]').forEach(function (button) {
      button.addEventListener('click', function () {
        goToPanel(button.dataset.panel);
      });
    });
    showPanel(state.panel);
  }

  function goToPanel(name) {
    showPanel(name);
    state.panel = name;
    page.saveUi();
  }

  /**
   * The panel the service worker asked for (toolbar icon), or null. It is
   * cleared as it is read, so a later reload shows the last panel again.
   */
  function takeOpenPanel() {
    var session = chrome.storage.session;
    if (!session) return Promise.resolve(null);
    return session.get(BCBuddy.OPEN_PANEL_KEY).then(function (got) {
      var panel = got && got[BCBuddy.OPEN_PANEL_KEY];
      if (!panel) return null;
      return session.remove(BCBuddy.OPEN_PANEL_KEY).then(function () { return panel; });
    }).catch(function () { return null; });
  }

  function showPanel(name) {
    var panels = document.querySelectorAll('.panel');
    var known = false;
    panels.forEach(function (panel) {
      if (panel.dataset.panel === name) known = true;
    });
    if (!known) name = 'webclient';

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
