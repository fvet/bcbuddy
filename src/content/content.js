/*
 * BC Buddy - content script.
 *
 * Finds the rule that matches the current URL and draws:
 *   - a coloured frame around the page
 *   - a banner at the top or bottom
 *   - the BC ribbon in the rule's colour, with custom text
 *   - optionally the tab title and the favicon
 *
 * Business Central is a SPA that continually redraws its own DOM. Everything
 * is therefore idempotent: reassert() may run as often as needed and does
 * nothing when everything already matches. That also prevents a loop with the
 * MutationObserver.
 */
(function () {
  'use strict';

  var BCBuddy = self.BCBuddy;
  if (!BCBuddy) return;

  // The Business Central client renders parts of the UI in an iframe. The frame,
  // banner, title and favicon belong in the top window; we paint the ribbon in
  // every frame where we find it.
  var IS_TOP = window.top === window.self;

  var FRAME_ID = 'bcb-frame';
  var BANNER_ID = 'bcb-banner';
  var FAVICON_REL = 'icon';

  var BRAND_PATTERNS = [
    /^micro(soft)?\s+dynamics\s+365\s+business\s+central/i,
    /^dynamics\s+365\s+business\s+central/i,
    /^business\s+central$/i
  ];

  // Ribbon elements that may keep their own background.
  var KEEP_PAINT = { INPUT: 1, TEXTAREA: 1, SELECT: 1, IMG: 1, CANVAS: 1, VIDEO: 1, svg: 1 };

  // A burst of DOM changes is bundled into a single reassert. Four times a
  // second is enough: BC redraws itself; we do not need to chase every
  // animation frame.
  var SCHEDULE_MS = 250;

  // Safety net beside the observer: BC can redraw without us noticing
  // (for example in a frame that joins later).
  var POLL_MS = 800;

  // Searching for the brand name combs the whole document. On a Business
  // Central host that pays off — there is a ribbon, and once we have found it
  // we remember it. Elsewhere the chance is small: a marked non-BC site has
  // none, and an on-prem install only gets one shortly after load. There we
  // search again at most once every so many milliseconds.
  var BRAND_RETRY_MS = 2000;

  var state = {
    settings: null,
    rule: null,
    ctx: null,
    href: '',
    titleOriginal: document.title,
    titleApplied: null,
    faviconOriginal: null,
    scheduled: false,
    pollTimer: null,
    observer: null,
    // When idle we drop the MutationObserver and the poll: nothing to mark on
    // this page, so chasing every DOM change only burns CPU.
    idle: true,
    // When we last combed the document looking for the ribbon, and whether we
    // ever found one (then this is Business Central).
    lastBrandSearch: 0,
    bcSeen: false,
    // Ribbon elements whose own background we turn off.
    painted: []
  };

  init();

  function init() {
    read().then(function (settings) {
      state.settings = settings;
      start();
    });

    try {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local' || !changes[BCBuddy.STORAGE_KEY]) return;
        state.settings = BCBuddy.normalize(changes[BCBuddy.STORAGE_KEY].newValue);
        clearAll();
        state.rule = null;
        // Settings may have gained rules or turned the extension back on.
        wake();
        apply();
      });
    } catch (e) { /* extension reloaded; the next page load picks it up */ }
  }

  function read() {
    return BCBuddy.loadSettings().catch(function () { return BCBuddy.normalize(null); });
  }

  function start() {
    // apply() decides whether to watch; start idle so a no-op page never arms
    // the observer and poll for a single frame.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply, { once: true });
    }
    window.addEventListener('popstate', onNavigate);
    window.addEventListener('hashchange', onNavigate);
    window.addEventListener('resize', onResize);
    apply();
  }

  function onNavigate() {
    wake();
    apply();
  }

  function onResize() {
    if (state.idle) return;
    schedule();
  }

  function restartPoll() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(apply, POLL_MS);
  }

  /** Stop watching the DOM: no matching work left on this page. */
  function sleep() {
    if (state.idle) return;
    state.idle = true;
    state.scheduled = false;
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
  }

  /** Resume observer + poll (BC SPA redraws, or settings just changed). */
  function wake() {
    if (!state.idle && state.observer && state.pollTimer) return;
    state.idle = false;
    if (!state.observer && document.documentElement) {
      state.observer = new MutationObserver(schedule);
      state.observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    restartPoll();
  }

  /**
   * Keep watching when something may still appear: a matching rule (reassert
   * after BC redraws), a known BC SaaS host, or an on-prem page where we
   * already saw the ribbon. Otherwise idle — most sites never need us again
   * until the URL or settings change.
   */
  function shouldWatch(settings, rule) {
    if (!settings || !settings.enabled) return false;
    if (!BCBuddy.effectiveRules(settings).length) return false;
    if (rule) return true;
    if (state.ctx && state.ctx.isbc) return true;
    if (state.bcSeen) return true;
    return false;
  }

  /** Bundles bursts of DOM changes into a single reassert. */
  function schedule() {
    if (state.idle || state.scheduled) return;
    state.scheduled = true;
    setTimeout(function () {
      state.scheduled = false;
      if (!state.idle) apply();
    }, SCHEDULE_MS);
  }

  /* ---------------------------------------------------------------- apply */

  function apply() {
    var settings = state.settings;
    if (!settings) return;

    var href = contextHref();
    var urlChanged = href !== state.href;
    if (urlChanged) {
      state.href = href;
      state.ctx = BCBuddy.parseUrl(href);
      // A different page may be a different site: start over, and allow a
      // search immediately.
      state.lastBrandSearch = 0;
      state.bcSeen = false;
    }

    // Rules apply on every site. From the URL alone you cannot tell that a
    // custom host runs Business Central, so filtering on the BC host would
    // shut out on-prem installs.
    var rule = settings.enabled
      ? BCBuddy.findRule(BCBuddy.effectiveRules(settings), state.ctx)
      : null;

    var changed = !sameRule(rule, state.rule);
    if (changed) {
      clearAll();
      state.rule = rule;
    }

    if (shouldWatch(settings, rule)) wake();
    else sleep();

    if (!rule) return;

    setVariables(rule);
    reassert(rule);
  }

  function sameRule(a, b) {
    if (!a || !b) return a === b;
    return a.id === b.id && JSON.stringify(a) === JSON.stringify(b);
  }

  function reassert(rule) {
    applyRibbon(rule);
    if (!IS_TOP) return;
    applyFrame(rule);
    applyBanner(rule);
    applyTitle(rule);
    applyFavicon(rule);
  }

  function setVariables(rule) {
    var root = document.documentElement;
    var text = rule.textColor === 'auto' ? BCBuddy.idealText(rule.color) : rule.textColor;
    root.style.setProperty('--bcb-color', rule.color);
    root.style.setProperty('--bcb-text', text);
    root.style.setProperty('--bcb-border-width', rule.border.width + 'px');
    root.style.setProperty('--bcb-bar-bg', BCBuddy.toRgba(rule.color, rule.banner.opacity));
    root.style.setProperty('--bcb-bar-font-size', (rule.banner.fontSize || 13) + 'px');
  }

  /* ---------------------------------------------------------------- frame */

  function applyFrame(rule) {
    var el = document.getElementById(FRAME_ID);
    if (!rule.border.enabled) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      if (!document.body) return;
      el = document.createElement('div');
      el.id = FRAME_ID;
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    } else if (el.parentNode !== document.body) {
      document.body.appendChild(el);
    }
  }

  /* --------------------------------------------------------------- banner */

  function applyBanner(rule) {
    var el = document.getElementById(BANNER_ID);
    if (!rule.banner.enabled) {
      if (el) el.remove();
      return;
    }
    if (!document.body) return;

    var corner = BCBuddy.isCorner(rule.banner.position);
    var className = (corner ? 'bcb-corner bcb-corner--' : 'bcb-bar bcb-bar--') + rule.banner.position;

    if (!el) {
      el = document.createElement('div');
      el.id = BANNER_ID;
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    } else if (el.parentNode !== document.body) {
      document.body.appendChild(el);
    }
    if (el.className !== className) el.className = className;

    var text = BCBuddy.renderTidy(rule.banner.text || '{name}', state.ctx, extras(rule));
    if (el.textContent !== text) {
      el.textContent = text;
      el.removeAttribute('data-bcb-fitted');
    }
    autoFit(el, rule, corner);
  }

  /**
   * At font size 0 ("automatic") the text shrinks until it fits, just as the
   * text in a corner ribbon would otherwise be clipped.
   */
  function autoFit(el, rule, corner) {
    if (rule.banner.fontSize > 0) {
      el.style.fontSize = rule.banner.fontSize + 'px';
      return;
    }
    var signature = el.textContent + '|' + el.clientWidth;
    if (el.getAttribute('data-bcb-fitted') === signature) return;

    var max = corner ? 18 : 14;
    var min = 9;
    var size = max;
    el.style.fontSize = size + 'px';
    while (size > min && el.scrollWidth > el.clientWidth) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
    el.setAttribute('data-bcb-fitted', signature);
  }

  /* --------------------------------------------------------------- ribbon */

  function applyRibbon(rule) {
    if (!rule.ribbon.enabled) {
      releaseRibbon();
      return;
    }
    var brand = getBrandElement();
    if (!brand) return;

    var original = brand.getAttribute('data-bcb-orig');
    if (original == null) {
      original = (brand.textContent || '').trim();
      brand.setAttribute('data-bcb-orig', original);
    }
    brand.setAttribute('data-bcb-brand', '');

    var text = BCBuddy.renderTidy(rule.ribbon.text, state.ctx, extras(rule));
    if (text && brand.textContent !== text) brand.textContent = text;

    var band = getBandElement(brand);
    if (!band) return;
    if (!band.hasAttribute('data-bcb-ribbon')) band.setAttribute('data-bcb-ribbon', '');
    clearRibbonPaint(band);
  }

  /**
   * The buttons on the right of the ribbon carry their own background. Our CSS
   * does not always reach them — BC sometimes sets style directly on the
   * element, and then that style wins — so we read what is actually painted
   * and turn it off per element. That way no dark blocks remain between the
   * icons.
   */
  function clearRibbonPaint(root) {
    var nodes = root.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      // Anything that needs its own background to stay readable or visible
      // we leave alone.
      if (KEEP_PAINT[el.tagName]) continue;
      if (el.shadowRoot) clearRibbonPaint(el.shadowRoot);
      if (el.hasAttribute('data-bcb-paint')) continue;

      var style = getComputedStyle(el);
      // A gradient is bar styling; an image is content (an avatar).
      var gradient = style.backgroundImage.indexOf('gradient') !== -1;
      if (!gradient && !paints(style.backgroundColor)) continue;

      el.setAttribute('data-bcb-paint', el.getAttribute('style') || '');
      el.style.setProperty('background-color', 'transparent', 'important');
      if (gradient) el.style.setProperty('background-image', 'none', 'important');
      state.painted.push(el);
    }
  }

  /** Does this colour actually paint something, or can you see straight through it? */
  function paints(color) {
    var parts = /rgba?\(([^)]+)\)/.exec(color || '');
    if (!parts) return false;
    var bits = parts[1].split(',');
    return (bits.length > 3 ? parseFloat(bits[3]) : 1) > 0.05;
  }

  function restorePaint() {
    state.painted.forEach(function (el) {
      var original = el.getAttribute('data-bcb-paint');
      if (original) {
        el.setAttribute('style', original);
      } else {
        el.removeAttribute('style');
      }
      el.removeAttribute('data-bcb-paint');
    });
    state.painted = [];
  }

  function getBrandElement() {
    var marked = document.querySelector('[data-bcb-brand]');
    if (marked && marked.isConnected) return marked;
    if (!brandSearchDue()) return null;

    var nodes = document.querySelectorAll('span, a, div, h1, h2, button, p');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length) continue; // leaves with their own text only
      var text = (el.textContent || '').trim();
      if (!text || text.length > 90) continue;
      if (!isBrandText(text)) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height === 0 || rect.top > 140) continue;
      state.bcSeen = true;
      return el;
    }
    return null;
  }

  /**
   * May we search for the brand name again now? On Business Central always —
   * you want the bar back immediately when the client redraws. Elsewhere that
   * would keep combing the whole document for something that almost certainly
   * is not there, so a wait applies.
   */
  function brandSearchDue() {
    // An on-prem install sits on its own host, so we do not recognise it from
    // the URL. If we already found a ribbon here, this really is Business
    // Central and we search again without a throttle.
    if (state.bcSeen || (state.ctx && state.ctx.isbc)) return true;
    var now = Date.now();
    if (now - state.lastBrandSearch < BRAND_RETRY_MS) return false;
    state.lastBrandSearch = now;
    return true;
  }

  function isBrandText(text) {
    for (var i = 0; i < BRAND_PATTERNS.length; i++) {
      if (BRAND_PATTERNS[i].test(text)) return true;
    }
    return false;
  }

  /** The full bar that holds the brand name: outermost element that takes the full width at the top of the page. */
  function getBandElement(brand) {
    var existing = document.querySelector('[data-bcb-ribbon]');
    if (existing && existing.isConnected && existing.contains(brand)) return existing;

    var vw = window.innerWidth;
    var node = brand;
    var best = null;
    for (var i = 0; i < 12 && node && node !== document.body; i++) {
      var r = node.getBoundingClientRect();
      if (r.width >= vw * 0.8 && r.top <= 8 && r.height >= 20 && r.height <= 140) best = node;
      node = node.parentElement;
    }
    return best;
  }

  function releaseRibbon() {
    var brand = document.querySelector('[data-bcb-brand]');
    if (brand) {
      var original = brand.getAttribute('data-bcb-orig');
      if (original != null && brand.textContent !== original) brand.textContent = original;
      brand.removeAttribute('data-bcb-brand');
      brand.removeAttribute('data-bcb-orig');
    }
    var band = document.querySelector('[data-bcb-ribbon]');
    if (band) band.removeAttribute('data-bcb-ribbon');
    restorePaint();
  }

  /* ---------------------------------------------------------------- title */

  function applyTitle(rule) {
    if (!rule.title.enabled) {
      if (state.titleApplied && document.title === state.titleApplied) {
        document.title = state.titleOriginal;
      }
      state.titleApplied = null;
      return;
    }
    if (document.title !== state.titleApplied) {
      // BC wrote the title itself: that is our new baseline.
      state.titleOriginal = document.title;
    }
    var next = BCBuddy.renderTidy(rule.title.text, state.ctx, extras(rule));
    if (next && document.title !== next) {
      document.title = next;
      state.titleApplied = next;
    }
  }

  /* -------------------------------------------------------------- favicon */

  function applyFavicon(rule) {
    if (!rule.favicon.enabled) {
      var ours = document.querySelector('link[data-bcb-favicon]');
      if (ours) {
        ours.remove();
        restoreFavicons();
      }
      return;
    }
    var existing = document.querySelector('link[data-bcb-favicon]');
    var label = (rule.favicon.text || rule.name || '').trim();
    var signature = rule.color + '|' + label;
    if (existing && existing.getAttribute('data-bcb-favicon') === signature) return;

    var href = drawFavicon(rule.color, label);
    if (!href) return;

    hideFavicons();
    var link = existing || document.createElement('link');
    link.rel = FAVICON_REL;
    link.type = 'image/png';
    link.setAttribute('data-bcb-favicon', signature);
    link.href = href;
    if (!link.parentNode) (document.head || document.documentElement).appendChild(link);
  }

  function hideFavicons() {
    var links = document.querySelectorAll('link[rel~="icon" i]:not([data-bcb-favicon])');
    for (var i = 0; i < links.length; i++) {
      if (!links[i].hasAttribute('data-bcb-was-rel')) {
        links[i].setAttribute('data-bcb-was-rel', links[i].rel);
      }
      links[i].rel = 'bcb-disabled-icon';
    }
  }

  function restoreFavicons() {
    var links = document.querySelectorAll('link[data-bcb-was-rel]');
    for (var i = 0; i < links.length; i++) {
      links[i].rel = links[i].getAttribute('data-bcb-was-rel');
      links[i].removeAttribute('data-bcb-was-rel');
    }
  }

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

      var initials = label.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase();
      if (initials) {
        ctx2d.fillStyle = BCBuddy.idealText(color);
        ctx2d.font = 'bold ' + (initials.length > 1 ? 17 : 22) + 'px "Segoe UI", Arial, sans-serif';
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

  /* ------------------------------------------------------------- cleanup */

  function clearAll() {
    var frame = document.getElementById(FRAME_ID);
    if (frame) frame.remove();
    var banner = document.getElementById(BANNER_ID);
    if (banner) banner.remove();
    releaseRibbon();

    if (state.titleApplied && document.title === state.titleApplied) {
      document.title = state.titleOriginal;
    }
    state.titleApplied = null;

    var favicon = document.querySelector('link[data-bcb-favicon]');
    if (favicon) {
      favicon.remove();
      restoreFavicons();
    }

    var root = document.documentElement;
    ['--bcb-color', '--bcb-text', '--bcb-border-width',
      '--bcb-bar-bg', '--bcb-bar-font-size'].forEach(function (v) {
      root.style.removeProperty(v);
    });
  }

  /* --------------------------------------------------------------- helpers */

  function extras(rule) {
    return {
      name: rule.name,
      title: state.titleOriginal
    };
  }

  /**
   * In an iframe the top window's URL counts: that holds the environment and
   * the company. On a cross-origin frame this falls back to the own URL.
   */
  function contextHref() {
    if (!IS_TOP) {
      try {
        var topHref = window.top.location.href;
        if (topHref) return topHref;
      } catch (e) { /* cross-origin: use own URL */ }
    }
    return location.href;
  }
})();
