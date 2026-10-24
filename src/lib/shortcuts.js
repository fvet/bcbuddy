/*
 * BC Buddy - the keyboard shortcuts that work where you are.
 *
 * BC Buddy's logo in BC's top bar, just before Help, opens a panel with three
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
 * one getElementById. Everything else runs when the panel opens, and again
 * when BC swaps the page under an open panel: while it is open, an observer
 * on the direct children of each .spa-container (no subtree) notices that.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var ICON_ID = 'bcb-keys_container';
  var PANEL_ID = 'bcb-keys';
  var HELP_ID = 'O365_MainLink_Help_container';
  var CLIENT_FRAME = 'iframe.designer-client-frame';
  var CONTAINER_SEL = '.spa-container';
  var VIEW_SEL = '.spa-container > .spa-view:not(.spa-lookup)';
  var FIELD_SEL = '.edit-container, .ms-nav-edit-control-container';
  // A part (subpage) on a page, such as the lines of an order.
  var PART_SEL = '.formhost-control';
  var FACTBOX_SEL = '.ms-nav-layout-factbox-content-area';
  // The New action, by its icon, so in any language: the + in a card's header
  // and the New button in a list's action bar.
  var NEW_SEL = 'button i[data-icon-name="Add"], button.ms-Button--command i.icon-Plus';
  // After BC swaps the page: how long to wait for it to render, and how often
  // to look again before giving up.
  var REFRESH_MS = 300;
  var REFRESH_TRIES = 10;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  // How much of a dragged panel stays in view at the bottom of the window.
  var MIN_SHOWN = 120;

  // One link, to Microsoft's full article. Without a locale in the path,
  // Learn opens it in the reader's language.
  var DOCS = [
    ['scDocsAll', 'https://learn.microsoft.com/dynamics365/business-central/keyboard-shortcuts']
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
    // 'new': only on a page with a New action; 'factbox': only on a page
    // with a FactBox pane. Find entries and a Role Center have neither.
    anywhere: ['scAnywhere', [
      ['Alt+Q', 'scTellMe'],
      ['Alt+N', 'scNew', 'new'],
      ['Ctrl+O', 'scCompany'],
      ['Alt+F2', 'scFactBox', 'factbox'],
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
   * The page on screen. BC keeps the pages you came from in the DOM, each in
   * its own .spa-view under a .spa-container, still rendered but marked
   * spa-not-top-most and inert; a lookup is a view too, and is skipped. The
   * whole document when there are no views.
   */
  function topView(doc) {
    var views = doc.querySelectorAll(VIEW_SEL);
    for (var i = views.length - 1; i >= 0; i--) {
      var view = views[i];
      if (!view.classList.contains('spa-not-top-most') && !view.hasAttribute('inert')) return view;
    }
    return views.length ? views[views.length - 1] : doc;
  }

  /**
   * This page's actions with a shortcut, as [{ keys, name }], each
   * shortcut once. Only what is rendered: a hidden copy has no width. A
   * part's actions only with focus, the cursor's element, in that part.
   */
  function pageActions(doc, focus) {
    var found = [];
    var seen = {};
    var nodes = doc.querySelectorAll('[title]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var keys = tooltipKey(el.getAttribute('title'));
      if (!keys || seen[keys]) continue;
      // Only actions: a field's own buttons, such as Copilot's suggestion
      // icon (Alt+I), sit in its edit container and only work from there.
      if (el.closest(FIELD_SEL)) continue;
      // Greyed out, such as New Line before a row is picked: nothing to press.
      if (el.getAttribute('aria-disabled') === 'true') continue;
      // A part's own action bar, such as History on a contact card, only
      // works with the cursor in that part.
      var part = el.closest(PART_SEL);
      if (part && !(focus && part.contains(focus))) continue;
      var name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
      // Some actions carry the key in their name too: "Suggest a value (Alt+I)".
      var tail = ' (' + keys + ')';
      if (name.slice(-tail.length) === tail) name = name.slice(0, -tail.length);
      if (!name || !el.offsetWidth) continue;
      seen[keys] = true;
      found.push({ keys: keys, name: name });
    }
    return found;
  }

  /**
   * Where the cursor is: { area: 'lines' | 'list' | 'card' | null, date,
   * newRecord, factBox }. Without a cursor in a grid, the page decides: a card
   * is a card; a list or worksheet goes by its own grid, so a read-only one
   * such as Find entries is a list, not lines; a Role Center gets no area.
   * newRecord: the page has a New action. factBox: it has a FactBox pane.
   */
  function context(doc) {
    var active = doc.activeElement;
    var inPage = active && active !== doc.body && active.closest;
    var grid = inPage ? active.closest('table.ms-nav-grid') : null;
    var view = topView(doc);
    var forms = view.querySelectorAll('form.ms-nav-root-form');
    var form = (inPage && active.closest('form.ms-nav-root-form')) || forms[forms.length - 1] || null;
    // A date field's input has BC's date picker button right beside it.
    var date = !!(inPage && active.tagName === 'INPUT' && active.parentElement &&
      active.parentElement.querySelector(':scope > .icon-Date'));
    var area = null;
    if (grid) area = grid.classList.contains('ms-nav-grid-edit') ? 'lines' : 'list';
    else if (form && form.classList.contains('ms-nav-cardform')) area = 'card';
    else if (form && (form.classList.contains('ms-nav-worksheetform') || form.classList.contains('ms-nav-listform'))) {
      var own = pageGrid(form);
      if (own) area = own.classList.contains('ms-nav-grid-edit') ? 'lines' : 'list';
      else if (form.classList.contains('ms-nav-listform')) area = 'list';
    }
    return {
      area: area,
      date: date,
      newRecord: !!(area && view.querySelector(NEW_SEL)),
      factBox: !!(area && form && !form.classList.contains('form-no-factboxes'))
    };
  }

  /** The page's own grid: the first one that is not in a FactBox. */
  function pageGrid(form) {
    var grids = form.querySelectorAll('table.ms-nav-grid-data-table');
    for (var i = 0; i < grids.length; i++) {
      if (!grids[i].closest(FACTBOX_SEL)) return grids[i];
    }
    return null;
  }

  /**
   * The sections to show, in order: [{ title, rows: [[keys, text]], note }].
   * Only the page's own section has a note: what it cannot list.
   */
  function sections(actions, ctx, t) {
    function set(key) {
      var s = SETS[key];
      var rows = s[1].filter(function (r) {
        return !r[2] || (r[2] === 'new' ? ctx.newRecord : ctx.factBox);
      });
      return { title: t(s[0]), rows: rows.map(function (r) { return [r[0], t(r[1])]; }) };
    }
    var out = [];
    if (actions.length) {
      out.push({
        title: t('scPage'),
        rows: actions.map(function (a) { return [a.keys, a.name]; }),
        note: t('scNotListed')
      });
    }
    if (ctx.date) out.push(set('date'));
    if (ctx.area) out.push(set(ctx.area));
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
    panel.appendChild(buildHead(doc, t));
    fillPanel(panel, list, t);
    return panel;
  }

  function buildHead(doc, t) {
    var head = el(doc, 'div', 'bcb-keys__head');
    head.appendChild(el(doc, 'h2', '', t('scTitle')));
    var close = el(doc, 'button', 'bcb-keys__close', '×');
    close.type = 'button';
    close.title = t('scClose');
    close.setAttribute('aria-label', t('scClose'));
    head.appendChild(close);
    return head;
  }

  /** Everything under the header, in place of what was there. */
  function fillPanel(panel, list, t) {
    var doc = panel.ownerDocument;
    var head = panel.firstElementChild;
    while (head.nextSibling) panel.removeChild(head.nextSibling);

    list.forEach(function (section) {
      var heading = el(doc, 'h3', '', section.title);
      // A (?) that shows the note on hover or keyboard focus (content.css).
      if (section.note) {
        var info = el(doc, 'span', 'bcb-keys__info', '?');
        info.tabIndex = 0;
        info.setAttribute('role', 'img');
        info.setAttribute('aria-label', section.note);
        info.setAttribute('data-tip', section.note);
        heading.appendChild(info);
      }
      panel.appendChild(heading);
      var dl = el(doc, 'dl');
      section.rows.forEach(function (row) {
        dl.appendChild(renderKeys(doc, row[0]));
        dl.appendChild(el(doc, 'dd', '', row[1]));
      });
      panel.appendChild(dl);
    });

    var foot = el(doc, 'div', 'bcb-keys__foot');
    var links = el(doc, 'p');
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
  }

  /* ----------------------------------------------------------------- icon */

  /**
   * BC Buddy's logo (logo.js, written from icons/logo.svg), in one colour:
   * the shell's own icons take the top bar's text colour, which follows the
   * theme, and the logo's grey and cyan would vanish on a coloured bar. The
   * mask keeps its black and white, or the bite is lost.
   */
  function logoSvg(doc) {
    function build(node, inMask) {
      var el = doc.createElementNS(SVG_NS, node.tag);
      inMask = inMask || node.tag === 'mask';
      Object.keys(node.attrs).forEach(function (name) {
        el.setAttribute(name, name === 'fill' && !inMask ? 'currentColor' : node.attrs[name]);
      });
      if (node.text) el.textContent = node.text;
      (node.children || []).forEach(function (child) { el.appendChild(build(child, inMask)); });
      return el;
    }
    var svg = build(BCBuddy.LOGO, false);
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('aria-hidden', 'true');
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
    wrap.appendChild(logoSvg(doc));
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

  /**
   * Puts the panel at left, top, kept inside the window with at least
   * MIN_SHOWN px of it in view. Returns where it went, as { left, top }.
   */
  function place(panel, left, top, width) {
    var win = panel.ownerDocument.defaultView;
    left = Math.round(Math.max(0, Math.min(left, win.innerWidth - width)));
    top = Math.round(Math.max(0, Math.min(top, win.innerHeight - MIN_SHOWN)));
    panel.style.left = left + 'px';
    panel.style.right = 'auto';
    panel.style.top = top + 'px';
    panel.style.maxHeight = 'calc(100vh - ' + (top + 16) + 'px)';
    return { left: left, top: top };
  }

  /**
   * Lets the panel be dragged by its header. The listeners sit on the header
   * only and do nothing until it is pressed; pointer capture keeps the moves
   * coming while the pointer is over BC's frame. onMoved gets where it was
   * dropped.
   */
  function draggable(panel, onMoved) {
    var head = panel.querySelector('.bcb-keys__head');
    var grab = null;
    head.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || event.target.closest('button')) return;
      var box = panel.getBoundingClientRect();
      grab = { id: event.pointerId, dx: event.clientX - box.left, dy: event.clientY - box.top, width: box.width, at: null };
      try { head.setPointerCapture(event.pointerId); } catch (e) { /* not an active pointer */ }
      event.preventDefault();
    });
    head.addEventListener('pointermove', function (event) {
      if (!grab || event.pointerId !== grab.id) return;
      grab.at = place(panel, event.clientX - grab.dx, event.clientY - grab.dy, grab.width);
    });
    function drop(event) {
      if (!grab || event.pointerId !== grab.id) return;
      if (grab.at) onMoved(grab.at);
      grab = null;
    }
    head.addEventListener('pointerup', drop);
    head.addEventListener('pointercancel', drop);
  }

  /**
   * Calls onChange when BC adds or removes a page: an observer on the direct
   * children of each .spa-container, never a subtree, so typing and
   * scrolling in a grid never reach it.
   */
  function watchPages(client, onChange) {
    var Observer = (client.defaultView || root).MutationObserver;
    var observer = new Observer(onChange);
    var containers = client.querySelectorAll(CONTAINER_SEL);
    for (var i = 0; i < containers.length; i++) observer.observe(containers[i], { childList: true });
    return observer;
  }

  /* --------------------------------------------------------------- attach */

  /**
   * Starts the shortcuts in this (top) document. options.t looks up a string,
   * options.icon says whether to add the icon to BC's top bar, options.onIcon
   * what a click on it does instead of toggling the panel. Returns
   * { toggle, isOpen, listen, detach }.
   */
  function attach(doc, options) {
    var t = options.t;
    var win = doc.defaultView;
    var open = null;
    var detached = false;
    var observer = null;
    var spot = null;

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
      var icon = buildIcon(doc, help, t(options.iconLabel || 'scIconLabel'), options.onIcon || toggle);
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
      var view = topView(client);
      var actions = pageActions(view, client.activeElement);
      var panel = buildPanel(doc, sections(actions, context(client), t), t);

      var header = doc.getElementById('O365_NavHeader');
      var top = header ? Math.round(header.getBoundingClientRect().bottom) + 8 : 16;
      panel.style.top = top + 'px';
      panel.style.maxHeight = 'calc(100vh - ' + (top + 16) + 'px)';
      doc.body.appendChild(panel);
      // Back where it was last dropped, for as long as this tab lives.
      if (spot) place(panel, spot.left, spot.top, panel.getBoundingClientRect().width);
      draggable(panel, function (where) { spot = where; });

      function onKey(event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        hide(true);
      }
      // A press outside the panel leaves it open, so people can work in BC
      // with it beside them; only ×, Escape or the icon closes it.
      panel.addEventListener('keydown', onKey);
      panel.querySelector('.bcb-keys__close').addEventListener('click', function () { hide(true); });

      open = {
        panel: panel,
        client: client,
        view: view,
        returnTo: returnTo,
        pages: watchPages(client, pagesChanged),
        timer: 0
      };
      setExpanded(true);
      panel.focus();
    }

    // BC opened or closed a page while the panel is open: once the page on
    // screen is another one and has rendered, show its shortcuts instead. A
    // lookup opening or closing leaves the page as it is, so nothing changes.
    function pagesChanged() {
      if (!open) return;
      win.clearTimeout(open.timer);
      var tries = 0;
      (function later() {
        open.timer = win.setTimeout(function () {
          if (!open) return;
          var view = topView(open.client);
          if (view !== open.view && view.querySelector('form.ms-nav-root-form')) render(view);
          else if (++tries < REFRESH_TRIES) later();
        }, REFRESH_MS);
      })();
    }

    // The open panel, filled for another page. The focus stays where it is.
    function render(view) {
      var actions = pageActions(view, open.client.activeElement);
      fillPanel(open.panel, sections(actions, context(open.client), t), t);
      open.view = view;
      // The field the cursor was in belongs to the page that went away.
      open.returnTo = null;
    }

    function hide(restoreFocus) {
      if (!open) return;
      var was = open;
      open = null;
      was.pages.disconnect();
      win.clearTimeout(was.timer);
      was.panel.remove();
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

    /**
     * Feeds the browser's side panel (src/sidepanel/): calls send(sections)
     * now and again whenever they change, until the returned function is
     * called. What runs while someone listens: the same page observer the
     * panel uses (childList on each .spa-container, no subtree), and one
     * focusin listener on BC's document that only restarts a timer; the
     * page is read REFRESH_MS after the cursor stops moving, and nothing is
     * sent when the result is the same.
     */
    function listen(send) {
      var client = clientDoc(doc);
      var cwin = client.defaultView || win;
      var view = null;
      var last = '';
      var timer = 0;
      var stopped = false;

      function push() {
        if (stopped || detached) return;
        view = topView(client);
        var list = sections(pageActions(view, client.activeElement), context(client), t);
        var json = JSON.stringify(list);
        if (json === last) return;
        last = json;
        send(list);
      }
      function soon() {
        win.clearTimeout(timer);
        timer = win.setTimeout(push, REFRESH_MS);
      }
      // Like pagesChanged(): wait for the new page to render.
      function pageSwap() {
        win.clearTimeout(timer);
        var tries = 0;
        (function later() {
          timer = win.setTimeout(function () {
            if (stopped) return;
            var now = topView(client);
            if (now !== view && now.querySelector('form.ms-nav-root-form')) push();
            else if (++tries < REFRESH_TRIES) later();
          }, REFRESH_MS);
        })();
      }

      var pages = watchPages(client, pageSwap);
      cwin.addEventListener('focusin', soon, true);
      push();
      return function stop() {
        stopped = true;
        win.clearTimeout(timer);
        pages.disconnect();
        cwin.removeEventListener('focusin', soon, true);
      };
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
      listen: listen,
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
