/*
 * BC Buddy - content script.
 *
 * Zoekt de regel die bij de huidige URL past en tekent:
 *   - een gekleurd kader rond de pagina
 *   - een banner boven- of onderaan
 *   - de BC-ribbon in de kleur van de regel, met een eigen tekst
 *   - optioneel de tabtitel en de favicon
 *
 * Business Central is een SPA die zijn eigen DOM voortdurend hertekent. Daarom
 * is alles idempotent: reassert() mag zo vaak lopen als nodig en doet niets
 * wanneer alles al klopt. Dat voorkomt ook een lus met de MutationObserver.
 */
(function () {
  'use strict';

  var BCEM = self.BCEM;
  if (!BCEM) return;

  // De Business Central client rendert delen van de UI in een iframe. Het kader,
  // de banner, de titel en de favicon horen in het bovenste venster; de ribbon
  // tekenen we in elk frame waar we hem vinden.
  var IS_TOP = window.top === window.self;

  var FRAME_ID = 'bcem-frame';
  var BANNER_ID = 'bcem-banner';
  var FAVICON_REL = 'icon';

  var BRAND_PATTERNS = [
    /^micro(soft)?\s+dynamics\s+365\s+business\s+central/i,
    /^dynamics\s+365\s+business\s+central/i,
    /^business\s+central$/i
  ];

  // Elementen in de ribbon die hun eigen achtergrond mogen houden.
  var KEEP_PAINT = { INPUT: 1, TEXTAREA: 1, SELECT: 1, IMG: 1, CANVAS: 1, VIDEO: 1, svg: 1 };

  // Een burst DOM-wijzigingen wordt tot een enkele reassert gebundeld. Vier keer
  // per seconde volstaat: BC hertekent zichzelf, wij hoeven daar niet elk
  // animatieframe achteraan te lopen.
  var SCHEDULE_MS = 250;

  // Vangnet naast de observer: BC kan hertekenen zonder dat wij het merken
  // (bijvoorbeeld in een frame dat pas later meedoet).
  var POLL_MS = 800;

  // Zoeken naar de merknaam kamt het hele document uit. Op een Business
  // Central-host loont dat - daar staat er een ribbon, en zodra we ze gevonden
  // hebben, onthouden we ze. Elders is de kans klein: een gemarkeerde niet-BC
  // site heeft er geen, en een on-prem installatie krijgt ze pas even na het
  // laden. Daar zoeken we hoogstens eens per zoveel milliseconden opnieuw.
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
    // Wanneer we voor het laatst het document uitkamden op zoek naar de ribbon,
    // en of we er ooit een gevonden hebben (dan is dit Business Central).
    lastBrandSearch: 0,
    bcSeen: false,
    // Elementen in de ribbon waarvan we de eigen achtergrond uitzetten.
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
        if (area !== 'local' || !changes[BCEM.STORAGE_KEY]) return;
        state.settings = BCEM.normalize(changes[BCEM.STORAGE_KEY].newValue);
        clearAll();
        state.rule = null;
        apply();
      });
    } catch (e) { /* extensie herladen; volgende paginalading pikt het op */ }
  }

  function read() {
    return BCEM.loadSettings().catch(function () { return BCEM.normalize(null); });
  }

  function start() {
    apply();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply, { once: true });
    }
    window.addEventListener('popstate', apply);
    window.addEventListener('hashchange', apply);
    window.addEventListener('resize', schedule);

    state.observer = new MutationObserver(schedule);
    state.observer.observe(document.documentElement, { childList: true, subtree: true });

    restartPoll();
  }

  function restartPoll() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(apply, POLL_MS);
  }

  /** Bundelt bursts van DOM-wijzigingen tot een enkele reassert. */
  function schedule() {
    if (state.scheduled) return;
    state.scheduled = true;
    setTimeout(function () {
      state.scheduled = false;
      apply();
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
      state.ctx = BCEM.parseUrl(href);
      // Een andere pagina kan een andere site zijn: opnieuw beginnen, en meteen
      // een zoektocht toestaan.
      state.lastBrandSearch = 0;
      state.bcSeen = false;
    }

    // Regels gelden op elke site. Aan de URL alleen valt niet te zien dat een
    // eigen host Business Central draait, dus een filter op de BC-host zou
    // on-prem installaties buitensluiten.
    var rule = settings.enabled
      ? BCEM.findRule(BCEM.effectiveRules(settings), state.ctx)
      : null;

    var changed = !sameRule(rule, state.rule);
    if (changed) {
      clearAll();
      state.rule = rule;
    }
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
    var text = rule.textColor === 'auto' ? BCEM.idealText(rule.color) : rule.textColor;
    root.style.setProperty('--bcem-color', rule.color);
    root.style.setProperty('--bcem-text', text);
    root.style.setProperty('--bcem-border-width', rule.border.width + 'px');
    root.style.setProperty('--bcem-bar-bg', BCEM.toRgba(rule.color, rule.banner.opacity));
    root.style.setProperty('--bcem-bar-font-size', (rule.banner.fontSize || 13) + 'px');
  }

  /* ---------------------------------------------------------------- kader */

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

    var corner = BCEM.isCorner(rule.banner.position);
    var className = (corner ? 'bcem-corner bcem-corner--' : 'bcem-bar bcem-bar--') + rule.banner.position;

    if (!el) {
      el = document.createElement('div');
      el.id = BANNER_ID;
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    } else if (el.parentNode !== document.body) {
      document.body.appendChild(el);
    }
    if (el.className !== className) el.className = className;

    var text = BCEM.renderTidy(rule.banner.text || '{name}', state.ctx, extras(rule));
    if (el.textContent !== text) {
      el.textContent = text;
      el.removeAttribute('data-bcem-fitted');
    }
    autoFit(el, rule, corner);
  }

  /**
   * Bij tekstgrootte 0 ("automatisch") krimpt de tekst tot ze past, net zoals
   * de tekst in een hoeklint anders zou worden afgekapt.
   */
  function autoFit(el, rule, corner) {
    if (rule.banner.fontSize > 0) {
      el.style.fontSize = rule.banner.fontSize + 'px';
      return;
    }
    var signature = el.textContent + '|' + el.clientWidth;
    if (el.getAttribute('data-bcem-fitted') === signature) return;

    var max = corner ? 18 : 14;
    var min = 9;
    var size = max;
    el.style.fontSize = size + 'px';
    while (size > min && el.scrollWidth > el.clientWidth) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
    el.setAttribute('data-bcem-fitted', signature);
  }

  /* --------------------------------------------------------------- ribbon */

  function applyRibbon(rule) {
    if (!rule.ribbon.enabled) {
      releaseRibbon();
      return;
    }
    var brand = getBrandElement();
    if (!brand) return;

    var original = brand.getAttribute('data-bcem-orig');
    if (original == null) {
      original = (brand.textContent || '').trim();
      brand.setAttribute('data-bcem-orig', original);
    }
    brand.setAttribute('data-bcem-brand', '');

    var text = BCEM.renderTidy(rule.ribbon.text, state.ctx, extras(rule));
    if (text && brand.textContent !== text) brand.textContent = text;

    var band = getBandElement(brand);
    if (!band) return;
    if (!band.hasAttribute('data-bcem-ribbon')) band.setAttribute('data-bcem-ribbon', '');
    clearRibbonPaint(band);
  }

  /**
   * De knoppen rechts in de ribbon dragen hun eigen achtergrond mee. Onze CSS
   * raakt die niet altijd - BC zet ze soms rechtstreeks op het element, en dan
   * wint die stijl - dus lezen we op wat er effectief geschilderd wordt en
   * zetten we dat per element uit. Zo blijven er geen donkere blokjes tussen
   * de icoontjes staan.
   */
  function clearRibbonPaint(root) {
    var nodes = root.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      // Wat zijn eigen achtergrond nodig heeft om leesbaar of zichtbaar te
      // blijven, laten we met rust.
      if (KEEP_PAINT[el.tagName]) continue;
      if (el.shadowRoot) clearRibbonPaint(el.shadowRoot);
      if (el.hasAttribute('data-bcem-paint')) continue;

      var style = getComputedStyle(el);
      // Een verloop is opmaak van de balk; een afbeelding is inhoud (een avatar).
      var gradient = style.backgroundImage.indexOf('gradient') !== -1;
      if (!gradient && !paints(style.backgroundColor)) continue;

      el.setAttribute('data-bcem-paint', el.getAttribute('style') || '');
      el.style.setProperty('background-color', 'transparent', 'important');
      if (gradient) el.style.setProperty('background-image', 'none', 'important');
      state.painted.push(el);
    }
  }

  /** Schildert deze kleur echt iets, of kijk je er dwars doorheen? */
  function paints(color) {
    var parts = /rgba?\(([^)]+)\)/.exec(color || '');
    if (!parts) return false;
    var bits = parts[1].split(',');
    return (bits.length > 3 ? parseFloat(bits[3]) : 1) > 0.05;
  }

  function restorePaint() {
    state.painted.forEach(function (el) {
      var original = el.getAttribute('data-bcem-paint');
      if (original) {
        el.setAttribute('style', original);
      } else {
        el.removeAttribute('style');
      }
      el.removeAttribute('data-bcem-paint');
    });
    state.painted = [];
  }

  function getBrandElement() {
    var marked = document.querySelector('[data-bcem-brand]');
    if (marked && marked.isConnected) return marked;
    if (!brandSearchDue()) return null;

    var nodes = document.querySelectorAll('span, a, div, h1, h2, button, p');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length) continue; // enkel bladeren met eigen tekst
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
   * Mag er nu opnieuw naar de merknaam gezocht worden? Op Business Central
   * altijd - daar wil je de balk meteen terug hebben als de client hertekent.
   * Elders zou dat het hele document blijven uitkammen voor iets wat er
   * hoogstwaarschijnlijk niet staat, dus daar geldt een wachttijd.
   */
  function brandSearchDue() {
    // Een on-prem installatie staat op een eigen host, dus die herkennen we niet
    // aan de URL. Vonden we hier al eens een ribbon, dan is dit wel degelijk
    // Business Central en zoeken we weer zonder rem.
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

  /** De volledige balk waarin de merknaam staat: outermost element dat bovenaan de pagina de volle breedte inneemt. */
  function getBandElement(brand) {
    var existing = document.querySelector('[data-bcem-ribbon]');
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
    var brand = document.querySelector('[data-bcem-brand]');
    if (brand) {
      var original = brand.getAttribute('data-bcem-orig');
      if (original != null && brand.textContent !== original) brand.textContent = original;
      brand.removeAttribute('data-bcem-brand');
      brand.removeAttribute('data-bcem-orig');
    }
    var band = document.querySelector('[data-bcem-ribbon]');
    if (band) band.removeAttribute('data-bcem-ribbon');
    restorePaint();
  }

  /* ---------------------------------------------------------------- titel */

  function applyTitle(rule) {
    if (!rule.title.enabled) {
      if (state.titleApplied && document.title === state.titleApplied) {
        document.title = state.titleOriginal;
      }
      state.titleApplied = null;
      return;
    }
    if (document.title !== state.titleApplied) {
      // BC heeft de titel zelf geschreven: dat is onze nieuwe basis.
      state.titleOriginal = document.title;
    }
    var next = BCEM.renderTidy(rule.title.text, state.ctx, extras(rule));
    if (next && document.title !== next) {
      document.title = next;
      state.titleApplied = next;
    }
  }

  /* -------------------------------------------------------------- favicon */

  function applyFavicon(rule) {
    if (!rule.favicon.enabled) {
      var ours = document.querySelector('link[data-bcem-favicon]');
      if (ours) {
        ours.remove();
        restoreFavicons();
      }
      return;
    }
    var existing = document.querySelector('link[data-bcem-favicon]');
    var label = (rule.favicon.text || rule.name || '').trim();
    var signature = rule.color + '|' + label;
    if (existing && existing.getAttribute('data-bcem-favicon') === signature) return;

    var href = drawFavicon(rule.color, label);
    if (!href) return;

    hideFavicons();
    var link = existing || document.createElement('link');
    link.rel = FAVICON_REL;
    link.type = 'image/png';
    link.setAttribute('data-bcem-favicon', signature);
    link.href = href;
    if (!link.parentNode) (document.head || document.documentElement).appendChild(link);
  }

  function hideFavicons() {
    var links = document.querySelectorAll('link[rel~="icon" i]:not([data-bcem-favicon])');
    for (var i = 0; i < links.length; i++) {
      if (!links[i].hasAttribute('data-bcem-was-rel')) {
        links[i].setAttribute('data-bcem-was-rel', links[i].rel);
      }
      links[i].rel = 'bcem-disabled-icon';
    }
  }

  function restoreFavicons() {
    var links = document.querySelectorAll('link[data-bcem-was-rel]');
    for (var i = 0; i < links.length; i++) {
      links[i].rel = links[i].getAttribute('data-bcem-was-rel');
      links[i].removeAttribute('data-bcem-was-rel');
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
        ctx2d.fillStyle = BCEM.idealText(color);
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

  /* ------------------------------------------------------------- opruimen */

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

    var favicon = document.querySelector('link[data-bcem-favicon]');
    if (favicon) {
      favicon.remove();
      restoreFavicons();
    }

    var root = document.documentElement;
    ['--bcem-color', '--bcem-text', '--bcem-border-width',
      '--bcem-bar-bg', '--bcem-bar-font-size'].forEach(function (v) {
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
   * In een iframe telt de URL van het bovenste venster: die bevat de omgeving
   * en het bedrijf. Bij een cross-origin frame valt dit terug op de eigen URL.
   */
  function contextHref() {
    if (!IS_TOP) {
      try {
        var topHref = window.top.location.href;
        if (topHref) return topHref;
      } catch (e) { /* cross-origin: eigen URL gebruiken */ }
    }
    return location.href;
  }
})();
