/*
 * BC Buddy - Help & feedback, the report view of the side panel.
 *
 * The start view opens it as a problem report (type Bug, with a priority) or
 * as feedback or a suggestion (type Improvement, no priority). Describe it, add screenshots of the tab in front (an area or
 * the whole visible page), draw on them, then one "Send to support" button:
 * the email app opens with the address and subject filled in and the full
 * report goes on the clipboard; the done view walks the user through the
 * paste, with copy-again and save-as-file fallbacks.
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
 * Settings, the tab's title and address, and the image the overlay hands back
 * are untrusted: they go through normalize(), are only put on the page as
 * text, and an image must be a PNG or JPEG data URL of bounded size.
 */
(function () {
  'use strict';

  var BCBuddy = self.BCBuddy;

  // Nine fills three rows of three thumbnails exactly.
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
  var SAVE_DELAY_MS = 400;

  var TYPES = ['Bug', 'Improvement'];
  var PRIORITIES = ['', 'Normal', 'High', 'Critical'];
  var PRIO_DOT = {
    Normal:   '<circle cx="4" cy="4" r="4" fill="#667080"/>',
    High:     '<circle cx="4" cy="4" r="4" fill="#ca5010"/>',
    Critical: '<polygon points="4,0 8,4 4,8 0,4" fill="#c4314b"/>'
  };
  var PRIO_KEY = { Normal: 'spPrioNormal', High: 'spPrioHigh', Critical: 'spPrioCritical' };

  var started = false;
  var windowId = null;
  var draftKey = '';
  var shots = [];
  var cachedEmail = '';
  var lastHtml = '';
  var sent = false;
  var busy = false;
  var saveTimer = 0;
  var type = 'Bug';
  var priority = '';
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
    $('help-add-area').addEventListener('click', trusted(addArea));
    $('help-add-full').addEventListener('click', trusted(addScreen));
    $('help-send').addEventListener('click', trusted(sendReport));
    $('help-dl').addEventListener('click', trusted(downloadReport));
    $('help-dl-done').addEventListener('click', trusted(function () {
      downloadFile(lastHtml);
      setStatus('help-done-status', t('spSaved'));
    }));
    $('help-copy-again').addEventListener('click', trusted(function () {
      copyToClipboard(lastHtml).then(
        function () { setStatus('help-done-status', t('spCopied')); },
        function () { downloadFile(lastHtml); setStatus('help-done-status', t('spCopyFailed'), true); }
      );
    }));
    $('help-new').addEventListener('click', trusted(reset));
    $('help-desc').addEventListener('input', function () { updateButtons(); saveLater(); });
    dropdown($('help-prio-btn'), $('help-prio-menu'), function (v) { setPriority(v); saveLater(); });
    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenus();
    });

    setType('Bug');
    setPriority('');

    chrome.storage.local.get(BCBuddy.STORAGE_KEY).then(function (obj) {
      applySettings(obj && obj[BCBuddy.STORAGE_KEY]);
    }).catch(function () { applySettings(null); });
    // The gear keeps the report, so a change made in settings (the address,
    // the colour) shows up here at once.
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
    updateButtons();
  }

  /**
   * Each time the view comes to the front, with the type its entry on the
   * start view stands for. A report in progress keeps its text and
   * screenshots when it comes back as the other type.
   */
  function shown(val) {
    if (TYPES.indexOf(val) !== -1 && val !== type) { setType(val); saveLater(); }
    updateButtons();
    if (!$('help-capture').hidden) $('help-desc').focus();
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

  function applySettings(raw) {
    // Stored settings are untrusted: only what normalize() lets through is
    // used, and without it nothing is (no address, the default colour).
    var s = BCBuddy.normalize(raw);
    cachedEmail = s.feedbackEmail || '';
    // The default is the panel's own teal, which has a lighter shade in dark
    // mode; only a colour someone picked overrules it.
    var accent = s.feedbackColor;
    if (accent && accent !== BCBuddy.DEFAULT_FEEDBACK_COLOR) {
      document.body.style.setProperty('--accent', accent);
      document.body.style.setProperty('--on-accent', BCBuddy.idealText(accent));
    } else {
      document.body.style.removeProperty('--accent');
      document.body.style.removeProperty('--on-accent');
    }
    $('help-noaddr').hidden = !!cachedEmail;
    updateButtons();
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

  // ------------------------------------------------------------------ draft

  function restore(d) {
    if (!d || typeof d !== 'object') return;
    if (Array.isArray(d.shots)) {
      shots = d.shots.filter(function (s) { return s && validImage(s.dataUrl); }).slice(0, MAX_SHOTS)
        .map(function (s) { return { dataUrl: s.dataUrl, title: text(s.title), url: text(s.url, 4096) }; });
    }
    if (typeof d.desc === 'string') $('help-desc').value = d.desc.slice(0, 20000);
    if (TYPES.indexOf(d.type) !== -1) setType(d.type);
    if (PRIORITIES.indexOf(d.priority) !== -1) setPriority(d.priority);
    renderThumbs();
  }

  function saveLater() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, SAVE_DELAY_MS);
  }

  function saveDraft() {
    clearTimeout(saveTimer);
    if (sent) return;
    var draft = {};
    draft[draftKey] = {
      shots: shots, desc: $('help-desc').value,
      type: type, priority: priority
    };
    chrome.storage.session.set(draft).catch(function () { /* over the quota: kept in the panel only */ });
  }

  function clearDraft() {
    clearTimeout(saveTimer);
    chrome.storage.session.remove(draftKey).catch(function () {});
  }

  function hasContent() { return shots.length > 0 || !!$('help-desc').value.trim(); }

  // ------------------------------------------------------------------ render

  // ---- dropdown (priority) ----

  function dropdown(btn, menu, onPick) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
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
      if (e.target.closest('.dd-info')) return;
      var opt = e.target.closest('.dd-opt');
      if (!opt || !e.isTrusted) return;
      onPick(opt.getAttribute('data-value'));
      closeMenus();
      btn.focus();
    });
  }

  function closeMenus() {
    $('help-prio-menu').hidden = true;
    $('help-prio-btn').setAttribute('aria-expanded', 'false');
  }

  function setType(val) {
    if (TYPES.indexOf(val) === -1) return;
    var bug = val === 'Bug';
    type = val;
    // A suggestion has no priority: the row goes, and so does a priority
    // picked while it was a problem report.
    $('help-prio-row').hidden = !bug;
    if (!bug) setPriority('');
    // The question follows the type: "what went wrong" makes no sense for a
    // suggestion.
    $('help-desc-label').textContent = t(bug ? 'spDescLabel' : 'spDescLabelImp');
    $('help-desc').placeholder = t(bug ? 'spDescPlaceholder' : 'spDescPlaceholderImp');
    $('help-desc-hint').textContent = t(bug ? 'spDescHint' : 'spDescHintImp');
  }

  /** '' is no priority picked yet: the button reads "Priority", greyed. */
  function setPriority(val) {
    if (PRIORITIES.indexOf(val) === -1) return;
    priority = val;
    var lbl = $('help-prio-lbl');
    lbl.textContent = t(val ? PRIO_KEY[val] : 'spPriority');
    lbl.className = 'dd-lbl ' + (val ? 'prio-' + val : 'prio-unset');
    var dot = $('help-prio-dot');
    dot.innerHTML = val ? PRIO_DOT[val] : '';
    dot.hidden = !val;
    markPicked($('help-prio-menu'), val);
  }

  function markPicked(menu, val) {
    var opts = menu.querySelectorAll('.dd-opt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].setAttribute('aria-checked', String(opts[i].getAttribute('data-value') === val));
    }
  }

  function updateButtons() {
    var ok = hasContent();
    var atLimit = shots.length >= MAX_SHOTS;
    var canShoot = here.webClient && !atLimit && !busy;
    // Without a helpdesk address there is nowhere to send to; the warning
    // above says so. Saving the report as a file stays possible.
    $('help-send').disabled = !ok || !cachedEmail;
    $('help-dl').disabled = !ok;
    $('help-add-area').disabled = !canShoot;
    $('help-add-full').disabled = !canShoot;
    $('help-notbc').hidden = here.webClient;
    $('help-max').hidden = !atLimit;
    $('help-max').textContent = atLimit ? t('spMaxShots', MAX_SHOTS) : '';
    $('help-discard').hidden = !ok || !$('help-done').hidden;
    var edits = document.querySelectorAll('#help-thumbs .thumb-edit');
    for (var i = 0; i < edits.length; i++) edits[i].disabled = !here.webClient || busy;
  }

  function renderThumbs() {
    var box = $('help-thumbs');
    box.textContent = '';
    box.hidden = !shots.length;
    $('help-add-lbl').textContent = t(shots.length ? 'spAddAnotherShot' : 'spAddShot');

    shots.forEach(function (shot, i) {
      var wrap = document.createElement('div'); wrap.className = 'thumb';
      var img  = document.createElement('img');
      img.src = shot.dataUrl; img.alt = t('spShotAlt', i + 1); img.className = 'thumb-img';
      if (shot.title) img.title = shot.title;
      var edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'thumb-edit';
      edit.title = t('spEdit'); edit.setAttribute('aria-label', t('spEdit'));
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
      box.appendChild(wrap);
    });

    updateButtons();
    saveDraft();
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

  function captureTab() {
    return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  }

  /** Makes sure the tab's top frame has the overlay (area selection, editor). */
  function overlay(tabId) {
    var target = { tabId: tabId };
    return chrome.scripting.executeScript({
      target: target,
      func: function () { return !!(window.BCBuddy && window.BCBuddy.SupportOverlay); }
    }).then(function (res) {
      if (res && res[0] && res[0].result === true) return;
      return chrome.scripting.insertCSS({ target: target, files: ['src/support/support-overlay.css'] }).then(function () {
        return chrome.scripting.executeScript({ target: target, files: ['src/support/support-overlay.js'] });
      });
    });
  }

  /** Runs one overlay step in the tab and hands back what it resolved. */
  function runOverlay(tabId, func, args) {
    return overlay(tabId).then(function () {
      return chrome.scripting.executeScript({ target: { tabId: tabId }, func: func, args: args || [] });
    }).then(function (res) { return res && res[0] ? res[0].result : null; });
  }

  function addScreen() {
    if (shots.length >= MAX_SHOTS || !here.webClient) return;
    setStatus('help-status', '');
    var from = { title: here.title, url: here.url };
    setBusy(true);
    captureTab().then(function (dataUrl) {
      setBusy(false);
      addShot(dataUrl, from);
    }, function () {
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
    runOverlay(tabId, function () { return window.BCBuddy.SupportOverlay.selectArea(); }).then(function (rect) {
      if (!rect) return null;
      return captureTab().then(function (full) { return crop(full, rect); });
    }).then(function (cropped) {
      if (!cropped) { setBusy(false); return; }
      // An area is a deliberate choice of what matters, so the editor opens
      // first: the user is nudged to point at it before it is saved. The
      // whole-screen capture next door lands directly.
      return runOverlay(tabId, function (url) { return window.BCBuddy.SupportOverlay.edit(url); }, [cropped])
        .then(function (edited) {
          setBusy(false);
          if (validImage(edited)) addShot(edited, from);
        });
    }).catch(function () {
      setBusy(false);
      setStatus('help-status', t('spCaptureFailed'), true);
    });
  }

  function editShot(shot) {
    if (!here.webClient || busy) return;
    setBusy(true);
    runOverlay(here.tabId, function (url) { return window.BCBuddy.SupportOverlay.edit(url); }, [shot.dataUrl])
      .then(function (edited) {
        setBusy(false);
        if (!validImage(edited) || edited === shot.dataUrl) return;
        shrink(edited, function (small) {
          shot.dataUrl = small;
          renderThumbs();
        });
      }, function () {
        setBusy(false);
        setStatus('help-status', t('spCaptureFailed'), true);
      });
  }

  function addShot(dataUrl, from) {
    shrink(dataUrl, function (small) {
      if (shots.length >= MAX_SHOTS) return;
      shots.push({ dataUrl: small, title: from.title, url: from.url });
      renderThumbs();
    });
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

  function shrink(dataUrl, done) {
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
      done(c.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = function () { /* not an image: dropped */ };
    img.src = dataUrl;
  }

  // ------------------------------------------------------------------ send / save

  /** Environment and company: the content script's, else from the address. */
  function pageContext() {
    var ctx = BCBuddy.parseUrl(here.url || '');
    return {
      environment: here.environment || ctx.environment || '',
      company: here.company || ctx.company || ''
    };
  }

  function sendReport() {
    if (!hasContent() || !cachedEmail) return;
    setStatus('help-status', '');
    var ctx = pageContext();
    lastHtml = buildHtml(ctx, $('help-desc').value.trim());
    // The clipboard first, while the panel still has the focus; the email
    // app takes it away.
    copyToClipboard(lastHtml).then(function () {
      setStatus('help-done-status', '');
    }, function () {
      downloadFile(lastHtml);
      setStatus('help-done-status', t('spCopyFailed'), true);
    }).then(function () {
      openMailto(ctx, cachedEmail);
    });
    sent = true;
    clearDraft();
    showDone();
  }

  function copyToClipboard(html) {
    try {
      var blob = new Blob([html], { type: 'text/html' });
      return navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function openMailto(ctx, toEmail) {
    var env     = ctx && ctx.environment ? ' – ' + ctx.environment : '';
    var prioTag = priority ? '[' + priority + '] ' : '';
    var typeTag = type ? type + ' - ' : '';
    var subject = encodeURIComponent(prioTag + typeTag + t('spSubject') + env);
    var body    = encodeURIComponent(t('spMailBody'));
    var a = document.createElement('a');
    a.href = 'mailto:' + (toEmail || '') + '?subject=' + subject + '&body=' + body;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  /** bc-support-request-20260913-141502.html: one file per report, nothing overwritten. */
  function reportFileName() {
    var d = new Date();
    function two(n) { return (n < 10 ? '0' : '') + n; }
    return 'bc-support-request-' +
      d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + '-' +
      two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds()) + '.html';
  }

  function downloadFile(html) {
    var blob = new Blob([html], { type: 'text/html' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = reportFileName();
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadReport() {
    if (!hasContent()) return;
    downloadFile(buildHtml(pageContext(), $('help-desc').value.trim()));
    setStatus('help-status', t('spSaved'));
  }

  function showDone() {
    var steps = $('help-steps');
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
    $('help-capture').hidden = true;
    $('help-done').hidden = false;
    updateButtons();
  }

  function showConfirm() {
    if (!hasContent() || $('help-confirm').open) return;
    closeMenus();
    $('help-confirm').showModal();
    $('help-discard-no').focus();
  }

  /** Back to an empty report: after sending, or after throwing one away. */
  function reset() {
    shots = [];
    sent = false;
    lastHtml = '';
    $('help-desc').value = '';
    setPriority('');
    $('help-done').hidden = true;
    $('help-capture').hidden = false;
    setStatus('help-status', '');
    setStatus('help-done-status', '');
    renderThumbs();
    clearDraft();
    $('help-desc').focus();
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
    parts.push(screen.width + ' \xd7 ' + screen.height + ' px');
    return parts.join(' / ');
  }

  /**
   * The report as it lands in the email. Plain paragraphs on purpose: what
   * the user pastes they may want to edit, and a table is awkward to edit in
   * a mail editor. Type and priority go in the subject only; the system line
   * sits after the screenshots, where it does not get in the way.
   */
  function buildHtml(ctx, desc) {
    var p = 'margin:0 0 6px;font-size:13px;line-height:1.5';
    var head = '';
    if (ctx && ctx.environment) head += '<p style="' + p + '"><b>' + esc(t('labelEnvironment')) + ':</b> ' + esc(ctx.environment) + '</p>';
    if (ctx && ctx.company)     head += '<p style="' + p + '"><b>' + esc(t('labelCompany')) + ':</b> ' + esc(ctx.company) + '</p>';

    var body = '<p style="' + p + ';margin-top:14px"><b>' + esc(t('spReportDescription')) + '</b></p>' +
      '<p style="' + p + ';margin-bottom:24px">' + (desc ? esc(desc).replace(/\n/g, '<br>') : '—') + '</p>';

    var imgs = shots.map(function (shot) {
      var href = /^https?:\/\//i.test(shot.url) ? shot.url : '';
      var link = shot.title
        ? '<p style="margin:0 0 6px">' + (href
          ? '<a href="' + esc(href) + '" style="color:#0f6cbd;font-weight:600;text-decoration:none">' + esc(shot.title) + '</a>'
          : '<b>' + esc(shot.title) + '</b>') + '</p>'
        : '';
      return '<div style="margin-bottom:24px">' + link +
        '<img src="' + shot.dataUrl + '" style="max-width:100%;border:1px solid #d9dde3;border-radius:6px;display:block">' +
        '</div>';
    }).join('');

    var system = '<p style="margin:0;font-size:12px;color:#667080">' + esc(t('spReportSystem')) + ': ' + esc(getSystemInfo()) + '</p>';

    return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
      '<body style="font-family:\'Segoe UI\',Arial,sans-serif;font-size:13px;color:#1b1e23;margin:24px;max-width:900px">' +
      head + body + imgs + system + '</body></html>';
  }

  BCBuddy.HelpPanel = { start: start, shown: shown };
}());
