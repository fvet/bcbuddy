/*
 * BC Buddy - storage, defaults, normalisation and import/export.
 * Requires match.js (for BCBuddy.toHex).
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var STORAGE_KEY = 'settings';
  var EXPORT_APP = 'bc-buddy';
  var SCHEMA_VERSION = 2;

  var BRAND_NAME = 'Dynamics 365 Business Central';
  var DEFAULT_RIBBON_TEXT = BRAND_NAME + ' - {company} ({environment})';

  // Lowercase: toHex() normalises that way, so comparisons stay consistent.
  var PALETTE = [
    '#c4314b', // red - sandbox / watch out
    '#d83b01', // orange
    '#eaa300', // amber
    '#498205', // light green
    '#107c10', // green
    '#00b294', // mint
    '#038387', // teal
    '#005b70', // dark teal
    '#0f6cbd', // blue
    '#4f6bed', // indigo
    '#8764b8', // purple
    '#881798', // plum
    '#e3008c', // magenta
    '#4f5b62'  // grey
  ];

  // 'bottom' is a full-width bar; the rest are diagonal ribbons in a corner
  // of the window.
  var POSITIONS = ['bottom', 'top-right', 'top-left', 'bottom-right', 'bottom-left'];
  var CORNER_POSITIONS = POSITIONS.slice(1);

  function isCorner(position) {
    return CORNER_POSITIONS.indexOf(position) !== -1;
  }

  // How often the shared file is checked while the shared configuration is
  // active.
  var SYNC_INTERVAL_MINUTES = 1440;

  /**
   * The shared configuration is 'active' once you have synced once; from then
   * on it is updated daily. It only turns off when the URL is empty or when
   * you clear the shared rules.
   */
  function normalizeActive(hosted) {
    if (!str(hosted.url)) return false; // without a source there is nothing to update
    if (typeof hosted.active === 'boolean') return hosted.active;
    return false; // a URL without a first sync
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
   * Every text value goes through here. Leading or trailing spaces are always
   * accidental — in a name, a condition or a URL they only produce rules that
   * do not match — so we trim them immediately, wherever the value came from:
   * the screen, an import or the shared file.
   */
  function str(value, fallback) {
    return value == null ? (fallback || '') : String(value).trim();
  }

  function normalizeCondition(c) {
    c = c || {};
    var fields = BCBuddy.FIELDS.map(function (f) { return f.value; });
    var ops = BCBuddy.OPERATORS.map(function (o) { return o.value; });

    return {
      field: fields.indexOf(c.field) !== -1 ? c.field : 'url',
      op: ops.indexOf(c.op) !== -1 ? c.op : 'contains',
      value: str(c.value)
    };
  }

  // Display settings live on layouts. Colour and favicon letters stay on the rule.
  var DISPLAY_KEYS = ['border', 'banner', 'ribbon', 'title', 'favicon'];

  // Fixed id, so normalize() always yields the same result.
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
        fontSize: num(banner.fontSize, 0, 0, 72), // 0 = automatic
        opacity: num(banner.opacity, 0.5, 0.05, 1)
      },
      ribbon: {
        enabled: bool(ribbon.enabled, true),
        text: str(ribbon.text, DEFAULT_RIBBON_TEXT)
      },
      title: {
        enabled: bool(title.enabled, false),
        text: str(title.text, '[{name}] {title}')
      },
      favicon: {
        enabled: bool(favicon.enabled, false),
        text: str(favicon.text, '').slice(0, 2) // two characters fit on a favicon
      }
    };
  }

  function normalizeRule(r) {
    r = r || {};
    var conditions = Array.isArray(r.conditions) ? r.conditions.map(normalizeCondition) : [];
    if (!conditions.length) conditions = [normalizeCondition({})];
    var favicon = r.favicon || {};

    return {
      id: str(r.id) || uid(),
      name: str(r.name, BCBuddy.t('newRuleName')),
      enabled: bool(r.enabled, true),
      conditions: conditions,
      color: BCBuddy.toHex(r.color || PALETTE[0]),
      textColor: r.textColor === 'auto' || !r.textColor ? 'auto' : BCBuddy.toHex(r.textColor),
      // Each rule picks its own layout; appearance comes from that layout.
      layoutId: str(r.layoutId),
      favicon: { text: str(favicon.text, '').slice(0, 2) }
    };
  }

  function normalizeLayout(l) {
    l = l || {};
    var layout = {
      id: str(l.id) || uid(),
      name: str(l.name, BCBuddy.t('newLayoutName'))
    };
    var display = normalizeDisplay(l);
    DISPLAY_KEYS.forEach(function (key) { layout[key] = display[key]; });
    // Favicon letters belong to the rule, not the layout.
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
   * The layout that applies to this rule: the one pointed at, otherwise the
   * first in the set. That way every rule always has one.
   */
  function effectiveLayout(rule, layouts, autoLayouts) {
    if (!rule) return null;
    if (rule.layoutId) {
      var chosen = findById(layouts || [], rule.layoutId);
      if (chosen) return chosen;
    }

    // Without a (valid) choice only the own set counts: a shared rule must not
    // silently pick up the reader's layout.
    var auto = autoLayouts === undefined ? (layouts || []) : autoLayouts;
    return auto.length ? auto[0] : null;
  }

  /**
   * Returns the rule as it should be drawn: display comes from the chosen
   * layout. Name, conditions, colour and favicon letters stay on the rule.
   * Without a layout the defaults are used, so drawing never crashes.
   */
  function resolveRule(rule, layouts, autoLayouts) {
    if (!rule) return rule;
    var layout = effectiveLayout(rule, layouts, autoLayouts);
    var display = normalizeDisplay(layout);
    var resolved = {};
    Object.keys(rule).forEach(function (key) {
      if (DISPLAY_KEYS.indexOf(key) === -1) resolved[key] = rule[key];
    });
    DISPLAY_KEYS.forEach(function (key) { resolved[key] = display[key]; });
    resolved.favicon = {
      enabled: display.favicon.enabled,
      text: str((rule.favicon && rule.favicon.text) || '', '').slice(0, 2)
    };
    return resolved;
  }

  /**
   * Name and conditions for a new rule, derived from a URL. For Business
   * Central we take environment and company, because those are the fields you
   * want to tell apart in practice. For any other site the URL itself is the
   * only useful hook.
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
    var name = (ctx && (ctx.environment || ctx.host)) || BCBuddy.t('newRuleName');
    return { name: name.toUpperCase(), conditions: conditions };
  }

  function newRule(patch) {
    var rule = normalizeRule(patch || {});
    rule.id = uid();
    return rule;
  }

  /**
   * Appearance lives in layouts, so every rule points at one. A configuration
   * without any layouts gets a Default, so there is always something to point
   * at. Each rule keeps its own layoutId.
   */
  function withDefaultLayout(layouts, rules) {
    if (!layouts.length) {
      var fresh = normalizeLayout({});
      fresh.id = DEFAULT_LAYOUT_ID;
      fresh.name = BCBuddy.t('defaultLayoutName');
      layouts.push(fresh);
    }

    // A rule without a valid layout follows the first; a valid layoutId is kept.
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
    var hostedRules = (Array.isArray(hosted.rules) ? hosted.rules : []).map(normalizeRule);
    var hostedLayouts = (Array.isArray(hosted.layouts) ? hosted.layouts : []).map(normalizeLayout);

    return {
      version: SCHEMA_VERSION,
      enabled: bool(s.enabled, true),
      rules: rules,
      layouts: withDefaultLayout(layouts, rules),
      hosted: {
        url: str(hosted.url),
        active: normalizeActive(hosted),
        rules: hostedRules,
        layouts: (hostedRules.length || hostedLayouts.length)
          ? withDefaultLayout(hostedLayouts, hostedRules)
          : hostedLayouts,
        sourceName: str(hosted.sourceName),
        lastSync: hosted.lastSync || null,
        lastError: hosted.lastError || null,
        lastHash: str(hosted.lastHash)
      }
    };
  }

  /**
   * Effective rules: own rules first, then the shared ones (first match wins),
   * each with its layout already applied. Shared rules look at the shared
   * layouts first, so a shared file stands on its own.
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
   * Accepts the own export format or a bare array of rules.
   * Throws an Error with a readable message.
   */
  function parseImport(text) {
    var data;
    try {
      data = typeof text === 'string' ? JSON.parse(text) : text;
    } catch (e) {
      throw new Error(BCBuddy.t('errInvalidJson', e.message));
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
    if (!rules) throw new Error(BCBuddy.t('errNoRules'));
    if (data && data.app && data.app !== EXPORT_APP) {
      throw new Error(BCBuddy.t('errOtherApp', data.app));
    }

    var normalizedRules = rules.map(normalizeRule);
    var normalizedLayouts = layouts.map(normalizeLayout);
    // A file with layouts has its rules pointed at them here. A rules-only file
    // derives nothing: after the merge, normalize() assigns the importer's own
    // first layout.
    if (normalizedLayouts.length) withDefaultLayout(normalizedLayouts, normalizedRules);

    return {
      rules: normalizedRules,
      layouts: normalizedLayouts,
      name: name
    };
  }

  /**
   * Merges imported rules with the existing ones.
   *   - if the rule already exists (same id, otherwise same name): overwrite in
   *     place, so order and therefore priority are preserved
   *   - if it is not in the list yet: append
   *   - rules that are not in the import file: leave alone
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
        // The item takes the id from the file, so a later import matches on id
        // immediately instead of on name.
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

  /** Stable, short hash to tell whether a shared file has changed. */
  function hash(input) {
    var s = typeof input === 'string' ? input : JSON.stringify(input);
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  /**
   * Turns known hosting URLs into their raw form, so a pasted
   * GitHub/Azure DevOps link just works.
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

  /**
   * Shared configuration may only be fetched over HTTPS. The file can define
   * rules that mark any site, so plain HTTP (and anything else) is refused —
   * including after rewriting a GitHub blob link to its raw form.
   */
  function resolveHostedUrl(url) {
    var target = toRawUrl(url);
    if (!target) throw new Error(BCBuddy.t('errNoUrl'));
    if (!/^https:\/\//i.test(target)) throw new Error(BCBuddy.t('errHttpsOnly'));
    return target;
  }

  /** Empty is fine; a non-empty URL must resolve to HTTPS. */
  function hostedUrlAllowed(url) {
    if (!str(url)) return true;
    try {
      resolveHostedUrl(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  BCBuddy.STORAGE_KEY = STORAGE_KEY;
  BCBuddy.SCHEMA_VERSION = SCHEMA_VERSION;
  BCBuddy.EXPORT_APP = EXPORT_APP;
  BCBuddy.PALETTE = PALETTE;
  BCBuddy.POSITIONS = POSITIONS;
  BCBuddy.isCorner = isCorner;
  BCBuddy.SYNC_INTERVAL_MINUTES = SYNC_INTERVAL_MINUTES;
  BCBuddy.DEFAULT_RIBBON_TEXT = DEFAULT_RIBBON_TEXT;
  BCBuddy.uid = uid;
  BCBuddy.newRule = newRule;
  BCBuddy.newLayout = newLayout;
  BCBuddy.draftFromContext = draftFromContext;
  BCBuddy.normalizeRule = normalizeRule;
  BCBuddy.normalizeLayout = normalizeLayout;
  BCBuddy.resolveRule = resolveRule;
  BCBuddy.effectiveLayout = effectiveLayout;
  BCBuddy.findById = findById;
  BCBuddy.DISPLAY_KEYS = DISPLAY_KEYS;
  BCBuddy.DEFAULT_LAYOUT_ID = DEFAULT_LAYOUT_ID;
  BCBuddy.normalize = normalize;
  BCBuddy.effectiveRules = effectiveRules;
  BCBuddy.loadSettings = load;
  BCBuddy.saveSettings = save;
  BCBuddy.toExport = toExport;
  BCBuddy.parseImport = parseImport;
  BCBuddy.mergeRules = mergeRules;
  BCBuddy.mergeLayouts = mergeLayouts;
  BCBuddy.hash = hash;
  BCBuddy.toRawUrl = toRawUrl;
  BCBuddy.resolveHostedUrl = resolveHostedUrl;
  BCBuddy.hostedUrlAllowed = hostedUrlAllowed;
})(typeof self !== 'undefined' ? self : this);
