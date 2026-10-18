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
          if (state.policyUrl) return;
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
        // Set by policy: the service worker would turn it straight back on.
        if (state.policyUrl) return;
        // Deleting one rule asks first; wiping the whole shared set should not
        // be the one destructive action that goes through on a single click.
        if (!confirm(t('clearSharedConfirm', [hosted.rules.length]))) return;
        hosted.rules = [];
        hosted.styles = [];
        // Starting over means the file's Web client defaults count as new again.
        hosted.webClient = {};
        hosted.lastHash = '';
        hosted.sourceName = '';
        hosted.lastSync = null;
        hosted.lastError = null;
        hosted.failures = 0;
        hosted.active = false;

        page.save();
        page.renderHosted();
        page.renderStyles();
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
          reader.onerror = function () { page.setTransferStatus(t('importReadFailed'), 'error'); };
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
          page.setTransferStatus(t('exportDone', data.rules.length), 'ok');
        });

        el.loadSamples.addEventListener('click', page.loadSamples);
      };

      /**
       * Adds the sample rules from the file packaged with the extension: no
       * network, and the same file the site offers as a shared example. They
       * become own rules; rules you already have are left alone.
       */
      page.loadSamples = function () {
        // Checked again on the click: a policy may have arrived since the page
        // was drawn.
        Promise.all([BCBuddy.readPolicy(), page.readInstallType()]).then(function (results) {
          state.policyUrl = BCBuddy.policyUrl(results[0]);
          state.installType = results[1];
          if (!page.samplesAllowed()) {
            page.renderEmptyState();
            return null;
          }
          return fetch(chrome.runtime.getURL(BCBuddy.SAMPLES_PATH)).then(function (response) {
            if (!response.ok) throw new Error(String(response.status));
            return response.text();
          });
        }).then(function (text) {
          if (text === null) return;
          var samples = BCBuddy.localizeSamples(BCBuddy.parseImport(text));
          var stats = BCBuddy.addSamples(state.settings, samples);
          if (stats.added || stats.styles) {
            page.save();
            page.renderStyles();
            page.renderRules(); // rule dropdowns now include the sample style
            page.renderParsed();
          }
          var status = stats.added ? t('samplesAdded', [stats.added])
            : stats.styles ? t('samplesStylesAdded', [stats.styles])
            : t('samplesNone');
          page.setSamplesStatus(status, 'ok');
        }).catch(function (err) {
          page.setSamplesStatus(t('samplesFailed', [String(err && err.message || err)]), 'error');
        });
      };

      page.setSamplesStatus = function (text, kind) {
        el.samplesStatus.textContent = text;
        el.samplesStatus.className = 'sync-status' + (kind ? ' sync-status--' + kind : '');
      };

      page.applyImport = function (text, source) {
        var parsed;
        try {
          parsed = BCBuddy.parseImport(text);
        } catch (e) {
          page.setTransferStatus(t('importFailed', e.message), 'error');
          return;
        }
        // Styles first, so rules can point at something that already exists.
        var mergedStyles = BCBuddy.mergeStyles(state.settings.styles, parsed.styles);
        state.settings.styles = mergedStyles.styles;

        var merged = BCBuddy.mergeRules(state.settings.rules, parsed.rules);
        state.settings.rules = merged.rules;
        // An import by hand is deliberate: the file's Web client settings win.
        var webClientChanged = BCBuddy.applyWebClient(state.settings, parsed.webClient);
        page.save();
        page.renderRules();
        page.renderStyles();
        page.renderParsed();
        page.renderWebClient();

        var stats = merged.stats;
        var styleStats = mergedStyles.stats;
        var rules = page.counts([[stats.overwritten, 'importOverwritten'],
          [stats.added, 'importAdded'], [stats.kept, 'importKept']]);
        var styles = page.counts([[styleStats.overwritten, 'importOverwritten'],
          [styleStats.added, 'importAdded']]);

        page.setTransferStatus(
          t('importDone', [parsed.rules.length, page.shorten(source), rules || t('importNone')]) +
          (styles ? t('importStyles', [styles]) : '') +
          (webClientChanged ? t('importWebClient', [webClientChanged]) : ''), 'ok');
      };

      page.renderHostedStatus = function () {
        var h = state.settings.hosted;
        page.updateSyncEnabled(h.url);
        // Set by policy: the address cannot be changed and the shared rules not
        // cleared. Synchronise stays, to fetch a change right away.
        var managed = !!state.policyUrl;
        el.hostedUrl.readOnly = managed;
        el.hostedManaged.hidden = !managed;
        el.clearShared.hidden = managed;
        // When shared configuration is off, dim the field — like a disabled rule.
        var field = el.hostedUrl.closest('.field');
        if (field) field.classList.toggle('field--inactive', !h.active);
        // No URL: the empty field says it already, so the line stays hidden.
        if (!h.url) {
          page.setHostedStatus('');
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
