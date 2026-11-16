// Filter row (spike)
//
// `lib/filterrow.js`, run from `applyFilterRow()` in `content.js`. SPIKE: the
// pure parts (containsFilter, the cell rules) are tested; the selectors that
// touch BC's own column menu (MENU_*) are best guesses and must be confirmed
// against a live client before this ships. Everything BC-specific is in the
// constants below so one capture of the real DOM can fix it.
//
// What it does: a row of one text input per column, as the first row of the
// list's header table, so the inputs take the columns' widths and scroll with
// them without any scroll or resize listener. Typing a value and pressing
// Enter filters that column to rows that contain it; Enter on an empty input
// clears that column's filter.
//
// How the filter is applied: not by URL (that reloads the page) and not by
// writing BC's state, but by doing what a person does: open the column's menu,
// choose Filter, type the text, press Enter, in BC's own dialog. BC keeps the
// filter, shows its chips and clears it with its own controls.
//
// Cost: apply() calls sync() once per pass: one querySelector in the page on
// screen and a count of its header cells when our row is there. Nothing per
// row, scroll or keystroke; the only listeners are on our own inputs.

/*
 * BC Buddy - filter row.
 *
 * Adds a row of filter boxes above the column captions of a list. Type
 * something in a column's box and press Enter: the list shows the rows whose
 * value in that column contains it. Empty the box and press Enter to clear.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var ROW_CLASS = 'bcb-filterrow';
  var INPUT_CLASS = 'bcb-filterbox';
  var HEADER_SEL = 'table.ms-nav-grid-header-table';
  var HEADER_CELLS_SEL = 'thead tr:last-child th';
  // Never in a lookup dropdown or a card's subpage: lists only.
  var SKIP_ANCESTOR_SEL = '.spa-lookup, .spa-container, form.ms-nav-cardform, .ms-nav-layout-factbox-content-area';
  var TASK_DIALOG_CLASS = 'spa-task-dialog';
  var MAX_LEN = 100;

  // --- Guesses about BC's column menu; confirm on a live client. -------------
  // The clickable part of a column caption that opens the column menu.
  var MENU_OPENER_SEL = 'a, button, [role="button"]';
  // A popup that appears when the menu or filter dialog opens.
  var POPUP_SEL = '.ms-nav-popup, .spa-popup, [role="menu"], [role="dialog"]';
  // The menu entry that starts a filter, matched by its icon/class, not its text.
  var FILTER_ITEM_SEL = '[class*="Filter"], [class*="filter"]';
  var FILTER_INPUT_SEL = 'input[type="text"], input:not([type])';
  var STEP_MS = 50;
  var GIVE_UP_MS = 1500;

  // Characters BC reads as filter syntax. A contains filter built from text with
  // any of them would mean something else, so such text is refused, not escaped.
  var SYNTAX_RE = /[|&<>=()'"*?@]|\.\./;

  /**
   * The BC filter for "contains text": `@*text*` (case-insensitive, wildcard on
   * both sides). '' for an empty box (clear the filter); null for text that
   * cannot be turned into a contains filter safely (fail closed).
   */
  function containsFilter(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return '';
    if (t.length > MAX_LEN) return null;
    if (SYNTAX_RE.test(t)) return null;
    if (/[\u0000-\u001f\u007f]/.test(t)) return null;
    return '@*' + t + '*';
  }

  /** The header table of the list on screen in doc, or null. */
  function headerOf(doc) {
    var view = BCBuddy.Maximize.topView(doc);
    if (view.classList && view.classList.contains(TASK_DIALOG_CLASS)) return null;
    var table = view.querySelector(HEADER_SEL);
    if (!table || table.closest(SKIP_ANCESTOR_SEL)) return null;
    return table;
  }

  /** A column gets a box when its caption cell has text. */
  function isFilterable(th) {
    return th.textContent.trim().length > 0;
  }

  function captionCells(table) {
    return Array.prototype.slice.call(table.querySelectorAll(HEADER_CELLS_SEL));
  }

  function wait(test, done) {
    var waited = 0;
    (function poll() {
      var found = test();
      if (found) return done(found);
      waited += STEP_MS;
      if (waited >= GIVE_UP_MS) return done(null); // fail closed: filter nothing
      setTimeout(poll, STEP_MS);
    })();
  }

  function newest(doc, sel) {
    var all = doc.querySelectorAll(sel);
    return all.length ? all[all.length - 1] : null;
  }

  /**
   * Applies `filter` ('' clears) to the column whose caption cell is `th`
   * through BC's own column menu. Calls done(true) when the filter dialog took
   * the value, done(false) when any step was not found.
   */
  function drive(doc, th, filter, done) {
    var opener = th.querySelector(MENU_OPENER_SEL) || th;
    try { opener.click(); } catch (e) { return done(false); }
    wait(function () {
      var popup = newest(doc, POPUP_SEL);
      return popup && popup.querySelector(FILTER_ITEM_SEL) ? popup : null;
    }, function (menu) {
      if (!menu) return done(false);
      try { menu.querySelector(FILTER_ITEM_SEL).click(); } catch (e) { return done(false); }
      wait(function () {
        var popup = newest(doc, POPUP_SEL);
        return popup && popup.querySelector(FILTER_INPUT_SEL) ? popup.querySelector(FILTER_INPUT_SEL) : null;
      }, function (input) {
        if (!input) return done(false);
        input.focus();
        input.value = filter;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        done(true);
      });
    });
  }

  function buildRow(doc, table, labels) {
    var cells = captionCells(table);
    var tr = doc.createElement('tr');
    tr.className = ROW_CLASS;
    cells.forEach(function (th) {
      var cell = doc.createElement('th');
      cell.className = 'bcb-filtercell';
      if (isFilterable(th)) {
        var input = doc.createElement('input');
        input.type = 'text';
        input.className = INPUT_CLASS;
        input.maxLength = MAX_LEN;
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('aria-label', labels.filter + ': ' + th.textContent.trim());
        input.setAttribute('placeholder', labels.placeholder);
        input.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' || !e.isTrusted) return;
          e.stopPropagation(); // not BC's: Enter in the grid would open the row
          var filter = containsFilter(input.value);
          if (filter === null) { input.setAttribute('aria-invalid', 'true'); return; }
          input.removeAttribute('aria-invalid');
          drive(doc, th, filter, function (ok) {
            if (!ok) input.setAttribute('aria-invalid', 'true');
          });
        });
        cell.appendChild(input);
      }
      tr.appendChild(cell);
    });
    return tr;
  }

  /**
   * Keeps the filter row in the header of the list on screen. Returns at once
   * when the row is there and still matches the caption cells.
   */
  function sync(doc, labels) {
    var table = headerOf(doc);
    if (!table) return;
    var thead = table.tHead;
    if (!thead) return;
    var row = thead.querySelector('tr.' + ROW_CLASS);
    var count = table.querySelectorAll(HEADER_CELLS_SEL).length;
    if (row && row.cells.length === count) return;
    if (row) row.remove();
    if (!count) return;
    thead.insertBefore(buildRow(doc, table, labels), thead.firstChild);
  }

  /** Removes our row from every header in doc. */
  function remove(doc) {
    Array.prototype.forEach.call(doc.querySelectorAll('tr.' + ROW_CLASS), function (row) {
      row.remove();
    });
  }

  BCBuddy.FilterRow = {
    containsFilter: containsFilter,
    isFilterable: isFilterable,
    sync: sync,
    remove: remove
  };
})(typeof self !== 'undefined' ? self : this);
