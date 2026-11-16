// Column search
//
// `lib/columnsearch.js`, started and stopped by `applyColumnSearch()` in
// `content.js` like copy values: attached once when the switch turns on,
// detached when it turns off, one comparison per `apply()` otherwise.
//
// What it does: when a person opens a list column's menu (the arrow, the blank
// part of the caption cell, or a right click on the header), a search box shows
// at the top of that menu. Typing text and pressing Enter or Tab filters that
// column to the rows that contain it.
//
// How the filter is applied: not by URL (that reloads the page) and not by
// writing BC's state, but by doing what a person does: choose "Filter..." in the
// same menu, type the filter in BC's own filter pane, press Enter. BC keeps the
// filter, shows its chip and clears it with its own "Clear filter".
//
// Everything BC-specific is in the constants below (confirmed on BC 28, 2026-11).
//
// Cost: one capture-phase `click` and one `contextmenu` listener per frame while
// the switch is on. Each does one `closest()` per event and nothing else unless
// it was on a column header. Nothing per row, scroll or keystroke; the only
// other listeners are on our own input, which exists while one menu is open.
//
// Security: the typed text is only ever put in an input's `value`, in BC's own
// filter line, which is where a person could type the same thing; control
// characters or more than 100 characters are refused (fail closed). The handlers
// need `isTrusted`.

