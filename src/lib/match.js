/*
 * BC Buddy - URL parsing, rule matching en template rendering.
 * Pure functies, geen chrome.* API. Bruikbaar in content script, options,
 * popup en service worker (via importScripts).
 */
(function (root) {
  'use strict';
  var BCEM = root.BCEM || (root.BCEM = {});

  var GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var BC_HOST_RE = /(^|\.)businesscentral\.dynamics(-tie)?\.com$/i;
  // Segmenten die na de tenant kunnen staan maar zelf geen omgevingsnaam zijn.
  var NON_ENV_SEG = /^(deeplink|signin|_layouts|api|webhooks)$/i;

  function safeDecode(value) {
    try {
      return decodeURIComponent(String(value).replace(/\+/g, ' '));
    } catch (e) {
      return String(value);
    }
  }

  /**
   * Ontleedt een URL naar de velden waarop regels kunnen matchen.
   * BC SaaS:   https://businesscentral.dynamics.com/{tenant}/{environment}?company=CRONUS%20BE&page=1
   * BC onprem: https://server/BC240/?company=CRONUS%20BE&tenant=default
   */
  function parseUrl(href) {
    var ctx = {
      url: String(href || ''),
      rawurl: String(href || ''),
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
        // /{tenantId of tenantdomein}/{environment}/...
        ctx.tenant = segs[0];
        ctx.environment = segs[1] && !NON_ENV_SEG.test(segs[1]) ? segs[1] : '';
      } else if (!NON_ENV_SEG.test(segs[0])) {
        // /{environment}/... (onprem serverinstance of BC zonder tenant in het pad)
        ctx.environment = segs[0];
      }
    }
    var qTenant = u.searchParams.get('tenant');
    if (qTenant) ctx.tenant = safeDecode(qTenant);

    return ctx;
  }

  // De opschriften komen uit de vertalingen: fieldUrl, opContains, enzovoort.
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
    // RegEx achteraan: de zeldzaamste keuze, en de enige die uitleg vraagt.
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
      try {
        return new RegExp(value, 'i').test(subject);
      } catch (e) {
        return false;
      }
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

  /** Alle ingevulde voorwaarden van een regel moeten kloppen (AND). */
  function matchRule(rule, ctx) {
    if (!rule || rule.enabled === false) return false;
    var conds = (rule.conditions || []).filter(function (c) {
      return c && String(c.value == null ? '' : c.value).trim() !== '';
    });
    if (!conds.length) return false;
    return conds.every(function (c) { return testCondition(c, ctx); });
  }

  var BC_HOST = 'businesscentral.dynamics.com';

  /**
   * Mikt deze regel op Business Central? Dat is zo bij een voorwaarde op
   * omgeving of bedrijf, of bij een voorwaarde op host of URL waarin de
   * BC-host voorkomt. Backslashes worden genegeerd, zodat een RegEx als
   * "businesscentral\.dynamics\.com" ook herkend wordt.
   */
  function targetsBusinessCentral(rule) {
    var conds = (rule && rule.conditions) || [];
    return conds.some(function (cond) {
      if (!cond) return false;
      if (cond.field === 'environment' || cond.field === 'company') return true;
      if (cond.field !== 'url') return false;
      var value = String(cond.value == null ? '' : cond.value).replace(/\\/g, '').toLowerCase();
      return value.indexOf(BC_HOST) !== -1;
    });
  }

  /** Eerste match wint; de volgorde in de lijst bepaalt de prioriteit. */
  function findRule(rules, ctx) {
    var list = rules || [];
    for (var i = 0; i < list.length; i++) {
      if (matchRule(list[i], ctx)) return list[i];
    }
    return null;
  }

  var TOKEN_RE = /\{(\w+)\}/g;
  var SEPARATOR = '[\\-–—·|/]';
  // Markeert waar een token leeg was, zodat het bijhorende scheidingsteken mee kan verdwijnen.
  var EMPTY = '\u0000';

  // De tokens die in teksten vervangen worden. Wat hier niet in staat blijft
  // letterlijk staan, zodat de lijst in de interface ook echt de lijst is.
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

  /** Vervangt {tokens} door waarden uit de context. Onbekende tokens blijven staan. */
  function render(template, ctx, extra) {
    var map = buildMap(ctx, extra);
    return String(template == null ? '' : template).replace(TOKEN_RE, function (m, key) {
      var v = map[key.toLowerCase()];
      return v == null ? m : String(v);
    });
  }

  /** Ruimt lege haakjes, dubbele spaties en losse scheidingstekens aan de randen op. */
  function tidy(text) {
    return String(text == null ? '' : text)
      .replace(/\(\s*\)|\[\s*\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(new RegExp('^[\\s' + SEPARATOR.slice(1, -1) + ']+'), '')
      .replace(new RegExp('[\\s' + SEPARATOR.slice(1, -1) + ']+$'), '')
      .trim();
  }

  /**
   * Rendert een template en haalt weg wat een leeg token achterlaat.
   * "BC - {environment} - {company} ({name})" wordt zonder bedrijf
   * "BC - Sandbox (TEST)" in plaats van "BC - Sandbox -  (TEST)".
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
      // Staat het lege token tussen twee scheidingstekens, hou er dan een over.
      return before && after ? after : '';
    });

    return tidy(text);
  }

  /* ---------- kleur helpers ---------- */

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
   * Wit of zwart, afhankelijk van wat het best leesbaar is op die achtergrond.
   * De drempel 0.179 is het punt waarop het WCAG-contrast met zwart dat met wit
   * overstijgt: sqrt(1.05 * 0.05) - 0.05.
   */
  function idealText(background) {
    return luminance(background) > 0.179 ? '#000000' : '#ffffff';
  }

  BCEM.parseUrl = parseUrl;
  BCEM.testCondition = testCondition;
  BCEM.matchRule = matchRule;
  BCEM.targetsBusinessCentral = targetsBusinessCentral;
  BCEM.findRule = findRule;
  BCEM.render = render;
  BCEM.renderTidy = renderTidy;
  BCEM.tidy = tidy;
  BCEM.parseColor = parseColor;
  BCEM.toHex = toHex;
  BCEM.toRgba = toRgba;
  BCEM.luminance = luminance;
  BCEM.idealText = idealText;
  BCEM.TOKENS = TOKENS;
  BCEM.FIELDS = FIELDS;
  BCEM.OPERATORS = OPERATORS;
  BCEM.safeDecode = safeDecode;
})(typeof self !== 'undefined' ? self : this);
