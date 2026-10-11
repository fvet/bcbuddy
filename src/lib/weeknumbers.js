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
