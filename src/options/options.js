/*
 * BC Buddy - optiespagina.
 * Wijzigingen worden automatisch bewaard (met een korte vertraging).
 */
(function () {
  'use strict';

  var BCEM = self.BCEM;
  var t = BCEM.t;
  var UI_KEY = 'ui';
  // Velden waar spaties voor of achter nooit bedoeld zijn.
  var TRIMMED_TYPES = ['text', 'url', 'search'];
  var PENDING_KEY = 'pendingRule';

  var SAMPLE_URL = 'https://businesscentral.dynamics.com/453d817a-d5b1-49c1-bdcf-d9474180a702/' +
    'Sandbox?company=CRONUS%20BE&page=1';

  /** Uitleg achter het vraagteken naast elk tekstveld. */
  function tokenHelp() {
    function line(token, description) {
      return '<code>{' + token + '}</code> ' + description + '<br>';
    }
    return '<strong>' + t('tokensHeading') + '</strong><br>' +
      line('name', t('tokenName')) +
      '<code>{environment}</code> ' + t('tokenOr') + ' <code>{env}</code> ' + t('tokenEnvironment') + '<br>' +
      line('company', t('tokenCompany')) +
      line('title', t('tokenTitle')) +
      t('tokensFooter');
  }

  var state = {
    settings: null,
    testUrl: SAMPLE_URL,
    panel: 'environments',
    ctx: null,
    selfWrite: false,
    saveTimer: null,
    // Welke regel er op dit moment versleept wordt (null = geen).
    dragIndex: null,
    // Welke regels opengeklapt staan, per id. Regels beginnen ingeklapt zodat
    // een lange lijst overzichtelijk blijft.
    expanded: {}
  };

  var el = {};

  init();

  function init() {
    document.title = t('optionsTitle');
    BCEM.applyI18n();
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
      BCEM.loadSettings(),
      chrome.storage.local.get([UI_KEY, PENDING_KEY])
    ]).then(function (results) {
      state.settings = results[0];
      var stored = results[1] || {};
      var ui = stored[UI_KEY] || {};
      state.testUrl = ui.testUrl || SAMPLE_URL;
      state.panel = ui.panel || 'environments';

      var pending = stored[PENDING_KEY];
      if (pending) {
        var draft = BCEM.newRule(pending);
        state.settings.rules.unshift(draft);
        state.expanded[expandKey('rule', draft, false)] = true;
        chrome.storage.local.remove(PENDING_KEY);
        save();
      }
      bind();
      renderAll();
    }).catch(function (err) {
      // Anders blijft de pagina leeg zonder dat iemand weet waarom.
      setStatus(String(err && err.message || err), true);
      throw err;
    });

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes[BCEM.STORAGE_KEY]) return;
      if (state.selfWrite) { state.selfWrite = false; return; }
      state.settings = BCEM.normalize(changes[BCEM.STORAGE_KEY].newValue);
      renderAll();
    });
  }

  /* --------------------------------------------------------------- binden */

  function bind() {
    el.globalEnabled.addEventListener('change', function () {
      state.settings.enabled = el.globalEnabled.checked;
      save();
    });

    el.testUrl.addEventListener('input', function () {
      state.testUrl = el.testUrl.value;
      saveUi();
      refreshContext();
    });
    el.testUrl.addEventListener('change', function () {
      if (trimField(el.testUrl)) el.testUrl.dispatchEvent(new Event('input'));
    });

    el.useCurrentTab.addEventListener('click', function () {
      // De optiespagina is zelf de actieve tab, dus kijken we naar alle andere.
      chrome.tabs.query({}).then(function (tabs) {
        var url = pickBrowsingTab(tabs);
        if (!url) {
          setStatus(t('noUsableTab'), true);
          return;
        }
        el.testUrl.value = url;
        el.testUrl.dispatchEvent(new Event('input'));
      });
    });

    el.addRule.addEventListener('click', function () {
      // De test-URL is wat de gebruiker voor ogen heeft; die nemen we over.
      var draft = BCEM.draftFromContext(state.ctx);
      var rule = BCEM.newRule({
        name: draft.name,
        color: BCEM.PALETTE[state.settings.rules.length % BCEM.PALETTE.length],
        conditions: draft.conditions,
        layoutId: defaultLayoutId()
      });
      state.settings.rules.push(rule);
      state.expanded[expandKey('rule', rule, false)] = true; // een nieuwe regel staat meteen open
      save();
      renderRules();
      var cards = el.ruleList.querySelectorAll('.rule');
      var last = cards[cards.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Naam geselecteerd, zodat je de voorgestelde naam meteen kan overtypen.
        last.querySelector('.rule__name').select();
      }
    });

    el.addLayout.addEventListener('click', function () {
      var layout = BCEM.newLayout({ name: t('newLayoutName') });
      state.settings.layouts.push(layout);
      state.expanded[expandKey('layout', layout, false)] = true;
      save();
      renderLayouts();
      renderRules(); // de keuzelijsten in de regels kennen de nieuwe layout nu
      var cards = el.layoutList.querySelectorAll('.rule');
      var last = cards[cards.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        last.querySelector('.rule__name').select();
      }
    });

    [el.ruleList, el.layoutList].forEach(function (list) {
      list.addEventListener('input', onRuleInput);
      list.addEventListener('change', onRuleInput);
      list.addEventListener('click', onRuleClick);
    });
    // Gedeelde regels en layouts zijn niet bewerkbaar, maar wel open te klappen.
    el.hostedList.addEventListener('click', onRuleClick);
    el.hostedLayoutList.addEventListener('click', onRuleClick);

    el.clearShared.addEventListener('click', clearSharedRules);

    bindReorder();
    bindNav();
    bindHosted();
    bindImportExport();
  }

  /* ------------------------------------------------------------- verslepen */

  /**
   * De volgorde bepaalt welke regel wint, dus die moet je vlot kunnen wijzigen:
   * neem een kaart bij haar greep vast en laat ze vallen waar ze hoort. Enkel
   * eigen regels; gedeelde regels houden de volgorde van het gedeelde bestand.
   */
  function bindReorder() {
    var list = el.ruleList;

    // Enkel de greep begint een sleepbeweging, anders kan je geen tekst meer
    // selecteren in de kopregel.
    list.addEventListener('mousedown', function (event) {
      var card = event.target.closest('[data-grip]') && event.target.closest('.rule');
      if (card) card.draggable = true;
    });
    // Losgelaten zonder te slepen: de kaart is weer gewoon een kaart.
    list.addEventListener('mouseup', clearDrag);

    list.addEventListener('dragstart', function (event) {
      var card = event.target.closest('.rule');
      if (!card || !card.draggable) return;
      state.dragIndex = Number(card.dataset.index);
      card.classList.add('rule--dragging');
      event.dataTransfer.effectAllowed = 'move';
      // Zonder inhoud weigeren sommige browsers de sleepbeweging te starten.
      event.dataTransfer.setData('text/plain', card.dataset.index);
    });

    list.addEventListener('dragover', function (event) {
      if (state.dragIndex === null) return;
      // Pas na preventDefault aanvaardt de browser hier een drop.
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
      move(state.settings.rules, from, to);
      save();
      renderRules();
      renderParsed(); // een andere volgorde kan een andere regel laten winnen
    });

    list.addEventListener('dragend', clearDrag);

    // Zonder muis: zet de focus op de greep en verplaats met de pijltjestoetsen.
    list.addEventListener('keydown', function (event) {
      if (!event.target.closest('[data-grip]')) return;
      var step = event.key === 'ArrowUp' ? -1 : (event.key === 'ArrowDown' ? 1 : 0);
      if (!step) return;
      event.preventDefault();
      var from = Number(event.target.closest('.rule').dataset.index);
      var to = from + step;
      if (to < 0 || to >= state.settings.rules.length) return;
      move(state.settings.rules, from, to);
      save();
      renderRules();
      renderParsed();
      var moved = list.querySelectorAll('.rule')[to];
      if (moved) moved.querySelector('[data-grip]').focus();
    });
  }

  /** Valt de kaart in de onderste helft, dan hoort de regel eronder. */
  function dropsAfter(card, event) {
    var box = card.getBoundingClientRect();
    return event.clientY > box.top + box.height / 2;
  }

  /** De plek in de lijst zoals ze er zonder de gesleepte regel uitziet. */
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
   * De navigatie links wisselt tussen de panelen. Welke open stond onthouden we,
   * zodat de pagina heropent waar je gebleven was.
   */
  function bindNav() {
    document.querySelectorAll('.nav__item').forEach(function (button) {
      button.addEventListener('click', function () {
        showPanel(button.dataset.panel);
        state.panel = button.dataset.panel;
        saveUi();
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

  function bindHosted() {
    // Al tijdens het typen: anders staat de knop nog uit op het moment dat je
    // ze aanklikt, en gebeurt er niets.
    el.hostedUrl.addEventListener('input', function () {
      el.syncNow.disabled = !el.hostedUrl.value.trim();
    });
    el.hostedUrl.addEventListener('change', function () {
      trimField(el.hostedUrl);
      state.settings.hosted.url = el.hostedUrl.value;
      // Zonder bron valt er niets bij te werken.
      if (!state.settings.hosted.url) state.settings.hosted.active = false;
      save();
      renderHostedStatus();
    });
    el.syncNow.addEventListener('click', function () {
      setHostedStatus(t('syncing'));
      chrome.runtime.sendMessage({ type: 'bcem:sync' }).then(function (result) {
        if (!result || !result.ok) {
          setHostedStatus(t('syncFailed', (result && result.error) || t('syncUnknownError')), 'error');
          return;
        }
        setHostedStatus(t(result.unchanged ? 'syncLoadedUnchanged' : 'syncLoaded', result.count), 'ok');
      });
    });
  }

  /**
   * Wist wat er van het gedeelde bestand kwam. De gedeelde configuratie gaat mee
   * uit, anders staat alles er morgen gewoon weer. De URL blijft staan, zodat
   * je met een klik op synchroniseren opnieuw kan beginnen.
   */
  function clearSharedRules() {
    var hosted = state.settings.hosted;
    hosted.rules = [];
    hosted.layouts = [];
    hosted.lastHash = '';
    hosted.sourceName = '';
    hosted.lastSync = null;
    hosted.lastError = null;
    hosted.active = false;

    save();
    renderHosted();
    renderLayouts();
    renderParsed();
    setHostedStatus(t('sharedCleared'), 'ok');
  }

  function bindImportExport() {
    el.importFileBtn.addEventListener('click', function () { el.importFile.click(); });

    el.importFile.addEventListener('change', function () {
      var file = el.importFile.files && el.importFile.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        applyImport(String(reader.result), file.name);
        el.importFile.value = '';
      };
      reader.onerror = function () { setImportStatus(t('importReadFailed'), 'error'); };
      reader.readAsText(file);
    });

    el.exportDownload.addEventListener('click', function () {
      var data = BCEM.toExport(state.settings);
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'bc-markers.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      setExportStatus(t('exportDone', data.rules.length), 'ok');
    });
  }

  function applyImport(text, source) {
    var parsed;
    try {
      parsed = BCEM.parseImport(text);
    } catch (e) {
      setImportStatus(t('importFailed', e.message), 'error');
      return;
    }
    // Eerst de layouts, zodat de regels erna meteen naar iets bestaands wijzen.
    var mergedLayouts = BCEM.mergeLayouts(state.settings.layouts, parsed.layouts);
    state.settings.layouts = mergedLayouts.layouts;

    var merged = BCEM.mergeRules(state.settings.rules, parsed.rules);
    state.settings.rules = merged.rules;
    save();
    renderRules();
    renderLayouts();
    renderParsed();

    var stats = merged.stats;
    var layoutStats = mergedLayouts.stats;
    var rules = counts([[stats.overwritten, 'importOverwritten'],
      [stats.added, 'importAdded'], [stats.kept, 'importKept']]);
    var layouts = counts([[layoutStats.overwritten, 'importOverwritten'],
      [layoutStats.added, 'importAdded']]);

    setImportStatus(
      t('importDone', [parsed.rules.length, shorten(source), rules || t('importNone')]) +
      (layouts ? t('importLayouts', [layouts]) : ''), 'ok');
  }

  /**
   * Somt op wat er echt gebeurd is. Een telling van nul zegt niets en maakt de
   * zin enkel langer, dus die laten we weg.
   */
  function counts(pairs) {
    var parts = [];
    pairs.forEach(function (pair) {
      if (pair[0]) parts.push(t(pair[1], pair[0]));
    });
    return parts.join(', ');
  }

  /* -------------------------------------------------------------- renderen */

  function renderAll() {
    el.globalEnabled.checked = state.settings.enabled;
    el.hostedUrl.value = state.settings.hosted.url;
    el.testUrl.value = state.testUrl;

    refreshContext();
    renderHosted();
  }

  function refreshContext() {
    state.ctx = BCEM.parseUrl(state.testUrl);
    renderParsed();
    renderRules();
    renderHosted();
    renderLayouts();
  }

  function renderParsed() {
    var ctx = state.ctx;
    // Enkel wat de URL effectief prijsgeeft; lege velden zijn ruis.
    var pairs = [
      [t('labelEnvironment'), ctx.environment],
      [t('labelCompany'), ctx.company],
      [t('labelTenant'), ctx.tenant]
    ].filter(function (pair) { return pair[1]; });

    el.parsed.textContent = '';
    if (!pairs.length) {
      var empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = t('nothingRecognised');
      el.parsed.appendChild(empty);
    }
    pairs.forEach(function (pair) {
      var wrap = document.createElement('div');
      var dt = document.createElement('dt');
      dt.textContent = pair[0] + ':';
      var dd = document.createElement('dd');
      dd.textContent = pair[1] || '';
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      el.parsed.appendChild(wrap);
    });

    var active = BCEM.findRule(BCEM.effectiveRules(state.settings), ctx);
    el.brandDot.style.fill = active ? active.color : "var(--muted)";
  }

  function renderRules() {
    el.ruleList.textContent = '';
    state.settings.rules.forEach(function (rule, index) {
      el.ruleList.appendChild(createCard(rule, index, { kind: 'rule', readOnly: false }));
    });
    renderEmptyState();
  }

  function renderHosted() {
    var hosted = state.settings.hosted.rules;
    el.hostedList.textContent = '';
    hosted.forEach(function (rule, index) {
      el.hostedList.appendChild(createCard(rule, index, { kind: 'rule', readOnly: true }));
    });
    el.sharedHead.hidden = !hosted.length;
    renderEmptyState();
    renderHostedStatus();
  }

  function renderLayouts() {
    el.layoutList.textContent = '';
    state.settings.layouts.forEach(function (layout, index) {
      el.layoutList.appendChild(createCard(layout, index, { kind: 'layout', readOnly: false }));
    });

    el.hostedLayoutList.textContent = '';
    state.settings.hosted.layouts.forEach(function (layout, index) {
      el.hostedLayoutList.appendChild(createCard(layout, index, { kind: 'layout', readOnly: true }));
    });

    el.emptyLayouts.hidden = state.settings.layouts.length > 0 ||
      state.settings.hosted.layouts.length > 0;
  }

  function renderEmptyState() {
    el.emptyRules.hidden = state.settings.rules.length > 0 ||
      state.settings.hosted.rules.length > 0;
  }

  /** De layouts waar een kaart uit kan kiezen: gedeelde kaarten zien beide sets. */
  function layoutsFor(readOnly) {
    return readOnly
      ? state.settings.hosted.layouts.concat(state.settings.layouts)
      : state.settings.layouts;
  }

  /** Hoeveel regels naar deze layout verwijzen. */
  function layoutUsage(layout) {
    return state.settings.rules.concat(state.settings.hosted.rules)
      .filter(function (rule) { return rule.layoutId === layout.id; }).length;
  }

  /** De layout die een nieuwe regel meekrijgt: Default, anders de eerste. */
  function defaultLayoutId() {
    var layouts = state.settings.layouts;
    var preferred = BCEM.findById(layouts, BCEM.DEFAULT_LAYOUT_ID);
    if (preferred) return preferred.id;
    return layouts.length ? layouts[0].id : '';
  }

  function renderHostedStatus() {
    var h = state.settings.hosted;
    // Zonder bron valt er niets op te halen.
    el.syncNow.disabled = !h.url;
    // Staat de gedeelde configuratie uit, dan dimmen we het veld - net zoals een
    // regel die niet aanstaat.
    var field = el.hostedUrl.closest('.field');
    if (field) field.classList.toggle('field--inactive', !h.active);
    if (!h.url) {
      setHostedStatus(t('statusNoHosted'));
      return;
    }
    if (h.lastError) {
      setHostedStatus(t('statusSyncError', [when(h.lastSync), h.lastError]), 'error');
      return;
    }
    if (!h.lastSync) {
      setHostedStatus(t('statusNotSynced'));
      return;
    }
    var summary = h.sourceName
      ? t('statusHostedNamed', [h.rules.length, h.sourceName, when(h.lastSync)])
      : t('statusHosted', [h.rules.length, when(h.lastSync)]);
    setHostedStatus(summary + (h.active ? ' ' + t('statusDaily') : ''), 'ok');
  }

  /* ------------------------------------------------------------ regelkaart */

  /**
   * Bouwt een kaart voor een regel of een layout. Beide delen het weergaveblok
   * uit displayTemplate, zodat die instellingen maar op een plek beschreven staan.
   */
  function createCard(item, index, options) {
    var kind = options.kind;
    var readOnly = options.readOnly;
    var templateId = kind === 'layout' ? 'layoutTemplate' : 'ruleTemplate';
    var card = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
    card.dataset.kind = kind;
    card.dataset.index = String(index);
    card.dataset.readonly = readOnly ? '1' : '';
    card.dataset.expandKey = expandKey(kind, item, readOnly);
    setExpanded(card, !!state.expanded[card.dataset.expandKey]);

    if (kind === 'layout') {
      card.querySelector('[data-display]')
        .appendChild(document.getElementById('displayTemplate').content.firstElementChild.cloneNode(true));
    }

    if (kind === 'rule') {
      renderConditions(card, item);
      renderPalette(card, item, readOnly);
    }

    card.querySelectorAll('[data-path]').forEach(function (input) {
      setControlValue(input, getPath(item, input.dataset.path));
    });

    // Na de velden: de keuzelijst bepaalt zelf wat er aangevinkt staat, ook
    // wanneer de regel nog geen expliciete keuze heeft.
    if (kind === 'rule') fillLayoutPicker(card, item, readOnly);

    BCEM.applyI18n(card);
    card.querySelectorAll('[data-tokens]').forEach(function (bubble) {
      bubble.innerHTML = tokenHelp();
    });

    updateCard(card, item);

    if (readOnly) {
      card.querySelectorAll('input, select, button').forEach(function (input) {
        input.disabled = true;
      });
      // Openklappen en de uitleg bekijken mag wel, ook al valt er niets te wijzigen.
      card.querySelectorAll('[data-action="toggle"], [data-action="hint"]').forEach(function (button) {
        button.disabled = false;
      });
      // Een gedeelde regel valt niet te wijzigen, maar je kan er wel een eigen
      // kopie van maken en die daarna naar je hand zetten.
      var tools = card.querySelector('.rule__tools');
      tools.textContent = '';
      if (kind === 'rule') {
        var copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'icon-btn';
        copy.dataset.action = 'duplicate';
        copy.title = t('copyShared');
        copy.innerHTML = '&#10697;';
        tools.appendChild(copy);
      }
      var addCond = card.querySelector('[data-action="add-condition"]');
      if (addCond) addCond.remove();
    }
    return card;
  }

  function fillLayoutPicker(card, rule, readOnly) {
    var select = card.querySelector('[data-layout-picker]');
    if (!select) return;
    var layouts = layoutsFor(readOnly);

    select.textContent = '';
    layouts.forEach(function (layout) {
      var option = document.createElement('option');
      option.value = layout.id;
      option.textContent = layout.name;
      select.appendChild(option);
    });

    // De waarde pas nu zetten: de opties bestaan hierboven nog niet.
    var auto = BCEM.effectiveLayout(rule, layouts);
    if (auto) select.value = auto.id;
  }

  function renderConditions(card, rule) {
    var host = card.querySelector('[data-conditions]');
    host.textContent = '';
    rule.conditions.forEach(function (cond, ci) {
      var row = document.getElementById('conditionTemplate').content.firstElementChild.cloneNode(true);
      row.dataset.index = String(ci);
      fillSelect(row.querySelector('[data-cond="field"]'), BCEM.FIELDS, cond.field);
      fillSelect(row.querySelector('[data-cond="op"]'), BCEM.OPERATORS, cond.op);
      row.querySelector('[data-cond="value"]').value = cond.value;
      host.appendChild(row);
    });
  }

  function renderPalette(card, rule, readOnly) {
    var host = card.querySelector('[data-palette]');
    // De kleurkiezer staat in de sjabloon al in het palet; even opzij houden,
    // zodat hij het leegmaken overleeft en achter de bolletjes terugkomt.
    var custom = card.querySelector('[data-custom-color]');
    host.textContent = '';
    if (!readOnly) {
      BCEM.PALETTE.forEach(function (color) {
        var button = document.createElement('button');
        button.type = 'button';
        button.style.background = color;
        button.dataset.action = 'pick-color';
        button.dataset.color = color;
        button.title = color;
        button.setAttribute('aria-pressed', 'false');
        host.appendChild(button);
      });
    }
    host.appendChild(custom);
  }

  /** Werkt kleur, badge en voorbeeld van een kaart bij, zonder de kaart te hertekenen. */
  function updateCard(card, item) {
    var ctx = state.ctx;
    var isLayout = card.dataset.kind === 'layout';
    var readOnly = !!card.dataset.readonly;

    // Een layout heeft geen eigen kleur: het voorbeeld leent die van de eerste
    // regel die haar gebruikt, anders een neutrale.
    var shown = isLayout ? item : BCEM.resolveRule(item, layoutsFor(readOnly));
    var color = isLayout ? layoutSampleColor(item) : item.color;
    var textColor = !isLayout && item.textColor !== 'auto' ? item.textColor : BCEM.idealText(color);

    card.style.setProperty('--rule-color', color);
    card.classList.toggle('rule--disabled', item.enabled === false);

    var swatch = card.querySelector('[data-swatch]');
    if (swatch) swatch.style.background = color;
    card.querySelectorAll('[data-action="pick-color"]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.color === color ? 'true' : 'false');
    });

    var matched = isLayout ? true : BCEM.matchRule(item, ctx);
    var badge = card.querySelector('[data-match]');
    if (badge) {
      badge.textContent = matched ? '\u2713' : '\u25CB';
      badge.className = 'match ' + (matched ? 'match--yes' : 'match--no');
      badge.title = t(matched ? 'matchYes' : 'matchNo');
    }
    var preview = card.querySelector('[data-preview]');
    if (preview) preview.classList.toggle('preview--nomatch', !matched);

    card.querySelectorAll('.condition').forEach(function (row) {
      var cond = item.conditions[Number(row.dataset.index)];
      var dot = row.querySelector('[data-cond-match]');
      var hasValue = cond && String(cond.value || '').trim() !== '';
      dot.className = 'dot-indicator ' +
        (!hasValue ? '' : (BCEM.testCondition(cond, ctx) ? 'dot-indicator--on' : 'dot-indicator--off'));
      dot.title = !hasValue ? '' : t(BCEM.testCondition(cond, ctx) ? 'conditionMatches' : 'conditionNoMatch');
    });

    // De letters op de favicon horen bij de regel, en enkel wanneer de layout
    // er een tekent. Een regelkaart heeft verder geen voorbeeld: dat hangt aan
    // de layout, waar de weergave ook bewerkt wordt.
    if (!isLayout) {
      card.querySelector('[data-favicon-letters]').hidden = !shown.favicon.enabled;
      return;
    }

    // Ribbon
    var ribbon = card.querySelector('[data-preview-ribbon]');
    var brand = card.querySelector('[data-preview-brand]');
    var originalBrand = 'Dynamics 365 Business Central';
    if (shown.ribbon.enabled) {
      ribbon.style.background = color;
      ribbon.style.color = textColor;
      brand.textContent = BCEM.renderTidy(shown.ribbon.text, ctx, {
        name: item.name, title: t('previewTitle')
      }) || originalBrand;
    } else {
      ribbon.style.background = '';
      ribbon.style.color = '';
      brand.textContent = originalBrand;
    }
    brand.style.fontWeight = '600';

    // Kader
    var frame = card.querySelector('[data-preview-frame]');
    frame.style.borderWidth = shown.border.enabled ? Math.min(shown.border.width, 14) + 'px' : '0';
    frame.style.borderColor = color;

    // Banner (balk of hoeklint)
    var banner = card.querySelector('[data-preview-banner]');
    banner.className = 'preview__banner preview__banner--' + shown.banner.position +
      (shown.banner.enabled ? ' preview__banner--visible' : '');
    if (shown.banner.enabled) {
      banner.style.background = BCEM.toRgba(color, shown.banner.opacity);
      banner.style.color = textColor;
      banner.textContent = BCEM.renderTidy(shown.banner.text || '{name}', ctx, { name: item.name });
    }

    // Een layout staat los van voorwaarden, dus de ribbon hoort er altijd bij.
    ribbon.hidden = false;
    card.querySelector('[data-preview-page]').textContent = t('previewPageBc');

    // Secties in/uitklappen op basis van hun schakelaar
    card.querySelectorAll('.option').forEach(function (option) {
      var toggle = option.querySelector('input[type="checkbox"][data-path$=".enabled"]');
      option.classList.toggle('option--off', toggle && !toggle.checked);
    });
  }

  /**
   * Een eigen en een gedeelde regel kunnen hetzelfde id hebben (dat gebeurt na
   * een import uit hetzelfde bestand), dus de lijst hoort bij de sleutel.
   */
  function expandKey(kind, item, readOnly) {
    return kind + ':' + (readOnly ? 'gedeeld:' : 'eigen:') + item.id;
  }

  /** Kleur voor het voorbeeld van een layout: die van de eerste regel die haar gebruikt. */
  function layoutSampleColor(layout) {
    var user = null;
    state.settings.rules.concat(state.settings.hosted.rules).forEach(function (rule) {
      if (!user && rule.layoutId === layout.id) user = rule;
    });
    return user ? user.color : BCEM.PALETTE[8];
  }

  function closeHints() {
    document.querySelectorAll('.hint.is-open').forEach(function (hint) {
      hint.classList.remove('is-open');
    });
  }

  function setExpanded(card, expanded) {
    card.classList.toggle('rule--collapsed', !expanded);
    var toggle = card.querySelector('[data-action="toggle"]');
    if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function toggleCard(card) {
    var key = card.dataset.expandKey;
    var expanded = !state.expanded[key];
    if (expanded) {
      state.expanded[key] = true;
    } else {
      delete state.expanded[key];
    }
    setExpanded(card, expanded);
  }

  /* ----------------------------------------------------------- interacties */

  /**
   * Maakt van een gedeelde regel een eigen kopie. De layout waar ze aan hangt
   * gaat mee, anders zou de kopie er anders uitzien dan het origineel.
   */
  function copySharedRule(index) {
    var source = state.settings.hosted.rules[index];
    if (!source) return;

    var copy = BCEM.newRule(source);
    copy.name = source.name;
    copy.layoutId = source.layoutId;

    var copiedLayout = false;
    if (copy.layoutId && !BCEM.findById(state.settings.layouts, copy.layoutId)) {
      var layout = BCEM.findById(state.settings.hosted.layouts, copy.layoutId);
      if (layout) {
        state.settings.layouts.push(BCEM.normalizeLayout(layout));
        copiedLayout = true;
      }
    }

    state.settings.rules.push(copy);
    state.expanded[expandKey('rule', copy, false)] = true;
    save();
    renderRules();
    renderLayouts();
    renderParsed();
    setStatus(t('copiedToOwn', 1) + (copiedLayout ? t('copiedLayouts', 1) : ''));
  }

  function onLayoutAction(action, index) {
    var layout = state.settings.layouts[index];
    if (!layout) return;

    if (action === 'delete') {
      // Er moet er altijd een overblijven, anders heeft "volgt de enige layout"
      // geen betekenis meer.
      if (state.settings.layouts.length < 2) {
        setStatus(t('lastLayout'), true);
        return;
      }
      var used = layoutUsage(layout);
      if (!confirm(t('deleteLayoutConfirm', [layout.name, used]))) return;
      // De regels houden hun eigen instellingen, die nooit overschreven werden.
      state.settings.rules.forEach(function (rule) {
        if (rule.layoutId === layout.id) rule.layoutId = '';
      });
      state.settings.layouts.splice(index, 1);
    } else if (action === 'duplicate') {
      var copy = BCEM.newLayout(layout);
      copy.name = t('copySuffix', layout.name);
      state.settings.layouts.splice(index + 1, 0, copy);
      state.expanded[expandKey('layout', copy, false)] = true;
    } else {
      return;
    }

    save();
    renderLayouts();
    renderRules();
    renderHosted();
    renderParsed();
  }

  /** De regel of de layout waar deze kaart bij hoort. */
  function cardTarget(card) {
    var index = Number(card.dataset.index);
    return card.dataset.kind === 'layout'
      ? state.settings.layouts[index]
      : state.settings.rules[index];
  }

  function onRuleInput(event) {
    var card = event.target.closest('.rule');
    if (!card || card.dataset.readonly) return;
    var target = cardTarget(card);
    if (!target) return;

    // Bij het verlaten van een veld ook tonen wat er bewaard wordt: zonder
    // spaties voor of achter.
    if (event.type === 'change') trimField(event.target);

    var pathInput = event.target.closest('[data-path]');
    if (pathInput) {
      var path = pathInput.dataset.path;
      setPath(target, path, controlValue(pathInput));
      if (path === 'banner.enabled' && target.banner.enabled) {
        // Een banner die de pagina afdekt helpt niemand: half doorzichtig.
        target.banner.opacity = 0.5;
        var opacityInput = card.querySelector('[data-path="banner.opacity"]');
        if (opacityInput) setControlValue(opacityInput, 0.5);
      }
    }

    var condInput = event.target.closest('[data-cond]');
    if (condInput) {
      var row = condInput.closest('.condition');
      var cond = target.conditions[Number(row.dataset.index)];
      if (cond) cond[condInput.dataset.cond] = condInput.value;
    }

    if (!pathInput && !condInput) return;
    updateCard(card, target);
    renderParsed();
    save();

    // Een wijziging aan een layout raakt elke regel die eraan hangt; die kaarten
    // hertekenen we, de layoutkaart zelf blijft staan zodat de focus niet springt.
    if (card.dataset.kind === 'layout') {
      renderRules();
      renderHosted();
      return;
    }

    // Andersom hangt de layoutkaart af van de regels: hoeveel er gekoppeld zijn
    // en welke kleur het voorbeeld leent.
    var path = pathInput && pathInput.dataset.path;
    if (path === 'layoutId' || path === 'color') renderLayouts();
  }

  function onRuleClick(event) {
    var button = event.target.closest('[data-action]');
    var card = event.target.closest('.rule');
    if (!card) return;

    if (button && button.dataset.action === 'hint') {
      // Binnen een <label>: niet doorgeven aan het veld ernaast.
      event.preventDefault();
      var wasOpen = button.classList.contains('is-open');
      closeHints();
      if (!wasOpen) button.classList.add('is-open');
      return;
    }
    closeHints();

    // Een klik op de kopregel klapt de regel open of dicht, behalve wanneer je
    // een bedieningselement in die kopregel aanklikt.
    var onHead = event.target.closest('.rule__head') &&
      !event.target.closest('input, select, label') &&
      (!button || button.dataset.action === 'toggle');
    if (onHead) {
      toggleCard(card);
      return;
    }
    if (!button) return;
    var index = Number(card.dataset.index);
    if (card.dataset.readonly) {
      // Het enige wat je met een gedeelde regel kan: er een eigen kopie van maken.
      if (button.dataset.action === 'duplicate' && card.dataset.kind === 'rule') {
        copySharedRule(index);
      }
      return;
    }
    if (card.dataset.kind === 'layout') {
      onLayoutAction(button.dataset.action, index);
      return;
    }
    var rule = state.settings.rules[index];
    if (!rule) return;

    switch (button.dataset.action) {
      case 'delete':
        if (!confirm(t('deleteConfirm', rule.name))) return;
        state.settings.rules.splice(index, 1);
        save();
        renderRules();
        renderParsed();
        return;
      case 'duplicate':
        var copy = BCEM.newRule(rule);
        copy.name = t('copySuffix', rule.name);
        state.settings.rules.splice(index + 1, 0, copy);
        state.expanded[expandKey('rule', copy, false)] = true;
        save();
        renderRules();
        return;
      case 'add-condition':
        rule.conditions.push({ field: 'url', op: 'contains', value: '' });
        renderConditions(card, rule);
        updateCard(card, rule);
        save();
        return;
      case 'remove-condition':
        var row = button.closest('.condition');
        rule.conditions.splice(Number(row.dataset.index), 1);
        if (!rule.conditions.length) rule.conditions.push({ field: 'url', op: 'contains', value: '' });
        renderConditions(card, rule);
        updateCard(card, rule);
        renderParsed();
        save();
        return;
      case 'pick-color':
        rule.color = button.dataset.color;
        setControlValue(card.querySelector('[data-custom-color]'), rule.color);
        updateCard(card, rule);
        renderParsed();
        save();
        return;
    }
  }

  /* --------------------------------------------------------------- helpers */

  function save() {
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(function () {
      state.selfWrite = true;
      // Bewaren gebeurt vanzelf; enkel als het misloopt is er iets te melden.
      BCEM.saveSettings(state.settings).then(null, function (err) {
        state.selfWrite = false;
        setStatus(t('saveFailed', err.message), true);
      });
    }, 250);
  }

  /**
   * Kiest uit de open tabbladen de URL die de gebruiker waarschijnlijk bedoelt:
   * een Business Central tab krijgt voorrang, daarna het meest recent gebruikte
   * tabblad. Tabbladen zonder http(s)-URL (zoals deze optiespagina) vallen af.
   */
  function pickBrowsingTab(tabs) {
    var usable = (tabs || []).filter(function (tab) {
      return /^https?:/i.test(tab && tab.url ? tab.url : '');
    });
    if (!usable.length) return '';

    function score(tab) {
      // lastAccessed bestaat niet in elke Chrome-versie; dan telt "actief".
      return tab.lastAccessed || (tab.active ? 1 : 0);
    }
    usable.sort(function (a, b) {
      var bc = (BCEM.parseUrl(b.url).isbc ? 1 : 0) - (BCEM.parseUrl(a.url).isbc ? 1 : 0);
      return bc || score(b) - score(a);
    });
    return usable[0].url;
  }

  function saveUi() {
    var payload = {};
    payload[UI_KEY] = { testUrl: state.testUrl, panel: state.panel };
    chrome.storage.local.set(payload);
  }

  /**
   * Knipt spaties voor en achter een ingetypte waarde weg. De opslag doet dit
   * sowieso (zie str() in settings.js); dit zorgt dat het scherm hetzelfde
   * toont. Geeft terug of er iets veranderde.
   */
  function trimField(input) {
    if (!input || TRIMMED_TYPES.indexOf(input.type) === -1) return false;
    var trimmed = input.value.trim();
    if (trimmed === input.value) return false;
    input.value = trimmed;
    return true;
  }

  function move(list, from, to) {
    var item = list.splice(from, 1)[0];
    list.splice(to, 0, item);
  }

  function getPath(object, path) {
    return path.split('.').reduce(function (acc, key) {
      return acc == null ? acc : acc[key];
    }, object);
  }

  function setPath(object, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (acc, key) {
      if (acc[key] == null) acc[key] = {};
      return acc[key];
    }, object);
    target[last] = value;
  }

  function controlValue(input) {
    if (input.type === 'checkbox') return input.checked;
    if (input.type === 'number' || input.type === 'range') return parseFloat(input.value);
    return input.value;
  }

  function setControlValue(input, value) {
    if (input.type === 'checkbox') {
      input.checked = !!value;
    } else if (input.type === 'color') {
      input.value = BCEM.toHex(value);
    } else {
      input.value = value == null ? '' : value;
    }
  }

  function fillSelect(select, options, selected) {
    select.textContent = '';
    options.forEach(function (option) {
      var node = document.createElement('option');
      node.value = option.value;
      node.textContent = t(option.key);
      select.appendChild(node);
    });
    select.value = selected;
  }

  function when(iso) {
    if (!iso) return t('unknownDate');
    var date = new Date(iso);
    if (isNaN(date.getTime())) return t('unknownDate');
    return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  }

  function shorten(text) {
    var s = String(text || '');
    return s.length > 48 ? s.slice(0, 45) + '...' : s;
  }

  function setStatus(text, isError) {
    el.status.textContent = text;
    el.status.className = 'status' + (isError ? ' status--error' : '');
  }

  function setHostedStatus(text, kind) {
    el.hostedStatus.textContent = text;
    el.hostedStatus.className = 'sync-status' + (kind ? ' sync-status--' + kind : '');
  }

  function setImportStatus(text, kind) {
    el.importStatus.textContent = text;
    el.importStatus.className = 'sync-status' + (kind ? ' sync-status--' + kind : '');
  }

  function setExportStatus(text, kind) {
    el.exportStatus.textContent = text;
    el.exportStatus.className = 'sync-status' + (kind ? ' sync-status--' + kind : '');
  }
})();
