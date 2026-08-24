/*
 * BC Buddy - URL parsing, rule matching and template rendering.
 * Pure functions, no chrome.* API. Usable in the content script, options,
 * popup and service worker (via importScripts).
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var BC_HOST_RE = /(^|\.)businesscentral\.dynamics(-tie)?\.com$/i;
  // Segments that can follow the tenant but are not an environment name themselves.
  var NON_ENV_SEG = /^(deeplink|signin|_layouts|api|webhooks)$/i;

  function safeDecode(value) {
    try {
      return decodeURIComponent(String(value).replace(/\+/g, ' '));
    } catch (e) {
      return String(value);
    }
  }

  /**
   * Parses a URL into the fields rules can match on.
   * BC SaaS:   https://businesscentral.dynamics.com/{tenant}/{environment}?company=CRONUS%20BE&page=1
   * BC onprem: https://server/BC240/?company=CRONUS%20BE&tenant=default
   */
  function parseUrl(href) {
    var ctx = {
      url: String(href || ''),
      host: '',
      path: '',
      tenant: '',
      environment: '',
      company: '',
      isbc: false
    };
    var u;
    try {
      u = new URL(href);
    } catch (e) {
      return ctx;
    }

    ctx.url = safeDecode(href);
    ctx.host = u.hostname;
    ctx.path = safeDecode(u.pathname);
    ctx.isbc = BC_HOST_RE.test(u.hostname);
    ctx.company = safeDecode(u.searchParams.get('company') || '');

    var segs = u.pathname.split('/').filter(Boolean).map(safeDecode);
    if (segs.length) {
      if (GUID_RE.test(segs[0]) || segs[0].indexOf('.') !== -1) {
        // /{tenantId or tenant domain}/{environment}/...
        ctx.tenant = segs[0];
        ctx.environment = segs[1] && !NON_ENV_SEG.test(segs[1]) ? segs[1] : '';
      } else if (!NON_ENV_SEG.test(segs[0])) {
        // /{environment}/... (onprem server instance or BC without tenant in the path)
        ctx.environment = segs[0];
      }
    }
    var qTenant = u.searchParams.get('tenant');
    if (qTenant) ctx.tenant = safeDecode(qTenant);

    return ctx;
  }

  // Labels come from the translations: fieldUrl, opContains, and so on.
  var FIELDS = [
    { value: 'environment', key: 'fieldEnvironment' },
    { value: 'company', key: 'fieldCompany' },
    { value: 'tenant', key: 'fieldTenant' },
    { value: 'url', key: 'fieldUrl' }
  ];

  var OPERATORS = [
    { value: 'contains', key: 'opContains' },
    { value: 'equals', key: 'opEquals' },
    { value: 'startsWith', key: 'opStartsWith' },
    { value: 'endsWith', key: 'opEndsWith' },
    { value: 'notContains', key: 'opNotContains' },
    // RegEx last: the rarest choice, and the only one that needs explaining.
    { value: 'regex', key: 'opRegex' }
  ];

  function testCondition(cond, ctx) {
    if (!cond) return false;
    var value = String(cond.value == null ? '' : cond.value).trim();
    if (!value) return false;

    var field = cond.field || 'url';
    var subject = String(ctx[field] == null ? '' : ctx[field]);
    var op = cond.op || 'contains';

    if (op === 'regex') {
      return safeRegexTest(value, subject);
    }
    var a = subject.toLowerCase();
    var b = value.toLowerCase();
    switch (op) {
      case 'equals': return a === b;
      case 'startsWith': return a.indexOf(b) === 0;
      case 'endsWith': return a.length >= b.length && a.lastIndexOf(b) === a.length - b.length;
      case 'notContains': return a.indexOf(b) === -1;
      default: return a.indexOf(b) !== -1;
    }
  }

  // Long enough for real BC URL patterns; short enough to keep ReDoS bounded.
  var REGEX_MAX_LEN = 200;

  // A subject longer than this is not a URL anyone navigated to, and the cost
  // of backtracking grows with it. Bounding both ends keeps the worst case
  // finite even for a pattern the filter below does not recognise.
  var SUBJECT_MAX_LEN = 2048;

  /**
   * Runs a user/shared RegEx against a subject. Invalid patterns, oversized
   * ones and the quantifier shapes below all fail closed — the condition simply
   * does not match, same as a syntax error.
   *
   * The filter is deliberately conservative rather than complete: deciding
   * whether an arbitrary pattern backtracks catastrophically is not something
   * a source scan can settle. It rejects the shapes that show up in practice
   * and bounds the subject; a pattern that slips through is still bounded by
   * that length, not by the filter.
   */
  function safeRegexTest(pattern, subject) {
    if (pattern.length > REGEX_MAX_LEN) return false;
    if (subject.length > SUBJECT_MAX_LEN) return false;
    if (hasRiskyQuantifier(pattern)) return false;
    try {
      return new RegExp(pattern, 'i').test(subject);
    } catch (e) {
      return false;
    }
  }

  /**
   * Detects a group or class that is quantified while its body already
   * contains a quantifier — (…*…)+ / (…+)+ / […]+* — or a quantified group
   * containing alternation, which is the (a|a)+ shape. Both explode on crafted
   * input. A quantified group without either, like (abc)+, is allowed.
   */
  function hasRiskyQuantifier(source) {
    var i = 0;
    while (i < source.length) {
      var ch = source.charAt(i);
      if (ch === '\\') { i += 2; continue; }
      if (ch === '(' || ch === '[') {
        var isGroup = ch === '(';
        var close = isGroup ? findGroupEnd(source, i) : findClassEnd(source, i);
        if (close < 0) return false;
        var inner = stripEscapes(source.slice(i + 1, close));
        // Alternation only carries that risk inside a group; in a character
        // class a '|' is just another character.
        var risky = /[*+?{]/.test(inner) || (isGroup && inner.indexOf('|') !== -1);
        if (risky && isQuantifierAt(source, close + 1)) return true;
        i = close + 1;
        continue;
      }
      i += 1;
    }
    return false;
  }

  function findGroupEnd(source, open) {
    var depth = 0;
    for (var i = open; i < source.length; i++) {
      var ch = source.charAt(i);
      if (ch === '\\') { i += 1; continue; }
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function findClassEnd(source, open) {
    for (var i = open + 1; i < source.length; i++) {
      var ch = source.charAt(i);
      if (ch === '\\') { i += 1; continue; }
      if (ch === ']') return i;
    }
    return -1;
  }

  function stripEscapes(text) {
    return text.replace(/\\[\s\S]/g, '');
  }

  function isQuantifierAt(source, index) {
    var ch = source.charAt(index);
    if (ch === '*' || ch === '+' || ch === '?') return true;
    if (ch !== '{') return false;
    return /^\{\d+(?:,\d*)?\}/.test(source.slice(index));
  }

  /** All filled-in conditions of a rule must match (AND). */
  function matchRule(rule, ctx) {
    if (!rule || rule.enabled === false) return false;
    var conds = (rule.conditions || []).filter(function (c) {
      return c && String(c.value == null ? '' : c.value).trim() !== '';
    });
    if (!conds.length) return false;
    return conds.every(function (c) { return testCondition(c, ctx); });
  }

  /** First match wins; list order decides priority. */
  function findRule(rules, ctx) {
    var list = rules || [];
    for (var i = 0; i < list.length; i++) {
      if (matchRule(list[i], ctx)) return list[i];
    }
    return null;
  }

  var TOKEN_RE = /\{(\w+)\}/g;
  var SEPARATOR = '[\\-–—·|/]';
  // Marks where a token was empty, so the matching separator can disappear with it.
  var EMPTY = '\u0000';

  // The tokens replaced in texts. Anything not listed here stays literal, so
  // the list in the UI really is the list.
  var TOKENS = ['name', 'environment', 'env', 'company', 'tenant', 'title'];

  function buildMap(ctx, extra) {
    var source = {};
    Object.keys(ctx || {}).forEach(function (k) { source[k.toLowerCase()] = ctx[k]; });
    Object.keys(extra || {}).forEach(function (k) { source[k.toLowerCase()] = extra[k]; });
    source.env = source.environment;

    var map = {};
    TOKENS.forEach(function (token) {
      if (source[token] != null) map[token] = source[token];
    });
    return map;
  }

  /** Replaces {tokens} with values from the context. Unknown tokens stay put. */
  function render(template, ctx, extra) {
    var map = buildMap(ctx, extra);
    return String(template == null ? '' : template).replace(TOKEN_RE, function (m, key) {
      var v = map[key.toLowerCase()];
      return v == null ? m : String(v);
    });
  }

  /** Cleans up empty brackets, double spaces and stray separators at the edges. */
  function tidy(text) {
    return String(text == null ? '' : text)
      .replace(/\(\s*\)|\[\s*\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(new RegExp('^[\\s' + SEPARATOR.slice(1, -1) + ']+'), '')
      .replace(new RegExp('[\\s' + SEPARATOR.slice(1, -1) + ']+$'), '')
      .trim();
  }

  /**
   * Renders a template and removes what an empty token leaves behind.
   * "BC - {environment} - {company} ({name})" without a company becomes
   * "BC - Sandbox (TEST)" instead of "BC - Sandbox -  (TEST)".
   */
  function renderTidy(template, ctx, extra) {
    var map = buildMap(ctx, extra);
    var text = String(template == null ? '' : template).replace(TOKEN_RE, function (m, key) {
      var v = map[key.toLowerCase()];
      if (v == null) return m;
      v = String(v);
      return v === '' ? EMPTY : v;
    });

    var gap = new RegExp('(\\s*' + SEPARATOR + '\\s*)?' + EMPTY + '(\\s*' + SEPARATOR + '\\s*)?', 'g');
    text = text.replace(gap, function (match, before, after) {
      // If the empty token sits between two separators, keep one.
      return before && after ? after : '';
    });

    return tidy(text);
  }

  /* ---------- colour helpers ---------- */

  function parseColor(input) {
    var s = String(input == null ? '' : input).trim();
    var m = s.match(/^#([0-9a-f]{3,8})$/i);
    if (m) {
      var h = m[1];
      if (h.length === 3 || h.length === 4) {
        h = h.split('').map(function (c) { return c + c; }).join('');
      }
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      };
    }
    m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/i);
    if (m) {
      var alpha = m[4] == null ? 1 : (String(m[4]).indexOf('%') !== -1 ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
      return { r: +m[1], g: +m[2], b: +m[3], a: isNaN(alpha) ? 1 : alpha };
    }
    return null;
  }

  function toHex(color) {
    var c = typeof color === 'string' ? parseColor(color) : color;
    if (!c) return '#c4314b';
    function h(n) {
      var v = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return v.length === 1 ? '0' + v : v;
    }
    return '#' + h(c.r) + h(c.g) + h(c.b);
  }

  function toRgba(color, alpha) {
    var c = typeof color === 'string' ? parseColor(color) : color;
    if (!c) return 'rgba(196,49,75,' + (alpha == null ? 1 : alpha) + ')';
    var a = alpha == null ? (c.a == null ? 1 : c.a) : alpha;
    return 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' + a + ')';
  }

  function luminance(color) {
    var c = typeof color === 'string' ? parseColor(color) : color;
    if (!c) return 0;
    function ch(v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }

  /**
   * White or black, whichever reads best on that background.
   * The 0.179 threshold is where WCAG contrast with black overtakes that with
   * white: sqrt(1.05 * 0.05) - 0.05.
   */
  function idealText(background) {
    return luminance(background) > 0.179 ? '#000000' : '#ffffff';
  }

  BCBuddy.parseUrl = parseUrl;
  BCBuddy.testCondition = testCondition;
  BCBuddy.matchRule = matchRule;
  BCBuddy.safeRegexTest = safeRegexTest;
  BCBuddy.findRule = findRule;
  BCBuddy.render = render;
  BCBuddy.renderTidy = renderTidy;
  BCBuddy.tidy = tidy;
  BCBuddy.parseColor = parseColor;
  BCBuddy.toHex = toHex;
  BCBuddy.toRgba = toRgba;
  BCBuddy.luminance = luminance;
  BCBuddy.idealText = idealText;
  BCBuddy.TOKENS = TOKENS;
  BCBuddy.FIELDS = FIELDS;
  BCBuddy.OPERATORS = OPERATORS;
  BCBuddy.safeDecode = safeDecode;
})(typeof self !== 'undefined' ? self : this);
