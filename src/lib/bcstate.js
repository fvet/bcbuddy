/*
 * BC Buddy - Business Central's own page settings.
 *
 * BC remembers a few choices per page in the localStorage of its client frame,
 * under keys such as
 *
 *   <user>:<environment>:Layout:0000001a-0000-0001-0c00-0000836bd2d2
 *   <user>:<environment>:TCB0000001a-0000-0001-0c00-0000836bd2d2
 *
 * The id after the prefix starts with the page number, eight hex digits. BC
 * writes a key only when someone changes that setting on that page, so no key
 * means the page shows BC's default. BC Buddy changes a default the first time
 * a page opens, and never a choice: chosen() says whether there is one.
 *
 * The user and environment part of the key cannot be rebuilt from the page
 * (the URL often leaves the environment out), so a key matches on what follows
 * it. A choice made in another environment, or by another user in the same
 * browser, then counts too, and BC Buddy errs on leaving the page alone.
 *
 * A few settings belong to the user rather than to a page, such as week
 * numbers in the date picker (see weeknumbers.js). prefixes() finds the
 * `<user>:<environment>:` part for those.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  // What each setting looks like in storage: a test for its key, given the
  // page number in hex, and the field BC writes into it. A task dialog keeps
  // its own layout, apart from the same page opened in full.
  var KINDS = {
    // Wide layout of a page (the toggle at the top right).
    wide: {
      field: 'PageLayoutExpanded',
      key: function (h) {
        return function (key) {
          return key.indexOf(':Layout:' + h + '-') !== -1 && key.indexOf(':TaskDialog:Layout:') === -1;
        };
      }
    },
    // A maximized task dialog, such as Select from full list.
    dialog: {
      field: 'PageLayoutExpanded',
      key: function (h) {
        return function (key) { return key.indexOf(':TaskDialog:Layout:' + h + '-') !== -1; };
      }
    },
    // List, tiles or tall tiles. The key is the list's own id with no prefix;
    // the field tells it apart from the other keys that end the same way.
    list: {
      field: 'Layout',
      key: function (h) {
        var re = new RegExp(':' + h + '-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i');
        return function (key) { return re.test(key); };
      }
    },
    // The pin on the action bar (BC's "tabbed command bar").
    pin: {
      field: 'Pinned',
      key: function (h) {
        return function (key) { return key.indexOf(':TCB' + h + '-') !== -1; };
      }
    }
  };

  /** The page number of the page in `view`, from its root form, or null. */
  function pageId(view) {
    var form = view && (view.matches && view.matches('form[data-page-id]')
      ? view : view.querySelector && view.querySelector('form[data-page-id]'));
    var id = form ? parseInt(form.getAttribute('data-page-id'), 10) : NaN;
    return id >= 0 ? id : null;
  }

  function hex(id) {
    return ('0000000' + id.toString(16)).slice(-8);
  }

  /**
   * Has someone set `kind` on page `id` themselves? Runs once per page that
   * opens, not per pass: one walk over the keys of `storage`, and a parse of
   * the few that match. Without a page number or a readable storage there is
   * nothing to go on, and the answer is no.
   */
  function chosen(storage, kind, id) {
    var spec = KINDS[kind];
    if (!spec || id == null || !storage) return false;
    var matches = spec.key(hex(id));
    try {
      for (var i = 0; i < storage.length; i++) {
        var key = storage.key(i);
        if (key && matches(key) && holds(storage.getItem(key), spec.field)) return true;
      }
    } catch (e) { /* storage blocked: BC cannot have stored anything either */ }
    return false;
  }

  function holds(text, field) {
    var value;
    try { value = JSON.parse(text); } catch (e) { return false; }
    return !!value && typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, field);
  }

  // BC writes the size of its navigation bar to <user>:<environment>:NavBar
  // each time it starts, so that key is there for everyone who ran BC in this
  // browser, in each environment.
  var START_KEY = 'NavBar';

  function isStartKey(key) {
    return typeof key === 'string' && key.length > START_KEY.length + 1 &&
      key.slice(-(START_KEY.length + 1)) === ':' + START_KEY;
  }

  /**
   * The `<user>:<environment>:` part of BC's keys for every user and
   * environment that ran BC in this browser: what BC puts before the name of
   * a setting that is not tied to a page.
   */
  function prefixes(storage) {
    var found = [];
    try {
      for (var i = 0; i < storage.length; i++) {
        var key = storage.key(i);
        if (isStartKey(key)) found.push(key.slice(0, -START_KEY.length));
      }
    } catch (e) { /* storage blocked */ }
    return found;
  }

  BCBuddy.BCState = {
    pageId: pageId,
    hex: hex,
    chosen: chosen,
    isStartKey: isStartKey,
    prefixes: prefixes
  };
})(typeof self !== 'undefined' ? self : this);
