/*
 * BC Buddy - opslag, defaults, normalisatie en import/export.
 * Vereist match.js (voor BCEM.toHex).
 */
(function (root) {
  'use strict';
  var BCEM = root.BCEM || (root.BCEM = {});

  var STORAGE_KEY = 'settings';
  var EXPORT_APP = 'bc-environment-marker';
  var SCHEMA_VERSION = 1;

  var BRAND_NAME = 'Dynamics 365 Business Central';
  var DEFAULT_RIBBON_TEXT = BRAND_NAME + ' - {company} ({environment})';

  // Kleine letters: toHex() normaliseert zo, waardoor vergelijkingen kloppen.
  var PALETTE = [
    '#c4314b', // rood - productie / let op
    '#d83b01', // oranje
    '#eaa300', // amber
    '#498205', // lichtgroen
    '#107c10', // groen
    '#00b294', // mint
    '#038387', // teal
    '#005b70', // donkerteal
    '#0f6cbd', // blauw
    '#4f6bed', // indigo
    '#8764b8', // paars
    '#881798', // pruim
    '#e3008c', // magenta
    '#4f5b62'  // grijs
  ];

  // 'bottom' is een balk over de volle breedte, de rest zijn diagonale linten
  // in een hoek van het venster.
  var POSITIONS = ['bottom', 'top-right', 'top-left', 'bottom-right', 'bottom-left'];
  var CORNER_POSITIONS = POSITIONS.slice(1);

  function isCorner(position) {
    return CORNER_POSITIONS.indexOf(position) !== -1;
  }

  // Hoe vaak het gedeelde bestand gecontroleerd wordt zolang de gedeelde
  // configuratie actief is.
  var SYNC_INTERVAL_MINUTES = 1440;

  /**
   * De gedeelde configuratie is 'actief' zodra je een keer gesynchroniseerd
   * hebt; vanaf dan wordt ze dagelijks bijgewerkt. Ze gaat enkel uit wanneer de
   * URL leeg is of wanneer je de gedeelde regels wist. Oudere instellingen
   * hadden hier een schakelaar (autoSync) of een interval in minuten staan.
   */
  function normalizeActive(hosted) {
    if (!str(hosted.url)) return false; // zonder bron valt er niets bij te werken
    if (typeof hosted.active === 'boolean') return hosted.active;
    if (typeof hosted.autoSync === 'boolean') return hosted.autoSync;
    if (hosted.intervalMinutes != null) return parseInt(hosted.intervalMinutes, 10) !== 0;
    return false; // een URL zonder eerste synchronisatie
  }

  function uid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function num(value, fallback, min, max) {
    var n = parseFloat(value);
    if (isNaN(n)) n = fallback;
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    return n;
  }

  function bool(value, fallback) {
    return typeof value === 'boolean' ? value : !!fallback;
  }

  /**
   * Elke tekstwaarde loopt hierlangs. Spaties voor of achter zijn altijd per
   * ongeluk - in een naam, een voorwaarde of een URL leveren ze enkel regels op
   * die niet passen - dus die knippen we er meteen af, waar de waarde ook
   * vandaan komt: het scherm, een import of het gedeelde bestand.
   */
  function str(value, fallback) {
    return value == null ? (fallback || '') : String(value).trim();
  }

  function normalizeCondition(c) {
    c = c || {};
    var fields = BCEM.FIELDS.map(function (f) { return f.value; });
    var ops = BCEM.OPERATORS.map(function (o) { return o.value; });

    // 'host' bestaat niet meer als veld. Een oude voorwaarde daarop blijft
    // werken als "de URL bevat die host", wat op hetzelfde neerkomt.
    if (c.field === 'host') {
      return { field: 'url', op: 'contains', value: str(c.value) };
    }
    return {
      field: fields.indexOf(c.field) !== -1 ? c.field : 'url',
      op: ops.indexOf(c.op) !== -1 ? c.op : 'contains',
      value: str(c.value)
    };
  }

  // De weergave-instellingen die een regel zelf kan hebben of van een layout
  // kan overnemen. De kleur hoort daar niet bij: die blijft regelspecifiek.
  var DISPLAY_KEYS = ['border', 'banner', 'ribbon', 'title', 'favicon'];

  // Vast id, zodat normalize() altijd hetzelfde resultaat geeft.
  var DEFAULT_LAYOUT_ID = 'default';

  function normalizeDisplay(source) {
    var s = source || {};
    var border = s.border || {};
    var banner = s.banner || {};
    var ribbon = s.ribbon || {};
    var title = s.title || {};
    var favicon = s.favicon || {};

    return {
      border: {
        enabled: bool(border.enabled, true),
        width: num(border.width, 3, 1, 5)
      },
      banner: {
        enabled: bool(banner.enabled, false),
        position: POSITIONS.indexOf(banner.position) !== -1 ? banner.position : 'bottom',
        text: str(banner.text, '{name}'),
        fontSize: num(banner.fontSize, 0, 0, 72), // 0 = automatisch
        opacity: num(banner.opacity, 0.5, 0.05, 1)
      },
      ribbon: {
        enabled: bool(ribbon.enabled, true),
        // {brand} bestaat niet meer als token; oudere teksten krijgen de
        // merknaam die het token vroeger opleverde.
        text: str(ribbon.text, DEFAULT_RIBBON_TEXT).replace(/\{brand\}/gi, BRAND_NAME)
      },
      title: {
        enabled: bool(title.enabled, false),
        text: str(title.text, '[{name}] {title}')
      },
      favicon: {
        enabled: bool(favicon.enabled, false),
        text: str(favicon.text, '').slice(0, 2) // twee tekens passen op een favicon
      }
    };
  }

  function normalizeRule(r) {
    r = r || {};
    var conditions = Array.isArray(r.conditions) ? r.conditions.map(normalizeCondition) : [];
    if (!conditions.length) conditions = [normalizeCondition({})];

    var rule = {
      id: str(r.id) || uid(),
      name: str(r.name, BCEM.t('newRuleName')),
      enabled: bool(r.enabled, true),
      note: str(r.note),
      conditions: conditions,
      color: BCEM.toHex(r.color || PALETTE[0]),
      textColor: r.textColor === 'auto' || !r.textColor ? 'auto' : BCEM.toHex(r.textColor),
      // Het id van de layout die de weergave bepaalt.
      layoutId: str(r.layoutId)
    };

    var display = normalizeDisplay(r);
    DISPLAY_KEYS.forEach(function (key) { rule[key] = display[key]; });
    return rule;
  }

  function normalizeLayout(l) {
    l = l || {};
    var layout = {
      id: str(l.id) || uid(),
      name: str(l.name, BCEM.t('newLayoutName'))
    };
    var display = normalizeDisplay(l);
    DISPLAY_KEYS.forEach(function (key) { layout[key] = display[key]; });
    // De letters op de favicon horen bij de regel, niet bij de layout.
    layout.favicon.text = '';
    return layout;
  }

  function newLayout(patch) {
    var layout = normalizeLayout(patch || {});
    layout.id = uid();
    return layout;
  }

  function findById(list, id) {
    var found = null;
    (list || []).forEach(function (item) {
      if (!found && item && item.id === id) found = item;
    });
    return found;
  }

  /**
   * De layout die voor deze regel geldt: de aangeduide, en anders de eerste uit
   * de set. Zo heeft elke regel er altijd een.
   */
  function effectiveLayout(rule, layouts, autoLayouts) {
    if (!rule) return null;
    if (rule.layoutId) {
      var chosen = findById(layouts || [], rule.layoutId);
      if (chosen) return chosen;
    }

    // Zonder (bestaande) keuze telt enkel de eigen set: een gedeelde regel mag
    // niet ongemerkt de layout van de lezer overnemen.
    var auto = autoLayouts === undefined ? (layouts || []) : autoLayouts;
    return auto.length ? auto[0] : null;
  }

  /**
   * Levert de regel zoals ze getekend moet worden: geldt er een layout, dan
   * komen de weergave-instellingen daarvandaan. Naam, voorwaarden en kleur
   * blijven altijd van de regel zelf. Bestaat de layout niet (meer), dan vallen
   * we terug op wat de regel zelf bewaard heeft.
   */
  function resolveRule(rule, layouts, autoLayouts) {
    var layout = effectiveLayout(rule, layouts, autoLayouts);
    if (!layout) return rule;

    var resolved = {};
    Object.keys(rule).forEach(function (key) { resolved[key] = rule[key]; });
    DISPLAY_KEYS.forEach(function (key) { resolved[key] = layout[key]; });
    resolved.favicon = { enabled: layout.favicon.enabled, text: rule.favicon.text };
    return resolved;
  }

  /**
   * Naam en voorwaarden voor een nieuwe regel, afgeleid van een URL.
   * Bij Business Central pakken we omgeving en bedrijf, want dat zijn de
   * velden die je in de praktijk wil onderscheiden. Bij een andere site is de
   * URL zelf het enige zinvolle aanknopingspunt.
   */
  function draftFromContext(ctx) {
    var conditions = [];
    if (ctx && ctx.isbc) {
      if (ctx.environment) conditions.push({ field: 'environment', op: 'equals', value: ctx.environment });
      if (ctx.company) conditions.push({ field: 'company', op: 'equals', value: ctx.company });
    }
    if (!conditions.length && ctx && ctx.host && ctx.url) {
      conditions.push({ field: 'url', op: 'contains', value: ctx.url });
    }
    if (!conditions.length) {
      conditions.push({ field: 'environment', op: 'contains', value: '' });
    }
    var name = (ctx && (ctx.environment || ctx.host)) || BCEM.t('newRuleName');
    return { name: name.toUpperCase(), conditions: conditions };
  }

  function newRule(patch) {
    var rule = normalizeRule(patch || {});
    rule.id = uid();
    return rule;
  }

  /**
   * De weergave zit in layouts, dus elke regel wijst er een aan. Zijn er nog
   * geen layouts, dan leiden we ze af uit de regels: regels die er hetzelfde
   * uitzien delen een layout, waardoor de migratie niets verandert aan wat er
   * vandaag getekend wordt. Bij een lege configuratie is er gewoon een Default.
   */
  function withDefaultLayout(layouts, rules) {
    if (!layouts.length) {
      var byLook = {};
      rules.forEach(function (rule) {
        var look = JSON.stringify(DISPLAY_KEYS.map(function (key) { return rule[key]; }));
        if (byLook[look]) return;
        var layout = normalizeLayout(rule);
        layout.id = layouts.length ? uid() : DEFAULT_LAYOUT_ID;
        layout.name = layouts.length
          ? BCEM.t('newLayoutName') + ' ' + (layouts.length + 1)
          : BCEM.t('defaultLayoutName');
        byLook[look] = layout;
        layouts.push(layout);
      });

      if (!layouts.length) {
        var fresh = normalizeLayout({});
        fresh.id = DEFAULT_LAYOUT_ID;
        fresh.name = BCEM.t('defaultLayoutName');
        layouts.push(fresh);
      }

      rules.forEach(function (rule) {
        var look = JSON.stringify(DISPLAY_KEYS.map(function (key) { return rule[key]; }));
        if (byLook[look]) rule.layoutId = byLook[look].id;
      });
    }

    // Een regel zonder geldige layout volgt de eerste.
    rules.forEach(function (rule) {
      if (!findById(layouts, rule.layoutId)) rule.layoutId = layouts[0].id;
    });
    return layouts;
  }

  function normalize(settings) {
    var s = settings || {};
    var hosted = s.hosted || {};
    var rules = (Array.isArray(s.rules) ? s.rules : []).map(normalizeRule);
    var layouts = (Array.isArray(s.layouts) ? s.layouts : []).map(normalizeLayout);

    return {
      version: SCHEMA_VERSION,
      enabled: bool(s.enabled, true),
      rules: rules,
      layouts: withDefaultLayout(layouts, rules),
      hosted: {
        url: str(hosted.url),
        active: normalizeActive(hosted),
        rules: (Array.isArray(hosted.rules) ? hosted.rules : []).map(normalizeRule),
        layouts: (Array.isArray(hosted.layouts) ? hosted.layouts : []).map(normalizeLayout),
        sourceName: str(hosted.sourceName),
        lastSync: hosted.lastSync || null,
        lastError: hosted.lastError || null,
        lastHash: str(hosted.lastHash)
      }
    };
  }

  /**
   * Effectieve regels: eigen regels eerst, daarna de gedeelde (eerste match
   * wint), elk met hun layout al toegepast. Gedeelde regels kijken eerst naar de
   * gedeelde layouts, zodat een gedeeld bestand op zichzelf klopt.
   */
  function effectiveRules(settings) {
    var s = normalize(settings);
    var own = s.rules.map(function (rule) { return resolveRule(rule, s.layouts); });
    var sharedLayouts = s.hosted.layouts.concat(s.layouts);
    var shared = s.hosted.rules.map(function (rule) {
      return resolveRule(rule, sharedLayouts, s.hosted.layouts);
    });
    return own.concat(shared);
  }

  function load() {
    return chrome.storage.local.get(STORAGE_KEY).then(function (obj) {
      return normalize(obj && obj[STORAGE_KEY]);
    });
  }

  function save(settings) {
    var payload = {};
    payload[STORAGE_KEY] = normalize(settings);
    return chrome.storage.local.set(payload);
  }

  /* ---------- import / export ---------- */

  function toExport(settings, name) {
    var s = normalize(settings);
    return {
      app: EXPORT_APP,
      version: SCHEMA_VERSION,
      name: str(name),
      exportedAt: new Date().toISOString(),
      layouts: s.layouts,
      rules: s.rules
    };
  }

  /**
   * Accepteert het eigen exportformaat of een kale array van regels.
   * Gooit een Error met een leesbare melding.
   */
  function parseImport(text) {
    var data;
    try {
      data = typeof text === 'string' ? JSON.parse(text) : text;
    } catch (e) {
      throw new Error(BCEM.t('errInvalidJson', e.message));
    }
    var rules = null;
    var layouts = [];
    var name = '';
    if (Array.isArray(data)) {
      rules = data;
    } else if (data && Array.isArray(data.rules)) {
      rules = data.rules;
      layouts = Array.isArray(data.layouts) ? data.layouts : [];
      name = str(data.name);
    }
    if (!rules) throw new Error(BCEM.t('errNoRules'));
    if (data && data.app && data.app !== EXPORT_APP) {
      throw new Error(BCEM.t('errOtherApp', data.app));
    }

    return {
      rules: rules.map(normalizeRule),
      layouts: layouts.map(normalizeLayout),
      name: name
    };
  }

  /**
   * Voegt geimporteerde regels samen met de bestaande.
   *   - bestaat de regel al (zelfde id, anders zelfde naam): overschrijven op
   *     zijn plaats, zodat de volgorde en dus de prioriteit behouden blijft
   *   - staat ze er nog niet in: achteraan toevoegen
   *   - regels die niet in het importbestand staan: laten staan
   */
  function mergeItems(current, incoming, normalizeFn) {
    var items = (Array.isArray(current) ? current : []).map(normalizeFn);
    var taken = [];
    var stats = { overwritten: 0, added: 0, kept: 0 };

    function indexOfMatch(item) {
      var i;
      for (i = 0; i < items.length; i++) {
        if (taken[i]) continue;
        if (items[i].id === item.id) return i;
      }
      var name = item.name.trim().toLowerCase();
      if (!name) return -1;
      for (i = 0; i < items.length; i++) {
        if (taken[i]) continue;
        if (items[i].name.trim().toLowerCase() === name) return i;
      }
      return -1;
    }

    (Array.isArray(incoming) ? incoming : []).map(normalizeFn).forEach(function (item) {
      var index = indexOfMatch(item);
      if (index === -1) {
        items.push(item);
        stats.added++;
      } else {
        // Het item neemt het id uit het bestand over, zodat een volgende import
        // meteen op id matcht in plaats van op naam.
        items[index] = item;
        taken[index] = true;
        stats.overwritten++;
      }
    });

    stats.kept = items.length - stats.overwritten - stats.added;
    return { items: items, stats: stats };
  }

  function mergeRules(current, incoming) {
    var merged = mergeItems(current, incoming, normalizeRule);
    return { rules: merged.items, stats: merged.stats };
  }

  function mergeLayouts(current, incoming) {
    var merged = mergeItems(current, incoming, normalizeLayout);
    return { layouts: merged.items, stats: merged.stats };
  }

  /** Stabiele, korte hash om te zien of een gedeeld bestand gewijzigd is. */
  function hash(input) {
    var s = typeof input === 'string' ? input : JSON.stringify(input);
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  /**
   * Zet bekende hosting-URLs om naar hun raw-variant, zodat een geplakte
   * GitHub/Azure DevOps-link ook gewoon werkt.
   */
  function toRawUrl(url) {
    var u = str(url).trim();
    if (!u) return '';
    var gh = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i);
    if (gh) return 'https://raw.githubusercontent.com/' + gh[1] + '/' + gh[2] + '/' + gh[3];
    var gist = u.match(/^https?:\/\/gist\.github\.com\/([^/]+)\/([0-9a-f]+)$/i);
    if (gist) return 'https://gist.githubusercontent.com/' + gist[1] + '/' + gist[2] + '/raw';
    return u;
  }

  BCEM.STORAGE_KEY = STORAGE_KEY;
  BCEM.SCHEMA_VERSION = SCHEMA_VERSION;
  BCEM.EXPORT_APP = EXPORT_APP;
  BCEM.PALETTE = PALETTE;
  BCEM.POSITIONS = POSITIONS;
  BCEM.isCorner = isCorner;
  BCEM.SYNC_INTERVAL_MINUTES = SYNC_INTERVAL_MINUTES;
  BCEM.DEFAULT_RIBBON_TEXT = DEFAULT_RIBBON_TEXT;
  BCEM.uid = uid;
  BCEM.newRule = newRule;
  BCEM.newLayout = newLayout;
  BCEM.draftFromContext = draftFromContext;
  BCEM.normalizeRule = normalizeRule;
  BCEM.normalizeLayout = normalizeLayout;
  BCEM.resolveRule = resolveRule;
  BCEM.effectiveLayout = effectiveLayout;
  BCEM.findById = findById;
  BCEM.DISPLAY_KEYS = DISPLAY_KEYS;
  BCEM.DEFAULT_LAYOUT_ID = DEFAULT_LAYOUT_ID;
  BCEM.normalize = normalize;
  BCEM.effectiveRules = effectiveRules;
  BCEM.loadSettings = load;
  BCEM.saveSettings = save;
  BCEM.toExport = toExport;
  BCEM.parseImport = parseImport;
  BCEM.mergeRules = mergeRules;
  BCEM.mergeLayouts = mergeLayouts;
  BCEM.hash = hash;
  BCEM.toRawUrl = toRawUrl;
})(typeof self !== 'undefined' ? self : this);
