/*
 * BC Buddy - dropdown sizer.
 *
 * Business Central opens a lookup (the dropdown under a field such as
 * Country/Region Code or an item No. on a line) as div.spa-view.spa-lookup, a
 * direct child of a div.spa-container. Its stylesheet caps that popup, and three
 * containers inside it, at a fixed max-width and max-height. We lift those caps
 * per dropdown: the width follows the columns, the height is a ceiling, and BC
 * still positions the popup itself (below or above the field, shifted left when
 * it runs out of room).
 *
 * This runs while people type, so it has to cost nothing: the observer only
 * watches the direct children of each .spa-container, never the whole tree, and
 * the width comes from the column widths BC writes on the header cells rather
 * than from a layout measurement.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  // Slider step 1-5 as a factor of BC's own size. Step 1 is BC standard.
  // Width matters more than height: a list wants its columns, and ten rows are
  // plenty to pick from.
  var WIDTH_FACTORS = [1, 1.25, 1.5, 1.75, 2];
  var HEIGHT_FACTORS = [1, 1.125, 1.25, 1.375, 1.5];

  // BC's own caps today. Only used when its stylesheet cannot be read; normally
  // the live value is read from the first dropdown, so a BC release that
  // changes them scales the steps along.
  var BC_WIDTH = 532;
  var BC_HEIGHT = 238;

  var CONTAINER_CLASS = 'spa-container';
  var LOOKUP_CLASS = 'spa-lookup';
  // A field you cannot edit (a page in view mode, a read-only field) opens a
  // record card in the same kind of popup instead of a list. BC only adds this
  // class a moment after inserting it, so on arrival the card is told apart by
  // its form and by having no grid; see isList().
  var PREVIEW_CLASS = 'spa-preview-lookup';
  var PREVIEW_FORM_SEL = '.ms-nav-previewlookupform';
  var HEADER_SEL = 'table.ms-nav-grid-header-table';
  var HEADER_CELLS_SEL = HEADER_SEL + ' thead tr:last-child th';
  var MARK = 'data-bcb-dropdown';
  var WIDTH_VAR = '--bcb-dropdown-width';
  var HEIGHT_VAR = '--bcb-dropdown-height';

  // Room for a vertical scrollbar. A short list has none, so this errs a few
  // pixels wide there; erring narrow would add a horizontal scrollbar instead.
  var SCROLLBAR_PX = 17;

  var EX_RE = /^(\d+(?:\.\d+)?)ex$/;

  function factor(table, step) {
    return table[step - 1] || 1;
  }

  /** On when either slider is above BC standard. */
  function isOn(dropdown) {
    return !!dropdown && (dropdown.width > 1 || dropdown.height > 1);
  }

  /** Sum of the column widths BC gives in ex ('15ex'); 0 when it gives none. */
  function columnEx(widths) {
    var total = 0;
    (widths || []).forEach(function (width) {
      var match = EX_RE.exec(String(width || '').trim());
      if (match) total += parseFloat(match[1]);
    });
    return total;
  }

  /**
   * The width a dropdown gets: what its columns need, never narrower than BC
   * standard and never wider than the maximum. Without a usable natural width
   * (BC changed how it sizes columns) it takes the maximum, as a plain stretch.
   */
  function fitWidth(natural, base, max) {
    if (!(natural > 0)) return Math.round(max);
    return Math.round(Math.min(max, Math.max(base, natural)));
  }

  /**
   * Only a list to pick from is sized: a lookup popup with a grid in it. A
   * record card, or anything else BC shows in the same popup, keeps its own
   * size.
   */
  function isList(node) {
    return node.nodeType === 1 && node.classList.contains(LOOKUP_CLASS) &&
      !node.classList.contains(PREVIEW_CLASS) && !node.querySelector(PREVIEW_FORM_SEL) &&
      !!node.querySelector(HEADER_SEL);
  }

  function px(value, fallback) {
    var n = parseFloat(value);
    return n > 0 ? n : fallback;
  }

  /**
   * Starts sizing the dropdowns in this document. Returns a handle whose
   * detach() stops it and hands every open dropdown back to BC.
   */
  function attach(doc, dropdown) {
    var win = doc.defaultView;
    var widthStep = dropdown.width;
    var heightStep = dropdown.height;
    // Read from the first dropdown and kept: BC's caps, and the two numbers
    // that turn a sum of ex widths into pixels.
    var base = null;
    var metrics = null;
    var detached = false;

    var lookups = new win.MutationObserver(onLookups);
    var containers = new win.MutationObserver(onContainers);

    if (doc.body) start();
    else doc.addEventListener('DOMContentLoaded', start, { once: true });

    function start() {
      if (detached || !doc.body) return;
      containers.observe(doc.body, { childList: true });
      var children = doc.body.children;
      for (var i = 0; i < children.length; i++) watch(children[i]);
    }

    function watch(node) {
      if (node.nodeType === 1 && node.classList.contains(CONTAINER_CLASS)) {
        lookups.observe(node, { childList: true });
      }
    }

    function onContainers(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) watch(added[j]);
      }
    }

    function onLookups(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (isList(added[j])) size(added[j]);
        }
      }
    }

    function size(lookup) {
      // Before the mark goes on, so this is still BC's own cap.
      if (!base) base = readBase(lookup);
      var maxWidth = base.width * factor(WIDTH_FACTORS, widthStep);
      var width = widthStep > 1 ? fitWidth(naturalWidth(lookup), base.width, maxWidth) : base.width;
      var height = Math.round(base.height * factor(HEIGHT_FACTORS, heightStep));
      lookup.style.setProperty(WIDTH_VAR, width + 'px');
      lookup.style.setProperty(HEIGHT_VAR, height + 'px');
      lookup.setAttribute(MARK, '');
    }

    function readBase(lookup) {
      var style = win.getComputedStyle(lookup);
      return {
        width: px(style.maxWidth, BC_WIDTH),
        height: px(style.maxHeight, BC_HEIGHT)
      };
    }

    function naturalWidth(lookup) {
      var cells = lookup.querySelectorAll(HEADER_CELLS_SEL);
      var widths = [];
      for (var i = 0; i < cells.length; i++) widths.push(cells[i].style.width);
      var ex = columnEx(widths);
      if (!ex) return 0;
      if (!metrics) metrics = calibrate(lookup, cells);
      return metrics ? ex * metrics.exPx + metrics.fixedPx : 0;
    }

    /**
     * Once per document: how many pixels an ex is in the grid font, and how
     * much the columns without an ex width (the row selector) and the popup's
     * own edges add. This is the only layout read the sizer ever does.
     */
    function calibrate(lookup, cells) {
      var header = lookup.querySelector(HEADER_SEL);
      var cell = null;
      var widths = [];
      for (var i = 0; i < cells.length; i++) {
        widths.push(cells[i].style.width);
        if (!cell && EX_RE.test(cells[i].style.width)) cell = cells[i];
      }
      if (!header || !cell || !header.parentElement) return null;

      var probe = doc.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;height:0;width:100ex';
      cell.appendChild(probe);
      var exPx = probe.offsetWidth / 100;
      probe.remove();

      // A table with fixed layout cannot get narrower than its columns, so at
      // width 0 its width is exactly what they add up to.
      var previous = header.style.width;
      header.style.width = '0px';
      var natural = header.offsetWidth;
      header.style.width = previous;

      if (!(exPx > 0) || !(natural > 0)) return null;
      var gutter = px(win.getComputedStyle(header).paddingRight, 0);
      var edges = lookup.offsetWidth - header.parentElement.clientWidth;
      return {
        exPx: exPx,
        fixedPx: natural - gutter - columnEx(widths) * exPx + Math.max(0, edges) + SCROLLBAR_PX
      };
    }

    function detach() {
      detached = true;
      lookups.disconnect();
      containers.disconnect();
      var marked = doc.querySelectorAll('[' + MARK + ']');
      for (var i = 0; i < marked.length; i++) {
        marked[i].removeAttribute(MARK);
        marked[i].style.removeProperty(WIDTH_VAR);
        marked[i].style.removeProperty(HEIGHT_VAR);
      }
    }

    return { detach: detach };
  }

  BCBuddy.Dropdowns = {
    WIDTH_FACTORS: WIDTH_FACTORS,
    HEIGHT_FACTORS: HEIGHT_FACTORS,
    BC_WIDTH: BC_WIDTH,
    BC_HEIGHT: BC_HEIGHT,
    MARK: MARK,
    factor: factor,
    isOn: isOn,
    isList: isList,
    columnEx: columnEx,
    fitWidth: fitWidth,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
