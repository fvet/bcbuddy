/*
 * BC Buddy - Help & feedback, the report view of the side panel.
 *
 * The start view opens it as a problem report (type Bug) or as feedback or a
 * suggestion (type Improvement); both can carry a priority, from the list the
 * settings give. The report is a series of steps: type what happened in the
 * box, take a screenshot of the tab in front (the whole screen or an area),
 * and the text goes with that screenshot as its note while the box empties
 * for the next step. Notes stay editable under their thumbnails, a
 * screenshot can be drawn on, and text left in the box at the end is the
 * last step, without a screenshot. A report with text only is fine.
 *
 * Then, from the buttons at the end:
 *   Email          the report as a new email (.eml, screenshots inside, which
 *                  Outlook opens ready to send). With the optional downloads
 *                  permission the file is opened straight away; without it,
 *                  or when that fails, it is downloaded and the user opens it.
 *   Email (draft)  the email app opens with the address and subject filled
 *                  in and the report on the clipboard, to paste.
 *   Download       the report as a web page (.html).
 *   Copy           the report on the clipboard only.
 * After any of them, Close throws the report away and closes the panel.
 *
 * The panel lives next to the page, so it is never in a screenshot and stays
 * open while the user moves around Business Central. Two steps need the page
 * itself, the area selection and the drawing editor: those run in
 * src/support/support-overlay.js, injected into the tab's top frame when they
 * start, and only on a tab that is Business Central (the content script says
 * so when asked, see 'bcb:support-context').
 *
 * The report in progress is kept in chrome.storage.session for this window,
 * so closing the panel, or the browser stopping the service worker, loses
 * nothing. Content scripts cannot read that storage.
 *
 * Settings, the tab's title and address, the text people type or paste and
 * what the overlay hands back are untrusted: settings go through
 * normalize(), text is kept as plain runs with bold, italic and underline
 * flags and only ever put on the page with textContent, the report's HTML is
 * our own markup around escaped text, and an image must be a PNG or JPEG
 * data URL of bounded size.
 */
