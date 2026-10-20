/*
 * BC Buddy - resize panes.
 *
 * Business Central opens Help, Copilot, Page Inspection and the
 * Personalization field list at a fixed width. This gives each a drag handle
 * on its left edge, as BC has for the FactBox pane: drag to make the pane
 * wider or narrower, double-click to give it back its own width. The width is
 * remembered per kind of pane, in every BC tab.
 *
 * From the live client (BC 25 on-prem and BC 28 online, 2026-10-20):
 *   - Page Inspection and Personalization live in the top window, in
 *     .designer > .pane-content > .designer-design-pane. That element stays in
 *     the page; BC adds .expanded while it is open and sizes it with a width
 *     rule (300 px, 350 px for Page Inspection).
 *   - Help and Copilot are a <div> BC adds right under <body> of the client
 *     frame, sized by its own inline --panel-width (340 px). Its class names
 *     are hashed per build (BC 28 adds .spa-pane, BC 25 has none), so the
 *     inline property is what we go by.
 *
 * The handle is a ::before in content.css, so nothing is added to BC's DOM
 * and nothing needs watching. Widths are custom properties on <html>, which
 * BC leaves alone, used by CSS only while one is saved. What runs: one
 * capturing pointerdown listener per frame, which returns after one matches()
 * unless the press is on a pane's left edge. Only during a drag are there
 * pointermove and pointerup listeners, on the pane itself, and those write
 * one property per animation frame.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  // Where the widths are kept in chrome.storage.local: { inspect, design, side }
  // in px. Not part of the settings: it is how one person likes their screen,
  // like the FactBox width BC remembers, so it is neither exported nor shared.
  var STORAGE_KEY = 'paneWidths';

  // The attribute on <html> that shows the handles; content.css keys on it.
  var ON_ATTR = 'data-bcb-panes';

  // Kinds of pane, each with its own width: the custom property and the
  // attribute that says one is saved.
  var KINDS = ['inspect', 'design', 'side'];

  // How wide the grab zone on the left edge is, in px, as BC's own FactBox
  // handle (2px bar + 10px). Must match the ::before in content.css.
  var HANDLE = 12;
  // Bounds for a width, in px. CSS also keeps room for the page next to the
  // pane when the window is narrow.
  var MIN = 240;
  var MAX = 2400;
  // Two presses on the handle within this many ms, without a drag, give the
  // pane back its own width.
  var DOUBLE_MS = 400;

  var DESIGN_SEL = '.designer > .pane-content > .designer-design-pane.expanded';
  var SIDE_SEL = 'body > div[style*="--panel-width"]';

  /** Which kind of pane this element is, or ''. */
  function kindOf(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.matches(DESIGN_SEL)) {
      var designer = el.parentNode.parentNode;
      return designer.classList.contains('inspector') ? 'inspect' : 'design';
    }
    return el.matches(SIDE_SEL) ? 'side' : '';
  }

  /** A width from storage, in bounds and whole, or 0 when there is none. */
  function widthOf(value) {
    var n = parseFloat(value);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round(Math.min(MAX, Math.max(MIN, n)));
  }

  /** Saved widths, each through widthOf(); the ones not saved left out. */
  function normalizeWidths(stored) {
    var result = {};
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return result;
    KINDS.forEach(function (kind) {
      var w = widthOf(stored[kind]);
      if (w) result[kind] = w;
    });
    return result;
  }

  /** Puts saved widths on <html>, and clears the ones that are gone. */
  function show(html, widths) {
    KINDS.forEach(function (kind) {
      var name = 'data-bcb-pane-' + kind;
      if (widths[kind]) {
        html.style.setProperty('--bcb-pane-' + kind, widths[kind] + 'px');
        if (!html.hasAttribute(name)) html.setAttribute(name, '');
      } else {
        html.removeAttribute(name);
        html.style.removeProperty('--bcb-pane-' + kind);
      }
    });
  }

  function storage() {
    try { return chrome.storage.local; } catch (e) { return null; }
  }

  /**
   * Starts the handles in this document; returns { detach }. `store` stands
   * in for chrome.storage.local in tests.
   */
  function attach(doc, store) {
    var html = doc.documentElement;
    var area = store || storage();
    var widths = {};
    var drag = null;
    var lastPress = { kind: '', at: 0 };

    html.setAttribute(ON_ATTR, '');
    if (area) {
      area.get(STORAGE_KEY).then(function (obj) {
        if (!html.hasAttribute(ON_ATTR)) return;
        widths = normalizeWidths(obj && obj[STORAGE_KEY]);
        if (!drag) show(html, widths);
      }, function () {});
    }

    // Another tab or frame saved a width: follow it.
    function onChanged(changes, name) {
      if (name !== 'local' || !changes[STORAGE_KEY] || drag) return;
      widths = normalizeWidths(changes[STORAGE_KEY].newValue);
      show(html, widths);
    }
    try { chrome.storage.onChanged.addListener(onChanged); } catch (e) { /* tests, or reloaded */ }

    function onDown(event) {
      if (!event.isTrusted || event.button !== 0 || drag) return;
      var pane = event.target;
      var kind = kindOf(pane);
      if (!kind) return;
      var rect = pane.getBoundingClientRect();
      if (event.clientX - rect.left > HANDLE) return;
      event.preventDefault();
      event.stopPropagation();

      var now = Date.now();
      if (lastPress.kind === kind && now - lastPress.at < DOUBLE_MS) {
        lastPress.kind = '';
        reset(kind);
        return;
      }
      lastPress.kind = kind;
      lastPress.at = now;

      drag = {
        kind: kind,
        pane: pane,
        pointer: event.pointerId,
        startX: event.clientX,
        startWidth: rect.width,
        width: Math.round(rect.width),
        frame: 0
      };
      try { pane.setPointerCapture(event.pointerId); } catch (e) { /* pointer already gone */ }
      pane.addEventListener('pointermove', onMove);
      pane.addEventListener('pointerup', onUp);
      pane.addEventListener('lostpointercapture', onUp);
      html.setAttribute('data-bcb-pane-drag', '');
    }

    function onMove(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      // The pane sits on the right: moving left makes it wider.
      drag.width = widthOf(drag.startWidth + drag.startX - event.clientX);
      if (drag.width !== Math.round(drag.startWidth)) lastPress.kind = '';
      if (drag.frame) return;
      drag.frame = requestAnimationFrame(function () {
        if (!drag) return;
        drag.frame = 0;
        var draft = {};
        draft[drag.kind] = drag.width;
        show(html, mergeInto(widths, draft));
      });
    }

    function onUp(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      var done = drag;
      stopDrag();
      // A press without a move is the first half of a double-click: nothing
      // to save.
      if (done.width === Math.round(done.startWidth)) {
        show(html, widths);
        return;
      }
      widths[done.kind] = done.width;
      show(html, widths);
      save();
    }

    function stopDrag() {
      if (!drag) return;
      if (drag.frame) cancelAnimationFrame(drag.frame);
      var pane = drag.pane;
      var pointer = drag.pointer;
      drag = null;
      pane.removeEventListener('pointermove', onMove);
      pane.removeEventListener('pointerup', onUp);
      pane.removeEventListener('lostpointercapture', onUp);
      try { if (pane.hasPointerCapture(pointer)) pane.releasePointerCapture(pointer); } catch (e) { /* gone */ }
      html.removeAttribute('data-bcb-pane-drag');
    }

    function reset(kind) {
      if (!widths[kind]) return;
      delete widths[kind];
      show(html, widths);
      save();
    }

    function save() {
      if (!area) return;
      var payload = {};
      payload[STORAGE_KEY] = normalizeWidths(widths);
      try { area.set(payload).catch(function () {}); } catch (e) { /* extension reloaded */ }
    }

    doc.addEventListener('pointerdown', onDown, true);

    function detach() {
      stopDrag();
      doc.removeEventListener('pointerdown', onDown, true);
      try { chrome.storage.onChanged.removeListener(onChanged); } catch (e) { /* tests, or reloaded */ }
      html.removeAttribute(ON_ATTR);
      show(html, {});
    }

    return { detach: detach };
  }

  function mergeInto(base, extra) {
    var result = {};
    KINDS.forEach(function (kind) {
      var w = extra[kind] || base[kind];
      if (w) result[kind] = w;
    });
    return result;
  }

  BCBuddy.Panes = {
    STORAGE_KEY: STORAGE_KEY,
    HANDLE: HANDLE,
    MIN: MIN,
    MAX: MAX,
    kindOf: kindOf,
    widthOf: widthOf,
    normalizeWidths: normalizeWidths,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
