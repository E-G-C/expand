// content/settings.js — User settings loader
(function () {
  'use strict';

  var DEFAULTS = {
    diagrams: true,
    images: true,
    svgs: true,
    tables: true,
    enabled: true,
    hoverDelay: 0.7,
    minDiagramArea: 0,
    minImageSize: 64,
    minSvgArea: 2000
  };
  var STORAGE_KEY = 'expandSettings';

  function readNumber(stored, key, fallback) {
    var value = stored && stored[key] != null ? Number(stored[key]) : fallback;
    return isFinite(value) && value >= 0 ? value : fallback;
  }

  function loadSettings() {
    var storage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    if (!storage) {
      return Promise.resolve(DEFAULTS);
    }
    return new Promise(function (resolve) {
      storage.get(STORAGE_KEY, function (result) {
        var stored = result && result[STORAGE_KEY];
        resolve({
          diagrams: stored ? stored.diagrams !== false : true,
          images: stored ? stored.images !== false : true,
          svgs: stored ? stored.svgs !== false : true,
          tables: stored ? stored.tables !== false : true,
          enabled: stored ? stored.enabled !== false : true,
          minDiagramArea: readNumber(stored, 'minDiagramArea', DEFAULTS.minDiagramArea),
          minImageSize: readNumber(stored, 'minImageSize', DEFAULTS.minImageSize),
          minSvgArea: readNumber(stored, 'minSvgArea', DEFAULTS.minSvgArea),
          hoverDelay: stored && stored.hoverDelay != null ? Number(stored.hoverDelay) : 0.7
        });
      });
    });
  }

  var exports = {
    loadSettings: loadSettings,
    DEFAULTS: DEFAULTS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof window !== 'undefined') {
    window.ExpandSettings = exports;
  }
})();
