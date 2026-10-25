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
  var ROW_ATTR = 'data-bcb-row';
  var CALM_ATTR = 'data-bcb-calm';
  var NO_BELL_ATTR = 'data-bcb-no-bell';
  var STRIPES_ATTR = 'data-bcb-stripes';
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

  // How often the ribbon walk forgets which elements painted nothing, so a
  // background BC added to a node that stayed in place is picked up again.
  var REPAINT_SWEEP_MS = 2000;

  // BC online without ?company= in the address: how often to look for the
  // company on the page until it is found (see companyFromPage()).
  var COMPANY_RETRY_MS = 2000;

  // On <html> in the top window while the banner is a bar at the top: the
  // page moves down to make room for it (content.css).
  var TOP_BAR_ATTR = 'data-bcb-top-bar';

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
    // When we last looked for the company on the page (companyFromPage()).
    lastCompanyLook: 0,
    // Ribbon elements whose own background we turn off.
    painted: [],
    // Ribbon elements already found to paint nothing, and when that memory was
    // last cleared. A WeakSet rather than an attribute: this is our bookkeeping
    // and it has no business showing up in someone else's DOM.
    unpainted: new WeakSet(),
    lastPaintSweep: 0,
    // Maximize: the BC pages already handled, keyed by their form.
    maximized: new WeakMap(),
    // Pin the action bar: the forms of the BC pages already decided.
    pinned: new WeakSet(),
    // Hide the FactBox pane: per BC page form, whether its toggle is still
    // awaited (see factbox.js).
    factBoxes: new WeakMap(),
    // Dropdown sizer handle, and the settings it was started with ('' = off).
    dropdowns: null,
    dropdownKey: '',
    // Drag handles on BC's side panes (panes.js), while the switch is on.
    panes: null,
    // Copy icon handle while the switch is on.
    copyValues: null,
    // Ctrl+click and middle-click handler (newtab.js, beta).
    newTab: null,
    // Week numbers in the date picker: its storage listener while the switch is on.
    weekNumbers: null,
    // Keyboard shortcuts icon and panel (shortcuts.js), while the switch is on.
    shortcuts: null,
    // Browser side panels showing this tab's shortcuts: [{ port, stop }].
    panelPorts: [],
    // The language picked on the options page has been looked up (see
    // applyLanguage()).
    language: false,
    // MutationObserver that reapplies ribbon inline styles if Dark Reader
    // overrides them. Disconnected whenever the ribbon is released.
    ribbonGuard: null,
    // Whether the web client tweaks apply in this frame, worked out once per
    // apply() by webClientHere().
    webClient: false,
    // This document showed Business Central's own elements (BC_PAGE_CLASSES).
    bcPage: false,
    // The look for those elements on a BC-like address: its timer, when it
    // started, and until when it runs (0 = not started, -1 = gave up on this
    // address).
    probeTimer: 0,
    probeFrom: 0,
    probeUntil: 0
  };

  // Where the web client tweaks (maximize, dropdown size, current row) apply:
  // BC online and common on-prem URL shapes, not the rest of Dynamics 365.
  // Checked against the top window's href, even when running inside an iframe.
  var isWebClientTarget = BCBuddy.isWebClientTarget;

  // Classes only the Business Central web client uses: the frame it runs in
  // (in the top window) and the container its pages stack in (inside that
  // frame). On-prem runs the same client, so it has them too.
  var BC_PAGE_CLASSES = ['designer-client-frame', 'spa-container'];

  // A page with a BC-like address that shows neither is looked at again: every
  // second while the client is usually still loading, then less often. The
  // client builds its frame with script as the page finishes loading, so the
  // look ends 10 s after the load event (or after the address changed, for a
  // page that loaded long before), and after a minute in any case.
  var BC_PROBE_LIMIT_MS = 60000;
  var BC_AFTER_LOAD_MS = 10000;

  function probeDelay(elapsed) {
    if (elapsed < 10000) return 1000;
    return elapsed < 30000 ? 2000 : 5000;
  }

  /**
   * Whether the web client tweaks apply in this frame. The address must look
   * like Business Central, and on any host but BC online the page must prove
   * it: BC's own elements, or the brand name in its ribbon (state.bcSeen). A
   * site that only looks like BC by its address, such as a host name starting
   * with "bc", gets no tweak.
   */
  function webClientHere() {
    if (!isWebClientTarget(state.href)) return false;
    if (state.bcPage || state.bcSeen || (state.ctx && state.ctx.isbc)) return true;
    if (hasBCElements()) return true;
    probeForBC();
    return false;
  }

  /**
   * Live collections from getElementsByClassName, made once: the browser
   * keeps their answer until the page changes, so a look at a page that did
   * not change costs next to nothing, and one after a change walks the page
   * once (2 ms for 60,000 elements, measured).
   */
  var bcMarks = null;

  function hasBCElements() {
    if (!bcMarks) {
      bcMarks = BC_PAGE_CLASSES.map(function (name) { return document.getElementsByClassName(name); });
    }
    for (var i = 0; i < bcMarks.length; i++) {
      if (bcMarks[i].length) {
        state.bcPage = true;
        return true;
      }
    }
    return false;
  }

  /**
   * Looks for BC's elements on a timer, without waking the observer and the
   * poll. Found, it runs apply(), which starts the tweaks; not found by 10 s
   * after the page loaded, it stops. A look-alike page gets about ten looks.
   */
  function probeForBC() {
    if (state.probeTimer || state.probeUntil === -1) return;
    var now = Date.now();
    if (!state.probeUntil) {
      state.probeFrom = now;
      state.probeUntil = now + BC_PROBE_LIMIT_MS;
    }
    state.probeTimer = setTimeout(function () {
      state.probeTimer = 0;
      if (hasBCElements()) apply();
      else if (probeGoesOn()) probeForBC();
      else state.probeUntil = -1;
    }, probeDelay(now - state.probeFrom));
  }

  function probeGoesOn() {
    var now = Date.now();
    if (now >= state.probeUntil) return false;
    var loaded = loadedAt();
    return !loaded || now < Math.max(loaded, state.probeFrom) + BC_AFTER_LOAD_MS;
  }

  /** When this page's load event fired, or 0 while it is still loading. */
  function loadedAt() {
    if (document.readyState !== 'complete') return 0;
    var nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    // loadEventEnd is still 0 while load handlers run.
    return nav && nav.loadEventEnd ? Math.round(performance.timeOrigin + nav.loadEventEnd) : Date.now();
  }

  init();

  function init() {
    // The browser shortcut for the keyboard shortcuts panel arrives from the
    // service worker, in the top frame only.
    if (IS_TOP) {
      try {
        chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
          if (!message || !sender || sender.id !== chrome.runtime.id || sender.tab) return;
          if (message.type === 'bcb:toggle-shortcuts') {
            if (state.shortcuts) state.shortcuts.toggle();
          } else if (message.type === 'bcb:support-context') {
            // The Help & feedback panel asks where the tab is: whether this
            // is Business Central (it only draws on BC pages) and the
            // environment and company for the report, the company also when
            // it came from the page rather than the address.
            var ctx = state.ctx || {};
            sendResponse({
              webClient: !!state.webClient,
              tenant: ctx.tenant || '',
              environment: ctx.environment || '',
              company: ctx.company || ''
            });
          }
        });
        chrome.runtime.onConnect.addListener(panelConnected);
      } catch (e) { /* extension reloaded */ }
    }

    read().then(function (settings) {
      state.settings = settings;
      start();
    });

    try {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === 'local' && changes[BCBuddy.LANGUAGE_KEY] && state.language) {
          BCBuddy.loadLanguage().then(relabel);
        }
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

  /**
   * BCBuddy.effectiveRules() re-normalizes the whole configuration on every
   * call — wasted work when apply() runs on the poll and on every burst of DOM
   * changes. state.settings is replaced wholesale whenever storage changes, so
   * its identity is a safe cache key.
   */
  var rulesCache = { source: null, rules: null };

  function effectiveRules(settings) {
    if (rulesCache.source !== settings) {
      rulesCache.source = settings;
      rulesCache.rules = BCBuddy.effectiveRules(settings);
    }
    return rulesCache.rules;
  }

  /**
   * The rule for this page. Matching only looks at the URL, and state.ctx is
   * replaced whenever that changes, so the answer is kept until the URL or the
   * rules change: a RegEx condition runs once per page, not on every pass.
   */
  var matchCache = { rules: null, ctx: null, rule: null };

  function matchingRule(settings) {
    var rules = effectiveRules(settings);
    if (matchCache.rules !== rules || matchCache.ctx !== state.ctx) {
      matchCache.rules = rules;
      matchCache.ctx = state.ctx;
      matchCache.rule = BCBuddy.findRule(rules, state.ctx);
    }
    return matchCache.rule;
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
    if (!settings) return false;
    // The current-row tint is not here on purpose: it is one attribute, set
    // once, and needs no watching. With an area off, nothing of it counts.
    var clicksBC = BCBuddy.maximizeOn(settings) || BCBuddy.pinActionBarOn(settings) ||
      BCBuddy.hideFactBoxOn(settings);
    var colours = BCBuddy.environmentsOn(settings) && effectiveRules(settings).length > 0;
    if (!colours && !clicksBC) return false;
    if (rule) return true;
    if (state.ctx && state.ctx.isbc) return true;
    if (state.bcSeen) return true;
    if (clicksBC && state.webClient) return true;
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
      state.lastCompanyLook = 0;
      // A new address may be BC where the old one was not: look again. Once
      // this document showed BC's elements, that stays true.
      if (state.probeUntil === -1) state.probeUntil = 0;
    }
    state.webClient = webClientHere();
    if (state.webClient && state.ctx.isbc && !state.ctx.company) companyFromPage();

    // Rules apply on every site. From the URL alone you cannot tell that a
    // custom host runs Business Central, so filtering on the BC host would
    // shut out on-prem installs. With environment colours off, no rule runs.
    var rule = BCBuddy.environmentsOn(settings) ? matchingRule(settings) : null;

    var changed = !sameRule(rule, state.rule);
    if (changed) {
      clearAll();
      state.rule = rule;
    }

    if (shouldWatch(settings, rule)) wake();
    else sleep();

    if (rule) {
      setVariables(rule);
      reassert(rule);
    }

    // Before maximize: its wide click stores the pane as open (factbox.js).
    applyHideFactBox();
    applyMaximize();
    applyPinActionBar();
    applyDropdowns();
    applyPanes();
    applyHighlightRow();
    applyListLook();
    applyNoAnimations();
    applyHideNotifications();
    applyLanguage();
    applyCopyValues();
    applyNewTab();
    applyWeekNumbers();
    applyShortcuts();
  }

  function sameRule(a, b) {
    // The cache hands back the same object while settings are unchanged, so in
    // the steady state this costs one comparison instead of two stringifies.
    if (a === b) return true;
    if (!a || !b) return false;
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
    // A bar at the top has the page below it, not behind it: always solid.
    var opacity = rule.banner.position === 'top' ? 1 : rule.banner.opacity;
    // The banner's text is picked for the colour you see through it: over a
    // page Dark Reader made dark, that is the rule's colour over dark grey.
    var under = root.getAttribute('data-darkreader-scheme') === 'dark' ? '#181a1b' : '#ffffff';
    root.style.setProperty('--bcb-color', rule.color);
    root.style.setProperty('--bcb-text', BCBuddy.idealText(rule.color));
    root.style.setProperty('--bcb-border-width', rule.border.width + 'px');
    root.style.setProperty('--bcb-bar-bg', BCBuddy.toRgba(rule.color, opacity));
    root.style.setProperty('--bcb-bar-text', BCBuddy.idealText(rule.color, opacity, under));
    root.style.setProperty('--bcb-bar-font-size', (rule.banner.fontSize || 13) + 'px');
    // Room for one line of the largest automatic size (14px) or the fixed one.
    root.style.setProperty('--bcb-top-height', Math.round((rule.banner.fontSize || 14) * 1.35) + 8 + 'px');
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
    var root = document.documentElement;
    var top = rule.banner.enabled && rule.banner.position === 'top';
    if (top !== root.hasAttribute(TOP_BAR_ATTR)) {
      if (top) root.setAttribute(TOP_BAR_ATTR, '');
      else root.removeAttribute(TOP_BAR_ATTR);
    }
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
    guardRibbon(band, rule);
  }

  /**
   * Dark Reader (and similar extensions) can override our CSS rule by injecting
   * their own !important stylesheet after ours. Setting the color as an inline
   * style on the element itself bypasses that: inline !important beats any
   * stylesheet rule. A MutationObserver then reapplies immediately if the style
   * attribute is modified again.
   */
  function guardRibbon(band, rule) {
    var color = rule.color;
    var text = BCBuddy.idealText(rule.color);

    function paint() {
      band.style.setProperty('background-color', color, 'important');
      band.style.setProperty('background-image', 'none', 'important');
      band.style.setProperty('color', text, 'important');
    }

    paint();

    if (state.ribbonGuard) state.ribbonGuard.disconnect();
    state.ribbonGuard = new MutationObserver(function () {
      state.ribbonGuard.disconnect();
      paint();
      state.ribbonGuard.observe(band, { attributes: true, attributeFilter: ['style'] });
    });
    state.ribbonGuard.observe(band, { attributes: true, attributeFilter: ['style'] });
  }

  /**
   * The buttons on the right of the ribbon carry their own background. Our CSS
   * does not always reach them — BC sometimes sets style directly on the
   * element, and then that style wins — so we read what is actually painted
   * and turn it off per element. That way no dark blocks remain between the
   * icons.
   */
  function clearRibbonPaint(root) {
    // Most of a ribbon paints nothing, and reading a computed style is the
    // expensive part of this walk. Elements already found transparent are
    // remembered and skipped; a new node carries no such memory and is read on
    // the very next pass. Every so often the memory is dropped, so an element
    // BC repainted in place — a class or an inline style on a node that stayed
    // put — is looked at again.
    if (Date.now() - state.lastPaintSweep >= REPAINT_SWEEP_MS) {
      state.lastPaintSweep = Date.now();
      state.unpainted = new WeakSet();
    }
    stripPaint(root);
  }

  function stripPaint(root) {
    var nodes = root.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      // Anything that needs its own background to stay readable or visible
      // we leave alone.
      if (KEEP_PAINT[el.tagName]) continue;
      if (el.shadowRoot) stripPaint(el.shadowRoot);
      if (el.hasAttribute('data-bcb-paint') || state.unpainted.has(el)) continue;

      var style = getComputedStyle(el);
      // A gradient is bar styling; an image is content (an avatar).
      var gradient = style.backgroundImage.indexOf('gradient') !== -1;
      if (!gradient && !paints(style.backgroundColor)) {
        state.unpainted.add(el);
        continue;
      }

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
    // The ribbon is being handed back; nothing we learned about it still holds.
    state.unpainted = new WeakSet();
    state.lastPaintSweep = 0;
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
    if (state.ribbonGuard) {
      state.ribbonGuard.disconnect();
      state.ribbonGuard = null;
    }
    var brand = document.querySelector('[data-bcb-brand]');
    if (brand) {
      var original = brand.getAttribute('data-bcb-orig');
      if (original != null && brand.textContent !== original) brand.textContent = original;
      brand.removeAttribute('data-bcb-brand');
      brand.removeAttribute('data-bcb-orig');
    }
    var band = document.querySelector('[data-bcb-ribbon]');
    if (band) {
      band.style.removeProperty('background-color');
      band.style.removeProperty('background-image');
      band.style.removeProperty('color');
      band.removeAttribute('data-bcb-ribbon');
    }
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

    // The page can add icons of its own at any moment — the BC client does — so
    // this runs on every pass, not only when our own icon changes. Otherwise a
    // late <link rel="icon"> quietly wins over ours.
    hideFavicons();

    if (existing && existing.getAttribute('data-bcb-favicon') === signature) return;

    var href = BCBuddy.drawFavicon(rule.color, label);
    if (!href) return;

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

  /* ------------------------------------------------------------- maximize */

  /**
   * Wide layout and list view for the BC page on screen; see maximize.js.
   * Runs in every frame; only acts where the BC toolbar is.
   */
  function applyMaximize() {
    if (!BCBuddy.maximizeOn(state.settings)) return;
    if (!state.webClient) return;
    BCBuddy.Maximize.apply(document, state.maximized, bcStorage());
  }

  /* ------------------------------------------------------ pin action bar */

  /**
   * Pins the action bar of a BC page that opens with it floating, unless
   * someone set it on that page before; see actionbar.js. Like maximize it
   * runs in every frame and only acts where the page is: one query in the page
   * on screen per pass, and a look in BC's storage once per page.
   */
  function applyPinActionBar() {
    if (!BCBuddy.pinActionBarOn(state.settings)) return;
    if (!state.webClient) return;
    BCBuddy.ActionBar.apply(document, state.pinned, bcStorage());
  }

  /* ------------------------------------------------------ FactBox pane */

  /**
   * Closes the FactBox pane of a BC page that opens with it, unless someone set
   * that page before; see factbox.js. Like maximize it runs in every frame and
   * only acts where the page is: one or two queries in the page on screen per
   * pass, and a look in BC's storage once per page.
   */
  function applyHideFactBox() {
    if (!BCBuddy.hideFactBoxOn(state.settings)) return;
    if (!state.webClient) return;
    BCBuddy.FactBox.apply(document, state.factBoxes, bcStorage());
  }

  /**
   * The localStorage of this frame, where BC keeps the choices made on each
   * page. Null where the browser blocks it; BC cannot store anything there
   * either.
   */
  function bcStorage() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  /* ---------------------------------------------------------- current row */

  /**
   * Tints the row you are on in BC's editable grids; the rules are in
   * content.css. All this does is set one attribute on <html>, in every frame.
   * BC leaves the root element of its frame alone, so it is set once - when
   * the page loads, the URL changes or the settings do - and costs nothing
   * while you scroll or type.
   */
  function applyHighlightRow() {
    var root = document.documentElement;
    if (!root) return;
    var on = BCBuddy.highlightRowOn(state.settings) && state.webClient;
    if (on === root.hasAttribute(ROW_ATTR)) return;
    if (on) root.setAttribute(ROW_ATTR, '');
    else root.removeAttribute(ROW_ATTR);
  }

  /* ------------------------------------------------------------ list look */

  /**
   * Striped rows in BC's lists and editable grids; the rules are in
   * content.css. Like the row tint this is one attribute on <html>, set once
   * per page load, URL change or settings change, so it costs nothing while
   * you scroll or type.
   */
  function applyListLook() {
    var root = document.documentElement;
    if (!root) return;
    var on = isWebClientTarget(state.href) && BCBuddy.stripeRowsOn(state.settings);
    toggleRootAttr(root, STRIPES_ATTR, on);
  }

  function toggleRootAttr(root, name, on) {
    if (on === root.hasAttribute(name)) return;
    if (on) root.setAttribute(name, '');
    else root.removeAttribute(name);
  }

  /* ----------------------------------------------------------- animations */

  /**
   * Shortens BC's animations; the rules are in content.css, and calm.js
   * (page world) does the same for element.animate(). Like the row tint
   * this only sets one attribute on <html>, once per page load, URL change or
   * settings change, so it costs nothing while you scroll or type.
   */
  function applyNoAnimations() {
    var root = document.documentElement;
    if (!root) return;
    var on = BCBuddy.noAnimationsOn(state.settings) && state.webClient;
    if (on === root.hasAttribute(CALM_ATTR)) return;
    if (on) root.setAttribute(CALM_ATTR, '');
    else root.removeAttribute(CALM_ATTR);
  }

  /* -------------------------------------------------------- notifications */

  /**
   * Hides the notifications bell in BC's top bar; the rule is in content.css.
   * Like the row tint this only sets one attribute on <html>, once per page
   * load, URL change or settings change.
   */
  function applyHideNotifications() {
    var root = document.documentElement;
    if (!root) return;
    var on = BCBuddy.hideNotificationsOn(state.settings) && state.webClient;
    if (on === root.hasAttribute(NO_BELL_ATTR)) return;
    if (on) root.setAttribute(NO_BELL_ATTR, '');
    else root.removeAttribute(NO_BELL_ATTR);
  }

  /* ------------------------------------------------------------- language */

  /**
   * Only the web client tweaks put text on a page, so only there do we look
   * up the language picked on the options page: once per page, not in every
   * frame of every site. Until it arrives the texts are in the browser's
   * language; then the tweaks with text are attached again.
   */
  function applyLanguage() {
    if (state.language) return;
    if (!state.webClient && !(IS_TOP && isWebClientTarget(state.href))) return;
    state.language = true;
    BCBuddy.loadLanguage().then(function (lang) {
      if (lang) relabel();
    });
  }

  /** Detaches the tweaks that show our texts, so apply() attaches them anew. */
  function relabel() {
    if (state.copyValues) state.copyValues.detach();
    dropShortcuts();
    state.copyValues = null;
    apply();
  }

  /* ---------------------------------------------------------- copy values */

  /**
   * Starts or stops the copy icon when the settings call for it. Like the
   * dropdown sizer it keeps its own listener, attached once and left alone
   * until the switch changes, so this costs one comparison per apply().
   */
  function applyCopyValues() {
    var want = BCBuddy.copyValuesOn(state.settings) && state.webClient;
    if (want === !!state.copyValues) return;
    if (state.copyValues) state.copyValues.detach();
    state.copyValues = want ? BCBuddy.CopyValues.attach(document, {
      copy: BCBuddy.t('copyValue'),
      copied: BCBuddy.t('copiedValue')
    }) : null;
  }

  /* --------------------------------------------------------- week numbers */

  /**
   * Turns on Business Central's own week numbers in the date picker where
   * nobody chose yet; see weeknumbers.js. It looks once when the switch turns
   * on and then only listens for storage events, so this costs one comparison
   * per apply(). Switching it off stops that; numbers already on stay, as BC
   * keeps them.
   */
  function applyWeekNumbers() {
    var want = BCBuddy.weekNumbersOn(state.settings) && state.webClient;
    if (want === !!state.weekNumbers) return;
    if (state.weekNumbers) state.weekNumbers.detach();
    state.weekNumbers = want ? BCBuddy.WeekNumbers.attach(window) : null;
  }

  /* ---------------------------------------------------- open in a new tab */

  /**
   * Starts or stops Ctrl+click / middle-click to open a link in a new tab.
   * Beta and undocumented on purpose, with no switch of its own: see the top
   * of newtab.js. It follows the Web client switch only. Its click listeners are
   * attached once and left alone until that changes, so this costs one
   * comparison per apply().
   */
  function applyNewTab() {
    var want = BCBuddy.webClientOn(state.settings) && state.webClient;
    if (want === !!state.newTab) return;
    if (state.newTab) state.newTab.detach();
    state.newTab = want ? BCBuddy.NewTab.attach(document, openTab) : null;
  }

  /**
   * Hands an address to the service worker, which opens it in a new tab next
   * to this one: in the background, like Ctrl+click on a link, or in front.
   */
  function openTab(url, active) {
    try {
      chrome.runtime.sendMessage({ type: 'bcb:open-tab', url: url, active: !!active });
    } catch (e) { /* extension reloaded; nothing to open it with */ }
  }

  /* ------------------------------------------------------------ dropdowns */

  /**
   * Starts or stops the dropdown sizer when the settings call for it. It keeps
   * its own narrow observer, independent of the idle/watch cycle above, so it
   * is attached once and left alone until the settings change.
   */
  function applyDropdowns() {
    var settings = state.settings;
    var want = BCBuddy.webClientOn(settings) && BCBuddy.Dropdowns.isOn(settings.dropdown) &&
      state.webClient;
    var key = want ? settings.dropdown.width + 'x' + settings.dropdown.height : '';
    if (key === state.dropdownKey) return;

    if (state.dropdowns) state.dropdowns.detach();
    state.dropdowns = want ? BCBuddy.Dropdowns.attach(document, settings.dropdown) : null;
    state.dropdownKey = key;
  }

  /* ---------------------------------------------------------------- panes */

  /**
   * Drag handles on the left edge of Help, Copilot, Page Inspection and the
   * Personalization field list; see panes.js. In every frame: Page Inspection
   * is in the top window, Help in the client frame. One pointerdown listener,
   * attached once and left alone until the switch changes, so this costs one
   * comparison per apply().
   */
  function applyPanes() {
    var want = BCBuddy.resizePanesOn(state.settings) && state.webClient;
    if (want === !!state.panes) return;
    if (state.panes) state.panes.detach();
    state.panes = want ? BCBuddy.Panes.attach(document) : null;
  }

  /* ------------------------------------------------------------ shortcuts */

  /**
   * The BC Buddy icon in BC's top bar, which opens the side panel on its
   * start view, and the shortcuts it feeds that panel; see shortcuts.js. The
   * icon is there while the Web client (which brings the keyboard
   * shortcuts) or Help & feedback is on: it is how people find both. Top
   * window only: from there it reads BC's client frame. Attached once, so
   * this costs one
   * comparison per apply().
   */
  function applyShortcuts() {
    var settings = state.settings;
    var want = IS_TOP && isWebClientTarget(state.href) &&
      (BCBuddy.webClientOn(settings) || BCBuddy.feedbackOn(settings));
    if (want === !!state.shortcuts) return;
    dropShortcuts();
    if (!want) return;
    state.shortcuts = BCBuddy.Shortcuts.attach(document, {
      t: BCBuddy.t, icon: true, iconLabel: 'bpTitle', onIcon: openSidePanel
    });
    state.panelPorts.forEach(feedPanel);
  }

  function dropShortcuts() {
    state.panelPorts.forEach(function (entry) {
      if (entry.stop) entry.stop();
      entry.stop = null;
      postToPanel(entry.port, { type: 'none' });
    });
    if (state.shortcuts) state.shortcuts.detach();
    state.shortcuts = null;
  }

  /**
   * The icon opens the browser's side panel on its start view, or closes it
   * when it is open; the service worker does that, as only it may. Where it
   * cannot, such as a browser without side panels, the floating shortcuts
   * panel opens instead, if the shortcuts are on.
   */
  function openSidePanel() {
    var fallback = function () {
      if (state.shortcuts && BCBuddy.shortcutsOn(state.settings)) state.shortcuts.toggle();
    };
    try {
      chrome.runtime.sendMessage({ type: 'bcb:toggle-side-panel' })
        .then(function (answer) { if (!answer || !answer.ok) fallback(); })
        .catch(fallback);
    } catch (e) { fallback(); }
  }

  /**
   * Our side panel (src/sidepanel/) connects to this tab's top frame to show
   * its shortcuts. Only our own extension pages may: a page cannot open a
   * port to a content script, and another frame of ours has a tab.
   */
  function panelConnected(port) {
    var sender = port.sender || {};
    if (port.name !== 'bcb-shortcuts' || sender.id !== chrome.runtime.id || sender.tab ||
        String(sender.url || '').indexOf(chrome.runtime.getURL('/')) !== 0) {
      port.disconnect();
      return;
    }
    var entry = { port: port, stop: null };
    state.panelPorts.push(entry);
    port.onDisconnect.addListener(function () {
      if (entry.stop) entry.stop();
      state.panelPorts = state.panelPorts.filter(function (e) { return e !== entry; });
    });
    if (state.shortcuts) feedPanel(entry);
    else postToPanel(port, { type: 'none' });
  }

  function feedPanel(entry) {
    if (entry.stop || !state.shortcuts) return;
    entry.stop = state.shortcuts.listen(function (list) {
      postToPanel(entry.port, { type: 'sections', sections: list });
    });
  }

  function postToPanel(port, message) {
    try { port.postMessage(message); } catch (e) { /* the panel closed */ }
  }

  /* ------------------------------------------------------------- cleanup */

  function clearAll() {
    var frame = document.getElementById(FRAME_ID);
    if (frame) frame.remove();
    var banner = document.getElementById(BANNER_ID);
    if (banner) banner.remove();
    document.documentElement.removeAttribute(TOP_BAR_ATTR);
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
    ['--bcb-color', '--bcb-text', '--bcb-border-width', '--bcb-bar-bg',
      '--bcb-bar-text', '--bcb-bar-font-size', '--bcb-top-height'].forEach(function (v) {
      root.style.removeProperty(v);
    });

    state.maximized = new WeakMap();
    state.pinned = new WeakSet();
    state.factBoxes = new WeakMap();
  }

  /* -------------------------------------------------------------- company */

  /**
   * BC online opens your default company without ?company= in the address.
   * The company then comes from the page: the environment button in BC's top
   * bar, whose title reads "Cronus België, Environment: Sandbox", or else the
   * Role Center heading in the client frame. Both show the company's display
   * name. Only on BC online, only while the address names no company, and at
   * most every COMPANY_RETRY_MS until found: one lookup by id, and an
   * attribute search only when the button gave nothing. Once found it is part
   * of state.ctx until the address changes, so rules and texts use it.
   */
  function companyFromPage() {
    var now = Date.now();
    if (now - state.lastCompanyLook < COMPANY_RETRY_MS) return;
    state.lastCompanyLook = now;

    var company = '';
    var shell = sameOriginDocument(IS_TOP ? window : window.top);
    var launcher = shell && shell.getElementById('BC_EnvironmentLauncher');
    var button = launcher && launcher.querySelector('button[title]');
    if (button) company = BCBuddy.companyFromLauncher(button.getAttribute('title'));
    if (!company) {
      var client = IS_TOP ? clientDocument() : document;
      var home = client && client.querySelector('a[data-home-node="true"] [role="heading"] [aria-label]');
      // aria-label, not the text: the heading holds the caption twice.
      if (home) company = BCBuddy.tidyCompany(home.getAttribute('aria-label'));
    }
    if (!company) return;

    var ctx = {};
    Object.keys(state.ctx).forEach(function (key) { ctx[key] = state.ctx[key]; });
    ctx.company = company;
    state.ctx = ctx;
  }

  /** The document of a window on this origin; null across origins. */
  function sameOriginDocument(win) {
    try {
      return win.document;
    } catch (e) {
      return null;
    }
  }

  /** The BC client frame's document, from the top window. */
  function clientDocument() {
    var frame = document.querySelector('iframe.designer-client-frame');
    return frame ? sameOriginDocument(frame.contentWindow) : null;
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
