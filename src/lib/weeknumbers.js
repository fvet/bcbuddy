// Week numbers in the date picker
//
// BC's date picker is Fluent UI v9's `Calendar`, and BC does wire up Fluent's
// `showWeekNumbers`: **Shift+Home** in an open picker toggles it (live client,
// 2026-10-11). BC stores the choice per user and environment, not per page, as
// `<user>:<environment>:DatePicker` = `{"showWeekNumbers":true|false}`, and reads
// it each time a picker opens; without the key the numbers are off.
//
// `lib/weeknumbers.js` writes `{"showWeekNumbers":true}` under that key for every
// user and environment that has none yet, and never touches a stored value, so
// Shift+Home stays the user's switch. It is started and stopped by
// `applyWeekNumbers()` in `content.js`.
//
// The prefix comes from `BCState.prefixes()`: BC writes
// `<user>:<environment>:NavBar` (the navigation bar's measured width) each time
// it starts, so every such key names a user and environment that ran BC here.
// An environment that starts for the first time while the tab is open is caught
// by the `storage` event: BC writes from the client frame, and the content
// script in the top frame hears it.
//
// The numbers are BC's: `firstWeekOfYear` and `firstDayOfWeek` come from the
// user's Region (`calendarWeekRule` in BC's formatting info). A Dutch region
// gives ISO 8601 weeks, as `Date2DWY`; a US region need not. BC draws them as
// `th.fui-CalendarDayGrid__weekNumberCell`, the first cell of each row, and
// widens the picker from 220 to 250px. Its label for that cell reads
// "Weeknummer undefined", a gap in BC's own strings.
//
// Runtime: one walk over the `localStorage` keys when the switch turns on or a
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
 * and reads it each time a picker opens. Without that key the numbers are off.
 * BC Buddy turns them on where nobody chose yet, by writing the key exactly as
 * BC does. From then on it is BC's setting: Shift+Home turns the numbers off,
 * BC stores that, and BC Buddy leaves a stored value alone.
 *
 * The numbers are BC's own, counted as the user's Region in My Settings says
 * (first day of the week, and which week is week 1).
 *
 * Which users and environments: see BCState.prefixes(). An environment that
 * starts for the first time while BC Buddy runs is caught by the storage
 * event: BC writes its start key from the client frame, and the page around
 * that frame hears it. Runtime: one walk over the localStorage keys when this
 * starts, and a look at the key of each storage event, which BC raises a few
 * times per session. Nothing runs in the picker or while you scroll or type.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var KEY = 'DatePicker';
  var ON = JSON.stringify({ showWeekNumbers: true });

  /**
   * Turns BC's week numbers on for every user and environment in `storage`
   * that has no DatePicker setting yet. Returns how many it turned on.
   */
  function turnOn(storage) {
    var count = 0;
    BCBuddy.BCState.prefixes(storage).forEach(function (prefix) {
      try {
        if (storage.getItem(prefix + KEY) !== null) return;
        storage.setItem(prefix + KEY, ON);
        count++;
      } catch (e) { /* storage full or blocked: BC cannot store it either */ }
    });
    return count;
  }

  /** Starts in window `win`. Returns { detach() }. */
  function attach(win) {
    var storage = null;
    try { storage = win.localStorage; } catch (e) { /* blocked */ }
    if (!storage) return { detach: function () {} };

    function onStorage(e) {
      if (e.newValue !== null && BCBuddy.BCState.isStartKey(e.key)) turnOn(storage);
    }

    turnOn(storage);
    win.addEventListener('storage', onStorage);
    return {
      detach: function () { win.removeEventListener('storage', onStorage); }
    };
  }

  BCBuddy.WeekNumbers = {
    KEY: KEY,
    turnOn: turnOn,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
