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
