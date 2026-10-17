/*
 * BC Buddy - the keyboard shortcuts that work where you are.
 *
 * A keyboard icon in BC's top bar, just before Help, opens a panel with three
 * kinds of shortcut:
 *
 *   - This page's own actions. BC writes an action's shortcut only at the end
 *     of its tooltip, "Finalize the document ... (F9)", so those are read from
 *     the page when the panel opens. That part is always right for the BC
 *     version, the language and the extensions in front of you. An action in
 *     a menu nobody opened yet is not in the page, so it is not listed.
 *   - A short list for where the cursor is: the lines of a journal or
 *     document, a list, a card, a date field.
 *   - A few that work anywhere.
 *
 * The built-in lists only hold shortcuts BC has had for years, taken from
 * Microsoft's "Keyboard Shortcuts" article; the panel links to that article
 * for everything else. Keep them short rather than complete.
 *
 * Where things live: BC online shows the client in an iframe
 * (iframe.designer-client-frame) under the Microsoft 365 top bar, both on the
 * same origin. Icon and panel belong to the top window; the actions and the
 * cursor are read from the client's document. On-prem has no Microsoft 365
 * top bar and no such iframe: there is no icon, and the panel (opened with the
 * browser shortcut, see background.js) reads the page itself.
 *
 * Cost: one observer on the top window's body (subtree) while the icon is
 * wanted. BC's grids live in the iframe's document, so the top window only
 * changes when the shell opens a pane or redraws its bar; each change costs
 * one getElementById. Everything else runs when the panel opens, once.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var ICON_ID = 'bcb-keys_container';
  var PANEL_ID = 'bcb-keys';
  var CAP_CLASS = 'bcb-keycap';
  var HELP_ID = 'O365_MainLink_Help_container';
  var CLIENT_FRAME = 'iframe.designer-client-frame';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Without a locale in the path, Learn opens these in the reader's language.
  var DOCS = [
    ['scDocsAll', 'https://learn.microsoft.com/dynamics365/business-central/keyboard-shortcuts'],
    ['scDocsCheatsheet', 'https://learn.microsoft.com/dynamics365/business-central/keyboard-shortcuts-cheatsheet'],
    ['scDocsPdf', 'https://learn.microsoft.com/en-us/dynamics365/business-central/media/keyboard-shortcuts.pdf']
  ];

  // [heading, [[keys, description], ...]]. In keys, " / " separates
  // alternatives and ", " a sequence; see keyParts().
  var SETS = {
    lines: ['scLines', [
      ['F8', 'scCopyAbove'],
      ['Ctrl+Insert', 'scNewLine'],
      ['Ctrl+Delete', 'scDeleteLine'],
      ['Alt+Down', 'scOpenList']
    ]],
    list: ['scList', [
      ['F3', 'scSearch'],
      ['Alt+F3', 'scFilterValue'],
      ['Shift+F3', 'scFilterPane'],
      ['Ctrl+Shift+Alt+F3', 'scResetFilters'],
      ['Alt+F7', 'scSort'],
      ['Ctrl+A, Ctrl+C', 'scCopyRows'],
      ['Ctrl+Home / Ctrl+End', 'scFirstLast']
    ]],
    card: ['scCard', [
      ['F6 / Shift+F6', 'scFastTabs'],
      ['Alt+F6', 'scFoldFastTab'],
      ['Ctrl+Down / Ctrl+Up', 'scNextRecord'],
      ['Ctrl+Enter', 'scSaveClose'],
      ['Alt+Shift+W', 'scNewWindow']
    ]],
    date: ['scDate', [
      ['t', 'scToday'],
      ['w', 'scWorkDate'],
      ['Alt+Down', 'scCalendar']
    ]],
    anywhere: ['scAnywhere', [
      ['Alt+Q', 'scTellMe'],
      ['Alt+N', 'scNew'],
      ['Ctrl+O', 'scCompany'],
      ['Alt+F2', 'scFactBox'],
      ['F5', 'scRefresh'],
      ['Alt', 'scKeyTips']
    ]]
  };

  // The shortcut at the end of a tooltip: "(F9)", "(Ctrl+F11)", also with a
  // translated modifier ("Strg+F9"). Something in brackets without a + or an
  // F-key, such as "Balance (LCY)", is not one.
  var TOOLTIP_KEY = /\(([^()\s]{1,30})\)\s*$/;

  function isKey(text) {
    return /^F\d{1,2}$/.test(text) || /^[^+]+(\+[^+]+)+$/.test(text);
  }

  /** The shortcut a tooltip ends with, or ''. */
  function tooltipKey(title) {
    var m = TOOLTIP_KEY.exec(title || '');
    return m && isKey(m[1]) ? m[1] : '';
  }

  /**
   * "Ctrl+A, Ctrl+C / F3" -> [[["Ctrl", "A"], ["Ctrl", "C"]], [["F3"]]]:
   * alternatives, each a sequence of key combinations.
   */
  function keyParts(keys) {
    return keys.split(' / ').map(function (alt) {
      return alt.split(', ').map(function (combo) { return combo.split('+'); });
    });
  }

  /** BC's client document: the iframe's on BC online, else this one. */
  function clientDoc(doc) {
    var frame = doc.querySelector(CLIENT_FRAME);
    try {
      return (frame && frame.contentDocument) || doc;
    } catch (e) {
      return doc;
    }
  }

  /**
   * This page's actions with a shortcut, as [{ keys, name, el }], each
   * shortcut once. Only what is rendered: a hidden copy has no width.
   */
  function pageActions(doc) {
    var found = [];
    var seen = {};
    var nodes = doc.querySelectorAll('[title]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var keys = tooltipKey(el.getAttribute('title'));
      if (!keys || seen[keys]) continue;
      var name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!name || !el.offsetWidth) continue;
      seen[keys] = true;
      found.push({ keys: keys, name: name, el: el });
    }
    return found;
  }

  /**
   * Where the cursor is: { area: 'lines' | 'list' | 'card', date: bool }.
   * Without a cursor in the page, the kind of page decides.
   */
  function context(doc) {
    var active = doc.activeElement;
    var inPage = active && active !== doc.body && active.closest;
    var grid = inPage ? active.closest('table.ms-nav-grid') : null;
    var forms = doc.querySelectorAll('form.ms-nav-root-form');
    var form = (inPage && active.closest('form.ms-nav-root-form')) || forms[forms.length - 1] || null;
    // A date field's input has BC's date picker button right beside it.
    var date = !!(inPage && active.tagName === 'INPUT' && active.parentElement &&
      active.parentElement.querySelector(':scope > .icon-Date'));
    var area = 'list';
    if (grid) area = grid.classList.contains('ms-nav-grid-edit') ? 'lines' : 'list';
    else if (form && form.classList.contains('ms-nav-cardform')) area = 'card';
    else if (form && form.classList.contains('ms-nav-worksheetform')) area = 'lines';
    return { area: area, date: date };
  }

  /** The sections to show, in order: [{ title, rows: [[keys, text]] }]. */
  function sections(actions, ctx, t) {
    function set(key) {
      var s = SETS[key];
      return { title: t(s[0]), rows: s[1].map(function (r) { return [r[0], t(r[1])]; }) };
    }
    var out = [];
    if (actions.length) {
      out.push({ title: t('scPage'), rows: actions.map(function (a) { return [a.keys, a.name]; }) });
    }
    if (ctx.date) out.push(set('date'));
    out.push(set(ctx.area));
    out.push(set('anywhere'));
    return out;
  }

  /* ---------------------------------------------------------------- panel */

  function el(doc, tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function renderKeys(doc, keys) {
    var dt = el(doc, 'dt');
    keyParts(keys).forEach(function (alt, a) {
      if (a) dt.appendChild(el(doc, 'span', 'bcb-keys__sep', ' / '));
      alt.forEach(function (combo, c) {
        if (c) dt.appendChild(el(doc, 'span', 'bcb-keys__sep', ', '));
        combo.forEach(function (key, k) {
          if (k) dt.appendChild(el(doc, 'span', 'bcb-keys__plus', '+'));
          dt.appendChild(el(doc, 'kbd', '', key));
        });
      });
    });
    return dt;
  }

  /** The panel's element, not yet in the page. All text goes in as text. */
  function buildPanel(doc, list, t) {
    var panel = el(doc, 'div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t('scTitle'));
    panel.tabIndex = -1;

    var head = el(doc, 'div', 'bcb-keys__head');
    head.appendChild(el(doc, 'h2', '', t('scTitle')));
    var close = el(doc, 'button', 'bcb-keys__close', '×');
    close.type = 'button';
    close.title = t('scClose');
    close.setAttribute('aria-label', t('scClose'));
    head.appendChild(close);
    panel.appendChild(head);

    list.forEach(function (section) {
      panel.appendChild(el(doc, 'h3', '', section.title));
      var dl = el(doc, 'dl');
      section.rows.forEach(function (row) {
        dl.appendChild(renderKeys(doc, row[0]));
        dl.appendChild(el(doc, 'dd', '', row[1]));
      });
      panel.appendChild(dl);
    });

    var foot = el(doc, 'div', 'bcb-keys__foot');
    foot.appendChild(el(doc, 'p', '', t('scNotListed')));
    var links = el(doc, 'p');
    links.appendChild(el(doc, 'span', '', t('scMore') + ' '));
    DOCS.forEach(function (doc_, i) {
      if (i) links.appendChild(el(doc, 'span', 'bcb-keys__sep', ' · '));
      var a = el(doc, 'a', '', t(doc_[0]));
      a.href = doc_[1];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      links.appendChild(a);
    });
    foot.appendChild(links);
    panel.appendChild(foot);
    return panel;
  }

  /** A small key badge above each listed action, in BC's own document. */
  function addCaps(doc, actions) {
    var rects = actions.map(function (a) { return a.el.getBoundingClientRect(); });
    actions.forEach(function (a, i) {
      var r = rects[i];
      if (!r.width || r.top < 0) return;
      var cap = el(doc, 'span', CAP_CLASS, a.keys);
      cap.setAttribute('aria-hidden', 'true');
      cap.style.left = Math.round(r.left + 4) + 'px';
      cap.style.top = Math.max(0, Math.round(r.top - 9)) + 'px';
      doc.body.appendChild(cap);
    });
  }

  function removeCaps(doc) {
    var caps = doc.querySelectorAll('.' + CAP_CLASS);
    for (var i = 0; i < caps.length; i++) caps[i].remove();
  }

  /* ----------------------------------------------------------------- icon */

  function keyboardSvg(doc) {
    var svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.1');
    svg.setAttribute('stroke-linecap', 'round');
    var box = doc.createElementNS(SVG_NS, 'rect');
    box.setAttribute('x', '1');
    box.setAttribute('y', '3.5');
    box.setAttribute('width', '14');
    box.setAttribute('height', '9');
    box.setAttribute('rx', '1.5');
    var keys = doc.createElementNS(SVG_NS, 'path');
    keys.setAttribute('d', 'M3.6 6.2h.8M6 6.2h.8M8.4 6.2h.8M10.8 6.2h1.6' +
      'M3.6 8.2h.8M6 8.2h.8M8.4 8.2h.8M10.8 8.2h1.6M5.2 10.3h5.6');
    svg.appendChild(box);
    svg.appendChild(keys);
    return svg;
  }

  /**
   * Our button, shaped like the Help button next to it: the shell's class
   * names are hashed and change between releases, so they are copied from
   * Help, element by element, rather than written down. Null when Help does
   * not have the shape we know.
   */
  function buildIcon(doc, help, label, onClick) {
    var model = help.querySelector('button');
    if (!model || !help.firstElementChild) return null;
    var box = help.cloneNode(false);
    box.id = ICON_ID;
    var inner = help.firstElementChild === model ? null : help.firstElementChild.cloneNode(false);
    if (inner) inner.removeAttribute('id');
    var button = doc.createElement('button');
    button.type = 'button';
    button.className = model.className;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    var wrap = model.firstElementChild ? model.firstElementChild.cloneNode(false) : doc.createElement('div');
    wrap.removeAttribute('id');
    wrap.appendChild(keyboardSvg(doc));
    button.appendChild(wrap);
    // Pressing a button moves the focus to it, and once BC's frame loses the
    // focus BC lets go of the field the cursor was in. Keeping the focus where
    // it is lets the panel see that field; the panel takes the focus itself
    // once it has looked, and hands it back when it closes.
    button.addEventListener('mousedown', function (event) { event.preventDefault(); });
    // A click the page made up (isTrusted false) is ignored.
    button.addEventListener('click', function (event) {
      if (event.isTrusted) onClick();
    });
    (inner || box).appendChild(button);
    if (inner) box.appendChild(inner);
    return box;
  }

  /* --------------------------------------------------------------- attach */

  /**
   * Starts the shortcuts in this (top) document. options.t looks up a string,
   * options.icon says whether to add the icon to BC's top bar. Returns
   * { toggle, isOpen, detach }.
   */
  function attach(doc, options) {
    var t = options.t;
    var win = doc.defaultView;
    var open = null;
    var detached = false;
    var observer = null;

    if (options.icon) {
      observer = new win.MutationObserver(insertIcon);
      if (doc.body) startIcon();
      else doc.addEventListener('DOMContentLoaded', startIcon, { once: true });
    }

    function startIcon() {
      if (detached || !doc.body) return;
      observer.observe(doc.body, { childList: true, subtree: true });
      insertIcon();
    }

    function insertIcon() {
      if (detached || doc.getElementById(ICON_ID)) return;
      var help = doc.getElementById(HELP_ID);
      if (!help || !help.parentNode) return;
      var icon = buildIcon(doc, help, t('scIconLabel'), toggle);
      if (icon) help.parentNode.insertBefore(icon, help);
    }

    function setExpanded(value) {
      var button = doc.querySelector('#' + ICON_ID + ' button');
      if (button) button.setAttribute('aria-expanded', value ? 'true' : 'false');
    }

    function show() {
      var client = clientDoc(doc);
      // Read the cursor before the panel takes the focus.
      var returnTo = client.activeElement;
      var actions = pageActions(client);
      var panel = buildPanel(doc, sections(actions, context(client), t), t);

      var header = doc.getElementById('O365_NavHeader');
      var top = header ? Math.round(header.getBoundingClientRect().bottom) + 8 : 16;
      panel.style.top = top + 'px';
      panel.style.maxHeight = 'calc(100vh - ' + (top + 16) + 'px)';
      doc.body.appendChild(panel);
      addCaps(client, actions);

      function onKey(event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        hide(true);
      }
      // Only while the panel is open: a press outside it closes it.
      function onPointer(event) {
        if (!panel.contains(event.target) && !isIconEvent(event)) hide(false);
      }
      panel.addEventListener('keydown', onKey);
      panel.querySelector('.bcb-keys__close').addEventListener('click', function () { hide(true); });
      doc.addEventListener('pointerdown', onPointer, true);
      if (client !== doc) client.addEventListener('pointerdown', onPointer, true);

      open = {
        panel: panel,
        client: client,
        returnTo: returnTo,
        cleanup: function () {
          doc.removeEventListener('pointerdown', onPointer, true);
          if (client !== doc) client.removeEventListener('pointerdown', onPointer, true);
        }
      };
      setExpanded(true);
      panel.focus();
    }

    function isIconEvent(event) {
      var icon = doc.getElementById(ICON_ID);
      return !!(icon && event.target && event.target.nodeType === 1 && icon.contains(event.target));
    }

    function hide(restoreFocus) {
      if (!open) return;
      var was = open;
      open = null;
      was.cleanup();
      was.panel.remove();
      removeCaps(was.client);
      setExpanded(false);
      // Back to where the cursor was, so typing goes on there.
      if (restoreFocus && was.returnTo && was.returnTo.isConnected && was.returnTo.focus) {
        try { was.returnTo.focus(); } catch (e) { /* gone or not focusable */ }
      }
    }

    function toggle() {
      if (detached) return;
      if (open) hide(true);
      else show();
    }

    function detach() {
      detached = true;
      hide(false);
      if (observer) observer.disconnect();
      var icon = doc.getElementById(ICON_ID);
      if (icon) icon.remove();
    }

    return {
      toggle: toggle,
      isOpen: function () { return !!open; },
      detach: detach
    };
  }

  BCBuddy.Shortcuts = {
    ICON_ID: ICON_ID,
    PANEL_ID: PANEL_ID,
    SETS: SETS,
    DOCS: DOCS,
    tooltipKey: tooltipKey,
    keyParts: keyParts,
    pageActions: pageActions,
    context: context,
    sections: sections,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
