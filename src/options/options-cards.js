/*
 * BC Buddy - options page rule and layout cards.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  BCBuddy.OptionsCards = {
    install: function (page) {
      var state = page.state;
      var el = page.el;
      var t = page.t;

      /** Layouts a card can pick from: shared cards see both sets. */
      page.layoutsFor = function (readOnly) {
        return readOnly
          ? state.settings.hosted.layouts.concat(state.settings.layouts)
          : state.settings.layouts;
      };

      /** How many rules reference this layout. */
      page.layoutUsage = function (layout) {
        return state.settings.rules.concat(state.settings.hosted.rules)
          .filter(function (rule) { return rule.layoutId === layout.id; }).length;
      };

      /**
       * Builds a card for a rule or a layout. Both share the display block from
       * displayTemplate so those settings are described in one place only.
       */
      page.createCard = function (item, index, options) {
        var kind = options.kind;
        var readOnly = options.readOnly;
        var templateId = kind === 'layout' ? 'layoutTemplate' : 'ruleTemplate';
        var card = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
        card.dataset.kind = kind;
        card.dataset.index = String(index);
        card.dataset.readonly = readOnly ? '1' : '';
        card.dataset.expandKey = page.expandKey(kind, item, readOnly);
        page.setExpanded(card, !!state.expanded[card.dataset.expandKey]);

        if (kind === 'layout') {
          card.querySelector('[data-display]')
            .appendChild(document.getElementById('displayTemplate').content.firstElementChild.cloneNode(true));
        }

        if (kind === 'rule') {
          page.renderConditions(card, item);
          page.renderPalette(card, item, readOnly);
        }

        card.querySelectorAll('[data-path]').forEach(function (input) {
          page.setControlValue(input, page.getPath(item, input.dataset.path));
        });

        // After the fields: the dropdown decides what is selected, even when the
        // rule has no explicit choice yet.
        if (kind === 'rule') page.fillLayoutPicker(card, item, readOnly);

        BCBuddy.applyI18n(card);
        card.querySelectorAll('[data-tokens]').forEach(function (bubble) {
          bubble.innerHTML = page.tokenHelp();
        });

        page.updateCard(card, item);

        if (readOnly) {
          card.querySelectorAll('input, select, button').forEach(function (input) {
            input.disabled = true;
          });
          // Expanding and viewing help is still allowed even though nothing is editable.
          card.querySelectorAll('[data-action="toggle"], [data-action="hint"]').forEach(function (button) {
            button.disabled = false;
          });
          // A shared rule cannot be edited, but you can duplicate it into your own
          // rules and tweak the copy.
          var tools = card.querySelector('.rule__tools');
          tools.textContent = '';
          if (kind === 'rule') {
            var copy = document.createElement('button');
            copy.type = 'button';
            copy.className = 'icon-btn';
            copy.dataset.action = 'duplicate';
            copy.title = t('copyShared');
            copy.innerHTML = '&#10697;';
            tools.appendChild(copy);
          }
          var addCond = card.querySelector('[data-action="add-condition"]');
          if (addCond) addCond.remove();
        }
        return card;
      };

      page.fillLayoutPicker = function (card, rule, readOnly) {
        var select = card.querySelector('[data-layout-picker]');
        if (!select) return;
        var layouts = page.layoutsFor(readOnly);

        select.textContent = '';
        layouts.forEach(function (layout) {
          var option = document.createElement('option');
          option.value = layout.id;
          option.textContent = layout.name;
          select.appendChild(option);
        });

        // Set the value only now: the options did not exist above.
        var auto = BCBuddy.effectiveLayout(rule, layouts);
        if (auto) select.value = auto.id;
      };

      page.renderConditions = function (card, rule) {
        var host = card.querySelector('[data-conditions]');
        host.textContent = '';
        rule.conditions.forEach(function (cond, ci) {
          var row = document.getElementById('conditionTemplate').content.firstElementChild.cloneNode(true);
          row.dataset.index = String(ci);
          page.fillSelect(row.querySelector('[data-cond="field"]'), BCBuddy.FIELDS, cond.field);
          page.fillSelect(row.querySelector('[data-cond="op"]'), BCBuddy.OPERATORS, cond.op);
          row.querySelector('[data-cond="value"]').value = cond.value;
          host.appendChild(row);
        });
      };

      page.renderPalette = function (card, rule, readOnly) {
        var host = card.querySelector('[data-palette]');
        // The colour picker is already in the palette in the template; set it aside
        // so clearing survives and it returns behind the swatches.
        var custom = card.querySelector('[data-custom-color]');
        host.textContent = '';
        if (!readOnly) {
          BCBuddy.PALETTE.forEach(function (color) {
            var button = document.createElement('button');
            button.type = 'button';
            button.style.background = color;
            button.dataset.action = 'pick-color';
            button.dataset.color = color;
            button.title = color;
            button.setAttribute('aria-pressed', 'false');
            host.appendChild(button);
          });
        }
        host.appendChild(custom);
      };

      /** Updates a card's colour, badge and preview without redrawing the card. */
      page.updateCard = function (card, item) {
        var ctx = state.ctx;
        var isLayout = card.dataset.kind === 'layout';
        var readOnly = !!card.dataset.readonly;

        // A layout has no colour of its own: the preview borrows from the first rule
        // that uses it, otherwise a neutral one.
        var shown = isLayout ? item : BCBuddy.resolveRule(item, page.layoutsFor(readOnly));
        var color = isLayout ? page.layoutSampleColor(item) : item.color;
        var textColor = !isLayout && item.textColor !== 'auto' ? item.textColor : BCBuddy.idealText(color);

        card.style.setProperty('--rule-color', color);
        card.classList.toggle('rule--disabled', item.enabled === false);

        var swatch = card.querySelector('[data-swatch]');
        if (swatch) swatch.style.background = color;
        card.querySelectorAll('[data-action="pick-color"]').forEach(function (button) {
          button.setAttribute('aria-pressed', button.dataset.color === color ? 'true' : 'false');
        });

        var matched = isLayout ? true : BCBuddy.matchRule(item, ctx);
        var badge = card.querySelector('[data-match]');
        if (badge) {
          badge.textContent = matched ? '\u2713' : '\u25CB';
          badge.className = 'match ' + (matched ? 'match--yes' : 'match--no');
          badge.title = t(matched ? 'matchYes' : 'matchNo');
        }
        var preview = card.querySelector('[data-preview]');
        if (preview) preview.classList.toggle('preview--nomatch', !matched);

        card.querySelectorAll('.condition').forEach(function (row) {
          var cond = item.conditions[Number(row.dataset.index)];
          var dot = row.querySelector('[data-cond-match]');
          var hasValue = cond && String(cond.value || '').trim() !== '';
          dot.className = 'dot-indicator ' +
            (!hasValue ? '' : (BCBuddy.testCondition(cond, ctx) ? 'dot-indicator--on' : 'dot-indicator--off'));
          dot.title = !hasValue ? '' : t(BCBuddy.testCondition(cond, ctx) ? 'conditionMatches' : 'conditionNoMatch');
        });

        // Favicon letters belong to the rule, and only when the layout draws them.
        // A rule card has no other preview: that lives on the layout, where display
        // settings are edited too.
        if (!isLayout) {
          card.querySelector('[data-favicon-letters]').hidden = !shown.favicon.enabled;
          return;
        }

        // Ribbon
        var ribbon = card.querySelector('[data-preview-ribbon]');
        var brand = card.querySelector('[data-preview-brand]');
        var originalBrand = 'Dynamics 365 Business Central';
        if (shown.ribbon.enabled) {
          ribbon.style.background = color;
          ribbon.style.color = textColor;
          brand.textContent = BCBuddy.renderTidy(shown.ribbon.text, ctx, {
            name: item.name, title: t('previewTitle')
          }) || originalBrand;
        } else {
          ribbon.style.background = '';
          ribbon.style.color = '';
          brand.textContent = originalBrand;
        }
        brand.style.fontWeight = '600';

        // Frame
        var frame = card.querySelector('[data-preview-frame]');
        frame.style.borderWidth = shown.border.enabled ? Math.min(shown.border.width, 14) + 'px' : '0';
        frame.style.borderColor = color;

        // Banner (bar or corner ribbon)
        var banner = card.querySelector('[data-preview-banner]');
        banner.className = 'preview__banner preview__banner--' + shown.banner.position +
          (shown.banner.enabled ? ' preview__banner--visible' : '');
        if (shown.banner.enabled) {
          banner.style.background = BCBuddy.toRgba(color, shown.banner.opacity);
          banner.style.color = textColor;
          banner.textContent = BCBuddy.renderTidy(shown.banner.text || '{name}', ctx, { name: item.name });
        }

        // A layout is independent of conditions, so the ribbon is always shown.
        ribbon.hidden = false;
        card.querySelector('[data-preview-page]').textContent = t('previewPageBc');

        // Collapse sections based on their toggle
        card.querySelectorAll('.option').forEach(function (option) {
          var toggle = option.querySelector('input[type="checkbox"][data-path$=".enabled"]');
          option.classList.toggle('option--off', toggle && !toggle.checked);
        });
      };

      /**
       * An own and a shared rule can share the same id (after importing from the
       * same file), so the list belongs in the key.
       */
      page.expandKey = function (kind, item, readOnly) {
        return kind + ':' + (readOnly ? 'gedeeld:' : 'eigen:') + item.id;
      };

      /** Colour for a layout preview: from the first rule that uses it. */
      page.layoutSampleColor = function (layout) {
        var user = null;
        state.settings.rules.concat(state.settings.hosted.rules).forEach(function (rule) {
          if (!user && rule.layoutId === layout.id) user = rule;
        });
        return user ? user.color : BCBuddy.PALETTE[8];
      };

      page.closeHints = function () {
        document.querySelectorAll('.hint.is-open').forEach(function (hint) {
          hint.classList.remove('is-open');
        });
      };

      page.setExpanded = function (card, expanded) {
        card.classList.toggle('rule--collapsed', !expanded);
        var toggle = card.querySelector('[data-action="toggle"]');
        if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      };

      page.toggleCard = function (card) {
        var key = card.dataset.expandKey;
        var expanded = !state.expanded[key];
        if (expanded) {
          state.expanded[key] = true;
        } else {
          delete state.expanded[key];
        }
        page.setExpanded(card, expanded);
      };

      /**
       * Turns a shared rule into an own copy. Its layout comes along, otherwise the
       * copy would look different from the original.
       */
      page.copySharedRule = function (index) {
        var source = state.settings.hosted.rules[index];
        if (!source) return;

        var copy = BCBuddy.newRule(source);
        copy.name = source.name;
        copy.layoutId = source.layoutId;

        var copiedLayout = false;
        if (copy.layoutId && !BCBuddy.findById(state.settings.layouts, copy.layoutId)) {
          var layout = BCBuddy.findById(state.settings.hosted.layouts, copy.layoutId);
          if (layout) {
            state.settings.layouts.push(BCBuddy.normalizeLayout(layout));
            copiedLayout = true;
          }
        }

        state.settings.rules.push(copy);
        state.expanded[page.expandKey('rule', copy, false)] = true;
        page.save();
        page.renderRules();
        page.renderLayouts();
        page.renderParsed();
        page.setStatus(t('copiedToOwn', 1) + (copiedLayout ? t('copiedLayouts', 1) : ''));
      };

      page.onLayoutAction = function (action, index) {
        var layout = state.settings.layouts[index];
        if (!layout) return;

        if (action === 'delete') {
          // At least one must remain, otherwise "follows the only layout" means
          // nothing.
          if (state.settings.layouts.length < 2) {
            page.setStatus(t('lastLayout'), true);
            return;
          }
          var used = page.layoutUsage(layout);
          if (!confirm(t('deleteLayoutConfirm', [layout.name, used]))) return;
          // Rules keep their own settings, which were never overwritten.
          state.settings.rules.forEach(function (rule) {
            if (rule.layoutId === layout.id) rule.layoutId = '';
          });
          state.settings.layouts.splice(index, 1);
        } else if (action === 'duplicate') {
          var copy = BCBuddy.newLayout(layout);
          copy.name = t('copySuffix', layout.name);
          state.settings.layouts.splice(index + 1, 0, copy);
          state.expanded[page.expandKey('layout', copy, false)] = true;
        } else {
          return;
        }

        page.save();
        page.renderLayouts();
        page.renderRules();
        page.renderHosted();
        page.renderParsed();
      };

      /** The rule or layout this card belongs to. */
      page.cardTarget = function (card) {
        var index = Number(card.dataset.index);
        return card.dataset.kind === 'layout'
          ? state.settings.layouts[index]
          : state.settings.rules[index];
      };

      page.onRuleInput = function (event) {
        var card = event.target.closest('.rule');
        if (!card || card.dataset.readonly) return;
        var target = page.cardTarget(card);
        if (!target) return;

        // On blur, show what gets saved: no leading or trailing spaces.
        if (event.type === 'change') page.trimField(event.target);

        var pathInput = event.target.closest('[data-path]');
        if (pathInput) {
          var path = pathInput.dataset.path;
          page.setPath(target, path, page.controlValue(pathInput));
          if (path === 'banner.enabled' && target.banner.enabled) {
            // A banner that covers the page helps nobody: half transparent.
            target.banner.opacity = 0.5;
            var opacityInput = card.querySelector('[data-path="banner.opacity"]');
            if (opacityInput) page.setControlValue(opacityInput, 0.5);
          }
        }

        var condInput = event.target.closest('[data-cond]');
        if (condInput) {
          var row = condInput.closest('.condition');
          var cond = target.conditions[Number(row.dataset.index)];
          if (cond) cond[condInput.dataset.cond] = condInput.value;
        }

        if (!pathInput && !condInput) return;
        page.updateCard(card, target);
        page.renderParsed();
        page.save();

        // A layout change affects every rule that uses it; redraw those cards while
        // the layout card stays put so focus does not jump.
        if (card.dataset.kind === 'layout') {
          page.renderRules();
          page.renderHosted();
          return;
        }

        // Conversely the layout card depends on rules: how many are linked and which
        // colour the preview borrows.
        var path = pathInput && pathInput.dataset.path;
        if (path === 'layoutId' || path === 'color') page.renderLayouts();
      };

      page.onRuleClick = function (event) {
        var button = event.target.closest('[data-action]');
        var card = event.target.closest('.rule');
        if (!card) return;

        if (button && button.dataset.action === 'hint') {
          // Inside a <label>: do not pass through to the adjacent field.
          event.preventDefault();
          var wasOpen = button.classList.contains('is-open');
          page.closeHints();
          if (!wasOpen) button.classList.add('is-open');
          return;
        }
        page.closeHints();

        // A click on the header expands or collapses the rule, unless you click a
        // control in that header.
        var onHead = event.target.closest('.rule__head') &&
          !event.target.closest('input, select, label') &&
          (!button || button.dataset.action === 'toggle');
        if (onHead) {
          page.toggleCard(card);
          return;
        }
        if (!button) return;
        var index = Number(card.dataset.index);
        if (card.dataset.readonly) {
          // The only thing you can do with a shared rule: duplicate it into your own rules.
          if (button.dataset.action === 'duplicate' && card.dataset.kind === 'rule') {
            page.copySharedRule(index);
          }
          return;
        }
        if (card.dataset.kind === 'layout') {
          page.onLayoutAction(button.dataset.action, index);
          return;
        }
        var rule = state.settings.rules[index];
        if (!rule) return;

        switch (button.dataset.action) {
          case 'delete':
            if (!confirm(t('deleteConfirm', rule.name))) return;
            state.settings.rules.splice(index, 1);
            page.save();
            page.renderRules();
            page.renderParsed();
            return;
          case 'duplicate':
            var copy = BCBuddy.newRule(rule);
            copy.name = t('copySuffix', rule.name);
            state.settings.rules.splice(index + 1, 0, copy);
            state.expanded[page.expandKey('rule', copy, false)] = true;
            page.save();
            page.renderRules();
            return;
          case 'add-condition':
            rule.conditions.push({ field: 'url', op: 'contains', value: '' });
            page.renderConditions(card, rule);
            page.updateCard(card, rule);
            page.save();
            return;
          case 'remove-condition':
            var row = button.closest('.condition');
            rule.conditions.splice(Number(row.dataset.index), 1);
            if (!rule.conditions.length) rule.conditions.push({ field: 'url', op: 'contains', value: '' });
            page.renderConditions(card, rule);
            page.updateCard(card, rule);
            page.renderParsed();
            page.save();
            return;
          case 'pick-color':
            rule.color = button.dataset.color;
            page.setControlValue(card.querySelector('[data-custom-color]'), rule.color);
            page.updateCard(card, rule);
            page.renderParsed();
            page.save();
            return;
        }
      };
    }
  };
})(typeof self !== 'undefined' ? self : this);
