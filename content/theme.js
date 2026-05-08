// content/theme.js — Theme detection and observation module
(function () {
  'use strict';

  var themeObserver = null;
  var mediaQueryListener = null;
  var mediaQuery = null;
  var darkModeOverride = null; // null = auto, 'light' = force light, 'dark' = force dark

  function linearize(channel) {
    var c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(r, g, b) {
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  }

  function parseColor(colorStr) {
    var match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return { r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10) };
    }
    return { r: 255, g: 255, b: 255 };
  }

  function detectTheme() {
    // If user has set a manual override, honour it
    if (darkModeOverride === 'light') {
      return { mode: 'light', source: 'user-override' };
    }
    if (darkModeOverride === 'dark') {
      return { mode: 'dark', source: 'user-override' };
    }

    // Tier 1: GitHub attribute
    var colorMode = document.documentElement.getAttribute('data-color-mode');
    if (colorMode === 'dark') {
      return { mode: 'dark', source: 'github-attr' };
    }
    if (colorMode === 'light') {
      return { mode: 'light', source: 'github-attr' };
    }

    // Tier 2: Page background luminance — reflects how diagrams were actually rendered
    if (document.body) {
      var bg = window.getComputedStyle(document.body).backgroundColor;
      var color = parseColor(bg);
      // Skip transparent/default backgrounds (r=255,g=255,b=255 with no explicit style)
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        var lum = relativeLuminance(color.r, color.g, color.b);
        return { mode: lum < 0.5 ? 'dark' : 'light', source: 'luminance' };
      }
    }

    // Tier 3: OS preference as last resort
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return { mode: 'dark', source: 'media-query' };
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return { mode: 'light', source: 'media-query' };
    }

    return { mode: 'light', source: 'default' };
  }

  function getThemeClass(theme) {
    return theme.mode === 'dark' ? 'expand-theme-dark' : 'expand-theme-light';
  }

  function observeThemeChanges(callback) {
    stopObserving();

    // Watch GitHub data-color-mode attribute
    themeObserver = new MutationObserver(function () {
      callback(detectTheme());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-mode', 'data-dark-theme']
    });

    // Watch prefers-color-scheme changes
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQueryListener = function () {
      callback(detectTheme());
    };
    mediaQuery.addEventListener('change', mediaQueryListener);
  }

  function stopObserving() {
    if (themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }
    if (mediaQuery && mediaQueryListener) {
      mediaQuery.removeEventListener('change', mediaQueryListener);
      mediaQuery = null;
      mediaQueryListener = null;
    }
  }

  /**
   * Set dark-mode override.
   * @param {string|null} mode — 'dark', 'light', or null for auto-detect
   */
  function setDarkModeOverride(mode) {
    darkModeOverride = mode;
    // Persist to extension storage when available
    var storage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    if (storage) {
      storage.set({ expandDarkMode: mode });
    }
  }

  /**
   * Return current override value: 'dark', 'light', or null (auto).
   */
  function getDarkModeOverride() {
    return darkModeOverride;
  }

  /**
   * Load dark-mode preference from storage.
   * Returns a Promise that resolves to the loaded mode.
   */
  function loadDarkModePreference() {
    var storage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    if (!storage) {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      storage.get('expandDarkMode', function (result) {
        var mode = result && result.expandDarkMode != null ? result.expandDarkMode : null;
        darkModeOverride = mode;
        resolve(mode);
      });
    });
  }

  var exports = {
    detectTheme: detectTheme,
    getThemeClass: getThemeClass,
    observeThemeChanges: observeThemeChanges,
    stopObserving: stopObserving,
    setDarkModeOverride: setDarkModeOverride,
    getDarkModeOverride: getDarkModeOverride,
    loadDarkModePreference: loadDarkModePreference
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof window !== 'undefined') {
    window.ExpandTheme = exports;
  }
})();
