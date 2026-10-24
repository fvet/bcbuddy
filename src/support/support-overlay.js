/*
 * BC Buddy - Help & feedback, the parts that have to be on the page itself.
 *
 * The report is written in the browser's side panel (src/sidepanel/help.js).
 * Two steps need the Business Central page under the mouse, so the panel
 * injects this file into the tab's top frame when one of them starts:
 *
 *   BCBuddy.SupportOverlay.selectArea()  drag a rectangle over the page;
 *     resolves { x, y, w, h, vw, vh } in CSS pixels, or null on Esc.
 *   BCBuddy.SupportOverlay.edit(dataUrl) the drawing editor over the page;
 *     resolves the new image, the same one when nothing was drawn, or null
 *     on cancel.
 *
 * The panel calls them through chrome.scripting, which hands back what they
 * resolve. It runs in the content scripts' isolated world, so the page cannot
 * call it or see its variables. Nothing here listens until a step starts,
 * and every listener goes when it ends.
 */
(function () {
  'use strict';

  var BCBuddy = window.BCBuddy = window.BCBuddy || {};
  if (BCBuddy.SupportOverlay) return;

  /** Translation with a readable fallback: a missing key shows the key. */
  function t(key) {
    if (BCBuddy.t) return BCBuddy.t(key, []);
    var msg = '';
    try { msg = chrome.i18n.getMessage(key); } catch (e) { /* extension reloaded */ }
    return msg || key;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var ICON_X =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      '<line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>' +
    '</svg>';

  // Only one step at a time: a second request while one is open gets null.
  var busy = false;

  // ------------------------------------------------------------------ tooltips

  // Browser tooltips are tiny and slow to appear. One shared bubble instead,
  // for the editor's buttons that carry data-bcb-tip. Listens only while the
  // editor is open.
  var tipEl = null;

  function showTip(target) {
    var text = target.getAttribute('data-bcb-tip');
    if (!text) return;
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.id = 'bcb-sp-tip';
    }
    tipEl.textContent = text;
    // Last in the body wins at equal z-index: the bubble goes after the editor.
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

  function tipsOn() {
    document.addEventListener('mouseover', onTipOver);
    document.addEventListener('mouseout', onTipOut);
    document.addEventListener('mousedown', hideTip, true);
  }

  function tipsOff() {
    document.removeEventListener('mouseover', onTipOver);
    document.removeEventListener('mouseout', onTipOut);
    document.removeEventListener('mousedown', hideTip, true);
    if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl);
  }

  // ------------------------------------------------------------------ area selection

  function selectArea() {
    if (busy) return Promise.resolve(null);
    busy = true;
    return new Promise(function (resolve) {
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

      function finish(result) {
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (sel.parentNode) sel.parentNode.removeChild(sel);
        busy = false;
        if (!result) { resolve(null); return; }
        // Two frames, so the browser has painted the page without the
        // overlay before the panel takes the screenshot.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { resolve(result); });
        });
      }

      function onMove(e) {
        moveCH(e.clientX, e.clientY);
        if (!dragging) return;
        var r = gr(startX, startY, e.clientX, e.clientY);
        setMasks(r.x, r.y, r.w, r.h);
      }

      function onDown(e) {
        if (e.button !== 0 || !e.isTrusted) return;
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
        r.vw = window.innerWidth;
        r.vh = window.innerHeight;
        finish(r);
      }

      function onKey(e) {
        if (e.key !== 'Escape') return;
        e.preventDefault(); e.stopPropagation();
        finish(null);
      }

      sel.addEventListener('mousedown', onDown);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      // Capture phase: Business Central must not see the Esc.
      document.addEventListener('keydown', onKey, true);
    });
  }

  // ------------------------------------------------------------------ annotation editor

  function edit(dataUrl) {
    if (busy) return Promise.resolve(null);
    busy = true;
    tipsOn();
    return new Promise(function (resolve) {
      var annotations = [];
      var tool    = 'arrow';
      var color   = '#e31f26';
      var drawing = false;
      var arrowStart = null;
      var freePath   = null;
      var colPop     = null;

      var COLOURS = ['#f5c400', '#222222', '#2563eb', '#2da44e', '#ff8c00', '#e31f26'];

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
      baseImg.onerror = function () { close(null); };
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
        if (e.button !== 0 || !e.isTrusted) return;
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

      function close(result) {
        closeColorPicker();
        tipsOff();
        document.removeEventListener('keydown', onEdKey, true);
        if (ed.parentNode) ed.parentNode.removeChild(ed);
        busy = false;
        resolve(result);
      }

      btnOk.addEventListener('click', function () {
        close(annotations.length ? canvas.toDataURL('image/png') : dataUrl);
      });

      btnNo.addEventListener('click', function () { close(null); });

      function onEdKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); btnNo.click(); }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); btnOk.click(); }
        else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.stopPropagation(); annotations.pop(); render(); }
      }
      // Capture phase: the host page (BC) must not see these keys while editing.
      document.addEventListener('keydown', onEdKey, true);
    });
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

  BCBuddy.SupportOverlay = { selectArea: selectArea, edit: edit };
}());
