/*
 * BC Buddy - pin the action bar.
 *
 * The row of actions under a page's tabs (Start, Prepare, ...) floats over the
 * page until you pin it with the pin button at its right end. BC remembers
 * that per page, but only once someone clicks it; until then each page opens
 * the way BC picks. This pins a page the first time it opens with the bar
 * floating, by clicking that same button. BC stores the click, and from then
 * on the page is BC's: unpin it and it stays unpinned (see bcstate.js).
 *
 * Only the page's own bar counts. A part on the page, such as the lines of an
 * order, has a pin of its own in its header, and a task dialog has none in the
 * page's menu bar; both are left alone.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  // The pin button shows the Pin icon while the bar floats and Unpin once it is
  // pinned. Icon names are not translated, unlike the button's label.
  var FLOATING_PIN_SEL = '.ms-nav-layout-menubar i[data-icon-name="Pin"]';

  /**
   * Pins the bar of the page on screen in doc, if it floats and nobody chose
   * that. `done` is a WeakSet of the pages already decided, kept by the caller;
   * `storage` is the client frame's localStorage. A page whose bar shows
   * pinned is not marked done: BC can still settle on floating a moment later,
   * and this then gets its turn on the next pass. Costs one query in the page
   * on screen per pass.
   */
  function apply(doc, done, storage) {
    var view = BCBuddy.Maximize.topView(doc);
    var icon = view.querySelector(FLOATING_PIN_SEL);
    var button = icon && icon.closest('button');
    var form = button && button.closest('form[data-page-id]');
    if (!form || done.has(form)) return;
    done.add(form);
    var State = BCBuddy.BCState;
    if (State.chosen(storage, 'pin', State.pageId(form))) return;
    try { button.click(); } catch (e) { /* BC tore it down mid-render */ }
  }

  BCBuddy.ActionBar = {
    apply: apply
  };
})(typeof self !== 'undefined' ? self : this);
