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
  // 3: one switch per area (webClientEnabled, environmentsEnabled,
  // feedbackEnabled) instead of one for the whole extension, and no on/off
  // switch per rule: a rule that exists is active. See migrate().
  var SCHEMA_VERSION = 3;
  // RFC 5321 caps an address at 254 characters.
  var MAX_EMAIL_LENGTH = 254;

  // Help & feedback: the priorities the report form offers, and its subjects.
  // null as the list means the built-in one, whose values the side panel
  // shows translated; [] means no priority field at all.
  var BUILTIN_PRIORITIES = ['Normal', 'High', 'Critical'];
  var DEFAULT_PRIORITY = 'Normal';
  var MAX_PRIORITIES = 6;
  var MAX_PRIORITY_LENGTH = 40;
  var MAX_SUBJECT_LENGTH = 200;
  // The notice shown when someone picks the most urgent priority, and the
  // link it may carry: an https: address or a tel: number.
  var MAX_URGENT_TEXT_LENGTH = 200;
  var MAX_URGENT_LINK_LENGTH = 500;
  var MAX_TEL_LENGTH = 30;
  // Line breaks, control characters and the bidi overrides that make text
  // read differently from what it holds. Text with any of them is refused.
  var UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;

  // The switch of each area. The Help & feedback switch is one of the
  // FEEDBACK_KEYS, because it travels and locks with the rest of that area.
  var AREA_KEYS = ['webClientEnabled', 'environmentsEnabled'];
  var FEEDBACK_KEYS = ['feedbackEnabled', 'feedbackEmail', 'feedbackPriorities',
    'feedbackDefaultPriority', 'feedbackSubjectBug', 'feedbackSubjectIdea',
    'feedbackUrgentText', 'feedbackUrgentLink'];

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

  // The keys IT can set by policy (managed_schema.json). Every one of them is
  // locked while the policy sets a valid value.
  var POLICY_KEYS = ['sharedConfigUrl'].concat(AREA_KEYS, FEEDBACK_KEYS);

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
      // No on/off switch: a rule that exists is active. Rules that say
      // enabled: false are dropped before they get here (liveRules()).
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

  /**
   * The rules in a list from storage, an import or the shared file without
   * the ones an older version had switched off: that switch is gone, and a
   * rule that was off must not start colouring a page by itself.
   */
  function liveRules(list) {
    return (Array.isArray(list) ? list : []).filter(function (r) {
      return !(r && typeof r === 'object' && r.enabled === false);
    });
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
  // `webClient`, shaped exactly as they are stored. The area's own switch
  // (webClientEnabled) does not: it belongs to whoever runs the extension.
  // The keyboard shortcuts have no switch: they come with the area.
  var WEB_CLIENT_KEYS = ['maximize', 'pinActionBar', 'dropdown', 'resizePanes', 'highlightRow',
    'stripeRows', 'noAnimations', 'hideNotifications', 'copyValues', 'weekNumbers',
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

  function has(o, key) {
    return !!o && Object.prototype.hasOwnProperty.call(o, key);
  }

  function copy(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  /**
   * One line of plain text of at most `max` characters, trimmed, or null when
   * it is not a string, is too long, or holds a line break, a control
   * character or a bidi override. The text ends up in a form, a subject line
   * and a mailto: link, so it is refused rather than repaired.
   */
  function plainText(value, max) {
    if (typeof value !== 'string') return null;
    var s = value.trim();
    if (UNSAFE_TEXT.test(s) || Array.from(s).length > max) return null;
    return s;
  }

  /**
   * The priorities the report form offers. null (or anything that is not a
   * list) is the built-in list; [] is no priority field. Otherwise 1 to
   * MAX_PRIORITIES names, each plain text of at most MAX_PRIORITY_LENGTH
   * characters, each once (ignoring case). A list in which nothing is valid
   * falls back to the built-in one rather than hiding the field.
   */
  function cleanPriorities(value) {
    if (!Array.isArray(value)) return null;
    if (!value.length) return [];
    var out = [];
    for (var i = 0; i < value.length && out.length < MAX_PRIORITIES; i++) {
      var name = plainText(value[i], MAX_PRIORITY_LENGTH);
      if (!name) continue;
      var lower = name.toLowerCase();
      if (out.some(function (other) { return other.toLowerCase() === lower; })) continue;
      out.push(name);
    }
    return out.length ? out : null;
  }

  /** The priority values in effect: the list itself, or the built-in one for null. */
  function priorityValues(list) {
    return (list === null || list === undefined ? BUILTIN_PRIORITIES : list).slice();
  }

  /**
   * The priority the form starts on: one of the values of `list` (as spelled
   * there), or '' for none. Anything else, or anything when there is no
   * priority field, is ''.
   */
  function cleanDefaultPriority(value, list) {
    var name = plainText(value, MAX_PRIORITY_LENGTH);
    if (!name) return '';
    var lower = name.toLowerCase();
    var values = priorityValues(list);
    for (var i = 0; i < values.length; i++) {
      if (values[i].toLowerCase() === lower) return values[i];
    }
    return '';
  }

  /**
   * A subject line for the report email, with the side panel's placeholders
   * ({prio} {type} {company} {environment} {tenant} {title}) left as they
   * are. '' means the built-in subject, and so does anything invalid.
   */
  function cleanSubject(value) {
    return plainText(value, MAX_SUBJECT_LENGTH) || '';
  }

  /** The notice for the most urgent priority: one line of plain text, or ''. */
  function cleanUrgentText(value) {
    return plainText(value, MAX_URGENT_TEXT_LENGTH) || '';
  }

  /**
   * The link on that notice, or '' for none. Only two kinds pass: an https:
   * address without spaces or a user name or password in it, and a tel:
   * number of digits, spaces, +, (, ), - and dots. Anything else (http:,
   * javascript:, data:, mailto:, ...) is '', so the notice has no link.
   */
  function cleanUrgentLink(value) {
    if (typeof value !== 'string') return '';
    var s = value.trim();
    if (!s || UNSAFE_TEXT.test(s)) return '';
    if (/^tel:/i.test(s)) {
      var number = s.slice(4);
      if (!number || number.length > MAX_TEL_LENGTH) return '';
      if (!/^[+0-9 ().\-]+$/.test(number) || !/[0-9]/.test(number)) return '';
      return 'tel:' + number;
    }
    if (s.length > MAX_URGENT_LINK_LENGTH || /\s/.test(s) || !/^https:\/\//i.test(s)) return '';
    var url;
    try { url = new URL(s); } catch (e) { return ''; }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    return url.href.length > MAX_URGENT_LINK_LENGTH ? '' : url.href;
  }

  /**
   * The Help & feedback fields of stored settings, each checked. A default
   * priority that was never stored is Normal; one that is not in the list is
   * none.
   */
  function normalizeFeedback(s) {
    var priorities = cleanPriorities(s.feedbackPriorities);
    var defaultPriority = s.feedbackDefaultPriority === undefined
      ? DEFAULT_PRIORITY : s.feedbackDefaultPriority;
    return {
      feedbackEnabled: bool(s.feedbackEnabled, false),
      feedbackEmail: feedbackEmail(s.feedbackEmail),
      feedbackPriorities: priorities,
      feedbackDefaultPriority: cleanDefaultPriority(defaultPriority, priorities),
      feedbackSubjectBug: cleanSubject(s.feedbackSubjectBug),
      feedbackSubjectIdea: cleanSubject(s.feedbackSubjectIdea),
      feedbackUrgentText: cleanUrgentText(s.feedbackUrgentText),
      feedbackUrgentLink: cleanUrgentLink(s.feedbackUrgentLink)
    };
  }

  /** Checks the Help & feedback fields again in place, e.g. after a lock wrote some. */
  function tidyFeedback(settings) {
    var clean = normalizeFeedback(settings);
    FEEDBACK_KEYS.forEach(function (key) { settings[key] = clean[key]; });
  }

  /**
   * The Help & feedback part of an import or a shared file: only what it
   * names, each value checked, so a file that leaves it out leaves the local
   * choice alone. Null when the file says nothing about Help & feedback. The
   * default priority is checked against the list once it is applied.
   */
  function readFeedback(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    var picked = null;
    function take(key, value) {
      picked = picked || {};
      picked[key] = value;
    }
    if (typeof data.feedbackEnabled === 'boolean') take('feedbackEnabled', data.feedbackEnabled);
    if (feedbackEmail(data.feedbackEmail)) take('feedbackEmail', feedbackEmail(data.feedbackEmail));
    if (data.feedbackPriorities === null || Array.isArray(data.feedbackPriorities)) {
      take('feedbackPriorities', cleanPriorities(data.feedbackPriorities));
    }
    var priority = plainText(data.feedbackDefaultPriority, MAX_PRIORITY_LENGTH);
    if (priority !== null) take('feedbackDefaultPriority', priority);
    ['feedbackSubjectBug', 'feedbackSubjectIdea'].forEach(function (key) {
      if (typeof data[key] === 'string') take(key, cleanSubject(data[key]));
    });
    if (typeof data.feedbackUrgentText === 'string') {
      take('feedbackUrgentText', cleanUrgentText(data.feedbackUrgentText));
    }
    if (typeof data.feedbackUrgentLink === 'string') {
      take('feedbackUrgentLink', cleanUrgentLink(data.feedbackUrgentLink));
    }
    return picked;
  }

  /**
   * Takes over what readFeedback() found, except the keys in `locked` (from
   * lockedKeys()): those stay as IT or the shared file set them. Returns the
   * locked keys the file tried to change, so the page can say so.
   */
  function applyFeedback(settings, incoming, locked) {
    var skipped = [];
    if (!incoming) return skipped;
    FEEDBACK_KEYS.forEach(function (key) {
      if (!has(incoming, key)) return;
      if (locked && has(locked, key)) {
        if (JSON.stringify(settings[key]) !== JSON.stringify(incoming[key])) skipped.push(key);
        return;
      }
      settings[key] = copy(incoming[key]);
    });
    tidyFeedback(settings);
    return skipped;
  }

  /**
   * The area switches a file names (webClientEnabled, environmentsEnabled),
   * or null when it names none. Export leaves them out; IT may add them to a
   * shared file as the team's defaults.
   */
  function readAreas(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    var picked = null;
    AREA_KEYS.forEach(function (key) {
      if (typeof data[key] !== 'boolean') return;
      picked = picked || {};
      picked[key] = data[key];
    });
    return picked;
  }

  /** Like applyFeedback(), for the area switches. Returns the locked keys it skipped. */
  function applyAreas(settings, incoming, locked) {
    var skipped = [];
    AREA_KEYS.forEach(function (key) {
      if (!incoming || typeof incoming[key] !== 'boolean') return;
      if (locked && has(locked, key)) {
        if (settings[key] !== incoming[key]) skipped.push(key);
        return;
      }
      settings[key] = incoming[key];
    });
    return skipped;
  }

  /**
   * The area switches of a shared file (parsed with parseImport), as team
   * defaults. A file with rules that does not say otherwise means environment
   * colours on: that is what sharing rules is for, and what every version
   * before the area switches did.
   */
  function sharedAreas(parsed) {
    var areas = (parsed && readAreas(parsed.areas)) || {};
    if (parsed && parsed.rules && parsed.rules.length && !has(areas, 'environmentsEnabled')) {
      areas.environmentsEnabled = true;
    }
    return areas;
  }

  /**
   * The shared file's area switches are defaults, like its Web client
   * settings (applySharedWebClient): each is taken over on the first sync and
   * after that only when its value in the file changes. Keys in `locked` (a
   * policy) are left alone. Returns how many switches changed.
   */
  function applySharedAreas(settings, incoming, locked) {
    var previous = settings.hosted.areas || {};
    var news = {};
    var changed = 0;
    AREA_KEYS.forEach(function (key) {
      if (!incoming || typeof incoming[key] !== 'boolean' || previous[key] === incoming[key]) return;
      news[key] = incoming[key];
      if (settings[key] !== incoming[key] && !(locked && has(locked, key))) changed++;
    });
    settings.hosted.areas = readAreas(incoming) || {};
    applyAreas(settings, news, locked);
    return changed;
  }

  /**
   * Settings stored by a version before the area switches: something is
   * stored, but no webClientEnabled. Nothing stored at all is a new install.
   */
  function isLegacy(s) {
    return !!s && typeof s === 'object' && !Array.isArray(s) &&
      Object.keys(s).length > 0 && typeof s.webClientEnabled !== 'boolean';
  }

  /**
   * Brings settings from before the area switches over, for normalize().
   * The master switch becomes the Web client switch. Environment colours are
   * on only when the master switch was and something coloured: an own rule
   * that was on, or a shared file with rules. Then the own rules that were
   * off are dropped, since a rule can no longer be off and a wrong colour on
   * Production is worse than a lost rule nobody used; with the area off, all
   * own rules stay, as they colour nothing. Help & feedback stays on only if
   * both it and the master switch were. Reading the same old settings again
   * gives the same answer, and the result is no longer legacy.
   */
  function migrate(s) {
    var on = s.enabled !== false;
    var hosted = s.hosted && typeof s.hosted === 'object' ? s.hosted : {};
    var ownLive = liveRules(s.rules);
    var sharedLive = normalizeActive(hosted) && liveRules(hosted.rules).length > 0;
    var environments = on && (ownLive.length > 0 || sharedLive);
    return {
      webClientEnabled: on,
      environmentsEnabled: environments,
      feedbackEnabled: on && s.feedbackEnabled === true,
      rules: environments ? ownLive : (Array.isArray(s.rules) ? s.rules : []),
      // What the shared file implied before (sharedAreas()), so the next sync
      // does not count it as new and turn colours on behind the user's back.
      hostedAreas: sharedLive ? { environmentsEnabled: true } : {}
    };
  }

  function normalize(settings) {
    var s = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
    var hosted = s.hosted && typeof s.hosted === 'object' ? s.hosted : {};
    var legacy = isLegacy(s) ? migrate(s) : null;
    var webClient = normalizeWebClient(s);
    var rules = (legacy ? legacy.rules : liveRules(s.rules)).map(normalizeRule);
    var styles = stylesOf(s).map(normalizeStyle);
    var hostedRules = liveRules(hosted.rules).map(normalizeRule);
    var hostedStyles = stylesOf(hosted).map(normalizeStyle);
    var feedback = normalizeFeedback(s);

    var result = {
      version: SCHEMA_VERSION,
      // A new install starts with the Web client on and environment colours
      // off: nothing gets coloured until someone (or IT) turns that on.
      webClientEnabled: legacy ? legacy.webClientEnabled : bool(s.webClientEnabled, true),
      environmentsEnabled: legacy ? legacy.environmentsEnabled : bool(s.environmentsEnabled, false)
    };
    if (legacy) feedback.feedbackEnabled = legacy.feedbackEnabled;
    WEB_CLIENT_KEYS.forEach(function (key) { result[key] = webClient[key]; });
    FEEDBACK_KEYS.forEach(function (key) { result[key] = feedback[key]; });
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
      // The same for the area switches; see applySharedAreas().
      areas: readAreas(hosted.areas) || (legacy ? legacy.hostedAreas : {}),
      // The Help & feedback values the file sets. Unlike the rest these are
      // locked while the shared configuration is active; see applySharedLocks().
      feedback: readFeedback(hosted.feedback) || {},
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
   * The three areas, each with its own switch. Only a stored true counts, so
   * settings that never went through normalize() switch nothing on.
   *   Web client: the tweaks to Business Central itself, and its shortcuts.
   *   Environment colours: own and shared rules, on every site.
   *   Help & feedback: the report form in the side panel.
   */
  function webClientOn(settings) {
    return !!(settings && settings.webClientEnabled === true);
  }

  function environmentsOn(settings) {
    return !!(settings && settings.environmentsEnabled === true);
  }

  function feedbackOn(settings) {
    return !!(settings && settings.feedbackEnabled === true);
  }

  /**
   * One Web client tweak: on only while the Web client area is, so switching
   * the area off stops it clicking BC's layout controls too.
   */
  function tweakOn(settings, key) {
    return webClientOn(settings) && !!(settings[key] && settings[key].enabled);
  }

  function maximizeOn(settings) { return tweakOn(settings, 'maximize'); }
  function pinActionBarOn(settings) { return tweakOn(settings, 'pinActionBar'); }
  function hideFactBoxOn(settings) { return tweakOn(settings, 'hideFactBox'); }
  function resizePanesOn(settings) { return tweakOn(settings, 'resizePanes'); }
  function highlightRowOn(settings) { return tweakOn(settings, 'highlightRow'); }
  function stripeRowsOn(settings) { return tweakOn(settings, 'stripeRows'); }
  function noAnimationsOn(settings) { return tweakOn(settings, 'noAnimations'); }
  function hideNotificationsOn(settings) { return tweakOn(settings, 'hideNotifications'); }
  function copyValuesOn(settings) { return tweakOn(settings, 'copyValues'); }
  function weekNumbersOn(settings) { return tweakOn(settings, 'weekNumbers'); }

  /** The keyboard shortcuts have no switch of their own: they come with the Web client. */
  function shortcutsOn(settings) {
    return webClientOn(settings);
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
    // never touched it does not switch it off for the team. The area switches
    // stay out: they belong to whoever runs the extension.
    if (feedbackSetUp(s)) {
      FEEDBACK_KEYS.forEach(function (key) {
        if (key === 'feedbackEmail' && !s.feedbackEmail) return;
        result[key] = copy(s[key]);
      });
    }
    return result;
  }

  /** Whether any Help & feedback field differs from a new install's. */
  function feedbackSetUp(s) {
    var fresh = normalizeFeedback({});
    return FEEDBACK_KEYS.some(function (key) {
      return JSON.stringify(s[key]) !== JSON.stringify(fresh[key]);
    });
  }

  /**
   * Accepts the own export format or a bare array of rules. Rules an older
   * version had switched off are left out (see liveRules()).
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

    var normalizedRules = liveRules(rules).map(normalizeRule);
    var normalizedStyles = styles.map(normalizeStyle);
    // A file with styles has its rules pointed at them here. A rules-only file
    // derives nothing: after the merge, normalize() assigns the importer's own
    // first style.
    if (normalizedStyles.length) withDefaultStyle(normalizedStyles, normalizedRules);

    return {
      rules: normalizedRules,
      styles: normalizedStyles,
      webClient: webClient,
      areas: Array.isArray(data) ? null : readAreas(data),
      feedback: Array.isArray(data) ? null : readFeedback(data),
      name: name
    };
  }

  /**
   * An import by hand (parsed with parseImport) into `settings`: styles and
   * rules merged, the file's Web client settings, area switches and Help &
   * feedback taken over, except the keys in `locked` (from lockedKeys()),
   * which IT or the shared file set. Returns
   * { rules: stats, styles: stats, webClient: changed, skipped: [keys] }.
   */
  function applyImported(settings, parsed, locked) {
    // Styles first, so rules can point at something that already exists.
    var styles = mergeStyles(settings.styles, parsed.styles);
    settings.styles = styles.styles;
    var rules = mergeRules(settings.rules, parsed.rules);
    settings.rules = rules.rules;
    var webClient = applyWebClient(settings, parsed.webClient);
    var skipped = applyAreas(settings, parsed.areas, locked)
      .concat(applyFeedback(settings, parsed.feedback, locked));
    return { rules: rules.stats, styles: styles.stats, webClient: webClient, skipped: skipped };
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
        stats.skipped++;
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
   * styles instead of the bare Default, and their rules. Nothing gets
   * coloured, because environment colours start off until someone turns
   * them on. That matters when IT installs BC Buddy on many computers at
   * once. Only while nothing is set up yet: no own rules and only that
   * Default. Returns true when it added them.
   */
  function seedSamples(settings, samples) {
    if (!untouched(settings) || !samples.styles.length) return false;
    settings.styles = samples.styles.slice();
    settings.rules = samples.rules.map(normalizeRule);
    withDefaultStyle(settings.styles, settings.rules);
    return true;
  }

  /**
   * Shared rules take over from the samples: the own rules that are still a
   * sample as it came (nothing changed) are removed. For
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
   * Whether `rule` is `sample` with nothing edited.
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
   * The values the policy sets, each checked like any other value. A value
   * that does not pass is left out rather than locking a field on something
   * unusable, and so is an empty text. Returns { key: value } for the keys of
   * POLICY_KEYS that the policy sets validly; sharedConfigUrl already in its
   * raw form.
   */
  function policyValues(policy) {
    var values = {};
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return values;
    var url = policyUrl(policy);
    if (url) values.sharedConfigUrl = url;
    AREA_KEYS.concat('feedbackEnabled').forEach(function (key) {
      if (typeof policy[key] === 'boolean') values[key] = policy[key];
    });
    var email = feedbackEmail(policy.feedbackEmail);
    if (email) values.feedbackEmail = email;
    // An empty list is a choice (no priority field); one with nothing valid
    // in it is not.
    var priorities = cleanPriorities(policy.feedbackPriorities);
    if (priorities) values.feedbackPriorities = priorities;
    var priority = plainText(policy.feedbackDefaultPriority, MAX_PRIORITY_LENGTH);
    if (priority) values.feedbackDefaultPriority = priority;
    ['feedbackSubjectBug', 'feedbackSubjectIdea'].forEach(function (key) {
      var subject = cleanSubject(policy[key]);
      if (subject) values[key] = subject;
    });
    var urgentText = cleanUrgentText(policy.feedbackUrgentText);
    if (urgentText) values.feedbackUrgentText = urgentText;
    var urgentLink = cleanUrgentLink(policy.feedbackUrgentLink);
    if (urgentLink) values.feedbackUrgentLink = urgentLink;
    return values;
  }

  /**
   * Which settings someone else decides, for the options page to show them
   * read-only: an object from setting name to 'policy' or 'shared'. Policy
   * first: every key the policy sets validly (sharedConfigUrl among them),
   * so a missing key is not locked. Then, while the shared
   * configuration is active, the Help & feedback keys the shared file names.
   * The shared file's area switches and Web client settings are defaults,
   * never locked.
   */
  function lockedKeys(settings, policy) {
    var locked = {};
    Object.keys(policyValues(policy)).forEach(function (key) { locked[key] = 'policy'; });
    var hosted = settings && settings.hosted;
    if (hosted && hosted.active && hosted.feedback) {
      FEEDBACK_KEYS.forEach(function (key) {
        if (!has(locked, key) && has(hosted.feedback, key)) locked[key] = 'shared';
      });
    }
    return locked;
  }

  /** What the locks guard, to tell whether applying them changed anything. */
  function lockedState(settings) {
    var state = { url: settings.hosted.url, active: settings.hosted.active };
    AREA_KEYS.concat(FEEDBACK_KEYS).forEach(function (key) { state[key] = settings[key]; });
    return JSON.stringify(state);
  }

  /**
   * Puts what the policy sets in place: the address (and keeps the shared
   * configuration on), the area switches and Help & feedback. Returns true
   * when something changed and the settings need saving. Without a policy
   * nothing changes: removing it unlocks the fields, and the values stay as
   * they are. The result is normalised, so saving it and applying the policy
   * again changes nothing: the service worker can re-apply it after every
   * write without a loop.
   */
  function applyPolicy(settings, policy) {
    var values = policyValues(policy);
    var before = lockedState(settings);
    if (values.sharedConfigUrl) {
      settings.hosted.url = values.sharedConfigUrl;
      settings.hosted.active = true;
    }
    AREA_KEYS.concat(FEEDBACK_KEYS).forEach(function (key) {
      if (has(values, key)) settings[key] = copy(values[key]);
    });
    tidyFeedback(settings);
    return lockedState(settings) !== before;
  }

  /**
   * While the shared configuration is active, the Help & feedback values the
   * shared file names are the team's: they are written over the local ones,
   * except where the policy sets its own. Returns true when something changed.
   */
  function applySharedLocks(settings, policy) {
    var hosted = settings.hosted;
    if (!hosted || !hosted.active || !hosted.feedback) return false;
    var byPolicy = policyValues(policy);
    var before = lockedState(settings);
    FEEDBACK_KEYS.forEach(function (key) {
      if (has(hosted.feedback, key) && !has(byPolicy, key)) settings[key] = copy(hosted.feedback[key]);
    });
    tidyFeedback(settings);
    return lockedState(settings) !== before;
  }

  /**
   * Policy, then the shared file, over whatever was written locally. The
   * service worker runs this after every settings write, so a value someone
   * changed around the lock (an options page open before the policy came, an
   * edited export) is put back. Returns true when the settings need saving.
   */
  function enforceLocks(settings, policy) {
    var byPolicy = applyPolicy(settings, policy);
    var byShared = applySharedLocks(settings, policy);
    return byPolicy || byShared;
  }

  BCBuddy.STORAGE_KEY = STORAGE_KEY;
  BCBuddy.OPEN_PANEL_KEY = OPEN_PANEL_KEY;
  BCBuddy.SCHEMA_VERSION = SCHEMA_VERSION;
  BCBuddy.EXPORT_APP = EXPORT_APP;
  BCBuddy.PALETTE = PALETTE;
  BCBuddy.POSITIONS = POSITIONS;
  BCBuddy.DROPDOWN_STEPS = DROPDOWN_STEPS;
  BCBuddy.WEB_CLIENT_KEYS = WEB_CLIENT_KEYS;
  BCBuddy.AREA_KEYS = AREA_KEYS;
  BCBuddy.FEEDBACK_KEYS = FEEDBACK_KEYS;
  BCBuddy.POLICY_KEYS = POLICY_KEYS;
  BCBuddy.BUILTIN_PRIORITIES = BUILTIN_PRIORITIES;
  BCBuddy.MAX_PRIORITIES = MAX_PRIORITIES;
  BCBuddy.MAX_PRIORITY_LENGTH = MAX_PRIORITY_LENGTH;
  BCBuddy.MAX_SUBJECT_LENGTH = MAX_SUBJECT_LENGTH;
  BCBuddy.MAX_URGENT_TEXT_LENGTH = MAX_URGENT_TEXT_LENGTH;
  BCBuddy.MAX_URGENT_LINK_LENGTH = MAX_URGENT_LINK_LENGTH;
  BCBuddy.isCorner = isCorner;
  BCBuddy.SYNC_INTERVAL_MINUTES = SYNC_INTERVAL_MINUTES;
  BCBuddy.syncIntervalMinutes = syncIntervalMinutes;
  BCBuddy.policyUrl = policyUrl;
  BCBuddy.readPolicy = readPolicy;
  BCBuddy.applyPolicy = applyPolicy;
  BCBuddy.policyValues = policyValues;
  BCBuddy.lockedKeys = lockedKeys;
  BCBuddy.applySharedLocks = applySharedLocks;
  BCBuddy.enforceLocks = enforceLocks;
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
  BCBuddy.isLegacy = isLegacy;
  BCBuddy.webClientOn = webClientOn;
  BCBuddy.environmentsOn = environmentsOn;
  BCBuddy.feedbackOn = feedbackOn;
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
  BCBuddy.applyImported = applyImported;
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
  BCBuddy.applyAreas = applyAreas;
  BCBuddy.sharedAreas = sharedAreas;
  BCBuddy.applySharedAreas = applySharedAreas;
  BCBuddy.cleanFeedbackEmail = feedbackEmail;
  BCBuddy.cleanPriorities = cleanPriorities;
  BCBuddy.cleanDefaultPriority = cleanDefaultPriority;
  BCBuddy.cleanSubject = cleanSubject;
  BCBuddy.cleanUrgentText = cleanUrgentText;
  BCBuddy.cleanUrgentLink = cleanUrgentLink;
  BCBuddy.priorityValues = priorityValues;
  BCBuddy.webClientDefaults = webClientDefaults;
  BCBuddy.webClientOf = webClientOf;
  BCBuddy.hash = hash;
  BCBuddy.toRawUrl = toRawUrl;
  BCBuddy.resolveHostedUrl = resolveHostedUrl;
  BCBuddy.hostedUrlAllowed = hostedUrlAllowed;
})(typeof self !== 'undefined' ? self : this);
