/*
 * BC Buddy - options page hosted config and import/export.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  BCBuddy.OptionsHosted = {
    install: function (page) {
      var state = page.state;
      var el = page.el;
      var t = page.t;

      page.bindHosted = function () {
        // While typing: otherwise the button is still disabled when you click it
        // and nothing happens. HTTP and other schemes stay disabled too.
        el.hostedUrl.addEventListener('input', function () {
          page.updateSyncEnabled(el.hostedUrl.value);
        });
        el.hostedUrl.addEventListener('change', function () {
          page.trimField(el.hostedUrl);
          if (!page.applyHostedUrl(el.hostedUrl.value, { persist: true })) return;
          page.renderHostedStatus();
        });
        el.syncNow.addEventListener('click', function () {
          page.trimField(el.hostedUrl);
          if (!page.applyHostedUrl(el.hostedUrl.value, { persist: true, immediate: true })) return;
          page.setHostedStatus(t('syncing'));
          // Save first so the service worker sees the URL that is on screen.
          page.markOwnWrite(state.settings);
          BCBuddy.saveSettings(state.settings).then(function () {
            return chrome.runtime.sendMessage({ type: 'bcb:sync' });
          }).then(function (result) {
            if (!result || !result.ok) {
              page.setHostedStatus(t('syncFailed', (result && result.error) || t('syncUnknownError')), 'error');
              return;
            }
            page.setHostedStatus(t(result.unchanged ? 'syncLoadedUnchanged' : 'syncLoaded', result.count), 'ok');
          }, function (err) {
            // Saving failed, or the service worker never answered. Either way
            // the status must not stay on "Synchronising...".
            page.setHostedStatus(
              t('syncFailed', String(err && err.message || err) || t('syncUnknownError')), 'error');
          });
        });
      };

      /**
       * Accepts an empty URL, or an HTTPS one (GitHub blob links rewrite to raw).
       * On failure the typed value stays so it can be fixed; storage is left alone.
       */
      page.applyHostedUrl = function (value, options) {
        options = options || {};
        var trimmed = String(value == null ? '' : value).trim();
        if (!trimmed) {
          el.hostedUrl.value = '';
          state.settings.hosted.url = '';
          state.settings.hosted.active = false;
          if (options.persist) {
            if (options.immediate) {
              // The caller stores it right away and marks that write itself.
              if (state.saveTimer) clearTimeout(state.saveTimer);
            } else {
              page.save();
            }
          }
          page.updateSyncEnabled('');
          return true;
        }
        try {
          var resolved = BCBuddy.resolveHostedUrl(trimmed);
          el.hostedUrl.value = resolved;
          state.settings.hosted.url = resolved;
          if (options.persist) {
            if (options.immediate) {
              // The caller stores it right away and marks that write itself.
              if (state.saveTimer) clearTimeout(state.saveTimer);
            } else {
              page.save();
            }
          }
          page.updateSyncEnabled(resolved);
          return true;
        } catch (err) {
          page.setHostedStatus(String(err && err.message || err), 'error');
          page.updateSyncEnabled(trimmed);
          return false;
        }
      };

      page.updateSyncEnabled = function (url) {
        el.syncNow.disabled = !String(url || '').trim() || !BCBuddy.hostedUrlAllowed(url);
      };

      /**
       * Clears what came from the shared file. The shared configuration is turned
       * off too, otherwise everything reappears tomorrow. The URL stays so you can
       * start again with one click on Synchronise.
       */
      page.clearSharedRules = function () {
        var hosted = state.settings.hosted;
        // Deleting one rule asks first; wiping the whole shared set should not
        // be the one destructive action that goes through on a single click.
        if (!confirm(t('clearSharedConfirm', [hosted.rules.length]))) return;
        hosted.rules = [];
        hosted.layouts = [];
        hosted.lastHash = '';
        hosted.sourceName = '';
        hosted.lastSync = null;
        hosted.lastError = null;
        hosted.active = false;

        page.save();
        page.renderHosted();
        page.renderLayouts();
        page.renderParsed();
        page.setHostedStatus(t('sharedCleared'), 'ok');
      };

      page.bindImportExport = function () {
        el.importFileBtn.addEventListener('click', function () { el.importFile.click(); });

        el.importFile.addEventListener('change', function () {
          var file = el.importFile.files && el.importFile.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            page.applyImport(String(reader.result), file.name);
            el.importFile.value = '';
          };
          reader.onerror = function () { page.setImportStatus(t('importReadFailed'), 'error'); };
          reader.readAsText(file);
        });

        el.exportDownload.addEventListener('click', function () {
          var data = BCBuddy.toExport(state.settings);
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'bc-buddy.json';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
          page.setExportStatus(t('exportDone', data.rules.length), 'ok');
        });
      };

      page.applyImport = function (text, source) {
        var parsed;
        try {
          parsed = BCBuddy.parseImport(text);
        } catch (e) {
          page.setImportStatus(t('importFailed', e.message), 'error');
          return;
        }
        // Layouts first, so rules can point at something that already exists.
        var mergedLayouts = BCBuddy.mergeLayouts(state.settings.layouts, parsed.layouts);
        state.settings.layouts = mergedLayouts.layouts;

        var merged = BCBuddy.mergeRules(state.settings.rules, parsed.rules);
        state.settings.rules = merged.rules;
        page.save();
        page.renderRules();
        page.renderLayouts();
        page.renderParsed();

        var stats = merged.stats;
        var layoutStats = mergedLayouts.stats;
        var rules = page.counts([[stats.overwritten, 'importOverwritten'],
          [stats.added, 'importAdded'], [stats.kept, 'importKept']]);
        var layouts = page.counts([[layoutStats.overwritten, 'importOverwritten'],
          [layoutStats.added, 'importAdded']]);

        page.setImportStatus(
          t('importDone', [parsed.rules.length, page.shorten(source), rules || t('importNone')]) +
          (layouts ? t('importLayouts', [layouts]) : ''), 'ok');
      };

      page.renderHostedStatus = function () {
        var h = state.settings.hosted;
        page.updateSyncEnabled(h.url);
        // When shared configuration is off, dim the field — like a disabled rule.
        var field = el.hostedUrl.closest('.field');
        if (field) field.classList.toggle('field--inactive', !h.active);
        if (!h.url) {
          page.setHostedStatus(t('statusNoHosted'));
          return;
        }
        // Legacy http:// URLs stay visible but cannot sync until upgraded.
        if (!BCBuddy.hostedUrlAllowed(h.url)) {
          page.setHostedStatus(t('errHttpsOnly'), 'error');
          return;
        }
        if (h.lastError) {
          page.setHostedStatus(t('statusSyncError', [page.when(h.lastSync), h.lastError]), 'error');
          return;
        }
        if (!h.lastSync) {
          page.setHostedStatus(t('statusNotSynced'));
          return;
        }
        var summary = h.sourceName
          ? t('statusHostedNamed', [h.rules.length, h.sourceName, page.when(h.lastSync)])
          : t('statusHosted', [h.rules.length, page.when(h.lastSync)]);
        page.setHostedStatus(summary + (h.active ? ' ' + t('statusDaily') : ''), 'ok');
      };
    }
  };
})(typeof self !== 'undefined' ? self : this);
