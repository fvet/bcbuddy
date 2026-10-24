/*
 * BC Buddy - storage, defaults, normalisation and import/export.
 * Requires match.js (for BCBuddy.toHex).
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var STORAGE_KEY = 'settings';
  // In chrome.storage.session: the options panel to show next, set by the
  // service worker when the toolbar icon is clicked and cleared by the page.
  var OPEN_PANEL_KEY = 'openPanel';
  var EXPORT_APP = 'bc-buddy';
  var SCHEMA_VERSION = 2;
  // RFC 5321 caps an address at 254 characters.
  var MAX_EMAIL_LENGTH = 254;

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

  // 'top' and 'bottom' are full-width bars; the rest are diagonal ribbons in a
  // corner of the window. The bar at the top moves the page down rather than
  // covering it.
  var POSITIONS = ['top', 'bottom', 'top-right', 'top-left', 'bottom-right', 'bottom-left'];
  var CORNER_POSITIONS = POSITIONS.slice(2);

  function isCorner(position) {
    return CORNER_POSITIONS.indexOf(position) !== -1;
  }

  // How often the shared file is checked while the shared configuration is
  // active.
  var SYNC_INTERVAL_MINUTES = 1440;
  // While the file fails to load: wait 1, 2, 4, then 8 hours after each
  // failed try in a row, and daily after that.
  var RETRY_MINUTES = [60, 120, 240, 480];

  // The keys IT can set by policy (managed_schema.json).
  var POLICY_KEYS = ['sharedConfigUrl'];

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

  // Dropdown size is a slider position, never pixels: step 1 is BC standard
  // and every step is a factor of what BC uses (see dropdowns.js), so nobody's
  // setting needs migrating when BC changes its own size.
  var DROPDOWN_STEPS = 5;

  function step(value, fallback) {
    return Math.round(num(value, fallback, 1, DROPDOWN_STEPS));
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

  /**
   * The first `count` characters as people see them. slice() counts UTF-16
   * units, so it cuts an emoji, a flag or a letter with an accent in half and
   * leaves a broken character behind.
   */
  function leading(text, count) {
    var s = String(text == null ? '' : text);
    var parts = root.Intl && Intl.Segmenter
      ? Array.from(new Intl.Segmenter().segment(s), function (part) { return part.segment; })
      : Array.from(s);
    return parts.slice(0, count).join('');
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

  // Display settings live on styles. Colour and favicon letters stay on the rule.
  var DISPLAY_KEYS = ['border', 'banner', 'ribbon', 'title', 'favicon'];

  // Fixed id, so normalize() always yields the same result.
  var DEFAULT_STYLE_ID = 'default';

  /**
   * 0 = automatic. The old number field let people save 1 to 8 px, which
   * draws the banner text as an unreadable dash while the size slider shows
   * those values as automatic; treat them as automatic too.
   */
  function bannerFontSize(value) {
    var size = num(value, 0, 0, 72);
    return size < 9 ? 0 : size;
  }

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
        fontSize: bannerFontSize(banner.fontSize),
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
        text: leading(str(favicon.text, ''), 2) // two characters fit on a favicon
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
      // No text colour: BC Buddy always picks black or white for what is on
      // screen (BCBuddy.idealText). A textColor in an older file is dropped.
      color: BCBuddy.toHex(r.color || PALETTE[0]),
      // Each rule picks its own style; appearance comes from that style.
      styleId: str(r.styleId || r.layoutId),
      favicon: { text: leading(str(favicon.text, ''), 2) }
    };
  }

  function normalizeStyle(l) {
    l = l || {};
    var style = {
      id: str(l.id) || uid(),
      name: str(l.name, BCBuddy.t('newStyleName'))
    };
    var display = normalizeDisplay(l);
    DISPLAY_KEYS.forEach(function (key) { style[key] = display[key]; });
    // Favicon letters belong to the rule, not the style.
    style.favicon.text = '';
    return style;
  }

  function newStyle(patch) {
    var style = normalizeStyle(patch || {});
    style.id = uid();
    return style;
  }

  /**
   * The styles in stored settings or a file. Styles were called layouts
   * before, so `layouts` (and `layoutId` on a rule) still reads; only the new
   * names are written.
   */
  function stylesOf(o) {
    if (!o) return [];
    if (Array.isArray(o.styles)) return o.styles;
    return Array.isArray(o.layouts) ? o.layouts : [];
  }

  function findById(list, id) {
    var found = null;
    (list || []).forEach(function (item) {
      if (!found && item && item.id === id) found = item;
    });
    return found;
  }

  /**
   * The style that applies to this rule: the one pointed at, otherwise the
   * first in the set. That way every rule always has one.
   */
  function effectiveStyle(rule, styles, autoStyles) {
    if (!rule) return null;
    if (rule.styleId) {
      var chosen = findById(styles || [], rule.styleId);
      if (chosen) return chosen;
    }

    // Without a (valid) choice only the own set counts: a shared rule must not
    // silently pick up the reader's style.
    var auto = autoStyles === undefined ? (styles || []) : autoStyles;
    return auto.length ? auto[0] : null;
  }

  /**
   * Returns the rule as it should be drawn: display comes from the chosen
   * style. Name, conditions, colour and favicon letters stay on the rule.
   * Without a style the defaults are used, so drawing never crashes.
   */
  function resolveRule(rule, styles, autoStyles) {
    if (!rule) return rule;
    var style = effectiveStyle(rule, styles, autoStyles);
    var display = normalizeDisplay(style);
    var resolved = {};
    Object.keys(rule).forEach(function (key) {
      if (DISPLAY_KEYS.indexOf(key) === -1) resolved[key] = rule[key];
    });
    DISPLAY_KEYS.forEach(function (key) { resolved[key] = display[key]; });
    resolved.favicon = {
      enabled: display.favicon.enabled,
      text: leading(str((rule.favicon && rule.favicon.text) || '', ''), 2)
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
   * Appearance lives in styles, so every rule points at one. A configuration
   * without any styles gets a Default, so there is always something to point
   * at. Each rule keeps its own styleId. `others` are styles the rules may
   * also pick but that belong elsewhere: the shared ones, for own rules. While
   * there are some, `styles` itself may be empty.
   */
  function withDefaultStyle(styles, rules, others) {
    var available = styles.concat(others || []);
    if (!available.length) {
      var fresh = normalizeStyle({});
      fresh.id = DEFAULT_STYLE_ID;
      fresh.name = BCBuddy.t('defaultStyleName');
      styles.push(fresh);
      available = styles;
    }

    // A rule without a valid style follows the first; a valid styleId is kept.
    rules.forEach(function (rule) {
      if (!findById(available, rule.styleId)) rule.styleId = available[0].id;
    });
    return styles;
  }

  // The settings of the Web client panel. They travel in an export as
  // `webClient`, shaped exactly as they are stored. The master switch does not:
  // it belongs to whoever runs the extension.
  var WEB_CLIENT_KEYS = ['maximize', 'pinActionBar', 'dropdown', 'resizePanes', 'highlightRow',
    'stripeRows', 'noAnimations', 'hideNotifications', 'copyValues', 'weekNumbers', 'shortcuts',
    'hideFactBox'];

  function normalizeWebClient(s) {
    var maximize = s.maximize || {};
    var pinActionBar = s.pinActionBar || {};
    var dropdown = s.dropdown || {};
    var resizePanes = s.resizePanes || {};
    var highlightRow = s.highlightRow || {};
    var stripeRows = s.stripeRows || {};
    var noAnimations = s.noAnimations || {};
    var hideNotifications = s.hideNotifications || {};
    var copyValues = s.copyValues || {};
    var weekNumbers = s.weekNumbers || {};
    var shortcuts = s.shortcuts || {};
    var hideFactBox = s.hideFactBox || {};

    return {
      maximize: {
        enabled: bool(maximize.enabled, true)
      },
      pinActionBar: {
        enabled: bool(pinActionBar.enabled, true)
      },
      // Dropdowns start at the widest and tallest step.
      dropdown: {
        width: step(dropdown.width, 5),
        height: step(dropdown.height, 5)
      },
      resizePanes: {
        enabled: bool(resizePanes.enabled, true)
      },
      highlightRow: {
        enabled: bool(highlightRow.enabled, true)
      },
      // Off until asked for: it changes how every list looks.
      stripeRows: {
        enabled: bool(stripeRows.enabled, false)
      },
      // Off until asked for: it changes how BC feels, not just how it looks.
      noAnimations: {
        enabled: bool(noAnimations.enabled, false)
      },
      // Off until asked for: Business Central online uses the bell. Installs
      // that saved their settings before keep what they had.
      hideNotifications: {
        enabled: bool(hideNotifications.enabled, false)
      },
      copyValues: {
        enabled: bool(copyValues.enabled, true)
      },
      weekNumbers: {
        enabled: bool(weekNumbers.enabled, true)
      },
      shortcuts: {
        enabled: bool(shortcuts.enabled, false)
      },
      // Off until asked for: the FactBoxes are BC's own, and many people
      // read them.
      hideFactBox: {
        enabled: bool(hideFactBox.enabled, false)
      }
    };
  }

  /**
   * The Web client settings a file names, normalised; the ones it leaves out
   * stay out, so a file can share just the dropdown size. Null when it names
   * none, as every file from before they were exported.
   */
  function readWebClient(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
    var full = normalizeWebClient(source);
    var picked = null;
    WEB_CLIENT_KEYS.forEach(function (key) {
      if (!source[key] || typeof source[key] !== 'object') return;
      picked = picked || {};
      picked[key] = full[key];
    });
    return picked;
  }

  /**
   * The helpdesk address goes into a mailto: link, so it is one plain address
   * or nothing: no spaces, no second address, no ?subject= of its own.
   */
  function feedbackEmail(value) {
    var s = str(value);
    if (s.length > MAX_EMAIL_LENGTH) return '';
    return /^[^\s@<>()",;:?&=%\/\\]+@[^\s@<>()",;:?&=%\/\\]+$/.test(s) ? s : '';
  }

  /**
   * The Help & feedback part of an import or a shared file: only what it names, each
   * value checked, so a file that leaves it out leaves the local choice alone.
   * Null when the file says nothing about Help & feedback.
   */
  function readFeedback(data) {
    if (!data || typeof data !== 'object') return null;
    var picked = null;
    if (typeof data.feedbackEnabled === 'boolean') {
      picked = picked || {};
      picked.feedbackEnabled = data.feedbackEnabled;
    }
    if (feedbackEmail(data.feedbackEmail)) {
      picked = picked || {};
      picked.feedbackEmail = feedbackEmail(data.feedbackEmail);
    }
    return picked;
  }

  /** Takes over what readFeedback() found. */
  function applyFeedback(settings, incoming) {
    if (!incoming) return;
    ['feedbackEnabled', 'feedbackEmail'].forEach(function (key) {
      if (key in incoming) settings[key] = incoming[key];
    });
  }

  function normalize(settings) {
    var s = settings || {};
    var hosted = s.hosted || {};
    var webClient = normalizeWebClient(s);
    var rules = (Array.isArray(s.rules) ? s.rules : []).map(normalizeRule);
    var styles = stylesOf(s).map(normalizeStyle);
    var hostedRules = (Array.isArray(hosted.rules) ? hosted.rules : []).map(normalizeRule);
    var hostedStyles = stylesOf(hosted).map(normalizeStyle);

    var result = {
      version: SCHEMA_VERSION,
      enabled: bool(s.enabled, true)
    };
    WEB_CLIENT_KEYS.forEach(function (key) { result[key] = webClient[key]; });
    result.feedbackEnabled = bool(s.feedbackEnabled, false);
    result.feedbackEmail = feedbackEmail(s.feedbackEmail);
    if (hostedRules.length || hostedStyles.length) withDefaultStyle(hostedStyles, hostedRules);
    // Own rules may pick a shared style too, so those count as available.
    result.rules = rules;
    result.styles = withDefaultStyle(styles, rules, hostedStyles);
    result.hosted = {
      url: str(hosted.url),
      active: normalizeActive(hosted),
      rules: hostedRules,
      styles: hostedStyles,
      // What the shared file said about the Web client last time, so a sync
      // only passes on what changed; see applySharedWebClient().
      webClient: readWebClient(hosted.webClient) || {},
      sourceName: str(hosted.sourceName),
      lastSync: hosted.lastSync || null,
      lastError: hosted.lastError || null,
      // Failed tries in a row; back to 0 once the file loads.
      failures: Math.round(num(hosted.failures, 0, 0, 1000)),
      lastHash: str(hosted.lastHash)
    };
    return result;
  }

  /**
   * Effective rules: own rules first, then the shared ones (first match wins),
   * each with its style already applied. Own rules look at the own styles
   * first, shared rules at the shared ones, so an id both use resolves to the
   * set the rule came from, and a shared file stands on its own.
   */
  function effectiveRules(settings) {
    var s = normalize(settings);
    var ownStyles = s.styles.concat(s.hosted.styles);
    var own = s.rules.map(function (rule) { return resolveRule(rule, ownStyles); });
    var sharedStyles = s.hosted.styles.concat(s.styles);
    var shared = s.hosted.rules.map(function (rule) {
      return resolveRule(rule, sharedStyles, s.hosted.styles);
    });
    return own.concat(shared);
  }

  /**
   * Maximize runs only while the extension as a whole is active: switching
   * BC Buddy off must stop it clicking BC's layout controls too.
   */
  function maximizeOn(settings) {
    return !!(settings && settings.enabled &&
      settings.maximize && settings.maximize.enabled);
  }

  /** Pinning the action bar clicks BC's controls too, so it follows the master switch. */
  function pinActionBarOn(settings) {
    return !!(settings && settings.enabled &&
      settings.pinActionBar && settings.pinActionBar.enabled);
  }

  /** Hiding the FactBox pane clicks BC's controls too, so it follows the master switch. */
  function hideFactBoxOn(settings) {
    return !!(settings && settings.enabled &&
      settings.hideFactBox && settings.hideFactBox.enabled);
  }

  /** The drag handles on BC's side panes follow the master switch as well. */
  function resizePanesOn(settings) {
    return !!(settings && settings.enabled &&
      settings.resizePanes && settings.resizePanes.enabled);
  }

  /** The current-row tint follows the master switch as well, like maximize. */
  function highlightRowOn(settings) {
    return !!(settings && settings.enabled &&
      settings.highlightRow && settings.highlightRow.enabled);
  }

  /** Striped list rows follow the master switch as well. */
  function stripeRowsOn(settings) {
    return !!(settings && settings.enabled &&
      settings.stripeRows && settings.stripeRows.enabled);
  }

  /** Turning animations off follows the master switch as well. */
  function noAnimationsOn(settings) {
    return !!(settings && settings.enabled &&
      settings.noAnimations && settings.noAnimations.enabled);
  }

  /** Hiding the notifications bell follows the master switch as well. */
  function hideNotificationsOn(settings) {
    return !!(settings && settings.enabled &&
      settings.hideNotifications && settings.hideNotifications.enabled);
  }

  /** The copy icon follows the master switch as well. */
  function copyValuesOn(settings) {
    return !!(settings && settings.enabled &&
      settings.copyValues && settings.copyValues.enabled);
  }

  /** Week numbers in the date picker follow the master switch as well. */
  function weekNumbersOn(settings) {
    return !!(settings && settings.enabled &&
      settings.weekNumbers && settings.weekNumbers.enabled);
  }

  /** The keyboard shortcuts icon and panel follow the master switch as well. */
  function shortcutsOn(settings) {
    return !!(settings && settings.enabled &&
      settings.shortcuts && settings.shortcuts.enabled);
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
    var webClient = {};
    WEB_CLIENT_KEYS.forEach(function (key) { webClient[key] = s[key]; });
    // A shared style an own rule uses comes along, so the file stands on its
    // own and the rule looks the same after an import.
    var styles = s.styles.slice();
    s.rules.forEach(function (rule) {
      if (findById(styles, rule.styleId)) return;
      var shared = findById(s.hosted.styles, rule.styleId);
      if (shared) styles.push(shared);
    });
    var result = {
      app: EXPORT_APP,
      version: SCHEMA_VERSION,
      name: str(name),
      exportedAt: new Date().toISOString(),
      styles: styles,
      rules: s.rules,
      webClient: webClient
    };
    // Only a Help & feedback someone set up travels, so a file from a colleague who
    // never touched it does not switch it off for the team.
    if (s.feedbackEnabled || s.feedbackEmail) {
      result.feedbackEnabled = s.feedbackEnabled;
      if (s.feedbackEmail) result.feedbackEmail = s.feedbackEmail;
    }
    return result;
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
    var styles = [];
    var name = '';
    var webClient = null;
    if (Array.isArray(data)) {
      rules = data;
    } else if (data && Array.isArray(data.rules)) {
      rules = data.rules;
      styles = stylesOf(data);
      name = str(data.name);
      webClient = readWebClient(data.webClient);
    }
    if (!rules) throw new Error(BCBuddy.t('errNoRules'));
    if (data && data.app && data.app !== EXPORT_APP) {
      throw new Error(BCBuddy.t('errOtherApp', data.app));
    }

    var normalizedRules = rules.map(normalizeRule);
    var normalizedStyles = styles.map(normalizeStyle);
    // A file with styles has its rules pointed at them here. A rules-only file
    // derives nothing: after the merge, normalize() assigns the importer's own
    // first style.
    if (normalizedStyles.length) withDefaultStyle(normalizedStyles, normalizedRules);

    return {
      rules: normalizedRules,
      styles: normalizedStyles,
      webClient: webClient,
      feedback: Array.isArray(data) ? null : readFeedback(data),
      name: name
    };
  }

  /**
   * Takes over every Web client setting in `incoming` (from readWebClient()),
   * as an import by hand does. Returns how many actually changed.
   */
  function applyWebClient(settings, incoming) {
    var changed = 0;
    WEB_CLIENT_KEYS.forEach(function (key) {
      if (!incoming || !incoming[key]) return;
      if (JSON.stringify(settings[key]) !== JSON.stringify(incoming[key])) changed++;
      settings[key] = JSON.parse(JSON.stringify(incoming[key]));
    });
    return changed;
  }

  /**
   * The shared file's Web client settings are defaults, not orders: each one is
   * taken over on the first sync, and after that only when its value in the
   * file changes. A colleague who switches something off keeps it off until
   * the team changes that setting. Returns how many settings changed.
   */
  function applySharedWebClient(settings, incoming) {
    var previous = settings.hosted.webClient || {};
    var news = {};
    WEB_CLIENT_KEYS.forEach(function (key) {
      if (!incoming || !incoming[key]) return;
      if (JSON.stringify(previous[key]) !== JSON.stringify(incoming[key])) news[key] = incoming[key];
    });
    settings.hosted.webClient = incoming || {};
    return applyWebClient(settings, news);
  }

  /**
   * What Reset to defaults goes back to: the app's own defaults, with what the
   * shared file says on top while the shared configuration is on. A file that
   * names only some settings leaves the rest at the app's defaults. Uses what
   * the last sync stored, so it works offline. Returns every Web client key.
   */
  function webClientDefaults(settings) {
    var defaults = normalizeWebClient({});
    var hosted = settings && settings.hosted;
    var shared = hosted && hosted.active ? readWebClient(hosted.webClient) : null;
    WEB_CLIENT_KEYS.forEach(function (key) {
      if (shared && shared[key]) defaults[key] = shared[key];
    });
    return defaults;
  }

  /** The current Web client settings, as a copy (e.g. to undo a reset). */
  function webClientOf(settings) {
    var copy = {};
    WEB_CLIENT_KEYS.forEach(function (key) {
      copy[key] = JSON.parse(JSON.stringify(settings[key]));
    });
    return copy;
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

  function mergeStyles(current, incoming) {
    var merged = mergeItems(current, incoming, normalizeStyle);
    return { styles: merged.items, stats: merged.stats };
  }

  /** The item in `items` with the same id, otherwise the same name, or null. */
  function findSame(items, item) {
    var name = item.name.trim().toLowerCase();
    return items.filter(function (other) { return other.id === item.id; })[0] ||
      (name && items.filter(function (other) {
        return other.name.trim().toLowerCase() === name;
      })[0]) || null;
  }

  /**
   * Adds the sample rules (parsed with parseImport) to `settings` as own
   * rules. Unlike an import nothing is overwritten: a sample whose id or name
   * you already use is skipped, and a sample style you already have by name
   * is not added again; the sample rules then point at yours. A bare Default
   * no rule uses yet gives way to the sample styles. Returns how many rules
   * were added and skipped, and how many styles were added.
   *
   * A sample you deleted comes back where it was among the samples you kept:
   * before the next sample in the file you still have, otherwise after the
   * previous one. Samples you have none of go after your own rules.
   */
  function addSamples(settings, samples) {
    var rules = settings.rules.slice();
    // Nothing set up yet: the sample styles replace the bare Default.
    var styles = untouched(settings) ? [] : settings.styles.slice();
    var styleIds = {};
    var stats = { added: 0, skipped: 0, styles: 0 };

    samples.styles.forEach(function (style) {
      var mine = findSame(styles, style);
      styleIds[style.id] = mine ? mine.id : style.id;
      if (mine) return;
      styles.push(style);
      stats.styles++;
    });
    var at = -1; // where the next sample goes: after the last one placed
    samples.rules.forEach(function (sample, index) {
      var mine = findSame(rules, sample);
      if (mine) {
        at = rules.indexOf(mine) + 1;
        // A sample the install put there, off and as it came: Load samples
        // switches it on, as if it had just been added.
        if (!mine.enabled && isSample(mine, sample, styleIds)) {
          mine.enabled = true;
          stats.added++;
        } else {
          stats.skipped++;
        }
        return;
      }
      if (at < 0) {
        // No earlier sample yet: just before the first later one you have.
        var next = null;
        for (var i = index + 1; i < samples.rules.length && !next; i++) {
          next = findSame(rules, samples.rules[i]);
        }
        at = next ? rules.indexOf(next) : rules.length;
      }
      var rule = normalizeRule(sample);
      if (styleIds[rule.styleId]) rule.styleId = styleIds[rule.styleId];
      rules.splice(at, 0, rule);
      at++;
      stats.added++;
    });

    // A sample style you lack comes along even when every rule is skipped, so
    // someone who loaded the samples before the styles existed gets them too.
    if (stats.added) settings.rules = rules;
    if (stats.added || stats.styles) {
      settings.styles = withDefaultStyle(styles, settings.rules,
        settings.hosted && settings.hosted.styles);
    }
    return stats;
  }

  // The packaged sample styles by id, with the message that names them.
  var SAMPLE_STYLE_NAMES = { full: 'fullStyleName', subtle: 'subtleStyleName' };

  /**
   * Names the packaged sample styles in the language BC Buddy is in, so
   * someone who installs it in Dutch gets Volledig and Subtiel. Only for the
   * packaged samples file: a shared or imported file keeps its own names.
   */
  function localizeSamples(samples) {
    samples.styles.forEach(function (style) {
      if (!Object.prototype.hasOwnProperty.call(SAMPLE_STYLE_NAMES, style.id)) return;
      var key = SAMPLE_STYLE_NAMES[style.id];
      var name = BCBuddy.t(key);
      if (name && name !== key) style.name = name;
    });
    return samples;
  }

  /**
   * A first install starts with the samples (parsed with parseImport): their
   * styles instead of the bare Default, and their rules switched off, so
   * nothing gets coloured until someone turns a rule on. That matters when IT
   * installs BC Buddy on many computers at once. Only while nothing is set up
   * yet: no own rules and only that Default. Returns true when it added them.
   */
  function seedSamples(settings, samples) {
    if (!untouched(settings) || !samples.styles.length) return false;
    settings.styles = samples.styles.slice();
    settings.rules = samples.rules.map(function (sample) {
      var rule = normalizeRule(sample);
      rule.enabled = false;
      return rule;
    });
    withDefaultStyle(settings.styles, settings.rules);
    return true;
  }

  /**
   * Shared rules take over from the samples: the own rules that are still a
   * sample as it came (on or off, but nothing else changed) are removed. For
   * the sync that brings the first shared rules. Returns how many went.
   */
  function dropSamples(settings, samples) {
    var before = settings.rules.length;
    settings.rules = settings.rules.filter(function (rule) {
      return !samples.rules.some(function (sample) {
        return sample.id === rule.id && isSample(rule, sample);
      });
    });
    return before - settings.rules.length;
  }

  /**
   * Whether `rule` is `sample` with nothing edited but its on/off switch.
   * `styleIds` maps a sample style to the one it was added as, if not itself.
   */
  function isSample(rule, sample, styleIds) {
    function look(r, styleId) {
      return JSON.stringify([r.name, r.conditions, r.color, styleId, r.favicon]);
    }
    var styleId = (styleIds && styleIds[sample.styleId]) || sample.styleId;
    return look(normalizeRule(rule), rule.styleId) === look(normalizeRule(sample), styleId);
  }

  /** No own rules and only the Default that normalize() adds. */
  function untouched(settings) {
    var styles = settings.styles;
    return !settings.rules.length && styles.length === 1 && styles[0].id === DEFAULT_STYLE_ID;
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

  /**
   * How often to check the shared file. Daily once it has loaded. Before the
   * first try, hourly. While it fails, 1, 2, 4 and 8 hours after each failed
   * try in a row, then daily: a laptop that was offline when the address
   * arrived soon gets its colours, and an address that stays broken settles
   * at one request a day.
   */
  function syncIntervalMinutes(hosted) {
    if (hosted && hosted.lastSync && !hosted.lastError) return SYNC_INTERVAL_MINUTES;
    var failures = hosted && hosted.lastError ? Math.max(1, hosted.failures || 0) : 0;
    if (!failures) return RETRY_MINUTES[0];
    return failures <= RETRY_MINUTES.length ? RETRY_MINUTES[failures - 1] : SYNC_INTERVAL_MINUTES;
  }

  /**
   * IT can set the shared file by browser policy (managed storage, see
   * managed_schema.json). Returns the address to use, or '' when there is no
   * policy or its value is not an HTTPS address — that one is ignored rather
   * than locking the field on something that can never sync.
   */
  function policyUrl(policy) {
    var raw = str(policy && policy.sharedConfigUrl).trim();
    if (!raw) return '';
    try {
      return resolveHostedUrl(raw);
    } catch (e) {
      return '';
    }
  }

  /** Reads the policy; resolves to {} where there is none or no managed storage. */
  function readPolicy() {
    var area = root.chrome && chrome.storage && chrome.storage.managed;
    if (!area) return Promise.resolve({});
    return area.get(POLICY_KEYS).then(function (obj) { return obj || {}; }, function () { return {}; });
  }

  /**
   * Puts the policy's address in place and keeps the shared configuration on.
   * Returns true when something changed and the settings need saving. Without
   * a policy nothing changes: removing it unlocks the field, and the address
   * and shared rules stay as they are.
   */
  function applyPolicy(settings, policy) {
    var url = policyUrl(policy);
    var hosted = settings.hosted;
    if (!url || (hosted.url === url && hosted.active)) return false;
    hosted.url = url;
    hosted.active = true;
    return true;
  }

  BCBuddy.STORAGE_KEY = STORAGE_KEY;
  BCBuddy.OPEN_PANEL_KEY = OPEN_PANEL_KEY;
  BCBuddy.SCHEMA_VERSION = SCHEMA_VERSION;
  BCBuddy.EXPORT_APP = EXPORT_APP;
  BCBuddy.PALETTE = PALETTE;
  BCBuddy.POSITIONS = POSITIONS;
  BCBuddy.DROPDOWN_STEPS = DROPDOWN_STEPS;
  BCBuddy.WEB_CLIENT_KEYS = WEB_CLIENT_KEYS;
  BCBuddy.isCorner = isCorner;
  BCBuddy.SYNC_INTERVAL_MINUTES = SYNC_INTERVAL_MINUTES;
  BCBuddy.syncIntervalMinutes = syncIntervalMinutes;
  BCBuddy.policyUrl = policyUrl;
  BCBuddy.readPolicy = readPolicy;
  BCBuddy.applyPolicy = applyPolicy;
  BCBuddy.DEFAULT_RIBBON_TEXT = DEFAULT_RIBBON_TEXT;
  BCBuddy.uid = uid;
  BCBuddy.leading = leading;
  BCBuddy.newRule = newRule;
  BCBuddy.newStyle = newStyle;
  BCBuddy.draftFromContext = draftFromContext;
  BCBuddy.normalizeRule = normalizeRule;
  BCBuddy.normalizeStyle = normalizeStyle;
  BCBuddy.resolveRule = resolveRule;
  BCBuddy.effectiveStyle = effectiveStyle;
  BCBuddy.findById = findById;
  BCBuddy.DISPLAY_KEYS = DISPLAY_KEYS;
  BCBuddy.DEFAULT_STYLE_ID = DEFAULT_STYLE_ID;
  BCBuddy.normalize = normalize;
  BCBuddy.effectiveRules = effectiveRules;
  BCBuddy.maximizeOn = maximizeOn;
  BCBuddy.pinActionBarOn = pinActionBarOn;
  BCBuddy.hideFactBoxOn = hideFactBoxOn;
  BCBuddy.resizePanesOn = resizePanesOn;
  BCBuddy.highlightRowOn = highlightRowOn;
  BCBuddy.stripeRowsOn = stripeRowsOn;
  BCBuddy.noAnimationsOn = noAnimationsOn;
  BCBuddy.hideNotificationsOn = hideNotificationsOn;
  BCBuddy.copyValuesOn = copyValuesOn;
  BCBuddy.weekNumbersOn = weekNumbersOn;
  BCBuddy.shortcutsOn = shortcutsOn;
  BCBuddy.loadSettings = load;
  BCBuddy.saveSettings = save;
  BCBuddy.toExport = toExport;
  BCBuddy.parseImport = parseImport;
  BCBuddy.mergeRules = mergeRules;
  BCBuddy.mergeStyles = mergeStyles;
  BCBuddy.addSamples = addSamples;
  BCBuddy.seedSamples = seedSamples;
  BCBuddy.dropSamples = dropSamples;
  BCBuddy.localizeSamples = localizeSamples;
  // Packaged with the extension and the same file as the shared example on
  // the site, so there is one copy of the samples.
  BCBuddy.SAMPLES_PATH = 'examples/bc-buddy.json';
  BCBuddy.applyWebClient = applyWebClient;
  BCBuddy.applySharedWebClient = applySharedWebClient;
  BCBuddy.applyFeedback = applyFeedback;
  BCBuddy.webClientDefaults = webClientDefaults;
  BCBuddy.webClientOf = webClientOf;
  BCBuddy.hash = hash;
  BCBuddy.toRawUrl = toRawUrl;
  BCBuddy.resolveHostedUrl = resolveHostedUrl;
  BCBuddy.hostedUrlAllowed = hostedUrlAllowed;
})(typeof self !== 'undefined' ? self : this);
