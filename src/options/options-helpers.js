/*
 * BC Buddy - options page helpers.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  BCBuddy.OptionsHelpers = {
    install: function (page) {
      var el = page.el;
      var t = page.t;
      var TRIMMED_TYPES = page.TRIMMED_TYPES;

      /**
       * The tokens every text on a layout can use, on one line below its
       * parts. The codes speak for themselves, so the line has no label.
       */
      page.tokenLine = function () {
        // codes: one token, or a token and its short form ({environment}, {env})
        function token(codes, description) {
          return '<span class="tokens__item">' + [].concat(codes).map(function (code) {
            return '<code>' + code + '</code> ';
          }).join('') + description + '</span>';
        }
        return token('{name}', t('tokenName')) +
          token(['{environment}', '{env}'], t('tokenEnvironment')) +
          token('{company}', t('tokenCompany')) +
          token('{title}', t('tokenTitle'));
      };

      /**
       * Summarises what actually happened. A count of zero adds nothing and only
       * lengthens the sentence, so we omit it.
       */
      page.counts = function (pairs) {
        var parts = [];
        pairs.forEach(function (pair) {
          if (pair[0]) parts.push(t(pair[1], pair[0]));
        });
        return parts.join(', ');
      };

      /**
       * Trims leading and trailing spaces from a typed value. Storage does this
       * anyway (see str() in settings.js); this keeps the screen in sync. Returns
       * whether anything changed.
       */
      page.trimField = function (input) {
        if (!input || TRIMMED_TYPES.indexOf(input.type) === -1) return false;
        var trimmed = input.value.trim();
        if (trimmed === input.value) return false;
        input.value = trimmed;
        return true;
      };

      page.move = function (list, from, to) {
        var item = list.splice(from, 1)[0];
        list.splice(to, 0, item);
      };

      page.getPath = function (object, path) {
        return path.split('.').reduce(function (acc, key) {
          return acc == null ? acc : acc[key];
        }, object);
      };

      page.setPath = function (object, path, value) {
        var keys = path.split('.');
        var last = keys.pop();
        var target = keys.reduce(function (acc, key) {
          if (acc[key] == null) acc[key] = {};
          return acc[key];
        }, object);
        target[last] = value;
      };

      /**
       * A slider with data-steps shows a few steps (1, 2, ...) but saves the
       * value that belongs to the step, listed in the attribute.
       */
      function steps(input) {
        return input.dataset.steps ? input.dataset.steps.split(' ').map(Number) : null;
      }

      page.controlValue = function (input) {
        if (input.type === 'checkbox') return input.checked;
        var list = steps(input);
        if (list) return list[Math.round(parseFloat(input.value)) - 1];
        if (input.type === 'number' || input.type === 'range') return parseFloat(input.value);
        return input.value;
      };

      page.setControlValue = function (input, value) {
        var list = steps(input);
        if (input.type === 'checkbox') {
          input.checked = !!value;
        } else if (input.type === 'color') {
          input.value = BCBuddy.toHex(value);
        } else if (list) {
          // A saved value between two steps (from before the steps, or from a
          // shared file) shows on the nearest one, and stays as it is until
          // somebody moves the slider.
          var nearest = 0;
          list.forEach(function (step, i) {
            if (Math.abs(step - value) < Math.abs(list[nearest] - value)) nearest = i;
          });
          input.value = String(nearest + 1);
        } else {
          input.value = value == null ? '' : value;
        }
      };

      page.fillSelect = function (select, options, selected) {
        select.textContent = '';
        options.forEach(function (option) {
          var node = document.createElement('option');
          node.value = option.value;
          node.textContent = t(option.key);
          select.appendChild(node);
        });
        select.value = selected;
      };

      page.when = function (iso) {
        if (!iso) return t('unknownDate');
        var date = new Date(iso);
        if (isNaN(date.getTime())) return t('unknownDate');
        return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
      };

      page.shorten = function (text) {
        var s = String(text || '');
        return s.length > 48 ? s.slice(0, 45) + '...' : s;
      };

      page.setStatus = function (text, isError) {
        el.status.textContent = text;
        el.status.className = 'status' + (isError ? ' status--error' : '');
      };

      page.setHostedStatus = function (text, kind) {
        el.hostedStatus.textContent = text;
        el.hostedStatus.className = 'sync-status' + (kind ? ' sync-status--' + kind : '');
      };

      page.setImportStatus = function (text, kind) {
        el.importStatus.textContent = text;
        el.importStatus.className = 'sync-status' + (kind ? ' sync-status--' + kind : '');
      };

      page.setExportStatus = function (text, kind) {
        el.exportStatus.textContent = text;
        el.exportStatus.className = 'sync-status' + (kind ? ' sync-status--' + kind : '');
      };
    }
  };
})(typeof self !== 'undefined' ? self : this);
