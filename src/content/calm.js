// Turn off animations
//
// BC does not honour `prefers-reduced-motion`. The content script sets
// `data-bcb-calm` on `<html>` in every frame, once, and two pieces do the rest:
//
// - `content.css` shortens CSS transitions and animations to `0.01ms` (not
//   `none`, so `transitionend` and `animationend` still fire) and zeroes their
//   delays. It targets stable classes only: `.animate`, the `ms-nav-layout-*`
//   regions that Maximize and the FactBox pane move, FastTab captions and
//   fields. The busy indicator and spinners are left out.
// - FastTabs slide with `element.animate()` (500 ms on `margin-top`), and BC
//   waits for it to finish before it marks the FastTab open or closed.
//   `calm.js` runs in the page's own world (`"world": "MAIN"`, Chrome 111+) and
//   wraps `Element.prototype.animate` to use a duration of 0 while the
//   attribute is set; animations with infinite iterations keep their timing.
//   It patches nothing until the attribute first appears, so other sites only
//   carry one attribute-filtered observer on `<html>`.
//
// Runtime cost: one attribute per frame, class-keyed CSS, and one
// `hasAttribute` per `animate()` call (on a card, only FastTab toggles call it).

/*
 * BC Buddy - turn off animations, page side.
 *
 * Runs in the page's own world (MAIN), because BC's FastTabs slide with
 * element.animate() and only the page can see its Element.prototype. BC
 * waits for that 500ms animation to finish before it marks a FastTab open or
 * closed; with a duration of 0 it finishes on the next frame.
 *
 * Nothing is patched until the content script sets data-bcb-calm on <html>,
 * which it does only on Business Central pages with the switch on. Other
 * sites only get one attribute-filtered observer on <html>, which never fires.
 * Once patched, each animate() call reads that attribute, so switching the
 * feature off restores BC's own timing at once. Animations that repeat
 * forever (progress indicators) keep their timing.
 */
(function () {
  'use strict';

  var ATTR = 'data-bcb-calm';
  var root = document.documentElement;
  var proto = window.Element && Element.prototype;
  if (!root || !proto || typeof proto.animate !== 'function') return;

  function instant(options) {
    if (typeof options === 'number') return 0;
    if (!options || options.iterations === Infinity) return options;
    var copy = {};
    for (var key in options) copy[key] = options[key];
    copy.duration = 0;
    copy.delay = 0;
    copy.endDelay = 0;
    return copy;
  }

  function install() {
    var original = proto.animate;
    proto.animate = function animate(keyframes, options) {
      if (document.documentElement.hasAttribute(ATTR)) options = instant(options);
      return original.call(this, keyframes, options);
    };
  }

  if (root.hasAttribute(ATTR)) {
    install();
    return;
  }
  var observer = new MutationObserver(function () {
    if (!root.hasAttribute(ATTR)) return;
    observer.disconnect();
    install();
  });
  observer.observe(root, { attributes: true, attributeFilter: [ATTR] });
})();