(function () {
  'use strict';

  var BCBuddy = self.BCBuddy;

  // Enough to walk through a problem, few enough for a mail server.
  var MAX_SHOTS = 9;
  // Nine whole-screen PNGs from a large monitor run to tens of megabytes,
  // more than a mail server accepts. A helpdesk reads a BC screen fine at
  // this width, and JPEG cuts the rest by a factor of ten.
  var MAX_SHOT_SIDE = 1920;
  var JPEG_QUALITY  = 0.85;
  // What the editor may hand back: a PNG of a 1920 px screenshot is a few
  // megabytes; anything far beyond that did not come from our editor.
  var MAX_IMAGE_CHARS = 24 * 1024 * 1024;
  var IMAGE_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
  var MAX_TEXT = 300;
  // Characters of text per box: the message box and every note.
  var MAX_RICH = 20000;
  var MAX_RUNS = 4000;
  // What the drawing editor may hand back about its drawings.
  var MAX_ANNOTATIONS = 300;
  var MAX_POINTS = 20000;
  var MAX_COORD = 100000;
  var ANNOTATION_TYPES = ['arrow', 'draw', 'box', 'blur'];
  var HEX_RE = /^#[0-9a-fA-F]{6}$/;
  var SAVE_DELAY_MS = 400;
  // The {title} in the subject: the start of the first step's text.
  var TITLE_MAX = 60;
  var SUBJECT_MAX = 250;
  var MAX_PRIORITY = 60;
  var MAX_PRIORITIES = 20;
  var MAX_SUBJECT_TEMPLATE = 200;
  // The Email button opens the downloaded .eml at once, with these two
  // optional permissions, asked for on the first click.
  var DOWNLOAD_PERMISSIONS = { permissions: ['downloads', 'downloads.open'] };
  var DOWNLOAD_WAIT_MS = 10000;
  var OPEN_WAIT_MS = 3000;

  var TYPES = ['Bug', 'Improvement'];
  // The built-in priorities: the value goes in the report as the label in
  // the user's language.
  var BUILT_IN_PRIORITIES = [['Normal', 'spPrioNormal'], ['High', 'spPrioHigh'], ['Critical', 'spPrioCritical']];
  var PLACEHOLDERS = /\{(prio|type|company|environment|tenant|title)\}/g;

  var started = false;
  var windowId = null;
  var draftKey = '';
  var shots = [];
  var cachedEmail = '';
  var busy = false;
  var saveTimer = 0;
  var type = 'Bug';
  // What the user picked (null: the default from the settings) and what is
  // in effect, which is '' when the list does not have it.
  var priorityWanted = null;
  var priority = '';
  // From the settings: null is the built-in list, [] hides the field.
  var config = { priorities: null, defaultPriority: '', subjectBug: '', subjectIdea: '' };
  // The area selection that runs: the tab it runs in, else null.
  var selectingTab = null;
  var desc = null;
  // Where the tab in front is: { tabId, url, title, webClient, tenant,
  // environment, company }. Refreshed when the user switches tabs or a page
  // finishes loading.
  var here = { tabId: null, url: '', title: '', webClient: false };

  function $(id) { return document.getElementById(id); }
  function t(key, subs) { return BCBuddy.t(key, subs == null ? [] : [String(subs)]); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function text(value, max) {
    return typeof value === 'string' ? value.slice(0, max || MAX_TEXT) : '';
  }

  /** Called by sidepanel.js the first time the view is shown. */
  function start(winId) {
    if (started) return;
    started = true;
    windowId = winId;
    draftKey = 'bcbHelpDraft:' + winId;

    desc = richBox($('help-desc'), function () { updateButtons(); saveLater(); });

    $('help-noaddr-link').addEventListener('click', function (e) {
      e.preventDefault();
      if (e.isTrusted) openSettings();
    });
    $('help-discard').addEventListener('click', trusted(showConfirm));
    $('help-discard-yes').addEventListener('click', trusted(function () {
      $('help-confirm').close();
      reset();
    }));
    $('help-discard-no').addEventListener('click', trusted(function () { $('help-confirm').close(); }));
    // A click on the grey around the dialog cancels, as Esc does.
    $('help-confirm').addEventListener('click', function (e) {
      if (e.isTrusted && e.target === $('help-confirm')) $('help-confirm').close();
    });
    $('help-confirm').addEventListener('close', function () { $('help-desc').focus(); });
    $('help-draft-ok').addEventListener('click', trusted(function () { $('help-draft').close(); }));
    $('help-add-area').addEventListener('click', trusted(addArea));
    $('help-add-full').addEventListener('click', trusted(addScreen));
    $('help-send').addEventListener('click', trusted(emailReport));
    $('help-dl').addEventListener('click', trusted(downloadReport));
    $('help-copy').addEventListener('click', trusted(copyReport));
    $('help-close').addEventListener('click', trusted(closeReport));
    dropdown($('help-send-more'), $('help-send-menu'), function (v) { if (v === 'draft') emailDraft(); });
    $('help-prio').addEventListener('change', function (e) {
      if (!e.isTrusted) return;
      priorityWanted = $('help-prio').value;
      renderPriorities();
      saveLater();
    });
    document.addEventListener('click', function (e) { if (e.isTrusted) closeMenus(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !e.isTrusted) return;
      closeMenus();
      // The area selection runs on the page, but the focus is usually still
      // here: Esc in the panel ends it as Esc on the page does.
      if (selectingTab != null) cancelSelection(selectingTab);
    });

    setType('Bug');
    renderPriorities();

    chrome.storage.local.get(BCBuddy.STORAGE_KEY).then(function (obj) {
      applySettings(obj && obj[BCBuddy.STORAGE_KEY]);
    }).catch(function () { applySettings(null); });
    // The gear keeps the report, so a change made in settings (the address,
    // the priorities) shows up here at once.
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes[BCBuddy.STORAGE_KEY]) applySettings(changes[BCBuddy.STORAGE_KEY].newValue);
    });

    chrome.storage.session.get(draftKey).then(function (obj) {
      restore(obj && obj[draftKey]);
    }).catch(function () { /* nothing kept */ });

    chrome.tabs.onActivated.addListener(function (info) {
      if (info.windowId === windowId) refreshHere();
    });
    chrome.tabs.onUpdated.addListener(function (id, change) {
      if (id === here.tabId && change.status === 'complete') refreshHere();
    });
    refreshHere();
    renderThumbs(true);
  }

  /**
   * Each time the view comes to the front, with the type its entry on the
   * start view stands for. A report in progress keeps its text and
   * screenshots when it comes back as the other type.
   */
  function shown(val) {
    if (TYPES.indexOf(val) !== -1 && val !== type) { setType(val); saveLater(); }
    updateButtons();
    $('help-desc').focus();
  }

  /** The language changed: every text this file puts on screen again. */
  function relocalize() {
    if (!started) return;
    setType(type);
    renderPriorities();
    renderThumbs(true);
  }

  /** A handler that only runs for a real click, never for a scripted one. */
  function trusted(fn) {
    return function (e) { if (e && e.isTrusted) fn(e); };
  }

  function openSettings() {
    // Keeps the panel (and the report) open; settings open in their own tab.
    chrome.runtime.sendMessage({ type: 'bcb:open-options', panel: 'feedback' }).catch(function () {});
  }

  // ------------------------------------------------------------------ settings

  function oneLine(value, max) {
    return typeof value === 'string'
      ? value.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || MAX_TEXT)
      : '';
  }

  function applySettings(raw) {
    // Stored settings are untrusted: only what normalize() lets through is
    // used, and without it nothing is (no address, the built-in list). The
    // fields are checked once more here, as plain short text.
    var s = BCBuddy.normalize(raw);
    cachedEmail = s.feedbackEmail || '';
    var list = null;
    if (Array.isArray(s.feedbackPriorities)) {
      list = [];
      s.feedbackPriorities.forEach(function (v) {
        var name = oneLine(v, MAX_PRIORITY);
        if (name && list.indexOf(name) === -1 && list.length < MAX_PRIORITIES) list.push(name);
      });
    }
    config.priorities = list;
    config.defaultPriority = oneLine(s.feedbackDefaultPriority, MAX_PRIORITY);
    config.subjectBug = oneLine(s.feedbackSubjectBug, MAX_SUBJECT_TEMPLATE);
    config.subjectIdea = oneLine(s.feedbackSubjectIdea, MAX_SUBJECT_TEMPLATE);
    $('help-noaddr').hidden = !!cachedEmail;
    renderPriorities();
    updateButtons();
  }

  /** [{ value, label }]: the built-in three in the user's language, or the team's own as typed. */
  function priorityOptions() {
    if (config.priorities === null) {
      return BUILT_IN_PRIORITIES.map(function (p) { return { value: p[0], label: t(p[1]) }; });
    }
    return config.priorities.map(function (v) { return { value: v, label: v }; });
  }

  function priorityLabel() {
    var opts = priorityOptions();
    for (var i = 0; i < opts.length; i++) if (opts[i].value === priority) return opts[i].label;
    return '';
  }

  /**
   * The priority field: a plain dropdown, gone when the list is empty. What
   * the user picked stays while the list still has it; otherwise the
   * default from the settings, or nothing picked.
   */
  function renderPriorities() {
    var sel = $('help-prio');
    var opts = priorityOptions();
    var values = opts.map(function (o) { return o.value; });
    var def = values.indexOf(config.defaultPriority) !== -1 ? config.defaultPriority : '';
    if (priorityWanted !== null && (priorityWanted === '' || values.indexOf(priorityWanted) !== -1)) priority = priorityWanted;
    else priority = def;
    if (!opts.length) priority = '';
    sel.hidden = !opts.length;
    sel.textContent = '';
    // "Priority", for no choice, while the settings name no default.
    if (!def) sel.appendChild(option('', t('spPriority')));
    opts.forEach(function (o) { sel.appendChild(option(o.value, o.label)); });
    sel.value = priority;
    sel.classList.toggle('unset', !priority);
  }

  function option(value, label) {
    var o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    return o;
  }

  // ------------------------------------------------------------------ where the tab is

  function refreshHere() {
    chrome.tabs.query({ active: true, windowId: windowId }).then(function (tabs) {
      var tab = tabs[0];
      if (!tab) return;
      var next = { tabId: tab.id, url: text(tab.url, 4096), title: text(tab.title), webClient: false };
      here = next;
      updateButtons();
      chrome.tabs.sendMessage(tab.id, { type: 'bcb:support-context' }, { frameId: 0 }).then(function (res) {
        if (here !== next || !res) return;
        next.webClient = res.webClient === true;
        next.tenant = text(res.tenant);
        next.environment = text(res.environment);
        next.company = text(res.company);
        updateButtons();
      }, function () { /* no BC Buddy in that tab */ });
    }).catch(function () {});
  }

  // ------------------------------------------------------------------ rich text

  /*
   * The message box and the notes are contenteditable, for bold, italic and
   * underline. What is in them is never read back as HTML: it is kept as a
   * model, runs of text with b, i and u flags, where a line break is '\n'
   * in the text. The model goes into the draft, the DOM is rebuilt from it
   * with createElement and textContent, and the report's HTML is written
   * from it with every run escaped. Paste and drop insert plain text only.
   */

  var BOLD = { B: 1, STRONG: 1 };
  var ITALIC = { I: 1, EM: 1 };
  var BLOCK = { DIV: 1, P: 1, LI: 1, UL: 1, OL: 1, H1: 1, H2: 1, H3: 1, BLOCKQUOTE: 1, PRE: 1 };
  var SKIP = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1 };

  /** Line breaks as '\n', no other control characters. */
  function cleanText(s) {
    return String(s).replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f\u2028\u2029]/g, '');
  }

  function sameFlags(a, b) { return !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u; }

  function pushRun(runs, t, f) {
    if (!t) return;
    var last = runs[runs.length - 1];
    if (last && sameFlags(last, f)) { last.t += t; return; }
    var run = { t: t };
    if (f.b) run.b = true;
    if (f.i) run.i = true;
    if (f.u) run.u = true;
    runs.push(run);
  }

  function modelLength(model) {
    var n = 0;
    for (var i = 0; i < model.length; i++) n += model[i].t.length;
    return n;
  }

  function modelText(model) { return model.map(function (r) { return r.t; }).join(''); }

  /** Cuts a model to the cap. */
  function capModel(model) {
    var out = [], room = MAX_RICH;
    for (var i = 0; i < model.length && room > 0 && out.length < MAX_RUNS; i++) {
      var piece = model[i].t.slice(0, room);
      room -= piece.length;
      pushRun(out, piece, model[i]);
    }
    return out;
  }

  /** A model from storage: anything that is not a run of text is dropped. */
  function cleanModel(raw) {
    if (typeof raw === 'string') raw = [{ t: raw }];
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.slice(0, MAX_RUNS).forEach(function (r) {
      if (r && typeof r.t === 'string') pushRun(out, cleanText(r.t), { b: r.b === true, i: r.i === true, u: r.u === true });
    });
    return capModel(out);
  }

  /** Reads what the box shows into a model. */
  function readModel(root) {
    var tokens = [];
    function walk(node, f) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          var s = cleanText(c.nodeValue);
          if (s) tokens.push({ t: s, f: f });
        } else if (c.nodeType === 1) {
          var tag = c.nodeName;
          if (SKIP[tag]) continue;
          if (tag === 'BR') { tokens.push({ br: true, f: f }); continue; }
          var st = c.style || {};
          var weight = String(st.fontWeight || '');
          var nf = {
            b: f.b || !!BOLD[tag] || weight === 'bold' || Number(weight) >= 600,
            i: f.i || !!ITALIC[tag] || st.fontStyle === 'italic',
            u: f.u || tag === 'U' || String(st.textDecoration || st.textDecorationLine || '').indexOf('underline') !== -1
          };
          // A block (Chrome's paragraphs) starts on a new line.
          if (BLOCK[tag] && tokens.length) tokens.push({ br: true, f: f, block: true });
          walk(c, nf);
        }
      }
    }
    walk(root, {});
    // A break at the very end only holds the empty last line open, as the
    // browser draws it: it is not a line of its own.
    if (tokens.length && tokens[tokens.length - 1].br) tokens.pop();
    var runs = [];
    tokens.forEach(function (tk) { pushRun(runs, tk.br ? '\n' : tk.t, tk.f); });
    return runs;
  }

  /** Puts a model on screen, with elements and text nodes only. */
  function renderModel(el, model) {
    el.textContent = '';
    model.forEach(function (run) {
      var parent = el;
      if (run.b) parent = parent.appendChild(document.createElement('b'));
      if (run.i) parent = parent.appendChild(document.createElement('i'));
      if (run.u) parent = parent.appendChild(document.createElement('u'));
      run.t.split('\n').forEach(function (part, k) {
        if (k) parent.appendChild(document.createElement('br'));
        if (part) parent.appendChild(document.createTextNode(part));
      });
    });
    // A last empty line needs one more break to show, as when typed.
    var all = modelText(model);
    if (all && all.charAt(all.length - 1) === '\n') el.appendChild(document.createElement('br'));
  }

  function caretToEnd(el) {
    var sel = window.getSelection();
    if (!sel || document.activeElement !== el) return;
    var r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /**
   * Makes a contenteditable a box with bold, italic and underline. onChange
   * runs after every change. Returns { get, set, clear, isEmpty, setPlaceholder }.
   */
  function richBox(el, onChange) {
    var model = [];
    try { document.execCommand('styleWithCSS', false, false); } catch (e) { /* not supported */ }

    function sync() {
      var next = readModel(el);
      if (modelLength(next) > MAX_RICH) {
        next = capModel(next);
        renderModel(el, next);
        caretToEnd(el);
      } else if (!modelLength(next) && el.firstChild) {
        // Empty: no leftover break, so the placeholder shows again.
        el.textContent = '';
      }
      model = next;
      if (onChange) onChange(model);
    }

    /** Plain text at the caret, as typing would put it there. */
    function insertPlain(s) {
      s = cleanText(s || '').replace(/\t/g, '    ');
      var sel = window.getSelection();
      var selected = sel && sel.rangeCount ? sel.toString().length : 0;
      var room = MAX_RICH - modelLength(readModel(el)) + selected;
      s = s.slice(0, Math.max(0, room));
      if (!s) return;
      // Line by line, with a real line break between: insertText would
      // make paragraphs of them.
      s.split('\n').forEach(function (line, k) {
        if (k) document.execCommand('insertLineBreak');
        if (line) document.execCommand('insertText', false, line);
      });
    }

    el.addEventListener('keydown', function (e) {
      if (!e.isTrusted) return;
      var key = String(e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (key === 'b' || key === 'i' || key === 'u')) {
        e.preventDefault();
        document.execCommand(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline');
      }
    });
    el.addEventListener('beforeinput', function (e) {
      if (!e.isTrusted) { e.preventDefault(); return; }
      var kind = e.inputType || '';
      // Enter makes a line break, not a paragraph.
      if (kind === 'insertParagraph') {
        e.preventDefault();
        document.execCommand('insertLineBreak');
        return;
      }
      // Only bold, italic and underline; any other formatting the browser
      // offers, and HTML from paste or drop, stays out.
      if ((kind.indexOf('format') === 0 && kind !== 'formatBold' && kind !== 'formatItalic' && kind !== 'formatUnderline') ||
          kind === 'insertFromPasteAsQuotation') {
        e.preventDefault();
      }
    });
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      if (!e.isTrusted || !e.clipboardData) return;
      insertPlain(e.clipboardData.getData('text/plain'));
    });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      if (!e.isTrusted || !e.dataTransfer) return;
      var s = e.dataTransfer.getData('text/plain');
      if (!s) return;
      var r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
      el.focus();
      if (r && el.contains(r.startContainer)) {
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
      insertPlain(s);
    });
    el.addEventListener('input', function (e) { if (e.isTrusted) sync(); });

    return {
      get: function () { return model.map(function (r) { return Object.assign({}, r); }); },
      set: function (m) { model = cleanModel(m); renderModel(el, model); },
      clear: function () { model = []; el.textContent = ''; },
      isEmpty: function () { return !modelText(model).trim(); },
      setPlaceholder: function (s) {
        el.setAttribute('data-placeholder', s);
        el.setAttribute('aria-label', s);
      }
    };
  }

  /** Leading and trailing white space off a model. */
  function trimModel(model) {
    var m = model.map(function (r) { return Object.assign({}, r); });
    while (m.length && !(m[0].t = m[0].t.replace(/^\s+/, ''))) m.shift();
    while (m.length && !(m[m.length - 1].t = m[m.length - 1].t.replace(/\s+$/, ''))) m.pop();
    return m;
  }

  /** The model as HTML: escaped text, <br>, and b, i and u only. */
  function modelHtml(model) {
    return trimModel(model).map(function (r) {
      var s = esc(r.t).replace(/\n/g, '<br>');
      if (r.u) s = '<u>' + s + '</u>';
      if (r.i) s = '<i>' + s + '</i>';
      if (r.b) s = '<b>' + s + '</b>';
      return s;
    }).join('');
  }

  // ------------------------------------------------------------------ draft

  function restore(d) {
    if (!d || typeof d !== 'object') return;
    if (Array.isArray(d.shots)) {
      shots = d.shots.filter(function (s) { return s && validImage(s.dataUrl); }).slice(0, MAX_SHOTS)
        .map(function (s) {
          var shot = { dataUrl: s.dataUrl, title: text(s.title), url: text(s.url, 4096), note: cleanModel(s.note) };
          if (validImage(s.orig)) {
            shot.orig = s.orig;
            shot.ann = cleanAnnotations(s.ann);
          }
          return shot;
        });
    }
    if (d.desc != null) desc.set(d.desc);
    if (TYPES.indexOf(d.type) !== -1) setType(d.type);
    if (typeof d.priority === 'string') { priorityWanted = oneLine(d.priority, MAX_PRIORITY); renderPriorities(); }
    renderThumbs();
  }

  function saveLater() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, SAVE_DELAY_MS);
  }

  function saveDraft() {
    clearTimeout(saveTimer);
    var draft = {};
    draft[draftKey] = {
      shots: shots, desc: desc.get(),
      type: type, priority: priority
    };
    chrome.storage.session.set(draft).catch(function () { /* over the quota: kept in the panel only */ });
  }

  function clearDraft() {
    clearTimeout(saveTimer);
    chrome.storage.session.remove(draftKey).catch(function () {});
  }

  function hasContent() { return shots.length > 0 || !desc.isEmpty(); }

  // ------------------------------------------------------------------ render

  // ---- dropdown (the Email caret) ----

  function dropdown(btn, menu, onPick) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!e.isTrusted) return;
      var open = menu.hidden;
      closeMenus();
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) {
        var first = menu.querySelector('.dd-opt');
        if (first) first.focus();
      }
    });
    menu.addEventListener('click', function (e) {
      e.stopPropagation();
      var opt = e.target.closest('.dd-opt');
      if (!opt || !e.isTrusted) return;
      closeMenus();
      onPick(opt.getAttribute('data-value'));
    });
  }

  function closeMenus() {
    $('help-send-menu').hidden = true;
    $('help-send-more').setAttribute('aria-expanded', 'false');
  }

  function setType(val) {
    if (TYPES.indexOf(val) === -1) return;
    type = val;
    // The question follows the type: "what went wrong" makes no sense for a
    // suggestion.
    desc.setPlaceholder(t(val === 'Bug' ? 'spDescPlaceholder' : 'spDescPlaceholderImp'));
  }

  function typeLabel() { return t(type === 'Bug' ? 'spTypeBug' : 'spTypeIdea'); }

  function updateButtons() {
    var ok = hasContent();
    var atLimit = shots.length >= MAX_SHOTS;
    var canShoot = here.webClient && !atLimit && !busy;
    // Without a helpdesk address there is nowhere to send to; the warning
    // above says so. Saving the report as a file stays possible.
    $('help-send').disabled = !ok || !cachedEmail;
    $('help-send-more').disabled = !ok || !cachedEmail;
    $('help-dl').disabled = !ok;
    $('help-copy').disabled = !ok;
    $('help-add-area').disabled = !canShoot;
    $('help-add-full').disabled = !canShoot;
    // Steering, not blocking: the screenshot buttons lead until there is
    // one, then the Email button does; without an address to send to,
    // Download takes its place.
    var first = shots.length === 0;
    ['help-add-full', 'help-add-area'].forEach(function (id) { $(id).classList.toggle('primary', first); });
    ['help-send', 'help-send-more'].forEach(function (id) { $(id).classList.toggle('primary', !first && !!cachedEmail); });
    $('help-dl').classList.toggle('primary', !first && !cachedEmail);
    $('help-notbc').hidden = here.webClient;
    $('help-max').hidden = !atLimit;
    $('help-max').textContent = atLimit ? t('spMaxShots', MAX_SHOTS) : '';
    $('help-discard').hidden = !ok || $('view-help').hidden;
    var edits = document.querySelectorAll('#help-thumbs .thumb-edit');
    for (var i = 0; i < edits.length; i++) edits[i].disabled = !here.webClient || busy;
  }

  function renderThumbs(noSave) {
    var box = $('help-thumbs');
    box.textContent = '';
    $('help-steps-card').hidden = !shots.length;

    shots.forEach(function (shot, i) {
      var row  = document.createElement('div'); row.className = 'shot';
      var wrap = document.createElement('div'); wrap.className = 'thumb';
      var img  = document.createElement('img');
      img.src = shot.dataUrl; img.alt = t('spShotAlt', i + 1); img.className = 'thumb-img';
      if (shot.title) img.title = shot.title;
      var edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'thumb-edit';
      edit.title = t('spEdit'); edit.setAttribute('aria-label', t('spEdit'));
      // A fixed drawing of our own, no data in it.
      edit.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'thumb-del';
      del.title = t('spRemove'); del.setAttribute('aria-label', t('spRemove'));
      del.textContent = '\xd7';
      edit.addEventListener('click', trusted(function () { editShot(shot); }));
      del.addEventListener('click', trusted(function () {
        var at = shots.indexOf(shot);
        if (at !== -1) shots.splice(at, 1);
        renderThumbs();
      }));
      wrap.appendChild(img); wrap.appendChild(edit); wrap.appendChild(del);
      // The text of this step, the same box as the message box; left empty,
      // the report shows the screenshot alone.
      var noteEl = document.createElement('div');
      noteEl.className = 'field rich shot-note';
      noteEl.contentEditable = 'true';
      noteEl.setAttribute('role', 'textbox');
      noteEl.setAttribute('aria-multiline', 'true');
      noteEl.spellcheck = true;
      var note = richBox(noteEl, function (m) { shot.note = m; saveLater(); });
      note.setPlaceholder(t('spShotNote'));
      noteEl.setAttribute('aria-label', t('spShotNoteLabel', i + 1));
      note.set(shot.note || []);
      row.appendChild(wrap); row.appendChild(noteEl);
      box.appendChild(row);
    });

    updateButtons();
    if (!noSave) saveDraft();
  }

  function setStatus(id, msg, isError) {
    var el = $(id);
    el.textContent = msg || '';
    el.className = 'status' + (isError ? ' status-err' : '');
  }

  function setBusy(v) { busy = v; updateButtons(); }

  // ------------------------------------------------------------------ capture

  function validImage(url) {
    return typeof url === 'string' && url.length <= MAX_IMAGE_CHARS && IMAGE_RE.test(url);
  }

  function okNumber(v) { return typeof v === 'number' && isFinite(v) && Math.abs(v) <= MAX_COORD; }

  /** The drawings the editor hands back, as plain numbers and our colours only. */
  function cleanAnnotations(list) {
    if (!Array.isArray(list)) return [];
    var out = [], points = 0;
    list.slice(0, MAX_ANNOTATIONS).forEach(function (a) {
      if (!a || ANNOTATION_TYPES.indexOf(a.type) === -1) return;
      var color = typeof a.color === 'string' && HEX_RE.test(a.color) ? a.color : '#c4314b';
      if (a.type === 'draw') {
        if (!Array.isArray(a.pts)) return;
        var pts = [];
        for (var i = 0; i < a.pts.length && points < MAX_POINTS; i++) {
          var p = a.pts[i];
          if (p && okNumber(p.x) && okNumber(p.y)) { pts.push({ x: p.x, y: p.y }); points++; }
        }
        if (pts.length > 1) out.push({ type: 'draw', pts: pts, color: color });
      } else if (okNumber(a.x1) && okNumber(a.y1) && okNumber(a.x2) && okNumber(a.y2)) {
        out.push({ type: a.type, x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2, color: color });
      }
    });
    return out;
  }

  function captureTab() {
    return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  }

  var overlayCss = null;

  /**
   * The overlay's stylesheet as text. The overlay draws in a closed shadow
   * root, which a stylesheet on the page does not reach, so it gets the CSS
   * handed over instead of inserted into the page.
   */
  function overlayStyle() {
    if (!overlayCss) {
      overlayCss = fetch(chrome.runtime.getURL('src/support/support-overlay.css'))
        .then(function (r) { return r.text(); })
        .catch(function (e) { overlayCss = null; throw e; });
    }
    return overlayCss;
  }

  /** Makes sure the tab's top frame has the overlay (area selection, editor). */
  function overlay(tabId) {
    var target = { tabId: tabId };
    return chrome.scripting.executeScript({
      target: target,
      func: function () { return !!(window.BCBuddy && window.BCBuddy.SupportOverlay); }
    }).then(function (res) {
      if (res && res[0] && res[0].result === true) return;
      return Promise.all([overlayStyle(),
        chrome.scripting.executeScript({ target: target, files: ['src/support/support-overlay.js'] })
      ]).then(function (r) {
        return chrome.scripting.executeScript({
          target: target,
          func: function (css) { return window.BCBuddy.SupportOverlay.useStyle(css); },
          args: [r[0]]
        });
      });
    });
  }

  /** Runs one overlay step in the tab and hands back what it resolved. */
  function runOverlay(tabId, func, args) {
    return overlay(tabId).then(function () {
      return chrome.scripting.executeScript({ target: { tabId: tabId }, func: func, args: args || [] });
    }).then(function (res) { return res && res[0] ? res[0].result : null; });
  }

  /** Ends the area selection in that tab, as Esc on the page would. */
  function cancelSelection(tabId) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
        var o = window.BCBuddy && window.BCBuddy.SupportOverlay;
        return !!(o && o.cancel && o.cancel());
      }
    }).catch(function () { /* the tab went away */ });
  }

  function addScreen() {
    if (shots.length >= MAX_SHOTS || !here.webClient) return;
    setStatus('help-status', '');
    var from = { title: here.title, url: here.url };
    setBusy(true);
    captureTab().then(function (dataUrl) {
      return shrink(dataUrl).then(function (small) {
        setBusy(false);
        addShot(small, from);
      });
    }).catch(function () {
      setBusy(false);
      setStatus('help-status', t('spCaptureFailed'), true);
    });
  }

  function addArea() {
    if (shots.length >= MAX_SHOTS || !here.webClient) return;
    setStatus('help-status', '');
    var tabId = here.tabId;
    var from = { title: here.title, url: here.url };
    setBusy(true);
    selectingTab = tabId;
    runOverlay(tabId, function () { return window.BCBuddy.SupportOverlay.selectArea(); }).then(function (rect) {
      selectingTab = null;
      if (!rect) return null;
      return captureTab().then(function (full) { return crop(full, rect); }).then(shrink);
    }).then(function (orig) {
      if (!orig) { setBusy(false); return; }
      // An area is a deliberate choice of what matters, so the editor opens
      // first: the user is nudged to point at it before it is saved. The
      // whole-screen capture next door lands directly.
      return runOverlay(tabId, function (url, ann) { return window.BCBuddy.SupportOverlay.edit(url, ann); }, [orig, []])
        .then(function (res) {
          if (!res || !validImage(res.image)) { setBusy(false); return; }
          var ann = cleanAnnotations(res.annotations);
          if (!ann.length) { setBusy(false); addShot(orig, from); return; }
          return shrink(res.image).then(function (small) {
            setBusy(false);
            addShot(small, from, orig, ann);
          });
        });
    }).catch(function () {
      selectingTab = null;
      setBusy(false);
      setStatus('help-status', t('spCaptureFailed'), true);
    });
  }

  /**
   * Draw on a screenshot again. The editor gets the capture as it was and
   * the drawings so far, so it can undo them one by one and Clear all goes
   * back to the capture.
   */
  function editShot(shot) {
    if (!here.webClient || busy) return;
    setBusy(true);
    var orig = shot.orig || shot.dataUrl;
    runOverlay(here.tabId, function (url, ann) { return window.BCBuddy.SupportOverlay.edit(url, ann); }, [orig, shot.ann || []])
      .then(function (res) {
        if (!res || !validImage(res.image)) { setBusy(false); return; }
        var ann = cleanAnnotations(res.annotations);
        if (!ann.length) {
          setBusy(false);
          shot.dataUrl = orig;
          delete shot.orig;
          delete shot.ann;
          renderThumbs();
          return;
        }
        return shrink(res.image).then(function (small) {
          setBusy(false);
          shot.dataUrl = small;
          shot.orig = orig;
          shot.ann = ann;
          renderThumbs();
        });
      }).catch(function () {
        setBusy(false);
        setStatus('help-status', t('spCaptureFailed'), true);
      });
  }

  /**
   * A new step: the screenshot, with what is in the box as its note. The
   * box empties for the next step.
   */
  function addShot(dataUrl, from, orig, ann) {
    if (shots.length >= MAX_SHOTS) return;
    var shot = { dataUrl: dataUrl, title: from.title, url: from.url, note: trimModel(desc.get()) };
    if (orig && ann && ann.length) { shot.orig = orig; shot.ann = ann; }
    shots.push(shot);
    desc.clear();
    renderThumbs();
    $('help-desc').focus();
  }

  /** Cuts the selected area out of a capture; the rect is in the page's CSS pixels. */
  function crop(fullDataUrl, rect) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var vw = Number(rect.vw), vh = Number(rect.vh);
        if (!(vw > 0) || !(vh > 0)) { reject(new Error('bad area')); return; }
        // The capture is in device pixels; the page's zoom and the display's
        // scaling are both in this ratio.
        var sx = img.naturalWidth / vw, sy = img.naturalHeight / vh;
        var x = clamp(Number(rect.x) * sx, 0, img.naturalWidth - 1);
        var y = clamp(Number(rect.y) * sy, 0, img.naturalHeight - 1);
        var w = clamp(Number(rect.w) * sx, 1, img.naturalWidth - x);
        var h = clamp(Number(rect.h) * sy, 1, img.naturalHeight - y);
        var c = document.createElement('canvas');
        c.width = Math.round(w); c.height = Math.round(h);
        c.getContext('2d').drawImage(img, Math.round(x), Math.round(y), c.width, c.height, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = fullDataUrl;
    });
  }

  function clamp(v, lo, hi) { return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; }

  /** A JPEG of at most MAX_SHOT_SIDE pixels; rejects what is not an image. */
  function shrink(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, MAX_SHOT_SIDE / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width  = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = function () { reject(new Error('not an image')); };
      img.src = dataUrl;
    });
  }

  // ------------------------------------------------------------------ send / save

  /** Tenant, environment and company: the content script's, else from the address. */
  function pageContext() {
    var ctx = BCBuddy.parseUrl(here.url || '') || {};
    return {
      tenant: here.tenant || ctx.tenant || '',
      environment: here.environment || ctx.environment || '',
      company: here.company || ctx.company || ''
    };
  }

  /** The steps of the report: one per screenshot, and the box's text last. */
  function reportSteps() {
    var list = shots.map(function (shot, i) {
      return { title: shot.title, url: shot.url, note: shot.note || [], shot: shot, index: i };
    });
    if (!desc.isEmpty()) list.push({ title: '', url: '', note: desc.get(), shot: null });
    return list;
  }

  /** Once the report went out one way: Close throws it away. */
  function markDone() { $('help-close').hidden = false; }

  /**
   * Email: the report as an unsent email. The permission request has to come
   * first, while the click still counts as the user's; the file is opened
   * when it is there. Whatever does not work falls back to a plain download
   * with a line saying where to find it, never to nothing.
   */
  function emailReport() {
    if (!hasContent() || !cachedEmail) return;
    var request;
    try { request = chrome.permissions.request(DOWNLOAD_PERMISSIONS); } catch (e) { request = Promise.reject(e); }
    setStatus('help-status', '');
    var eml = buildEml(pageContext());
    Promise.resolve(request).then(function (granted) {
      if (!granted || !chrome.downloads) throw new Error('no downloads permission');
      return saveAndOpen(eml);
    }).then(function (opened) {
      setStatus('help-status', t(opened ? 'spEmlOpened' : 'spSavedEml'));
      markDone();
    }, function () {
      downloadFile(eml, 'eml');
      setStatus('help-status', t('spSavedEml'));
      markDone();
    });
  }

  /**
   * Downloads the .eml with chrome.downloads and opens it. Resolves true when
   * it opened, false when it was saved but could not be opened; rejects when
   * nothing was saved, so the caller can save it the plain way.
   */
  function saveAndOpen(content) {
    var url = URL.createObjectURL(new Blob([content], { type: 'message/rfc822' }));
    return chrome.downloads.download({
      url: url, filename: reportFileName('eml'), conflictAction: 'uniquify', saveAs: false
    }).then(function (id) {
      if (typeof id !== 'number') throw new Error('no download');
      return whenComplete(id).then(function (state) {
        URL.revokeObjectURL(url);
        if (state === 'interrupted') throw new Error('download interrupted');
        if (state !== 'complete') return false;
        return openDownload(id);
      });
    }, function (err) {
      URL.revokeObjectURL(url);
      throw err;
    });
  }

  function whenComplete(id) {
    return new Promise(function (resolve) {
      var timer = setTimeout(function () { finish('timeout'); }, DOWNLOAD_WAIT_MS);
      function finish(state) {
        clearTimeout(timer);
        chrome.downloads.onChanged.removeListener(onChanged);
        resolve(state);
      }
      function onChanged(delta) {
        if (!delta || delta.id !== id || !delta.state) return;
        if (delta.state.current === 'complete' || delta.state.current === 'interrupted') finish(delta.state.current);
      }
      chrome.downloads.onChanged.addListener(onChanged);
      chrome.downloads.search({ id: id }).then(function (items) {
        var item = items && items[0];
        if (item && (item.state === 'complete' || item.state === 'interrupted')) finish(item.state);
      }).catch(function () {});
    });
  }

  function openDownload(id) {
    return new Promise(function (resolve) {
      var timer = setTimeout(function () { resolve(false); }, OPEN_WAIT_MS);
      function done(ok) { clearTimeout(timer); resolve(ok); }
      try {
        chrome.downloads.open(id, function () { done(!chrome.runtime.lastError); });
      } catch (e) {
        // A browser whose open() takes no callback.
        try { chrome.downloads.open(id); done(true); } catch (e2) { done(false); }
      }
    });
  }

  /** Email (draft): the report on the clipboard, then the email app. */
  function emailDraft() {
    if (!hasContent() || !cachedEmail) return;
    setStatus('help-status', '');
    var ctx = pageContext();
    var html = buildHtml(ctx);
    // The clipboard first, while the panel still has the focus; the email
    // app takes it away.
    copyToClipboard(html).then(function () {
      return true;
    }, function () {
      downloadFile(html, 'html');
      setStatus('help-status', t('spCopyFailed'), true);
      return false;
    }).then(function () {
      openMailto(ctx, cachedEmail);
      showDraftDialog();
      markDone();
    });
  }

  function showDraftDialog() {
    var steps = $('help-draft-steps');
    steps.textContent = '';
    [t('spDoneStepPaste'), t('spDoneStepSend')].forEach(function (line) {
      var li = document.createElement('li');
      // Ctrl+V in bold; the rest stays text.
      line.split(/(Ctrl\+V)/).forEach(function (part) {
        if (!part) return;
        if (part === 'Ctrl+V') { var b = document.createElement('strong'); b.textContent = part; li.appendChild(b); }
        else li.appendChild(document.createTextNode(part));
      });
      steps.appendChild(li);
    });
    if (!$('help-draft').open) $('help-draft').showModal();
    $('help-draft-ok').focus();
  }

  function copyToClipboard(html) {
    try {
      var blob = new Blob([html], { type: 'text/html' });
      return navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /** The first line of the first step that has text, for {title}. */
  function reportTitle() {
    var steps = reportSteps();
    for (var i = 0; i < steps.length; i++) {
      var lines = modelText(steps[i].note).split('\n');
      for (var k = 0; k < lines.length; k++) {
        var line = oneLine(lines[k], 1000);
        if (line) return Array.from(line).slice(0, TITLE_MAX).join('').trim();
      }
    }
    return '';
  }

  /**
   * The subject: the team's own pattern from the settings, else ours, with
   * {prio} {type} {company} {environment} {tenant} {title} filled in. An
   * empty placeholder takes its separator with it, so no " - " or ": " is
   * left hanging. Never a line break: the subject is one header line.
   */
  function fillSubject(template, values) {
    var EMPTY = '\u0000';
    var s = oneLine(template, MAX_SUBJECT_TEMPLATE).replace(PLACEHOLDERS, function (all, key) {
      return oneLine(values[key], 100) || EMPTY;
    });
    var gap = /(\s*[-\u2013\u2014:|,\/]\s*)?\u0000(\s*[-\u2013\u2014:|,\/]\s*)?/;
    for (var guard = 0; s.indexOf(EMPTY) !== -1 && guard < 20; guard++) {
      s = s.replace(gap, function (all, left, right) {
        // Between two separators the first stays; at either end it goes.
        return left && right ? left : (left || right ? ' ' : '');
      });
    }
    return s.replace(/\[\s*\]|\(\s*\)/g, '').replace(/\s+/g, ' ')
      .replace(/^(\s*[-\u2013\u2014:|,\/]\s*)+/, '').replace(/(\s*[-\u2013\u2014:|,\/]\s*)+$/, '')
      .trim().slice(0, SUBJECT_MAX);
  }

  function subjectLine(ctx) {
    var bug = type === 'Bug';
    var template = (bug ? config.subjectBug : config.subjectIdea) || t(bug ? 'spSubjectDefaultBug' : 'spSubjectDefaultIdea');
    return fillSubject(template, {
      prio: priorityLabel(),
      type: typeLabel(),
      company: ctx.company,
      environment: ctx.environment,
      tenant: ctx.tenant,
      title: reportTitle()
    });
  }

  function openMailto(ctx, toEmail) {
    var subject = encodeURIComponent(subjectLine(ctx));
    var body    = encodeURIComponent(t('spMailBody'));
    var a = document.createElement('a');
    a.href = 'mailto:' + (toEmail || '') + '?subject=' + subject + '&body=' + body;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  /** bc-support-request-20260913-141502.html: one file per report, nothing overwritten. */
  function reportFileName(ext) {
    var d = new Date();
    function two(n) { return (n < 10 ? '0' : '') + n; }
    return 'bc-support-request-' +
      d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + '-' +
      two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds()) + '.' + (ext || 'html');
  }

  function downloadFile(content, ext) {
    var blob = new Blob([content], { type: ext === 'eml' ? 'message/rfc822' : 'text/html' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = reportFileName(ext);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** Download: the report as a web page. */
  function downloadReport() {
    if (!hasContent()) return;
    downloadFile(buildHtml(pageContext()), 'html');
    setStatus('help-status', t('spSaved'));
    markDone();
  }

  // ------------------------------------------------------------------ eml

  /*
   * An unsent email as one MIME file: X-Unsent makes Outlook open it as a
   * new email to send, not as one received. The report is the HTML part and
   * each screenshot an inline image it points at with cid:, so the pictures
   * arrive even where pasting into webmail loses them. Every header value is
   * fixed, the address normalize() let through (no spaces, no line breaks),
   * or base64 in encoded words, so nothing from the page can add a header
   * or a part.
   */
  var CRLF = '\r\n';

  function base64Utf8(s) {
    var bytes = new TextEncoder().encode(s), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  /** Base64 in lines of 76, as MIME wants. */
  function wrap76(b64) {
    return b64.replace(/.{76}/g, '$&' + CRLF);
  }

  /** A header value as encoded words of at most 75 characters, folded. */
  function encodedWords(s) {
    var words = [], chunk = '', bytes = 0;
    Array.from(s).forEach(function (ch) {
      var n = new TextEncoder().encode(ch).length;
      if (bytes + n > 45 && chunk) { words.push(chunk); chunk = ''; bytes = 0; }
      chunk += ch; bytes += n;
    });
    if (chunk) words.push(chunk);
    if (!words.length) words.push('');
    return words.map(function (w) { return '=?UTF-8?B?' + base64Utf8(w) + '?='; }).join(CRLF + ' ');
  }

  function buildEml(ctx) {
    var boundary = 'bcb-' + Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(12)),
      function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    var images = [];
    var html = buildHtml(ctx, function (shot, i) {
      var m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+=*)$/.exec(shot.dataUrl);
      if (!m) return '';
      var name = 'screenshot-' + (i + 1) + (m[1] === 'image/png' ? '.png' : '.jpg');
      var cid  = 'shot' + (i + 1) + '@bcbuddy';
      images.push([
        '--' + boundary,
        'Content-Type: ' + m[1] + '; name="' + name + '"',
        'Content-Transfer-Encoding: base64',
        'Content-ID: <' + cid + '>',
        'Content-Disposition: inline; filename="' + name + '"',
        '',
        wrap76(m[2])
      ].join(CRLF));
      return 'cid:' + cid;
    });
    var head = [];
    if (cachedEmail) head.push('To: ' + cachedEmail);
    head.push(
      'Subject: ' + encodedWords(subjectLine(ctx)),
      'X-Unsent: 1',
      'MIME-Version: 1.0',
      'Content-Type: multipart/related; type="text/html"; boundary="' + boundary + '"'
    );
    return head.join(CRLF) + CRLF + CRLF + [
      '--' + boundary,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(base64Utf8(html))
    ].concat(images).join(CRLF) + CRLF + '--' + boundary + '--' + CRLF;
  }

  /** The report on the clipboard, to paste wherever the user likes. */
  function copyReport() {
    if (!hasContent()) return;
    copyToClipboard(buildHtml(pageContext())).then(function () {
      setStatus('help-status', t('spCopied'));
      markDone();
    }, function () {
      setStatus('help-status', t('spCopyFailedPlain'), true);
    });
  }

  function showConfirm() {
    if (!hasContent() || $('help-confirm').open) return;
    closeMenus();
    $('help-confirm').showModal();
    $('help-discard-no').focus();
  }

  /** Back to an empty report, after throwing one away. */
  function reset() {
    shots = [];
    desc.clear();
    priorityWanted = null;
    renderPriorities();
    $('help-close').hidden = true;
    setStatus('help-status', '');
    renderThumbs(true);
    clearDraft();
    $('help-desc').focus();
  }

  /** Close: the report is out, so it goes, and so does the panel. */
  function closeReport() {
    reset();
    window.close();
  }

  // ------------------------------------------------------------------ html report

  function getSystemInfo() {
    var parts = [], ua = navigator.userAgent, os = '';
    if      (/Windows NT 10\.0/.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT 6\.3/.test(ua))  os = 'Windows 8.1';
    else if (/Windows NT 6\.1/.test(ua))  os = 'Windows 7';
    else if (/Macintosh/.test(ua))        os = 'macOS';
    else if (/Android ([\d.]+)/.test(ua)) os = 'Android ' + RegExp.$1;
    else if (/Linux/.test(ua))            os = 'Linux';
    if (os) parts.push(os);
    var browserName = '', vm = null;
    if (navigator.userAgentData && navigator.userAgentData.brands) {
      var brands = navigator.userAgentData.brands;
      if (brands.some(function (b) { return b.brand === 'Microsoft Edge'; })) browserName = 'Edge';
      else if (brands.some(function (b) { return b.brand === 'Google Chrome'; })) browserName = 'Chrome';
    }
    if (browserName === 'Edge') { vm = ua.match(/Edg\/([\d.]+)/); }
    else { vm = ua.match(/Chrome\/([\d.]+)/); if (vm && !browserName) browserName = 'Chrome'; }
    if (browserName) parts.push(browserName + (vm ? ' ' + vm[1] : ''));
    return parts.join(' / ');
  }

  /** "24 oktober 2026, 14:05", in the language on screen. */
  function reportDate() {
    var d = new Date();
    var lang = BCBuddy.currentLanguage ? BCBuddy.currentLanguage() : undefined;
    try {
      return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(d) + ', ' +
        new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d);
    } catch (e) {
      return d.toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  /**
   * The report as it lands in the email. Plain paragraphs and nothing else,
   * no tables: what the user pastes they may want to edit, and a table is
   * awkward in a mail editor. At the top when and where, then each step: the
   * page, its address, the note and the screenshot.
   */
  function buildHtml(ctx, srcFor) {
    var p = 'margin:0 0 6px;font-size:13px;line-height:1.5';
    var hr = '<hr style="border:0;border-top:1px solid #d9dde3;margin:18px 0">';
    function line(label, value) {
      return value ? '<p style="' + p + '"><b>' + esc(label) + ':</b> ' + esc(value) + '</p>' : '';
    }
    var head = '<p style="' + p + '">' + esc(reportDate()) + '</p>' +
      line(t('labelTenant'), ctx && ctx.tenant) +
      line(t('labelEnvironment'), ctx && ctx.environment) +
      line(t('labelCompany'), ctx && ctx.company) +
      line(t('spPriority'), priorityLabel()) +
      line(t('spReportType'), typeLabel());

    var steps = reportSteps().map(function (step) {
      var out = '';
      if (step.title) out += '<p style="' + p + '"><b>' + esc(step.title) + '</b></p>';
      if (step.url) {
        out += '<p style="' + p + '">' + (/^https?:\/\//i.test(step.url)
          ? '<a href="' + esc(step.url) + '" style="color:#0f6cbd">' + esc(step.url) + '</a>'
          : esc(step.url)) + '</p>';
      }
      var note = modelHtml(step.note);
      if (note) out += '<p style="' + p + '">' + note + '</p>';
      if (step.shot) {
        var src = srcFor ? srcFor(step.shot, step.index) : step.shot.dataUrl;
        if (src) {
          out += '<p style="' + p + '"><img src="' + esc(src) + '" alt="' + esc(t('spShotAlt', step.index + 1)) +
            '" style="max-width:100%;border:1px solid #d9dde3;display:block"></p>';
        }
      }
      return out;
    }).filter(Boolean);

    var system = '<p style="margin:0;font-size:12px;color:#667080">' + esc(t('spReportSystem')) + ': ' + esc(getSystemInfo()) + '</p>';

    return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
      '<body style="font-family:\'Segoe UI\',Arial,sans-serif;font-size:13px;color:#1b1e23;margin:24px;max-width:900px">' +
      head + hr + steps.join(hr) + hr + system + '</body></html>';
  }

  BCBuddy.HelpPanel = {
    start: start,
    shown: shown,
    relocalize: relocalize,
    // For the test harness: the subject builder on its own.
    fillSubject: fillSubject
  };
}());
