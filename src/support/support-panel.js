/*
 * BC Buddy - Report a problem panel.
 * Injected dynamically into the active tab (toolbar icon, ribbon link, or
 * re-injected after a navigation while a report is in progress).
 *
 * Flow: describe what went wrong, optionally add screenshots (each lands as a
 * thumbnail straight away; a pencil on the thumbnail opens the editor), then
 * one "Send to support" button. Sending opens the email app with the address
 * pre-filled and puts the full report on the clipboard; the done view walks
 * the user through the paste, with copy-again and save-as-file fallbacks.
 */
(function () {
  'use strict';

  // Guard: panel already open — shake it so the user sees where it is.
  if (document.getElementById('bcb-sp-panel')) {
    var existing = document.getElementById('bcb-sp-panel');
    existing.style.animation = 'none';
    existing.offsetHeight; // reflow
    existing.style.animation = 'bcb-sp-shake 0.3s ease';
    return;
  }

  // Nine fills three rows of three thumbnails exactly.
  var MAX_SHOTS = 9;

  var shots       = [];
  var cachedEmail = '';
  var lastHtml    = '';
  var sent        = false;

  /** Translation with a readable fallback: a missing key shows the key. */
  function t(key, subs) {
    var list = subs == null ? [] : (Array.isArray(subs) ? subs : [subs]);
    var msg = '';
    try { msg = chrome.i18n.getMessage(key, list.map(String)); } catch (e) { /* outside an extension */ }
    return msg || key;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var ICON_GEAR =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
    '</svg>';
  var ICON_X =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      '<line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>' +
    '</svg>';
  var ICON_AREA =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
      '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
    '</svg>';
  var ICON_SCREEN =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>' +
    '</svg>';
  var ICON_MAIL =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7 12 13 2 7"/>' +
    '</svg>';
  var ICON_DOWNLOAD =
    '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">' +
      '<path d="M7.5 1.5v8M4.5 7 7.5 10 10.5 7M2.5 13h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  var ICON_PENCIL =
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>' +
    '</svg>';
  var ICON_CARET =
    '<svg class="bcb-sp-caret" width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 1 4 4 7 1"/></svg>';

  var TYPE_DOT = {
    Bug:         '<circle cx="5" cy="5" r="5" fill="#c4314b"/>',
    Improvement: '<polygon points="5,1 9,9 1,9" fill="#107c10"/>'
  };
  var PRIO_DOT = {
    Normal:   '<circle cx="4" cy="4" r="4" fill="#667080"/>',
    High:     '<circle cx="4" cy="4" r="4" fill="#ca5010"/>',
    Critical: '<polygon points="4,0 8,4 4,8 0,4" fill="#c4314b"/>'
  };
  var PRIO_KEY = { Normal: 'spPrioNormal', High: 'spPrioHigh', Critical: 'spPrioCritical' };

  // ------------------------------------------------------------------ build

  var panel = document.createElement('div');
  panel.id = 'bcb-sp-panel';
  panel.innerHTML =
    '<div class="bcb-sp-hdr">' +
      '<span class="bcb-sp-title">BC Buddy</span>' +
      '<div class="bcb-sp-hdr-end">' +
        '<button class="bcb-sp-hdr-btn" id="bcb-sp-settings" type="button" data-bcb-tip="' + esc(t('spSettings')) + '">' + ICON_GEAR + '</button>' +
        '<button class="bcb-sp-hdr-btn" id="bcb-sp-close" type="button" data-bcb-tip="' + esc(t('spClose')) + '">' + ICON_X + '</button>' +
      '</div>' +
    '</div>' +

    '<div id="bcb-sp-capture">' +
      '<p class="bcb-sp-intro" id="bcb-sp-intro" hidden></p>' +
      '<p class="bcb-sp-warn" id="bcb-sp-noaddr" hidden>' +
        '<span>' + esc(t('spNoAddress')) + '</span> ' +
        '<a href="#" id="bcb-sp-noaddr-link">' + esc(t('spOpenSettings')) + '</a>' +
      '</p>' +

      '<div class="bcb-sp-meta">' +
        '<input type="hidden" id="bcb-sp-type" value="Bug">' +
        '<div class="bcb-sp-dd-wrap">' +
          '<button class="bcb-sp-dd-btn" id="bcb-sp-type-btn" type="button">' +
            '<svg class="bcb-sp-dd-dot" id="bcb-sp-type-icon" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">' + TYPE_DOT.Bug + '</svg>' +
            '<span class="bcb-sp-dd-lbl bcb-sp-type-Bug" id="bcb-sp-type-lbl">' + esc(t('spTypeBug')) + '</span>' +
            ICON_CARET +
          '</button>' +
          '<div class="bcb-sp-dd-menu" id="bcb-sp-type-menu" hidden>' +
            '<div class="bcb-sp-dd-opt" data-value="Bug">' +
              '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">' + TYPE_DOT.Bug + '</svg>' +
              '<span class="bcb-sp-type-Bug">' + esc(t('spTypeBug')) + '</span>' +
              '<span class="bcb-sp-dd-info" data-bcb-tip="' + esc(t('spTypeBugHint')) + '">i</span>' +
            '</div>' +
            '<div class="bcb-sp-dd-opt" data-value="Improvement">' +
              '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">' + TYPE_DOT.Improvement + '</svg>' +
              '<span class="bcb-sp-type-Improvement">' + esc(t('spTypeImprovement')) + '</span>' +
              '<span class="bcb-sp-dd-info" data-bcb-tip="' + esc(t('spTypeImprovementHint')) + '">i</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<input type="hidden" id="bcb-sp-priority" value="">' +
        '<div class="bcb-sp-dd-wrap">' +
          '<button class="bcb-sp-dd-btn" id="bcb-sp-prio-btn" type="button">' +
            '<svg class="bcb-sp-dd-dot" id="bcb-sp-prio-dot" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" hidden></svg>' +
            '<span class="bcb-sp-dd-lbl bcb-sp-prio-unset" id="bcb-sp-prio-lbl">' + esc(t('spPriority')) + '</span>' +
            ICON_CARET +
          '</button>' +
          '<div class="bcb-sp-dd-menu" id="bcb-sp-prio-menu" hidden>' +
            '<div class="bcb-sp-dd-opt" data-value="Normal"><svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">' + PRIO_DOT.Normal + '</svg><span class="bcb-sp-prio-Normal">' + esc(t('spPrioNormal')) + '</span></div>' +
            '<div class="bcb-sp-dd-opt" data-value="High"><svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">' + PRIO_DOT.High + '</svg><span class="bcb-sp-prio-High">' + esc(t('spPrioHigh')) + '</span></div>' +
            '<div class="bcb-sp-dd-opt" data-value="Critical"><svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">' + PRIO_DOT.Critical + '</svg><span class="bcb-sp-prio-Critical">' + esc(t('spPrioCritical')) + '</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="bcb-sp-desc-wrap">' +
        '<label class="bcb-sp-desc-label" id="bcb-sp-desc-label" for="bcb-sp-desc">' + esc(t('spDescLabel')) + '</label>' +
        '<textarea id="bcb-sp-desc" class="bcb-sp-desc" rows="3" placeholder="' + esc(t('spDescPlaceholder')) + '"></textarea>' +
        '<p class="bcb-sp-desc-hint" id="bcb-sp-desc-hint">' + esc(t('spDescHint')) + '</p>' +
      '</div>' +

      '<div id="bcb-sp-thumbs" class="bcb-sp-thumbs" hidden></div>' +

      '<div class="bcb-sp-actions">' +
        '<div class="bcb-sp-shot-group">' +
          '<button class="bcb-sp-btn bcb-sp-shot-area" id="bcb-sp-add-area" type="button">' + ICON_AREA + '<span id="bcb-sp-add-lbl">' + esc(t('spAddShot')) + '</span></button>' +
          '<button class="bcb-sp-btn bcb-sp-icon-btn" id="bcb-sp-add-full" type="button" data-bcb-tip="' + esc(t('spFullPage')) + '">' + ICON_SCREEN + '</button>' +
        '</div>' +
        '<div class="bcb-sp-send-row">' +
          '<button class="bcb-sp-btn bcb-sp-primary bcb-sp-send" id="bcb-sp-send" type="button" disabled>' + ICON_MAIL + '<span>' + esc(t('spSend')) + '</span></button>' +
          '<button class="bcb-sp-btn bcb-sp-icon-btn" id="bcb-sp-dl" type="button" disabled data-bcb-tip="' + esc(t('spSaveReportHint')) + '">' + ICON_DOWNLOAD + '</button>' +
        '</div>' +
      '</div>' +
      '<p class="bcb-sp-status" id="bcb-sp-status"></p>' +
    '</div>' +

    '<div id="bcb-sp-confirm" hidden>' +
      '<p class="bcb-sp-confirm-text">' + esc(t('spDiscardConfirm')) + '</p>' +
      '<div class="bcb-sp-done-foot">' +
        '<button class="bcb-sp-btn bcb-sp-danger" id="bcb-sp-discard-yes" type="button">' + esc(t('spDiscardYes')) + '</button>' +
        '<button class="bcb-sp-btn bcb-sp-primary" id="bcb-sp-discard-no" type="button">' + esc(t('spDiscardNo')) + '</button>' +
      '</div>' +
    '</div>' +

    '<div id="bcb-sp-done" hidden>' +
      '<div class="bcb-sp-done-body">' +
        '<div class="bcb-sp-check bcb-sp-check--pending">!</div>' +
        '<p class="bcb-sp-done-title">' + esc(t('spDoneTitle')) + '</p>' +
        '<ol class="bcb-sp-steps" id="bcb-sp-steps"></ol>' +
        '<p class="bcb-sp-done-fallback">' + esc(t('spDoneFallback')) + '</p>' +
        '<p class="bcb-sp-done-note">' + esc(t('spDoneWebmail')) + '</p>' +
        '<div class="bcb-sp-done-foot">' +
          '<button class="bcb-sp-btn" id="bcb-sp-copy-again" type="button">' + esc(t('spCopyAgain')) + '</button>' +
          '<button class="bcb-sp-btn" id="bcb-sp-dl-done" type="button">' + esc(t('spSaveReport')) + '</button>' +
        '</div>' +
        '<button class="bcb-sp-btn bcb-sp-primary" id="bcb-sp-close2" type="button">' + esc(t('spClose')) + '</button>' +
        '<p class="bcb-sp-status" id="bcb-sp-done-status"></p>' +
      '</div>' +
    '</div>';

  document.body.appendChild(panel);

  // ------------------------------------------------------------------ refs

  function $(id) { return document.getElementById(id); }

  var elSettings   = $('bcb-sp-settings');
  var elClose      = $('bcb-sp-close');
  var elClose2     = $('bcb-sp-close2');
  var elIntro      = $('bcb-sp-intro');
  var elNoAddr     = $('bcb-sp-noaddr');
  var elNoAddrLink = $('bcb-sp-noaddr-link');
  var elDesc       = $('bcb-sp-desc');
  var elDescLabel  = $('bcb-sp-desc-label');
  var elDescHint   = $('bcb-sp-desc-hint');
  var elType       = $('bcb-sp-type');
  var elPriority   = $('bcb-sp-priority');
  var elThumbs     = $('bcb-sp-thumbs');
  var elAddArea    = $('bcb-sp-add-area');
  var elAddLbl     = $('bcb-sp-add-lbl');
  var elAddFull    = $('bcb-sp-add-full');
  var elSend       = $('bcb-sp-send');
  var elDl         = $('bcb-sp-dl');
  var elStatus     = $('bcb-sp-status');
  var elCapture    = $('bcb-sp-capture');
  var elDone       = $('bcb-sp-done');
  var elConfirm    = $('bcb-sp-confirm');
  var elSteps      = $('bcb-sp-steps');
  var elCopyAgain  = $('bcb-sp-copy-again');
  var elDl2        = $('bcb-sp-dl-done');
  var elDoneStatus = $('bcb-sp-done-status');
  var elHdr        = panel.querySelector('.bcb-sp-hdr');

  function openSettings() {
    // Keeps the panel (and the report) open; settings open in their own tab.
    chrome.runtime.sendMessage({ type: 'bcb:open-options' });
  }

  elSettings.addEventListener('click', openSettings);
  elNoAddrLink.addEventListener('click', function (e) { e.preventDefault(); openSettings(); });
  elClose.addEventListener('click', closeWithConfirm);
  $('bcb-sp-discard-yes').addEventListener('click', remove);
  $('bcb-sp-discard-no').addEventListener('click', hideConfirm);
  elClose2.addEventListener('click', remove);
  elAddArea.addEventListener('click', startAreaSelection);
  elAddFull.addEventListener('click', captureScreen);
  elSend.addEventListener('click', sendReport);
  elDl.addEventListener('click', downloadReport);
  elDl2.addEventListener('click', function () {
    downloadFile(lastHtml);
    setDoneStatus(t('spSaved'));
  });
  elCopyAgain.addEventListener('click', function () {
    copyToClipboard(lastHtml).then(
      function () { setDoneStatus(t('spCopied')); },
      function () { downloadFile(lastHtml); setDoneStatus(t('spCopyFailed'), true); }
    );
  });
  elDesc.addEventListener('input', function () { updateButtons(); saveSession(); });

  // ---- dropdowns (type, priority) ----

  function dropdown(btn, menu, onPick) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!menu.hidden) { menu.hidden = true; return; }
      var r = btn.getBoundingClientRect();
      menu.style.setProperty('top',       (r.bottom + 3) + 'px',               'important');
      menu.style.setProperty('right',     (window.innerWidth - r.right) + 'px', 'important');
      menu.style.setProperty('min-width', r.width + 'px',                       'important');
      menu.hidden = false;
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('.bcb-sp-dd-info')) { e.stopPropagation(); return; }
      var opt = e.target.closest('.bcb-sp-dd-opt');
      if (!opt) return;
      onPick(opt.dataset.value);
      menu.hidden = true;
    });
  }

  var elTypeMenu = $('bcb-sp-type-menu');
  var elPrioMenu = $('bcb-sp-prio-menu');

  function setType(val) {
    if (!TYPE_DOT[val]) return;
    var bug = val === 'Bug';
    elType.value = val;
    $('bcb-sp-type-lbl').textContent = t(bug ? 'spTypeBug' : 'spTypeImprovement');
    $('bcb-sp-type-lbl').className = 'bcb-sp-dd-lbl bcb-sp-type-' + val;
    $('bcb-sp-type-icon').innerHTML = TYPE_DOT[val];
    // The question follows the type: "what went wrong" makes no sense for a
    // suggestion.
    elDescLabel.textContent = t(bug ? 'spDescLabel' : 'spDescLabelImp');
    elDesc.placeholder = t(bug ? 'spDescPlaceholder' : 'spDescPlaceholderImp');
    elDescHint.textContent = t(bug ? 'spDescHint' : 'spDescHintImp');
  }

  function setPriority(val) {
    if (!PRIO_DOT[val]) return;
    elPriority.value = val;
    var lbl = $('bcb-sp-prio-lbl');
    lbl.textContent = t(PRIO_KEY[val]);
    lbl.className = 'bcb-sp-dd-lbl bcb-sp-prio-' + val;
    var dot = $('bcb-sp-prio-dot');
    dot.innerHTML = PRIO_DOT[val];
    dot.hidden = false;
  }

  dropdown($('bcb-sp-type-btn'), elTypeMenu, function (v) { setType(v); saveSession(); });
  dropdown($('bcb-sp-prio-btn'), elPrioMenu, function (v) { setPriority(v); saveSession(); });

  document.addEventListener('click', function () {
    if (!panel.parentNode) return;
    elTypeMenu.hidden = true;
    elPrioMenu.hidden = true;
  });

  // ------------------------------------------------------------------ tooltips

  // Browser tooltips are tiny and slow to appear. One shared bubble instead,
  // for everything in the panel and the editor that carries data-bcb-tip.
  var tipEl = null;

  function showTip(target) {
    var text = target.getAttribute('data-bcb-tip');
    if (!text) return;
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.id = 'bcb-sp-tip';
      document.body.appendChild(tipEl);
    }
    tipEl.textContent = text;
    // Last in the body wins at equal z-index: the editor overlay is added
    // after the bubble, so re-append to stay on top of it.
    document.body.appendChild(tipEl);
    tipEl.hidden = false;
    var r = target.getBoundingClientRect();
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    var top = r.top - h - 8;
    if (top < 8) top = r.bottom + 8;
    tipEl.style.setProperty('left', left + 'px', 'important');
    tipEl.style.setProperty('top', top + 'px', 'important');
  }

  function hideTip() { if (tipEl) tipEl.hidden = true; }

  function onTipOver(e) {
    var target = e.target.closest && e.target.closest('[data-bcb-tip]');
    if (target) showTip(target); else hideTip();
  }
  function onTipOut(e) {
    var to = e.relatedTarget;
    if (!to || !to.closest || !to.closest('[data-bcb-tip]')) hideTip();
  }
  document.addEventListener('mouseover', onTipOver);
  document.addEventListener('mouseout', onTipOut);
  document.addEventListener('mousedown', hideTip, true);

  // ------------------------------------------------------------------ panel drag

  var panelDragging = false, dragOffX = 0, dragOffY = 0;
  var DRAG_MARGIN = 8;

  elHdr.addEventListener('mousedown', function (e) {
    if (e.target.closest('button')) return;
    e.preventDefault();
    var r = panel.getBoundingClientRect();
    panel.style.setProperty('bottom', 'auto', 'important');
    panel.style.setProperty('right',  'auto', 'important');
    panel.style.setProperty('top',    r.top  + 'px', 'important');
    panel.style.setProperty('left',   r.left + 'px', 'important');
    panelDragging = true;
    dragOffX = e.clientX - r.left;
    dragOffY = e.clientY - r.top;
    document.addEventListener('mousemove', onPanelMove);
    document.addEventListener('mouseup', onPanelUp, { once: true });
  });

  function onPanelMove(e) {
    if (!panelDragging) return;
    var l = Math.max(DRAG_MARGIN, Math.min(window.innerWidth  - panel.offsetWidth  - DRAG_MARGIN, e.clientX - dragOffX));
    var tp = Math.max(DRAG_MARGIN, Math.min(window.innerHeight - panel.offsetHeight - DRAG_MARGIN, e.clientY - dragOffY));
    panel.style.setProperty('left', l + 'px', 'important');
    panel.style.setProperty('top',  tp + 'px', 'important');
  }

  function onPanelUp() {
    panelDragging = false;
    document.removeEventListener('mousemove', onPanelMove);
  }

  // ------------------------------------------------------------------ settings

  function applySettings(raw) {
    cachedEmail = (raw && typeof raw.helpdeskEmail === 'string' && raw.helpdeskEmail.trim()) || '';
    var accent = raw && typeof raw.helpdeskColor === 'string' && raw.helpdeskColor.trim();
    if (accent) panel.style.setProperty('--bcb-sp-accent', accent);
    else panel.style.removeProperty('--bcb-sp-accent');
    renderIntro();
    updateButtons();
  }

  chrome.storage.local.get('settings').then(function (obj) {
    applySettings(obj && obj.settings);
  });

  // The gear keeps the panel open, so a change made in settings (the address,
  // the colour) should show up here without reopening.
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes.settings || !panel.parentNode) return;
      applySettings(changes.settings.newValue);
    });
  } catch (e) { /* extension reloaded */ }

  chrome.runtime.sendMessage({ type: 'bcb:support-restore-session' }).then(function (res) {
    var s = res && res.session;
    if (!s) return;
    if (Array.isArray(s.shots)) shots = s.shots;
    if (s.desc) elDesc.value = s.desc;
    if (s.type) setType(s.type);
    if (s.priority) setPriority(s.priority);
    renderThumbs();
  }).catch(function () { /* background not reachable; start empty */ });

  elDesc.focus();
  updateButtons();

  // ------------------------------------------------------------------ render

  function renderIntro() {
    // The box's own placeholder explains what to write and what to capture;
    // the line above it only appears when there is something to say.
    var atLimit = shots.length >= MAX_SHOTS;
    elIntro.textContent = atLimit ? t('spMaxShots', MAX_SHOTS) : '';
    elIntro.hidden = !atLimit;
    elNoAddr.hidden = !!cachedEmail;
  }

  function canSend() { return shots.length > 0 || !!elDesc.value.trim(); }

  function updateButtons() {
    var ok = canSend();
    var hasShots = shots.length > 0;
    // Without a helpdesk address there is nowhere to send to; the warning
    // above the box says so. Saving the report as a file stays possible.
    var canMail = ok && !!cachedEmail;
    elSend.disabled = !canMail;
    elDl.disabled = !ok;
    // A gentle push towards one screenshot: the pulse sits on "Add a
    // screenshot" until there is one, then moves to "Send". Never a block.
    elAddArea.classList.toggle('bcb-sp-pulse', !hasShots);
    elSend.classList.toggle('bcb-sp-pulse', canMail && hasShots);
  }

  function renderThumbs() {
    elThumbs.innerHTML = '';
    var hasShots = shots.length > 0;
    var atLimit  = shots.length >= MAX_SHOTS;
    elThumbs.hidden = !hasShots;
    elAddArea.disabled = atLimit;
    elAddFull.disabled = atLimit;
    elAddLbl.textContent = t(hasShots ? 'spAddAnotherShot' : 'spAddShot');
    renderIntro();
    updateButtons();

    shots.forEach(function (shot, i) {
      var wrap = document.createElement('div'); wrap.className = 'bcb-sp-thumb';
      var img  = document.createElement('img');
      img.src = shot.dataUrl; img.alt = t('spShotAlt', i + 1); img.className = 'bcb-sp-thumb-img';
      img.setAttribute('data-bcb-tip', t('spEdit'));
      var edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'bcb-sp-thumb-edit'; edit.setAttribute('data-bcb-tip', t('spEdit'));
      edit.innerHTML = ICON_PENCIL;
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'bcb-sp-del'; del.setAttribute('data-bcb-tip', t('spRemove')); del.textContent = '\xd7';
      (function (idx) {
        function editShot() {
          showAnnotationEditor(shots[idx].dataUrl, function (url) {
            shrink(url, function (small) {
              shots[idx].dataUrl = small;
              renderThumbs();
            });
          });
        }
        img.addEventListener('click', editShot);
        edit.addEventListener('click', editShot);
        del.addEventListener('click', function () { shots.splice(idx, 1); renderThumbs(); });
      }(i));
      wrap.appendChild(img); wrap.appendChild(edit); wrap.appendChild(del);
      elThumbs.appendChild(wrap);
    });

    saveSession();
  }

  function saveSession() {
    if (sent) return;
    chrome.runtime.sendMessage({
      type: 'bcb:support-save-session',
      session: { shots: shots, desc: elDesc.value, type: elType.value, priority: elPriority.value }
    }).catch(function () { /* background asleep; nothing to do */ });
  }

  function addShot(dataUrl) {
    shrink(dataUrl, function (small) {
      shots.push({ dataUrl: small, title: document.title, url: location.href });
      renderThumbs();
    });
  }

  // Nine whole-screen PNGs from a large monitor run to tens of megabytes,
  // more than a mail server accepts. A helpdesk reads a BC screen fine at
  // this width, and JPEG cuts the rest by a factor of ten.
  var MAX_SHOT_SIDE = 1920;
  var JPEG_QUALITY  = 0.85;

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
    img.onerror = function () { done(dataUrl); };
    img.src = dataUrl;
  }

  // ------------------------------------------------------------------ capture

  function setShotDisabled(v) { elAddArea.disabled = v; elAddFull.disabled = v; }

  function requestScreenshot() {
    return chrome.runtime.sendMessage({ type: 'bcb:support-screenshot' }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || 'capture failed');
      return res.dataUrl;
    });
  }

  function captureScreen() {
    if (shots.length >= MAX_SHOTS) return;
    setShotDisabled(true);
    setStatus('');
    panel.style.setProperty('display', 'none', 'important');
    setTimeout(function () {
      requestScreenshot().then(function (dataUrl) {
        panel.style.removeProperty('display');
        setShotDisabled(false);
        addShot(dataUrl);
      }, function () {
        panel.style.removeProperty('display');
        setShotDisabled(false);
        setStatus(t('spCaptureFailed'), true);
      });
    }, 120);
  }

  function startAreaSelection() {
    if (shots.length >= MAX_SHOTS) return;
    panel.style.setProperty('display', 'none', 'important');

    var dragging = false, startX = 0, startY = 0;

    var sel  = document.createElement('div'); sel.id = 'bcb-sp-sel';
    var chH  = document.createElement('div'); chH.id = 'bcb-sp-sel-ch-h';
    var chV  = document.createElement('div'); chV.id = 'bcb-sp-sel-ch-v';
    var mTop = document.createElement('div'); mTop.className = 'bcb-sp-sel-m';
    var mBot = document.createElement('div'); mBot.className = 'bcb-sp-sel-m';
    var mL   = document.createElement('div'); mL.className   = 'bcb-sp-sel-m';
    var mR   = document.createElement('div'); mR.className   = 'bcb-sp-sel-m';
    var sBox = document.createElement('div'); sBox.id = 'bcb-sp-sel-box';
    var hint = document.createElement('div'); hint.id = 'bcb-sp-sel-hint';
    hint.textContent = t('spSelectHint');

    sel.appendChild(mTop); sel.appendChild(mBot);
    sel.appendChild(mL);   sel.appendChild(mR);
    sel.appendChild(sBox); sel.appendChild(chH);
    sel.appendChild(chV);  sel.appendChild(hint);
    document.body.appendChild(sel);

    setMasks(0, 0, 0, 0);
    sBox.hidden = true;

    function gr(x1, y1, x2, y2) {
      return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
    }

    function setMasks(x, y, w, h) {
      var mask = 'background:rgba(0,0,0,0.45)!important;pointer-events:none!important;z-index:2147483640!important;position:fixed!important;';
      mTop.style.cssText = mask + 'inset:0 0 auto!important;height:' + y + 'px!important';
      mBot.style.cssText = mask + 'top:' + (y + h) + 'px!important;left:0!important;right:0!important;bottom:0!important';
      mL.style.cssText   = mask + 'top:' + y + 'px!important;left:0!important;width:' + x + 'px!important;height:' + h + 'px!important';
      mR.style.cssText   = mask + 'top:' + y + 'px!important;left:' + (x + w) + 'px!important;right:0!important;height:' + h + 'px!important';
      if (w > 0 && h > 0) {
        sBox.style.cssText = 'position:fixed!important;top:' + y + 'px!important;left:' + x + 'px!important;width:' + w + 'px!important;height:' + h + 'px!important;border:1.5px solid #fff!important;box-sizing:border-box!important;pointer-events:none!important;z-index:2147483641!important';
        sBox.hidden = false;
      } else {
        sBox.hidden = true;
      }
    }

    function moveCH(x, y) {
      var line = 'position:fixed!important;background:#fff!important;opacity:0.5!important;pointer-events:none!important;z-index:2147483642!important;';
      chH.style.cssText = line + 'top:' + y + 'px!important;left:0!important;right:0!important;height:1px!important;transform:translateY(-0.5px)!important';
      chV.style.cssText = line + 'top:0!important;left:' + x + 'px!important;bottom:0!important;width:1px!important;transform:translateX(-0.5px)!important';
    }

    function cleanup() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (sel.parentNode) sel.parentNode.removeChild(sel);
    }

    function cancel() { cleanup(); panel.style.removeProperty('display'); }

    function onMove(e) {
      moveCH(e.clientX, e.clientY);
      if (!dragging) return;
      var r = gr(startX, startY, e.clientX, e.clientY);
      setMasks(r.x, r.y, r.w, r.h);
    }

    function onDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      hint.hidden = true;
    }

    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      var r = gr(startX, startY, e.clientX, e.clientY);
      if (r.w < 10 || r.h < 10) {
        setMasks(0, 0, 0, 0); sBox.hidden = true; hint.hidden = false;
        return;
      }
      cleanup();
      // Brief delay so the browser paints without the overlay before capture.
      setTimeout(function () {
        requestScreenshot().then(function (dataUrl) {
          // An area is a deliberate choice of what matters, so the editor
          // opens first: the user is nudged to point at it before it is
          // saved. The whole-screen capture next door lands directly.
          crop(dataUrl, r, function (cropped) {
            showAnnotationEditor(cropped, addShot);
          });
        }, function () {
          panel.style.removeProperty('display');
          setStatus(t('spCaptureFailed'), true);
        });
      }, 120);
    }

    function onKey(e) { if (e.key === 'Escape') cancel(); }

    sel.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keydown', onKey);
  }

  function crop(fullDataUrl, rect, done) {
    var dpr = window.devicePixelRatio || 1;
    var tmp = new Image();
    tmp.onload = function () {
      var c = document.createElement('canvas');
      c.width  = Math.round(rect.w * dpr);
      c.height = Math.round(rect.h * dpr);
      c.getContext('2d').drawImage(tmp,
        Math.round(rect.x * dpr), Math.round(rect.y * dpr),
        Math.round(rect.w * dpr), Math.round(rect.h * dpr),
        0, 0, c.width, c.height
      );
      done(c.toDataURL('image/png'));
    };
    tmp.src = fullDataUrl;
  }

  // ------------------------------------------------------------------ annotation editor

  /** Opens the editor on an image; onSave gets the new data URL. Cancel changes nothing. */
  function showAnnotationEditor(dataUrl, onSave) {
    var annotations = [];
    var tool    = 'arrow';
    var color   = '#e31f26';
    var drawing = false;
    var arrowStart = null;
    var freePath   = null;
    var colPop     = null;

    var COLOURS = ['#f5c400', '#222222', '#2563eb', '#2da44e', '#ff8c00', '#e31f26'];

    panel.style.setProperty('display', 'none', 'important');

    var ed = document.createElement('div');
    ed.id = 'bcb-sp-ed';

    var canvas = document.createElement('canvas');
    canvas.id  = 'bcb-sp-ed-canvas';
    var ctx2d  = canvas.getContext('2d');

    var baseImg = new Image();
    baseImg.onload = function () {
      canvas.width  = baseImg.naturalWidth;
      canvas.height = baseImg.naturalHeight;
      render();
    };
    baseImg.src = dataUrl;

    var bar = document.createElement('div');
    bar.id = 'bcb-sp-ed-bar';

    function sep() { var s = document.createElement('div'); s.className = 'bcb-sp-eb-sep'; return s; }

    function toolBtn(cls, title, svg) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = cls; b.setAttribute('data-bcb-tip', title); b.innerHTML = svg;
      return b;
    }

    var btnArrow = toolBtn('bcb-sp-eb-tool bcb-sp-eb-on', t('spToolArrow'),
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg>');
    var btnDraw = toolBtn('bcb-sp-eb-tool', t('spToolPen'),
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>');

    [btnArrow, btnDraw].forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        tool = i === 0 ? 'arrow' : 'draw';
        btnArrow.classList.toggle('bcb-sp-eb-on', i === 0);
        btnDraw.classList.toggle('bcb-sp-eb-on',  i === 1);
      });
    });

    var btnColor = document.createElement('button');
    btnColor.type = 'button';
    btnColor.className = 'bcb-sp-eb-color';
    btnColor.setAttribute('data-bcb-tip', t('spToolColour'));
    btnColor.style.setProperty('background', color, '');

    function openColorPicker() {
      if (colPop) { closeColorPicker(); return; }
      colPop = document.createElement('div');
      colPop.id = 'bcb-sp-col-pick';
      COLOURS.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'bcb-sp-cp-btn' + (c === color ? ' bcb-sp-cp-on' : '');
        b.style.setProperty('background', c, '');
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          color = c;
          btnColor.style.setProperty('background', c, '');
          closeColorPicker();
        });
        colPop.appendChild(b);
      });
      document.body.appendChild(colPop);
      var br = btnColor.getBoundingClientRect();
      var pw = colPop.offsetWidth || 100;
      colPop.style.cssText =
        'left:' + Math.max(8, br.left + br.width / 2 - pw / 2) + 'px;' +
        'bottom:' + (window.innerHeight - br.top + 8) + 'px';
      setTimeout(function () {
        document.addEventListener('click', closeColorPicker, { once: true });
      }, 0);
    }

    function closeColorPicker() {
      if (colPop && colPop.parentNode) colPop.parentNode.removeChild(colPop);
      colPop = null;
    }

    btnColor.addEventListener('click', function (e) { e.stopPropagation(); openColorPicker(); });

    var btnUndo = toolBtn('bcb-sp-eb-tool', t('spUndo'),
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>');
    btnUndo.addEventListener('click', function () { annotations.pop(); render(); });

    var btnOk = toolBtn('bcb-sp-eb-ok', t('spEditorSave'),
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' +
      '<span>' + esc(t('spEditorSaveShort')) + '</span>');
    var btnNo = toolBtn('bcb-sp-eb-no', t('spEditorCancel'), ICON_X);

    bar.appendChild(btnArrow);
    bar.appendChild(btnDraw);
    bar.appendChild(sep());
    bar.appendChild(btnColor);
    bar.appendChild(sep());
    bar.appendChild(btnUndo);
    bar.appendChild(sep());
    bar.appendChild(btnOk);
    bar.appendChild(btnNo);

    ed.appendChild(canvas);
    ed.appendChild(bar);
    document.body.appendChild(ed);

    function coords(e) {
      var r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (canvas.width  / r.width),
        y: (e.clientY - r.top)  * (canvas.height / r.height)
      };
    }

    canvas.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      drawing = true;
      var p = coords(e);
      if (tool === 'arrow') { arrowStart = p; }
      else { freePath = { type: 'draw', pts: [p], color: color }; }
    });

    canvas.addEventListener('mousemove', function (e) {
      if (!drawing) return;
      var p = coords(e);
      if (tool === 'arrow' && arrowStart) {
        render(); paintArrow(ctx2d, arrowStart.x, arrowStart.y, p.x, p.y, color);
      } else if (freePath) {
        freePath.pts.push(p);
        render(); paintPath(ctx2d, freePath.pts, color);
      }
    });

    function commitDraw(e) {
      if (!drawing) return;
      drawing = false;
      var p = e ? coords(e) : null;
      if (tool === 'arrow' && arrowStart) {
        if (p) {
          var dx = p.x - arrowStart.x, dy = p.y - arrowStart.y;
          if (dx * dx + dy * dy > 25) {
            annotations.push({ type: 'arrow', x1: arrowStart.x, y1: arrowStart.y, x2: p.x, y2: p.y, color: color });
          }
        }
        arrowStart = null;
      } else if (freePath) {
        if (freePath.pts.length > 2) annotations.push(freePath);
        freePath = null;
      }
      render();
    }

    canvas.addEventListener('mouseup', commitDraw);
    canvas.addEventListener('mouseleave', function () { if (drawing) commitDraw(null); });

    function render() {
      if (!canvas.width) return;
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      ctx2d.drawImage(baseImg, 0, 0);
      annotations.forEach(function (a) {
        if (a.type === 'arrow') paintArrow(ctx2d, a.x1, a.y1, a.x2, a.y2, a.color);
        else paintPath(ctx2d, a.pts, a.color);
      });
    }

    function removeEditor() {
      closeColorPicker();
      document.removeEventListener('keydown', onEdKey, true);
      if (ed.parentNode) ed.parentNode.removeChild(ed);
      panel.style.removeProperty('display');
    }

    btnOk.addEventListener('click', function () {
      var url = annotations.length ? canvas.toDataURL('image/png') : dataUrl;
      removeEditor();
      onSave(url);
    });

    btnNo.addEventListener('click', removeEditor);

    function onEdKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); btnNo.click(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); btnOk.click(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.stopPropagation(); annotations.pop(); render(); }
    }
    // Capture phase: the host page (BC) must not see these keys while editing.
    document.addEventListener('keydown', onEdKey, true);
  }

  function paintArrow(ctx, x1, y1, x2, y2, color) {
    var dist    = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    var headLen = Math.max(18, Math.min(34, dist * 0.3));
    var angle   = Math.atan2(y2 - y1, x2 - x1);
    var shaftX  = x2 - Math.cos(angle) * headLen * 0.55;
    var shaftY  = y2 - Math.sin(angle) * headLen * 0.55;

    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(shaftX, shaftY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function paintPath(ctx, pts, color) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke(); ctx.restore();
  }

  // ------------------------------------------------------------------ send / save

  function pageContext() {
    return (typeof BCBuddy !== 'undefined' && BCBuddy.parseUrl) ? BCBuddy.parseUrl(location.href) : {};
  }

  function sendReport() {
    if (!canSend()) return;
    elSend.disabled = true; setStatus('');
    var ctx = pageContext();
    lastHtml = buildHtml(ctx, elDesc.value.trim());
    sent = true;
    chrome.runtime.sendMessage({ type: 'bcb:support-clear-session' }).catch(function () {});
    openMailto(ctx, cachedEmail);
    showDone();
    copyToClipboard(lastHtml).then(
      function () { setDoneStatus(''); },
      function () { downloadFile(lastHtml); setDoneStatus(t('spCopyFailed'), true); }
    );
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
    var prioTag = elPriority.value ? '[' + elPriority.value + '] ' : '';
    var typeTag = elType.value ? elType.value + ' - ' : '';
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
    URL.revokeObjectURL(url);
  }

  function downloadReport() {
    if (!canSend()) return;
    downloadFile(buildHtml(pageContext(), elDesc.value.trim()));
    setStatus(t('spSaved'));
  }

  function showDone() {
    elSteps.innerHTML = '';
    var steps = [];
    steps.push(t('spDoneStepPaste'));
    steps.push(t('spDoneStepSend'));
    steps.forEach(function (text) {
      var li = document.createElement('li');
      li.innerHTML = esc(text).replace(/Ctrl\+V/g, '<strong>Ctrl+V</strong>');
      elSteps.appendChild(li);
    });
    elCapture.hidden = true; elDone.hidden = false;
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
    if (!browserName) {
      var ffm = ua.match(/Firefox\/([\d.]+)/);
      if (ffm) { browserName = 'Firefox'; vm = ffm; }
      else { var safm = ua.match(/Version\/([\d.]+).*Safari\//); if (safm) { browserName = 'Safari'; vm = safm; } }
    }
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
      '<p style="' + p + ';margin-bottom:24px">' + (desc ? esc(desc).replace(/\n/g, '<br>') : '\u2014') + '</p>';

    var imgs = shots.map(function (shot) {
      var link = shot.title
        ? '<p style="margin:0 0 6px"><a href="' + esc(shot.url) + '" style="color:#0f6cbd;font-weight:600;text-decoration:none">' + esc(shot.title) + '</a></p>'
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

  // ------------------------------------------------------------------ utils

  function setStatus(text, isError) {
    elStatus.textContent = text || '';
    elStatus.className = 'bcb-sp-status' + (isError ? ' bcb-sp-status-err' : '');
  }

  function setDoneStatus(text, isError) {
    elDoneStatus.textContent = text || '';
    elDoneStatus.className = 'bcb-sp-status' + (isError ? ' bcb-sp-status-err' : '');
  }

  function closeWithConfirm() {
    // Screenshots are work; a misclick on the X must not throw them away.
    // Once the report has been sent there is nothing left to lose.
    if (shots.length && !sent) { showConfirm(); return; }
    remove();
  }

  function showConfirm() {
    elCapture.hidden = true; elConfirm.hidden = false;
    $('bcb-sp-discard-no').focus();
  }

  function hideConfirm() {
    elConfirm.hidden = true; elCapture.hidden = false;
    elDesc.focus();
  }

  // (d) Esc: closes an open menu, then the confirm question, then the panel.
  // The area selection and the editor handle Esc themselves.
  function onPanelKey(e) {
    if (e.key !== 'Escape' || !panel.parentNode) return;
    if (document.getElementById('bcb-sp-sel') || document.getElementById('bcb-sp-ed')) return;
    if (!elTypeMenu.hidden || !elPrioMenu.hidden) { elTypeMenu.hidden = true; elPrioMenu.hidden = true; return; }
    if (!elConfirm.hidden) { hideConfirm(); return; }
    e.preventDefault();
    if (!elDone.hidden) { remove(); return; }
    closeWithConfirm();
  }
  document.addEventListener('keydown', onPanelKey);

  function remove() {
    document.removeEventListener('mousemove', onPanelMove);
    document.removeEventListener('keydown', onPanelKey);
    document.removeEventListener('mouseover', onTipOver);
    document.removeEventListener('mouseout', onTipOut);
    document.removeEventListener('mousedown', hideTip, true);
    if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl);
    chrome.runtime.sendMessage({ type: 'bcb:support-clear-session' }).catch(function () {});
    if (panel.parentNode) panel.parentNode.removeChild(panel);
  }
}());
