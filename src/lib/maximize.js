/*
 * BC Buddy - maximize.
 *
 * Puts a Business Central page in wide layout and switches a tile page to list
 * view, by clicking BC's own controls the way a person would.
 *
 * BC keeps the pages you came from in the DOM: each sits in its own
 * div.spa-view, and every view but the one on screen is marked inert and
 * spa-not-top-most. A query on the whole document can land on the controls of
 * a page nobody sees, so everything here looks in the top view only.
 *
 * Each page is handled once, keyed by its form rather than by the URL: BC
 * changes the URL a moment before or after it swaps the view, and a page you
 * return to keeps whatever you changed on it yourself.
 *
 * Only BC's default is changed, never a choice. BC stores wide layout and the
 * list layout per page once someone sets them (see bcstate.js); a page with a
 * stored value opens the way it was left, even when that is narrow or tiles.
 * BC Buddy's own click is stored the same way, so from the second time on BC
 * opens the page wide by itself.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var TOP_VIEW_SEL = '.spa-view:not(.spa-not-top-most):not([inert])';
  var WIDE_TOGGLE_SEL = 'button.ms-nav-layout-wide-toggle-button';
  // A list that opens as a dialog over the page ("Select from full list") has
  // no wide toggle but a maximize button in its title bar. Its label is
  // translated; the icon name is not, and turns into BackToWindow once
  // maximized, so a dialog that is already big does not match.
  var LIST_DIALOG_SEL = 'form.ms-nav-listform.flexible-dialog';
  var DIALOG_MAXIMIZE_SEL = '.dialog-system-actions button:has(i[data-icon-name="FullScreen"])';
  // The view of a task dialog: a page opened over another, such as Select
  // from full list.
  var TASK_DIALOG_CLASS = 'spa-task-dialog';

  // The layout chooser on a list page. Current clients use a Fluent UI menu
  // button that shows the active layout's icon and opens one radio item per
  // layout; older ones a control with a button inside and numbered options.
  var LAYOUT_MENU_SEL = 'button[aria-haspopup="true"]:has(i[class*="BrickView"])';
  var LIST_ITEM_SEL = '[role="menuitemradio"]:has(i.icon-NotBrickView)';
  var OLD_CHOOSER_SEL = 'div[data-control-id="ListLayoutChooser"]:not([data-is-focusable="false"])';
  var OLD_LIST_OPTION_SEL = 'div[data-control-id="0"]';
  var FOCUSABLE_BTN_SEL = 'button[data-is-focusable="true"]';
  // The list layout's icon. On the chooser it means list view is already on.
  var LIST_ACTIVE_SEL = 'i.icon-NotBrickView:not([data-is-focusable="false"])';

  // How long the layout menu gets to open: up to 20 looks, 50 ms apart.
  var MENU_TRIES = 20;
  var MENU_POLL_MS = 50;

  function topView(doc) {
    var views = doc.querySelectorAll(TOP_VIEW_SEL);
    return views.length ? views[views.length - 1] : doc;
  }

  /** Current clients say aria-checked, older ones is-checked or aria-pressed. */
  function isPressed(button) {
    return button.getAttribute('aria-checked') === 'true' ||
      button.getAttribute('aria-pressed') === 'true' ||
      button.classList.contains('is-checked');
  }

  function click(el) {
    try { el.click(); } catch (e) { /* BC tore it down mid-render */ }
  }

  /**
   * Opens the layout menu and picks list view once it shows. A menu that never
   * offers it is closed again rather than left hanging open.
   */
  function pickFromMenu(opener, findOption) {
    if (!opener || opener.getAttribute('aria-expanded') === 'true') return;
    click(opener);
    var tries = MENU_TRIES;
    (function look() {
      var option = findOption();
      if (option) click(option);
      else if (--tries > 0) setTimeout(look, MENU_POLL_MS);
      else if (opener.getAttribute('aria-expanded') === 'true') click(opener);
    })();
    // The first look waits a beat: the menu is not there yet, and an old
    // client's numbered option could match something else on the page.
  }

  /**
   * Handles the page on screen in doc. `done` is a WeakMap the caller keeps for
   * as long as the same pages should not be handled again; `storage` is the
   * client frame's localStorage, where BC keeps the choices made per page.
   */
  function apply(doc, done, storage) {
    var view = topView(doc);
    var wide = view.querySelector(WIDE_TOGGLE_SEL) ||
      (view.querySelector(LIST_DIALOG_SEL) && view.querySelector(DIALOG_MAXIMIZE_SEL));
    var menu = view.querySelector(LAYOUT_MENU_SEL);
    var oldChooser = menu ? null : view.querySelector(OLD_CHOOSER_SEL);
    if (!wide && !menu && !oldChooser) return; // not the frame that hosts the BC toolbar

    var key = view.querySelector('form') || view;
    var page = done.get(key);
    if (!page) {
      page = { wide: false, list: false };
      done.set(key, page);
    }
    var State = BCBuddy.BCState;
    var id = State.pageId(view);

    if (wide && !page.wide) {
      page.wide = true;
      // A task dialog stores its size apart from the same page opened in full.
      var kind = view.classList && view.classList.contains(TASK_DIALOG_CLASS) ? 'dialog' : 'wide';
      if (!isPressed(wide) && !State.chosen(storage, kind, id)) click(wide);
    }

    if ((menu || oldChooser) && !page.list) {
      page.list = true;
      if (view.querySelector(LIST_ACTIVE_SEL) || State.chosen(storage, 'list', id)) return;
      if (menu) {
        pickFromMenu(menu, function () { return doc.querySelector(LIST_ITEM_SEL); });
      } else {
        pickFromMenu(oldChooser.querySelector(FOCUSABLE_BTN_SEL), function () {
          var option = doc.querySelector(OLD_LIST_OPTION_SEL);
          return option && option.querySelector(FOCUSABLE_BTN_SEL);
        });
      }
    }
  }

  BCBuddy.Maximize = {
    MENU_POLL_MS: MENU_POLL_MS,
    topView: topView,
    isPressed: isPressed,
    apply: apply
  };
})(typeof self !== 'undefined' ? self : this);
