/*
 * BC Buddy - hide the FactBox pane.
 *
 * Cards, documents and lists open with the FactBox pane on the right. BC
 * remembers per page whether you closed it, but only once someone clicks its
 * toggle; until then the pane shows. This closes it the first time a page
 * opens, with one click on that same toggle. BC stores the click, and from then
 * on the page is BC's: open the pane again and it stays open (see bcstate.js).
 *
 * BC keeps the pane in the same stored layout as wide layout, and writes the
 * whole layout on every change: Maximize's click on the wide toggle stores the
 * pane as open too. So the page is judged the moment its form first shows,
 * before Maximize clicks anything (content.js runs this first), and that
 * verdict holds until the toggle turns up. A page someone widened or set
 * before, in this browser, keeps its pane: BC cannot tell us who chose.
 *
 * A task dialog (a page opened over another, such as Select from full list) is
 * left alone.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var ROOT_FORM_SEL = 'form.ms-nav-root-form[data-page-id]';
  // The pane's toggle at the top right of the page. It stays in the DOM, hidden
  // and unchecked, on a page without FactBoxes; that page's form says so.
  var TOGGLE_SEL = '.ms-nav-layout-factbox-toggle-button button';
  var NO_FACTBOXES_CLASS = 'form-no-factboxes';
  var TASK_DIALOG_CLASS = 'spa-task-dialog';

  /**
   * Closes the pane of the page on screen in doc, if it shows and nobody set
   * the page before. `done` is a WeakMap the caller keeps, from a page's form to
   * true while its toggle is still awaited and false once decided; `storage` is
   * the client frame's localStorage. Costs one query in the page on screen per
   * pass, a second while a toggle is awaited, and a look in BC's storage once
   * per page.
   */
  function apply(doc, done, storage) {
    var view = BCBuddy.Maximize.topView(doc);
    if (view.classList && view.classList.contains(TASK_DIALOG_CLASS)) return;
    var form = view.querySelector(ROOT_FORM_SEL);
    if (!form) return;
    var pending = done.get(form);
    if (pending === false) return;
    if (pending === undefined) {
      var State = BCBuddy.BCState;
      pending = !State.chosen(storage, 'factbox', State.pageId(form));
      done.set(form, pending);
      if (!pending) return;
    }
    if (form.classList.contains(NO_FACTBOXES_CLASS)) {
      done.set(form, false);
      return;
    }
    var button = form.querySelector(TOGGLE_SEL);
    if (!button) return; // BC draws it with the wide toggle, a moment after the form
    done.set(form, false);
    // The toggle shows checked from the start on a page whose pane is open; a
    // pane that is already closed needs nothing.
    if (!BCBuddy.Maximize.isPressed(button)) return;
    try { button.click(); } catch (e) { /* BC tore it down mid-render */ }
  }

  BCBuddy.FactBox = {
    apply: apply
  };
})(typeof self !== 'undefined' ? self : this);
