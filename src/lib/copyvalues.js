/*
 * BC Buddy - copy values.
 *
 * Rest the mouse on a read-only value in a list, a FactBox or the Page
 * Inspection pane, or on a read-only field with a link on a card, and a small
 * copy icon appears in the cell; clicking it puts the value on the
 * clipboard, as BC shows it. Editable fields, check boxes and empty cells get
 * nothing.
 *
 * A hover feature has to know what is under the pointer, so this keeps the
 * one document-wide pointer listener BC Buddy has, and keeps it cheap: it only
 * listens to pointerover (an element boundary crossed, not every pixel), does
 * one closest() and resets one timer. Only after the pointer has rested on a
 * cell does it read that cell's rectangle (and, for an amount, where its text
 * is), once. The icon is our own element, appended to body; nothing is written
 * into BC's cells, which it recycles.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  // How long the pointer rests before the icon shows: sweeping across a list
  // shows nothing and does nothing.
  var REST_MS = 300;
  // How long the tick stays after a copy.
  var TICK_MS = 1500;
  // The icon's size and its distance from the cell edge, in px. Must match
  // #bcb-copy in content.css.
  var SIZE = 20;
  var INSET = 2;
  // Space between the icon and the value it sits next to.
  var GAP = 4;
  // How far the icon may reach past the cell's right edge, into the next
  // cell's padding, to stay off a value that fits. Small enough to stay clear
  // of the next cell's text and of BC's ... button in the first column of a
  // list (a 30 px cell with the glyph in its middle).
  var OVERHANG = 6;

  var ICON_ID = 'bcb-copy';
  var DONE_CLASS = 'bcb-copy--done';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // From the live client (BC SaaS, 2026-10-11). A read-only value, in a grid
  // cell (td), a FactBox or a card field (div), is a .stringcontrol-read.value
  // inside an .edit-container-read; an editable one is an input or a select,
  // with no such value.
  var VALUE_SEL = '.stringcontrol-read.value';
  // The Page Inspection pane (Ctrl+Alt+F1; BC 27 on-prem, 2026-10-19). Its
  // Page and Table boxes are read-only values like the ones above; each
  // table field is a tile (.brick-container) whose second line is the value
  // and whose right side is BC's own ... menu.
  var INSPECTOR_SEL = '.designer.inspector';
  var BRICK_SEL = INSPECTOR_SEL + ' .brick-container';
  var BRICK_VALUE_SEL = '.brick-field-1';
  var BRICK_MENU_SEL = '.brick-context-menu';
  var CELL_SEL = '.edit-container-read, ' + BRICK_SEL;
  // In lists, FactBoxes and Page Inspection every read-only value counts.
  var LIST_SEL = 'table.ms-nav-grid-data-table, .ms-nav-layout-factbox-content-area, ' + INSPECTOR_SEL;
  // On a card (a FastTab), only a read-only value that is a link, such as
  // Balance (LCY): text you can select with the mouse gets no icon there.
  var CARD_SEL = '.collapsibleTab';
  // A lookup dropdown is a list to pick from; an icon there gets in the way.
  var LOOKUP_SEL = '.spa-lookup';

  var COPY_PATHS = [
    'M5.5 2h6A2.5 2.5 0 0 1 14 4.5v6a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 3 10.5v-6A2.5 2.5 0 0 1 5.5 2zm0 1A1.5 1.5 0 0 0 4 4.5v6A1.5 1.5 0 0 0 5.5 12h6a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 11.5 3h-6z',
    'M2 5.5a.5.5 0 0 1 1 0v6A2.5 2.5 0 0 0 5.5 14h6a.5.5 0 0 1 0 1h-6A3.5 3.5 0 0 1 2 11.5v-6z'
  ];
  var DONE_PATHS = [
    'M13.35 4.15a.5.5 0 0 1 0 .7l-7 7a.5.5 0 0 1-.7 0l-3-3a.5.5 0 1 1 .7-.7L6 10.79l6.65-6.64a.5.5 0 0 1 .7 0z'
  ];

  /**
   * The value element of a cell that gets the icon, or null. The cell must be
   * read-only and show something, in a list, a FactBox or Page Inspection, or
   * be a link on a card.
   */
  function valueOf(cell) {
    if (!cell || !cell.classList) return null;
    if (cell.classList.contains('brick-container')) {
      var field = cell.closest(INSPECTOR_SEL) && cell.querySelector(BRICK_VALUE_SEL);
      return field && !field.classList.contains('empty') && textOf(field) ? field : null;
    }
    if (!cell.classList.contains('edit-container-read')) return null;
    if (cell.classList.contains('empty') || cell.classList.contains('ms-nav-hidden')) return null;
    var value = cell.querySelector(VALUE_SEL);
    if (!value || value.classList.contains('empty') || value.classList.contains('empty-anchor-link')) return null;
    if (!textOf(value)) return null;
    if (cell.closest(LOOKUP_SEL)) return null;
    if (cell.closest(LIST_SEL)) return value;
    if (value.tagName === 'A' && cell.closest(CARD_SEL)) return value;
    return null;
  }

  /**
   * What goes on the clipboard: the text BC shows, whole. textContent has the
   * full value even when CSS cuts it off, and reads no layout. Not the title:
   * on a link that is an action ("Open record 10000").
   */
  function textOf(value) {
    return (value.textContent || '').trim();
  }

  /**
   * The box the icon is placed in. A Page Inspection tile: the part left of
   * BC's ... menu, at the height of the value line. Anything else: the cell.
   */
  function boxOf(cell, value) {
    var rect = cell.getBoundingClientRect();
    if (!cell.classList.contains('brick-container')) return rect;
    var menu = cell.querySelector(BRICK_MENU_SEL);
    var line = value.getBoundingClientRect();
    var right = menu ? menu.getBoundingClientRect().left : rect.right;
    return { left: rect.left, right: right, width: right - rect.left, top: line.top, height: line.height };
  }

  /** The cell's free side: right-aligned values (amounts) get the icon left. */
  function sideOf(cell) {
    return cell.classList.contains('right') ? 'left' : 'right';
  }

  /**
   * Where the icon goes, vertically centred in the cell. On the right it sits
   * at the cell edge, unless that would cover a value that fits: then just
   * after the text, up to OVERHANG past the edge (the key column of a list,
   * with BC's ... in the next cell, leaves less room than the icon needs). A
   * value cut off with an ellipsis has no room after it; the icon stays at
   * the edge, over the ellipsis. On the left it sits just before the text,
   * so a wide field does not leave it far from the amount; never outside the
   * cell.
   */
  function place(rect, side, textRect) {
    var x = rect.right - SIZE - INSET;
    if (side === 'left') {
      x = rect.left + INSET;
      if (textRect) x = Math.max(x, textRect.left - SIZE - GAP);
    } else if (textRect && textRect.right + GAP > x &&
               textRect.right + GAP + SIZE <= rect.right + OVERHANG) {
      x = textRect.right + GAP;
    }
    return { x: Math.round(x), y: Math.round(rect.top + (rect.height - SIZE) / 2) };
  }

  /**
   * Where the text itself is. Not the value element's box: in lists and
   * FactBoxes BC sizes it to the text, but on a card it is a block as wide as
   * the field. A range over its contents is the text in both cases.
   */
  function textRect(value) {
    var range = value.ownerDocument.createRange();
    range.selectNodeContents(value);
    return range.getBoundingClientRect();
  }

  function svg(doc, paths, className) {
    var el = doc.createElementNS(SVG_NS, 'svg');
    el.setAttribute('viewBox', '0 0 16 16');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('class', className);
    paths.forEach(function (d) {
      var path = doc.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      el.appendChild(path);
    });
    return el;
  }

  /**
   * Puts text on the clipboard. Where the async API is missing (on-prem over
   * plain HTTP) a hidden textarea and execCommand do it, and focus goes back
   * to where it was.
   */
  function copy(doc, text) {
    var nav = doc.defaultView && doc.defaultView.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      return nav.clipboard.writeText(text).catch(function () { return fallback(doc, text); });
    }
    return fallback(doc, text);
  }

  function fallback(doc, text) {
    var focused = doc.activeElement;
    var area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    doc.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    if (focused && focused.focus) focused.focus();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  /**
   * Starts the copy icon in this document. labels: { copy, copied }. Returns
   * a handle whose detach() removes the listener and the icon.
   */
  function attach(doc, labels) {
    var win = doc.defaultView;
    var icon = doc.createElement('button');
    icon.id = ICON_ID;
    icon.type = 'button';
    icon.tabIndex = -1;
    icon.hidden = true;
    icon.appendChild(svg(doc, COPY_PATHS, 'bcb-copy__copy'));
    icon.appendChild(svg(doc, DONE_PATHS, 'bcb-copy__done'));
    label(labels.copy);

    var pending = null;   // the cell the pointer is resting on
    var current = null;   // the cell the icon is shown for
    var restTimer = 0;
    var tickTimer = 0;

    doc.addEventListener('pointerover', onOver, { capture: true, passive: true });
    icon.addEventListener('pointerdown', swallow);
    icon.addEventListener('mousedown', swallow);
    icon.addEventListener('mouseup', swallow);
    icon.addEventListener('click', onClick);

    function label(text) {
      icon.title = text;
      icon.setAttribute('aria-label', text);
    }

    function onOver(event) {
      if (event.pointerType === 'touch') return;
      var target = event.target;
      if (target === icon || icon.contains(target)) {
        clearTimeout(restTimer);
        return;
      }
      var cell = target.closest ? target.closest(CELL_SEL) : null;
      // Still the same cell, only another element inside it.
      if (cell && (cell === current || cell === pending)) return;
      clearTimeout(restTimer);
      if (current) hide();
      pending = cell;
      if (cell) restTimer = setTimeout(show, REST_MS);
    }

    function show() {
      var cell = pending;
      pending = null;
      var value = cell && cell.isConnected && valueOf(cell);
      if (!value || !doc.body) return;
      var rect = boxOf(cell, value);
      // A cell too narrow to keep the value readable next to the icon.
      // FactBox rows are about as tall as the icon, so height is no limit.
      if (rect.width < SIZE * 3) return;
      var at = place(rect, sideOf(cell), textRect(value));
      if (icon.parentNode !== doc.body) doc.body.appendChild(icon);
      reset();
      icon.style.transform = 'translate(' + at.x + 'px,' + at.y + 'px)';
      icon.hidden = false;
      current = cell;
      // Only while the icon shows: anything that moves the page or starts
      // typing takes it away. None of these stay attached.
      win.addEventListener('scroll', hide, { capture: true, passive: true });
      doc.addEventListener('keydown', hide, true);
      doc.addEventListener('pointerdown', onPointerDown, true);
      doc.addEventListener('pointerout', onOut, true);
    }

    function hide() {
      if (!current) return;
      current = null;
      icon.hidden = true;
      reset();
      win.removeEventListener('scroll', hide, true);
      doc.removeEventListener('keydown', hide, true);
      doc.removeEventListener('pointerdown', onPointerDown, true);
      doc.removeEventListener('pointerout', onOut, true);
    }

    function onPointerDown(event) {
      if (event.target !== icon && !icon.contains(event.target)) hide();
    }

    // The pointer left the frame altogether.
    function onOut(event) {
      if (!event.relatedTarget) hide();
    }

    // BC must not see the press: it would move its selection or close the
    // page part the icon sits over.
    function swallow(event) {
      event.preventDefault();
      event.stopPropagation();
    }

    function onClick(event) {
      swallow(event);
      var value = current && valueOf(current);
      if (!value) return;
      copy(doc, textOf(value)).then(function () {
        if (!current) return;
        icon.classList.add(DONE_CLASS);
        label(labels.copied);
        clearTimeout(tickTimer);
        tickTimer = setTimeout(reset, TICK_MS);
      }, function () { /* the icon simply stays a copy icon */ });
    }

    function reset() {
      clearTimeout(tickTimer);
      icon.classList.remove(DONE_CLASS);
      label(labels.copy);
    }

    function detach() {
      clearTimeout(restTimer);
      hide();
      doc.removeEventListener('pointerover', onOver, true);
      icon.remove();
    }

    return { detach: detach, icon: icon };
  }

  BCBuddy.CopyValues = {
    REST_MS: REST_MS,
    TICK_MS: TICK_MS,
    SIZE: SIZE,
    ICON_ID: ICON_ID,
    valueOf: valueOf,
    textOf: textOf,
    sideOf: sideOf,
    boxOf: boxOf,
    place: place,
    textRect: textRect,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
