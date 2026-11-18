// Week numbers in the date picker
//
// BC's date picker is Fluent UI v9's `Calendar`, and BC does wire up Fluent's
// `showWeekNumbers`: **Shift+Home** in an open picker toggles it (live client,
// 2026-10-11). BC stores the choice per user and environment, not per page, as
// `<user>:<environment>:DatePicker` = `{"showWeekNumbers":true|false}`, and reads
// it each time a picker opens; without the key the numbers are off.
//
// The BC Buddy switch is the only authority, on or off. `lib/weeknumbers.js`
// writes `showWeekNumbers` under that key for every user and environment, and
// writes it back whenever BC stores something else (a Shift+Home), so that
// press never sticks: the open picker flips once, the next one follows the
// switch. It is started and stopped by `applyWeekNumbers()` in `content.js`,
// only while BC Buddy and the Web client area are on; with either off BC
// Buddy leaves the key alone.
//
// The prefix comes from `BCState.prefixes()`: BC writes
// `<user>:<environment>:NavBar` (the navigation bar's measured width) each time
// it starts, so every such key names a user and environment that ran BC here.
// On-prem builds leave the environment out (`<user>:NavBar`). A key BC writes
// from the client frame, such as an environment starting for the first time or
// a Shift+Home, is caught by the `storage` event: the content script in the top
// frame hears it.
//
// Needs BC 27 or later (2025 release wave 2). An on-prem client seen in
// 2026-11 passes no `showWeekNumbers` to the calendar at all, so the key does
// nothing there.
//
// The numbers are BC's: `firstWeekOfYear` and `firstDayOfWeek` come from the
// user's Region (`calendarWeekRule` in BC's formatting info). A Dutch region
// gives ISO 8601 weeks, as `Date2DWY`; a US region need not. BC draws them as
// `th.fui-CalendarDayGrid__weekNumberCell`, the first cell of each row, and
// widens the picker from 220 to 250px. Its label for that cell reads
// "Weeknummer undefined", a gap in BC's own strings.
//
// Runtime: one walk over the `localStorage` keys when the switch changes or a
// page loads, and a suffix check on each `storage` event, which BC raises a few
// times per session. Nothing runs in the picker itself.

/*
 * BC Buddy - week numbers in the date picker.
 *
 * Business Central's date picker can show week numbers itself: press
 * Shift+Home while it is open. BC remembers that per user and environment, in
 * the client frame's localStorage under
 *
 *   <user>:<environment>:DatePicker   {"showWeekNumbers":true}
 *
 * and reads it each time a picker opens. BC Buddy's switch decides, on or off:
 * it writes the key exactly as BC does and writes it back when BC stores a
 * different value, so a Shift+Home does not stick.
 *
 * The numbers are BC's own, counted as the user's Region in My Settings says
 * (first day of the week, and which week is week 1).
 *
 * Which users and environments: see BCState.prefixes(). Runtime: one walk over
 * the localStorage keys when this starts, and a look at the key of each storage
 * event, which BC raises a few times per session. Nothing runs in the picker or
 * while you scroll or type.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var KEY = 'DatePicker';
  var FIELD = 'showWeekNumbers';

  function isPickerKey(key) {
    return typeof key === 'string' && key.length > KEY.length + 1 &&
      key.slice(-(KEY.length + 1)) === ':' + KEY;
  }

  /** What `text` should become so that showWeekNumbers is `on`; null if it already is. */
  function wanted(text, on) {
    var value = null;
    try { value = text === null ? null : JSON.parse(text); } catch (e) { /* garbled: replace */ }
    if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
    if (value[FIELD] === on) return null;
    value[FIELD] = on;
    return JSON.stringify(value);
  }

  function set(storage, key, on) {
    try {
      var next = wanted(storage.getItem(key), on);
      if (next === null) return false;
      storage.setItem(key, next);
      return true;
    } catch (e) { /* storage full or blocked: BC cannot store it either */ }
    return false;
  }

  /**
   * Makes showWeekNumbers `on` for every user and environment in `storage`
   * and keeps the other fields BC stored. Returns how many keys it changed.
   */
  function enforce(storage, on) {
    var count = 0;
    BCBuddy.BCState.prefixes(storage).forEach(function (prefix) {
      if (set(storage, prefix + KEY, on)) count++;
    });
    return count;
  }

  /** Starts in window `win`, holding the numbers `on` or off. Returns { detach() }. */
  function attach(win, on) {
    on = !!on;
    var storage = null;
    try { storage = win.localStorage; } catch (e) { /* blocked */ }
    if (!storage) return { detach: function () {} };

    function onStorage(e) {
      if (e.newValue === null) return;
      if (isPickerKey(e.key)) set(storage, e.key, on);
      else if (BCBuddy.BCState.isStartKey(e.key)) enforce(storage, on);
    }

    enforce(storage, on);
    win.addEventListener('storage', onStorage);
    return {
      detach: function () { win.removeEventListener('storage', onStorage); }
    };
  }

  BCBuddy.WeekNumbers = {
    KEY: KEY,
    enforce: enforce,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