/*
 * BC Buddy - column search.
 *
 * Open a column's menu in a list and the first item is a search box. Type
 * something and press Enter: the list shows the rows whose value in that column
 * contains it. Text with filter syntax (=text, text*, A|B, 1..9) is BC's own
 * filter and is used as typed. Only text and code columns get it: not numbers, dates, yes/no
 * or option columns.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var ITEM_CLASS = 'bcb-menusearch';
  var HEADER_SEL = 'table.ms-nav-grid-header-table';
  // Never in a lookup dropdown, a card's subpage or a FactBox: lists only. Not
  // .spa-container: a list's own header table is inside one (BC 28, 2026-11).
  var SKIP_ANCESTOR_SEL = '.spa-lookup, form.ms-nav-cardform, .ms-nav-layout-factbox-content-area';
  var DATA_SEL = 'table.ms-nav-grid-data-table';
  var RIGHT_ALIGN_CLASS = 'columncaption-rightalign';
  // A Boolean column's cells hold a boolean control: a checkbox, or a link that
  // reads Yes/No (Review G/L Entries, "Reviewed"; BC 28, 2026-11).
  var BOOLEAN_SEL = '[class*="booleancontrol"], input[type="checkbox"]';
  // BC marks the cells of an option (enum) column with this class.
  var OPTION_CELL_CLASS = 'ms-nav-enumeration';
  var MAX_LEN = 100;

  // --- BC's column menu, confirmed on a live client (BC 28). -----------------
  // The arrow in a caption cell opens the menu (the caption link itself sorts).
  // The menu opens from the arrow and from the blank part of the caption cell; a
  // click on the caption link itself sorts and opens nothing.
  var MENU_TRIGGER_SEL = 'th.ms-nav-contextmenu-trigger';
  var SORT_LINK_SEL = 'a[data-sorting-column-link]';
  var MENU_SEL = '.ms-nav-ctxmenu-container';
  var MENU_ITEM_SEL = MENU_SEL + ' li.ms-nav-ctxmenu-item';
  // Items are found by their icon, never by their text, so any language works.
  // 'Filter...' is the first item with the filter icon ('Filter to this value'
  // comes after it).
  var FILTER_ICON = '/actions/filter/';
  // 'Filter...' opens BC's filter pane and focuses this column's line in it.
  var FILTER_LINE_SEL = '.advanced-list-filter-line';
  // BC's own quick search magnifier, a glyph of BC's icon font in the theme's
  // colour (BC 28: U+E721 in FabricMDL2Icons, 16 px). Glyph, font and colour are
  // read from that icon, so the box shows exactly what the toolbar shows.
  var BC_SEARCH_ICON_SEL = 'i[data-icon-name="Search"]';
  var SVG_NS = 'http://www.w3.org/2000/svg';
  // Our own magnifier, for a page where BC's icon is not there to copy.
  var SEARCH_PATH = 'M6.5 1a5.5 5.5 0 0 1 4.38 8.82l3.4 3.4a.75.75 0 0 1-1.06 1.06l-3.4-3.4A5.5 5.5 0 1 1 6.5 1zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z';
  // BC's labels have padding of their own: the box starts this far in, so the text
  // typed in it lines up with the label text, and the box keeps off the icon.
  var TEXT_GAP = 8;
  var STEP_MS = 50;
  var GIVE_UP_MS = 1500;
  // Keys BC keeps: Escape closes the menu, the others move around in it.
  var BC_KEYS = { Escape: 1, Tab: 1, ArrowUp: 1, ArrowDown: 1 };

  // Characters BC reads as filter syntax. Text with any of them is the person's
  // own filter and goes to BC as typed, exactly as if typed in "Filter...".
  var SYNTAX_RE = /[|&<>=()'"*?@]|\.\./;

  /**
   * The filter to give BC for the typed text. Plain text becomes a contains
   * filter, @*text* (case-insensitive, wildcard on both sides); text with filter
   * syntax (=text exact, text* starts with, A|B, 1..9) is passed on unchanged.
   * '' for an empty box (nothing to filter); null for text that cannot be used
   * safely (control characters, or too long): fail closed.
   */
  function filterFor(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return '';
    if (t.length > MAX_LEN) return null;
    if (/[\u0000-\u001f\u007f]/.test(t)) return null;
    return SYNTAX_RE.test(t) ? t : '@*' + t + '*';
  }

  // Dates look like text in BC's DOM (no class marks them), so a column whose
  // sampled values are all dates is recognised by its values: 1-11-2026,
  // 2026-11-01, 01.11.2026, with an optional time.
  var DATE_RE = /^\d{1,4}[-\/.]\d{1,2}[-\/.]\d{1,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/;
  var SAMPLE_ROWS = 10;

  /**
   * A column gets the search when it holds text or a code. BC right-aligns the
   * caption of a number column, a Boolean column's cells hold a boolean control, an
   * option column's cells carry a class of their own, and a date column's values
   * are all dates, so those are left out. `cells` are the column's cells in the
   * first rows (empty for an empty list); then the caption alone decides.
   */
  function isSearchable(th, cells) {
    if (!th.textContent.trim()) return false;
    var caption = th.querySelector('.columncaption');
    if (caption && caption.classList.contains(RIGHT_ALIGN_CLASS)) return false;
    var values = 0;
    var dates = 0;
    for (var i = 0; cells && i < cells.length; i++) {
      if (!cells[i]) continue;
      if (cells[i].querySelector(BOOLEAN_SEL)) return false;
      if (cells[i].classList.contains(OPTION_CELL_CLASS)) return false;
      var text = cells[i].textContent.trim();
      if (!text) continue;
      values++;
      if (DATE_RE.test(text)) dates++;
    }
    return !(values > 0 && dates === values);
  }

  /** The column's cells in the first rows of the data table that matches the captions. */
  function sampleColumn(doc, count, index) {
    var tables = doc.querySelectorAll(DATA_SEL);
    for (var i = 0; i < tables.length; i++) {
      var trs = tables[i].querySelectorAll('tbody > tr');
      if (trs.length && trs[0].children.length === count) {
        return Array.prototype.slice.call(trs, 0, SAMPLE_ROWS).map(function (tr) {
          return tr.children[index];
        });
      }
    }
    return [];
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

  function menuItem(doc, icon) {
    var items = doc.querySelectorAll(MENU_ITEM_SEL);
    for (var i = 0; i < items.length; i++) {
      var img = items[i].querySelector('img');
      if (img && (img.getAttribute('src') || '').indexOf(icon) !== -1) return items[i];
    }
    return null;
  }

  /**
   * Applies `filter` to the column of the open menu through BC's own "Filter..."
   * item. Calls done(true) when BC took the value, done(false) when any step was
   * not found.
   */
  function applyFilter(doc, filter, done) {
    var item = menuItem(doc, FILTER_ICON);
    if (!item) return done(false);
    try { item.click(); } catch (e) { return done(false); }
    wait(function () {
      var el = doc.activeElement;
      return el && el.tagName === 'INPUT' && el.closest(FILTER_LINE_SEL) ? el : null;
    }, function (input) {
      if (!input) return done(false);
      var win = doc.defaultView;
      input.value = filter;
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
      input.dispatchEvent(new win.Event('change', { bubbles: true }));
      ['keydown', 'keypress', 'keyup'].forEach(function (type) {
        input.dispatchEvent(new win.KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      });
      done(true);
    });
  }

  /** BC's quick search icon, copied from the toolbar; our own SVG if there is none. */
  function searchIcon(doc) {
    var ref = doc.querySelector(BC_SEARCH_ICON_SEL);
    var glyph = ref && ref.textContent;
    if (glyph && glyph.length <= 2) {
      var style = doc.defaultView.getComputedStyle(ref);
      var icon = doc.createElement('i');
      icon.className = 'bcb-menusearch__glyph';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = glyph;
      icon.style.fontFamily = style.fontFamily;
      icon.style.color = style.color;
      return icon;
    }
    var svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    var path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', SEARCH_PATH);
    svg.appendChild(path);
    return svg;
  }

  /**
   * Lines the icon up with BC's own menu icons and the box with their labels, by
   * measuring a real item of this menu: BC's menu padding differs between
   * versions and themes, so no fixed number is right everywhere. Reads first,
   * then writes, once per menu, on our own elements only.
   */
  function align(icon, input, menu) {
    var img = menu.querySelector('li.ms-nav-ctxmenu-item img');
    var item = img && img.closest('li');
    var label = item && item.querySelector('.ms-nav-ctxmenu-itemlabel');
    if (!img || !label) return;
    // Where our icon sits now, with BC's own padding on the row included.
    var start = icon.getBoundingClientRect().left;
    var iconRect = img.getBoundingClientRect();
    var labelLeft = label.getBoundingClientRect().left;
    icon.style.marginLeft = Math.max(0, Math.round(iconRect.left - start)) + 'px';
    input.style.marginLeft = Math.max(0, Math.round(labelLeft - iconRect.left - iconRect.width) + TEXT_GAP) + 'px';
  }

  /** Puts the search box at the top of `menu`, unless it is there already. */
  function addBox(doc, menu, labels) {
    if (menu.querySelector('li.' + ITEM_CLASS)) return;
    var first = menu.querySelector('li');
    if (!first || !first.parentNode) return;
    var li = doc.createElement('li');
    li.className = ITEM_CLASS;
    li.setAttribute('role', 'presentation');
    var input = doc.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_LEN;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', labels.placeholder);
    input.setAttribute('placeholder', labels.placeholder);
    if (labels.hint) input.setAttribute('title', labels.hint);
    // Leaving the box with Enter or Tab applies the filter. A Tab in an empty box
    // is BC's own: it moves on in the menu.
    function leaving(e) {
      return e.key === 'Enter' || (e.key === 'Tab' && input.value.trim() !== '');
    }
    input.addEventListener('keydown', function (e) {
      // Our text box keeps its keys; BC keeps Escape and the menu's navigation.
      if (!leaving(e) && BC_KEYS[e.key]) return;
      e.stopPropagation();
      if (!leaving(e) || !e.isTrusted) return;
      e.preventDefault();
      var filter = filterFor(input.value);
      if (filter === null) { input.setAttribute('aria-invalid', 'true'); return; }
      input.removeAttribute('aria-invalid');
      if (!filter) return;
      applyFilter(doc, filter, function (ok) {
        if (!ok) input.setAttribute('aria-invalid', 'true');
      });
    });
    ['keyup', 'keypress'].forEach(function (type) {
      input.addEventListener(type, function (e) {
        if (!leaving(e) && BC_KEYS[e.key]) return;
        e.stopPropagation();
      });
    });
    var icon = searchIcon(doc);
    li.appendChild(icon);
    li.appendChild(input);
    first.parentNode.insertBefore(li, first);
    align(icon, input, menu);
    // Ready to type at once. BC may move focus to the menu as it opens, so look
    // once more a moment later.
    input.focus();
    setTimeout(function () {
      if (input.isConnected && doc.activeElement !== input) input.focus();
    }, 100);
  }

  /**
   * A trusted click on a list column's menu arrow: wait for BC's menu, then put
   * the box in it. Nothing happens for a column that BC's quick search would
   * not search.
   */
  function onClick(doc, labels, e) {
    if (!e.isTrusted || !e.target || !e.target.closest) return;
    var th = e.target.closest(MENU_TRIGGER_SEL);
    // A left click on the caption link sorts; a right click opens the menu there too.
    if (!th || (e.type === 'click' && e.target.closest(SORT_LINK_SEL))) return;
    var table = th && th.closest(HEADER_SEL);
    if (!table || table.closest(SKIP_ANCESTOR_SEL)) return;
    var row = th.parentNode;
    var index = Array.prototype.indexOf.call(row.children, th);
    if (!isSearchable(th, sampleColumn(doc, row.children.length, index))) return;
    wait(function () {
      var menus = doc.querySelectorAll(MENU_SEL);
      return menus.length ? menus[menus.length - 1] : null;
    }, function (menu) {
      if (menu) addBox(doc, menu, labels);
    });
  }

  /**
   * Starts listening in `doc`. Returns { detach } to stop. `labels.placeholder`
   * is the box's text.
   */
  function attach(doc, labels) {
    var handler = function (e) { onClick(doc, labels, e); };
    // Capture phase: BC stops the arrow's click from bubbling up to the document.
    doc.addEventListener('click', handler, { capture: true, passive: true });
    doc.addEventListener('contextmenu', handler, { capture: true, passive: true });
    return {
      detach: function () {
        doc.removeEventListener('click', handler, { capture: true });
        doc.removeEventListener('contextmenu', handler, { capture: true });
        Array.prototype.forEach.call(doc.querySelectorAll('li.' + ITEM_CLASS), function (li) {
          li.remove();
        });
      }
    };
  }

  BCBuddy.ColumnSearch = {
    filterFor: filterFor,
    isSearchable: isSearchable,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
