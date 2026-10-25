/*
 * BC Buddy - options page rule and style cards.
 */
(function (root) {
  'use strict';
  var BCBuddy = root.BCBuddy || (root.BCBuddy = {});

  // A style preview with no rule to borrow from: close to BC's own teal.
  var NEUTRAL = '#038387';

  BCBuddy.OptionsCards = {
    install: function (page) {
      var state = page.state;
      var el = page.el;
      var t = page.t;

      /**
       * Styles a card can pick from: both sets, the card's own set first. A
       * copied shared rule brings its style along under the same id; the
       * first one wins, as it does in effectiveRules().
       */
      page.stylesFor = function (readOnly) {
        var own = state.settings.styles;
        var shared = state.settings.hosted.styles;
        var seen = {};
        return (readOnly ? shared.concat(own) : own.concat(shared)).filter(function (style) {
          if (seen[style.id]) return false;
          seen[style.id] = true;
          return true;
        });
      };

      /** How many rules reference this style. */
      page.styleUsage = function (style) {
        return state.settings.rules.concat(state.settings.hosted.rules)
          .filter(function (rule) { return rule.styleId === style.id; }).length;
      };

      /**
       * Builds a card for a rule or a style. Both share the display block from
       * displayTemplate so those settings are described in one place only.
       */
      page.createCard = function (item, index, options) {
        var kind = options.kind;
        var readOnly = options.readOnly;
        var templateId = kind === 'style' ? 'styleTemplate' : 'ruleTemplate';
        var card = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
        card.dataset.kind = kind;
        card.dataset.index = String(index);
        card.dataset.readonly = readOnly ? '1' : '';
        card.dataset.expandKey = page.expandKey(kind, item, readOnly);
        page.setExpanded(card, !!state.expanded[card.dataset.expandKey]);

        if (kind === 'style') {
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
        if (kind === 'rule') page.fillStylePicker(card, item, readOnly);

        BCBuddy.applyI18n(card);
        card.querySelectorAll('[data-token-line]').forEach(function (line) {
          line.innerHTML = page.tokenLine();
          // What happens to a token that stays empty.
          line.title = t('tokensFooter');
        });

        page.updateCard(card, item);

        if (readOnly) {
          card.querySelectorAll('input, select, button').forEach(function (input) {
            input.disabled = true;
          });
          // Expanding is still allowed even though nothing is editable.
          card.querySelectorAll('[data-action="toggle"]').forEach(function (button) {
            button.disabled = false;
          });
          // Shared rules keep the order from the shared file: the triangle and
          // the swatch only toggle, they are no grip.
          card.querySelectorAll('[data-grip]').forEach(function (grip) {
            grip.removeAttribute('data-grip');
            grip.classList.remove('rule__grip');
            grip.title = t('toggleDetails');
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

      page.fillStylePicker = function (card, rule, readOnly) {
        var select = card.querySelector('[data-style-picker]');
        if (!select) return;
        var styles = page.stylesFor(readOnly);

        // On an own rule the shared styles follow under their own heading,
        // as they do in the Styles list.
        var sharedGroup = null;
        select.textContent = '';
        styles.forEach(function (style) {
          var option = document.createElement('option');
          option.value = style.id;
          option.textContent = style.name;
          var shared = !readOnly && !BCBuddy.findById(state.settings.styles, style.id);
          if (shared && !sharedGroup) {
            sharedGroup = document.createElement('optgroup');
            sharedGroup.label = t('sharedStyles');
            select.appendChild(sharedGroup);
          }
          (shared ? sharedGroup : select).appendChild(option);
        });

        // Set the value only now: the options did not exist above.
        var auto = BCBuddy.effectiveStyle(rule, styles);
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

      /** The value as matching sees it: RegEx exactly, the rest without case. */
      function conditionKey(cond) {
        var value = String(cond.value || '').trim();
        return cond.field + '|' + cond.op + '|' + (cond.op === 'regex' ? value : value.toLowerCase());
      }

      /** True when an earlier condition of the rule says the same thing. */
      page.repeatsCondition = function (conditions, index) {
        var key = conditionKey(conditions[index]);
        for (var i = 0; i < index; i++) {
          if (conditionKey(conditions[i]) === key) return true;
        }
        return false;
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
            button.style.setProperty('--swatch', color);
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
        var isStyle = card.dataset.kind === 'style';
        var readOnly = !!card.dataset.readonly;

        // A style has no colour of its own: the preview borrows one (sampleRule).
        var shown = isStyle ? item : BCBuddy.resolveRule(item, page.stylesFor(readOnly));
        var source = isStyle ? page.sampleRule() : item;
        var color = source ? source.color : NEUTRAL;
        var textColor = BCBuddy.idealText(color);

        card.style.setProperty('--rule-color', color);

        var swatch = card.querySelector('[data-swatch]');
        if (swatch) swatch.style.background = color;
        card.querySelectorAll('[data-action="pick-color"]').forEach(function (button) {
          button.setAttribute('aria-pressed', button.dataset.color === color ? 'true' : 'false');
        });

        var matched = isStyle ? true : BCBuddy.matchRule(item, ctx);
        // A change to one rule can change which rule wins.
        if (!isStyle) page.markWinner();
        var preview = card.querySelector('[data-preview]');
        if (preview) preview.classList.toggle('preview--nomatch', !matched);

        card.querySelectorAll('.condition').forEach(function (row) {
          var cond = item.conditions[Number(row.dataset.index)];
          var dot = row.querySelector('[data-cond-match]');
          var hasValue = cond && String(cond.value || '').trim() !== '';
          var condMatches = hasValue && BCBuddy.testCondition(cond, ctx);
          var condLabel = hasValue ? t(condMatches ? 'conditionMatches' : 'conditionNoMatch') : '';
          // A RegEx that cannot run never matches; say why, or it looks like a
          // pattern that is merely wrong for this URL.
          var problem = hasValue && cond.op === 'regex'
            ? BCBuddy.regexProblem(String(cond.value).trim(), String(ctx[cond.field] || '').length)
            : '';
          if (problem) condLabel = t(problem === 'invalid' ? 'regexInvalid' : 'regexTooHeavy');
          var repeated = hasValue && page.repeatsCondition(item.conditions, Number(row.dataset.index));
          if (repeated) condLabel = t('conditionRepeated');
          var valueInput = row.querySelector('[data-cond="value"]');
          if (problem || repeated) {
            valueInput.setAttribute('aria-invalid', 'true');
            valueInput.title = condLabel;
          } else if (valueInput.hasAttribute('aria-invalid')) {
            valueInput.removeAttribute('aria-invalid');
            valueInput.removeAttribute('title');
          }
          dot.className = 'dot-indicator ' +
            (!hasValue ? '' : (condMatches ? 'dot-indicator--on' : 'dot-indicator--off'));
          dot.title = condLabel;
          // An empty condition says nothing; only a filled one is announced.
          if (condLabel) {
            dot.setAttribute('role', 'img');
            dot.setAttribute('aria-label', condLabel);
          } else {
            dot.removeAttribute('role');
            dot.removeAttribute('aria-label');
          }
        });

        // Favicon letters belong to the rule, and only when the style draws them.
        // A rule card has no other preview: that lives on the style, where display
        // settings are edited too.
        if (!isStyle) {
          card.querySelector('[data-favicon-letters]').hidden = !shown.favicon.enabled;
          return;
        }

        // Ribbon
        // Placeholders are filled in as a BC tab would for the borrowed rule.
        var extras = { name: source ? source.name : item.name, title: t('previewTitle') };
        var ribbon = card.querySelector('[data-preview-ribbon]');
        var brand = card.querySelector('[data-preview-brand]');
        var originalBrand = 'Dynamics 365 Business Central';
        if (shown.ribbon.enabled) {
          ribbon.style.background = color;
          ribbon.style.color = textColor;
          brand.textContent = BCBuddy.renderTidy(shown.ribbon.text, ctx, extras) || originalBrand;
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

        // Banner (bar or corner ribbon). The bar at the top has its own element
        // above the ribbon, and is always solid.
        var atTop = shown.banner.position === 'top';
        var topBar = card.querySelector('[data-preview-topbar]');
        topBar.hidden = !(shown.banner.enabled && atTop);
        if (!topBar.hidden) {
          topBar.style.background = color;
          topBar.style.color = textColor;
          topBar.textContent = BCBuddy.renderTidy(shown.banner.text || '{name}', ctx, extras);
        }
        var opacityField = card.querySelector('[data-banner-opacity]');
        if (opacityField) opacityField.hidden = atTop;
        var banner = card.querySelector('[data-preview-banner]');
        banner.className = 'preview__banner preview__banner--' + shown.banner.position +
          (shown.banner.enabled && !atTop ? ' preview__banner--visible' : '');
        if (shown.banner.enabled && !atTop) {
          // Business Central's page is white, whatever this page's theme: show
          // the colour it gets there, mixed with white, and its text colour.
          banner.style.background = BCBuddy.toHex(BCBuddy.blend(color, '#ffffff', shown.banner.opacity));
          banner.style.color = BCBuddy.idealText(color, shown.banner.opacity);
          banner.textContent = BCBuddy.renderTidy(shown.banner.text || '{name}', ctx, extras);
          // A fixed size is scaled like the rest of the preview (the bar to
          // about 0.85, the corner ribbon to about 0.5); automatic keeps the CSS size.
          var scale = shown.banner.position === 'bottom' ? 0.85 : 0.5;
          banner.style.fontSize = shown.banner.fontSize > 0
            ? Math.round(shown.banner.fontSize * scale * 2) / 2 + 'px' : '';
        }

        // Favicon: drawn only when it would look different.
        var favicon = card.querySelector('[data-preview-favicon]');
        if (shown.favicon.enabled) {
          // The same letters as a BC tab: the rule's own, else its name.
          var label = ((source ? (source.favicon && source.favicon.text) || source.name : item.name) || '').trim();
          var signature = color + '|' + label;
          if (favicon.dataset.signature !== signature) {
            favicon.dataset.signature = signature;
            var href = BCBuddy.drawFavicon(color, label);
            if (href) favicon.src = href;
            else favicon.removeAttribute('src');
          }
        }

        // A style is independent of conditions, so the ribbon is always shown.
        ribbon.hidden = false;

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
        return kind + ':' + (readOnly ? 'shared:' : 'own:') + item.id;
      };

      /**
       * The rule whose colour and name the style previews show: the one the
       * test URL gets, else none (BC's own teal).
       */
      page.sampleRule = function () {
        return page.matchedRule();
      };

      /** Same order as a BC tab and markWinner: own rules, then shared ones. */
      page.matchedRule = function () {
        var all = state.settings.rules.concat(state.settings.hosted.rules);
        for (var i = 0; i < all.length; i++) {
          if (BCBuddy.matchRule(all[i], state.ctx)) return all[i];
        }
        return null;
      };

      /** Redraws the style previews in place, so no style card loses focus. */
      page.refreshStylePreviews = function () {
        [[el.styleList, state.settings.styles], [el.hostedStyleList, state.settings.hosted.styles]]
          .forEach(function (pair) {
            pair[0].querySelectorAll('.rule').forEach(function (card) {
              var style = pair[1][Number(card.dataset.index)];
              if (style) page.updateCard(card, style);
            });
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
       * Turns a shared rule into an own copy. Its style comes along, otherwise the
       * copy would look different from the original.
       */
      page.copySharedRule = function (index) {
        var source = state.settings.hosted.rules[index];
        if (!source) return;

        var copy = BCBuddy.newRule(source);
        copy.name = source.name;
        copy.styleId = source.styleId;

        var copiedStyle = false;
        if (copy.styleId && !BCBuddy.findById(state.settings.styles, copy.styleId)) {
          var style = BCBuddy.findById(state.settings.hosted.styles, copy.styleId);
          if (style) {
            state.settings.styles.push(BCBuddy.normalizeStyle(style));
            copiedStyle = true;
          }
        }

        state.settings.rules.push(copy);
        state.expanded[page.expandKey('rule', copy, false)] = true;
        page.save();
        page.renderRules();
        page.renderStyles();
        page.renderParsed();
        page.setSamplesStatus(t('copiedToOwn', 1) + (copiedStyle ? t('copiedStyles', 1) : ''), 'ok');
      };

      page.onStyleAction = function (action, index) {
        var style = state.settings.styles[index];
        if (!style) return;

        if (action === 'delete') {
          // At least one style must remain, otherwise "follows the only style"
          // means nothing. A shared one counts: own rules can pick it.
          if (state.settings.styles.length + state.settings.hosted.styles.length < 2) {
            page.setStylesStatus(t('lastStyle'), 'error');
            return;
          }
          var used = page.styleUsage(style);
          if (!confirm(t('deleteStyleConfirm', [style.name, used]))) return;
          // Rules keep their own settings, which were never overwritten.
          state.settings.rules.forEach(function (rule) {
            if (rule.styleId === style.id) rule.styleId = '';
          });
          state.settings.styles.splice(index, 1);
        } else if (action === 'duplicate') {
          var copy = BCBuddy.newStyle(style);
          copy.name = t('copySuffix', style.name);
          state.settings.styles.splice(index + 1, 0, copy);
          state.expanded[page.expandKey('style', copy, false)] = true;
        } else {
          return;
        }

        page.save();
        page.renderStyles();
        page.renderRules();
        page.renderHosted();
        page.renderParsed();
      };

      /** The rule or style this card belongs to. */
      page.cardTarget = function (card) {
        var index = Number(card.dataset.index);
        return card.dataset.kind === 'style'
          ? state.settings.styles[index]
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

        // A style change affects every rule that uses it; redraw those cards while
        // the style card stays put so focus does not jump.
        if (card.dataset.kind === 'style') {
          page.renderRules();
          page.renderHosted();
          return;
        }

        // Conversely the style card depends on rules: how many are linked and which
        // colour the preview borrows.
        var path = pathInput && pathInput.dataset.path;
        if (path === 'styleId' || path === 'color') page.renderStyles();
      };

      page.onRuleClick = function (event) {
        var button = event.target.closest('[data-action]');
        var card = event.target.closest('.rule');
        if (!card) return;

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
        if (card.dataset.kind === 'style') {
          page.onStyleAction(button.dataset.action, index);
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
            // One empty condition at a time: while one waits for a value, or
            // repeats an earlier one, + goes there.
            var empty = -1;
            rule.conditions.forEach(function (cond, i) {
              if (empty === -1 && (!String(cond.value || '').trim() || page.repeatsCondition(rule.conditions, i))) {
                empty = i;
              }
            });
            if (empty === -1) {
              rule.conditions.push({ field: 'url', op: 'contains', value: '' });
              empty = rule.conditions.length - 1;
              page.renderConditions(card, rule);
              page.updateCard(card, rule);
              page.save();
            }
            var emptyRow = card.querySelectorAll('.condition')[empty];
            var emptyValue = emptyRow && emptyRow.querySelector('[data-cond="value"]');
            if (emptyValue) emptyValue.focus();
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
