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
  // What BC online opens when the address names no environment.
  var DEFAULT_ENVIRONMENT = 'Production';

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
    // searchParams already decodes. Decoding again would read a + as a space
    // (R%2BD becomes "R D") and a literal %20 in a name as a space.
    ctx.company = u.searchParams.get('company') || '';

    var segs = u.pathname.split('/').filter(Boolean).map(safeDecode);
    if (segs.length) {
      if (GUID_RE.test(segs[0]) || segs[0].indexOf('.') !== -1) {
        // /{tenantId or tenant domain}/{environment}/...
        // Only BC online puts the tenant in the path. Elsewhere a first segment
        // with a dot is a file or a user name; there only ?tenant= names one.
        if (ctx.isbc) ctx.tenant = segs[0];
        ctx.environment = segs[1] && !NON_ENV_SEG.test(segs[1]) ? segs[1] : '';
      } else if (!NON_ENV_SEG.test(segs[0])) {
        // /{environment}/... (onprem server instance or BC without tenant in the path)
        ctx.environment = segs[0];
      }
    }
    var qTenant = u.searchParams.get('tenant');
    if (qTenant) ctx.tenant = qTenant;

    // BC online without an environment in the address opens the tenant's
    // default environment, which Microsoft names Production. Only on BC's own
    // host: anywhere else an empty path says nothing about an environment.
    if (ctx.isbc && !ctx.environment) ctx.environment = DEFAULT_ENVIRONMENT;

    return ctx;
  }

  // Microsoft's own Dynamics 365 domain. Sales, Customer Service, Finance and
  // Operations and the rest share it, so there only Business Central's hosts
  // count: businesscentral.dynamics.com and the embed apps on *.bc.dynamics.com.
  var DYNAMICS_HOST_RE = /(^|\.)dynamics(-tie)?\.com$/i;
  var BC_EMBED_HOST_RE = /(^|\.)bc\.dynamics(-tie)?\.com$/i;

  /**
   * Where the web client tweaks may apply: BC online and common on-prem URL
   * shapes. Only the address; the content script still checks the page.
   */
  function isWebClientTarget(href) {
    var u;
    try { u = new URL(href); } catch (e) { return false; }
    var host = u.hostname.toLowerCase();
    if (DYNAMICS_HOST_RE.test(host)) return BC_HOST_RE.test(host) || BC_EMBED_HOST_RE.test(host);
    if (/(?:^|\.)bc[^.]*(?:\.|$)/.test(host)) return true;   // hostname label starts with 'bc' (bc, bcdev, bcprod, …)
    if (/^\/bc/i.test(u.pathname)) return true;             // path starts with /BC (on-prem)
    return false;
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
    }
    // Contains and does not contain take a list, the way DevOps reads "In":
    // dev, uat, qa. Empty items from a stray comma are skipped.
    var items = b.indexOf(',') === -1 ? [b] : b.split(',').map(function (item) {
      return item.trim();
    }).filter(Boolean);
    if (!items.length) return false;
    var found = items.some(function (item) { return a.indexOf(item) !== -1; });
    return op === 'notContains' ? !found : found;
  }

  // Long enough for real BC URL patterns; short enough to keep ReDoS bounded.
  var REGEX_MAX_LEN = 200;

  // A subject longer than this is not a URL anyone navigated to, and the cost
  // of backtracking grows with it.
  var SUBJECT_MAX_LEN = 2048;

  // How much backtracking a pattern may need in the worst case, in the units
  // of estimateCost(). Measured in Chrome's engine, a pattern at this budget
  // takes 20 to 60 ms on a subject it does not match; one twenty times over
  // it freezes the tab for seconds. Ungrouped quantifiers are what the shape
  // filter below cannot see: .*.*.*.*.*.*Q is 13 characters and kept a tab
  // busy for 45 s on a 100-character URL before this budget existed.
  var REGEX_BUDGET = 1 << 24;

  // Stands for "as many as the subject has" in a list of quantifier widths.
  var OPEN = -1;

  // Compiled patterns and their quantifiers, so the content script does not
  // parse the same few patterns again on every pass. Patterns come from the
  // settings, so there are few; the cap only guards against a long session of
  // typing in the options page.
  var compiled = {};
  var compiledCount = 0;
  var COMPILED_MAX = 500;

  /**
   * Why a RegEx condition cannot run on a subject of `length` characters:
   * 'invalid' for a syntax error, 'heavy' when checking it could take long
   * enough to freeze the page, '' when it can run. The options page shows the
   * reason; matching treats both the same, as a condition that does not match.
   */
  function regexProblem(pattern, length) {
    var entry = inspect(String(pattern == null ? '' : pattern));
    if (entry.problem) return entry.problem;
    if (length > SUBJECT_MAX_LEN) return 'heavy';
    return estimateCost(entry, length) > REGEX_BUDGET ? 'heavy' : '';
  }

  /**
   * Runs a user/shared RegEx against a subject. Invalid patterns, oversized
   * ones, the nested shapes below and anything over the backtracking budget
   * fail closed — the condition simply does not match, same as a syntax error.
   * A wrong colour on Production is worse than none, so a pattern that is
   * too heavy is never run on part of the subject instead.
   *
   * Deciding whether an arbitrary pattern backtracks catastrophically is not
   * something a source scan can settle, so both checks are conservative: the
   * shape filter catches nested quantifiers, which blow up exponentially, and
   * the budget bounds what is left by the subject's length.
   */
  function safeRegexTest(pattern, subject) {
    var entry = inspect(pattern);
    if (entry.problem || subject.length > SUBJECT_MAX_LEN) return false;
    if (estimateCost(entry, subject.length) > REGEX_BUDGET) return false;
    return entry.re.test(subject);
  }

  function inspect(pattern) {
    if (Object.prototype.hasOwnProperty.call(compiled, pattern)) return compiled[pattern];
    var entry = { problem: '', re: null, widths: [], anchored: false };
    var source = trimLooseEnds(pattern);
    if (pattern.length > REGEX_MAX_LEN || hasRiskyQuantifier(source)) {
      entry.problem = 'heavy';
    } else {
      try {
        entry.re = new RegExp(source, 'i');
        var shape = quantifiers(source);
        entry.widths = shape.widths;
        entry.anchored = source.charAt(0) === '^' && !shape.alternation;
      } catch (e) {
        entry.problem = 'invalid';
      }
    }
    if (compiledCount >= COMPILED_MAX) {
      compiled = {};
      compiledCount = 0;
    }
    compiled[pattern] = entry;
    compiledCount += 1;
    return entry;
  }

  /**
   * An upper bound on the paths the engine may try before it gives up on a
   * subject of `length`: each quantifier multiplies them by the number of
   * lengths it can take, and an unanchored pattern is tried again from every
   * position. Real patterns usually stay far below it, because their literal
   * parts rule out most paths at once.
   */
  function estimateCost(entry, length) {
    var n = Math.max(length, 1);
    var cost = entry.anchored ? 1 : n;
    for (var i = 0; i < entry.widths.length && cost <= REGEX_BUDGET; i++) {
      cost *= entry.widths[i] === OPEN ? n : entry.widths[i];
    }
    return cost;
  }

  /**
   * A .* at the very start or end changes nothing for test(): it may match
   * nothing, so the rest matches wherever it would have anyway. People write
   * .*CRONUS.* all the same, and dropping those ends keeps the pattern from
   * spending its budget on them.
   */
  function trimLooseEnds(source) {
    var s = source;
    var lead = /^\.\*\??/;
    var m;
    while ((m = lead.exec(s)) && !/^[*+?{]/.test(s.slice(m[0].length))) s = s.slice(m[0].length);
    while ((m = /\.\*\??$/.exec(s)) && !isEscaped(s, m.index)) s = s.slice(0, m.index);
    return s;
  }

  function isEscaped(source, index) {
    var slashes = 0;
    for (var i = index - 1; i >= 0 && source.charAt(i) === '\\'; i--) slashes += 1;
    return slashes % 2 === 1;
  }

  /**
   * The quantifiers of a pattern as widths — how many lengths each can take,
   * OPEN for *, + and {n,} — and whether it has an | outside any group, which
   * makes a leading ^ anchor only its first branch. Character classes and
   * escapes are skipped; the pattern already compiled, so it is well formed.
   */
  function quantifiers(source) {
    var widths = [];
    var depth = 0;
    var alternation = false;
    for (var i = 0; i < source.length; i++) {
      var ch = source.charAt(i);
      var width = 0;
      if (ch === '\\') { i += 1; continue; }
      if (ch === '[') { i = findClassEnd(source, i); continue; }
      if (ch === '(') {
        depth += 1;
        // The ? of (?: (?= (?! (?<name> is not a quantifier.
        if (source.charAt(i + 1) === '?') i += 1;
        continue;
      }
      if (ch === ')') { depth -= 1; continue; }
      if (ch === '|') { if (depth === 0) alternation = true; continue; }
      if (ch === '*' || ch === '+') width = OPEN;
      else if (ch === '?') width = 2;
      else if (ch === '{') {
        var range = /^\{(\d+)(?:(,)(\d*))?\}/.exec(source.slice(i));
        if (!range) continue; // a literal brace
        width = !range[2] ? 1 : (range[3] === '' ? OPEN : Math.max(1, range[3] - range[1] + 1));
        i += range[0].length - 1;
      } else continue;
      widths.push(width);
      // A ? right after a quantifier makes it lazy; it is no quantifier itself.
      if (source.charAt(i + 1) === '?') i += 1;
    }
    return { widths: widths, alternation: alternation };
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
    // A tenant ID is a GUID, which only clutters a ribbon or a tab title.
    // Leave it empty, so it goes with the separator next to it.
    if (GUID_RE.test(source.tenant || '')) source.tenant = '';

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

  /* ---------- company from the page ---------- */

  // BC caps a company's display name at 250 characters; anything longer is
  // not one.
  var COMPANY_MAX = 250;

  /** Page text as a company name: one line, trimmed, '' when too long. */
  function tidyCompany(text) {
    var s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    return s.length > COMPANY_MAX ? '' : s;
  }

  /**
   * The company in the title of BC's environment button:
   * "Cronus België, Omgeving: Sandbox" gives "Cronus België". The label
   * after the last comma is in the user's language ("Environment",
   * "Environnement :"), so only its colon is checked. '' when the title has
   * no company part.
   */
  function companyFromLauncher(title) {
    var s = String(title == null ? '' : title);
    var cut = s.lastIndexOf(',');
    if (cut <= 0 || s.indexOf(':', cut) === -1) return '';
    return tidyCompany(s.slice(0, cut));
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
   * A see-through background (`opacity` below 1) is judged by the colour you
   * see: mixed with the page under it, white unless `under` says otherwise.
   */
  function idealText(background, opacity, under) {
    var seen = opacity == null || opacity >= 1 ? background : blend(background, under || '#ffffff', opacity);
    return luminance(seen) > 0.179 ? '#000000' : '#ffffff';
  }

  /** `top` at `opacity` over `bottom`, as the browser paints it. */
  function blend(top, bottom, opacity) {
    var a = parseColor(top);
    var b = parseColor(bottom);
    if (!a || !b) return a || b;
    var o = Math.max(0, Math.min(1, opacity));
    function mix(x, y) { return x * o + y * (1 - o); }
    return { r: mix(a.r, b.r), g: mix(a.g, b.g), b: mix(a.b, b.b), a: 1 };
  }

  /**
   * The tab icon a rule gets: a rounded square in its colour with up to two
   * letters, as a PNG data URL. Shared by the BC tab and the options preview.
   * Null where there is no canvas.
   */
  function drawFavicon(color, label) {
    try {
      var size = 32;
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx2d = canvas.getContext('2d');
      if (!ctx2d) return null;

      ctx2d.fillStyle = color;
      roundRect(ctx2d, 0, 0, size, size, 6);
      ctx2d.fill();

      // Letters keep their accents (\p{M}), and two letters are counted as you
      // see them, not in UTF-16 units.
      var initials = BCBuddy.leading(String(label || '').replace(/[^\p{L}\p{M}\p{N}]/gu, ''), 2).toUpperCase();
      if (initials) {
        ctx2d.fillStyle = idealText(color);
        var single = BCBuddy.leading(initials, 1) === initials;
        ctx2d.font = 'bold ' + (single ? 22 : 17) + 'px "Segoe UI", Arial, sans-serif';
        ctx2d.textAlign = 'center';
        ctx2d.textBaseline = 'middle';
        ctx2d.fillText(initials, size / 2, size / 2 + 1);
      }
      return canvas.toDataURL('image/png');
    } catch (e) {
      return null;
    }
  }

  function roundRect(ctx2d, x, y, w, h, r) {
    ctx2d.beginPath();
    ctx2d.moveTo(x + r, y);
    ctx2d.arcTo(x + w, y, x + w, y + h, r);
    ctx2d.arcTo(x + w, y + h, x, y + h, r);
    ctx2d.arcTo(x, y + h, x, y, r);
    ctx2d.arcTo(x, y, x + w, y, r);
    ctx2d.closePath();
  }

  BCBuddy.parseUrl = parseUrl;
  BCBuddy.isWebClientTarget = isWebClientTarget;
  BCBuddy.testCondition = testCondition;
  BCBuddy.matchRule = matchRule;
  BCBuddy.safeRegexTest = safeRegexTest;
  BCBuddy.regexProblem = regexProblem;
  BCBuddy.findRule = findRule;
  BCBuddy.render = render;
  BCBuddy.renderTidy = renderTidy;
  BCBuddy.tidy = tidy;
  BCBuddy.tidyCompany = tidyCompany;
  BCBuddy.companyFromLauncher = companyFromLauncher;
  BCBuddy.parseColor = parseColor;
  BCBuddy.toHex = toHex;
  BCBuddy.toRgba = toRgba;
  BCBuddy.luminance = luminance;
  BCBuddy.idealText = idealText;
  BCBuddy.blend = blend;
  BCBuddy.drawFavicon = drawFavicon;
  BCBuddy.TOKENS = TOKENS;
  BCBuddy.FIELDS = FIELDS;
  BCBuddy.OPERATORS = OPERATORS;
  BCBuddy.safeDecode = safeDecode;
})(typeof self !== 'undefined' ? self : this);
