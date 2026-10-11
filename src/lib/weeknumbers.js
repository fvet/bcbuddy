/*
 * BC Buddy - week numbers in the date picker.
 *
 * Business Central's date picker is Fluent UI's Calendar. Fluent can show week
 * numbers itself, but BC does not turn that on and an extension cannot reach
 * its props, so we add them: each week row's first cell gets a data-bcb-week
 * attribute, and a rule in content.css draws it in a margin left of the grid.
 *
 * The numbers are what BC's own Date2DWY(Date, 2) returns: ISO 8601, always,
 * whatever the server or device settings. Weeks start on Monday, and week 1 is
 * the week that holds the first Thursday of the year (the one with 4 January),
 * so 29 December 2025 is in week 1 of 2026. A row is labelled with the week of
 * its Monday: with Monday first, as in BC, that is the whole row.
 * https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/methods-auto/system/system-date2dwy-method
 *
 * What runs (live client, BC SaaS, 2026-10-11): BC opens the picker as a new
 * Fluent layer, appended to div#fluent-default-layer-host, a direct child of
 * body. So one observer watches the direct children of body (to find that
 * host) and one the direct children of the host; neither looks deeper. A layer
 * that holds a calendar gets an observer of its own while it is open, because
 * React replaces the week rows when you change month. That calendar is about
 * fifty cells and changes only when you click in it. Nothing runs while you
 * scroll or type.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  var HOST_ID = 'fluent-default-layer-host';
  var CALENDAR_SEL = '.fui-Calendar';
  // The rows on screen. Fluent keeps a hidden row above and below for its
  // month animation; those are left alone.
  var ROW_SEL = 'tr.fui-CalendarDayGrid__weekRow';
  var DAY_SEL = 'button.fui-CalendarDayGrid__dayButton[aria-label]';
  var MARK = 'data-bcb-week';
  var DAY_MS = 86400000;
  var RETRY_MS = 50;

  /** ISO 8601 week number of a date, as BC's Date2DWY(Date, 2). */
  function isoWeek(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // The Thursday of this week decides the year the week belongs to.
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    return Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
  }

  /**
   * Month names in this language, lower case, to their number: the long and
   * the short name, and the form a month takes next to a day ("grudnia" next
   * to "grudzień" in Polish), so the label parses whichever BC uses.
   */
  function monthNames(lang) {
    var names = {};
    var formats;
    try {
      formats = [
        new Intl.DateTimeFormat(lang, { month: 'long' }),
        new Intl.DateTimeFormat(lang, { month: 'short' }),
        new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' }),
        new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
      ];
    } catch (e) {
      return names; // a language tag Intl does not know
    }
    for (var m = 0; m < 12; m++) {
      var date = new Date(2026, m, 15);
      formats.forEach(function (format) {
        format.formatToParts(date).forEach(function (part) {
          if (part.type === 'month') names[part.value.toLowerCase().replace(/\.$/, '')] = m;
        });
      });
    }
    return names;
  }

  /**
   * The date in a day button's label, such as "22, december, 2025", or null.
   * The order of day, month and year differs per language, so this looks for
   * a four-digit year, a month name and a day number wherever they are.
   */
  function parseLabel(label, names) {
    var year = null;
    var month = null;
    var day = null;
    String(label || '').toLowerCase().split(/[\s,.]+/).forEach(function (token) {
      if (!token) return;
      if (/^\d{4}$/.test(token)) year = Number(token);
      else if (/^\d{1,2}$/.test(token)) day = Number(token);
      else if (Object.prototype.hasOwnProperty.call(names, token)) month = names[token];
    });
    if (year === null || month === null || day === null || day < 1 || day > 31) return null;
    var date = new Date(year, month, day);
    return date.getMonth() === month ? date : null;
  }

  /** The Monday in the week a row starts with. */
  function mondayOf(first) {
    var date = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    date.setDate(date.getDate() + (8 - (date.getDay() || 7)) % 7);
    return date;
  }

  /** Puts the week number on every row of a calendar. Safe to repeat. */
  function label(calendar, names) {
    var rows = calendar.querySelectorAll(ROW_SEL);
    for (var i = 0; i < rows.length; i++) {
      var cell = rows[i].cells[0];
      var day = cell && cell.querySelector(DAY_SEL);
      var date = day && parseLabel(day.getAttribute('aria-label'), names);
      if (!date) continue;
      var week = String(isoWeek(mondayOf(date)));
      if (cell.getAttribute(MARK) !== week) cell.setAttribute(MARK, week);
    }
  }

  /** Starts week numbers in this document. Returns { detach() }. */
  function attach(doc) {
    var win = doc.defaultView;
    var names = null;
    var host = null;
    var detached = false;
    // The observer per open calendar, keyed by its layer.
    var open = new Map();

    var bodyWatch = new win.MutationObserver(findHost);
    var hostWatch = new win.MutationObserver(onLayers);

    if (doc.body) start();
    else doc.addEventListener('DOMContentLoaded', start, { once: true });

    function start() {
      if (detached || !doc.body) return;
      bodyWatch.observe(doc.body, { childList: true });
      findHost();
    }

    // The host comes with the first Fluent layer, so it may not be there yet.
    function findHost() {
      var found = doc.getElementById(HOST_ID);
      if (found === host) return;
      hostWatch.disconnect();
      closeAll();
      host = found;
      if (!host) return;
      hostWatch.observe(host, { childList: true });
      for (var i = 0; i < host.children.length; i++) watch(host.children[i], false);
    }

    function onLayers(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) watch(added[j], false);
        var removed = mutations[i].removedNodes;
        for (var k = 0; k < removed.length; k++) close(removed[k]);
      }
    }

    // retried: a layer can arrive a moment before its content does, so one
    // without a calendar is looked at once more.
    function watch(layer, retried) {
      if (detached || layer.nodeType !== 1 || open.has(layer) || !layer.isConnected) return;
      var calendar = layer.querySelector(CALENDAR_SEL);
      if (!calendar) {
        if (!retried) win.setTimeout(function () { watch(layer, true); }, RETRY_MS);
        return;
      }
      if (!names) names = monthNames(doc.documentElement.lang || win.navigator.language);
      label(calendar, names);
      var rows = new win.MutationObserver(function () { label(calendar, names); });
      rows.observe(calendar, { childList: true, subtree: true });
      open.set(layer, rows);
    }

    function close(layer) {
      var rows = open.get(layer);
      if (!rows) return;
      rows.disconnect();
      open.delete(layer);
    }

    function closeAll() {
      open.forEach(function (rows) { rows.disconnect(); });
      open.clear();
    }

    function detach() {
      detached = true;
      bodyWatch.disconnect();
      hostWatch.disconnect();
      closeAll();
      var marked = doc.querySelectorAll('[' + MARK + ']');
      for (var i = 0; i < marked.length; i++) marked[i].removeAttribute(MARK);
    }

    return { detach: detach };
  }

  BCBuddy.WeekNumbers = {
    MARK: MARK,
    isoWeek: isoWeek,
    monthNames: monthNames,
    parseLabel: parseLabel,
    mondayOf: mondayOf,
    label: label,
    attach: attach
  };
})(typeof self !== 'undefined' ? self : this);
