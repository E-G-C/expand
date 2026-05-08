// popup/popup.js — Settings popup logic
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

  var toggleDiagrams = document.getElementById('toggle-diagrams');
  var toggleImages = document.getElementById('toggle-images');
  var toggleSvgs = document.getElementById('toggle-svgs');
  var toggleTables = document.getElementById('toggle-tables');
  var toggleEnabled = document.getElementById('toggle-enabled');
  var dependentControls = document.getElementById('expand-dependent-controls');
  var thresholdDiagramArea = document.getElementById('threshold-diagram-area');
  var thresholdImageSize = document.getElementById('threshold-image-size');
  var thresholdSvgArea = document.getElementById('threshold-svg-area');
  var rangeHoverDelay = document.getElementById('range-hover-delay');
  var delayValue = document.getElementById('delay-value');

  function readNumber(value, fallback) {
    var num = Number(value);
    return isFinite(num) && num >= 0 ? num : fallback;
  }

  function updateEnabledState() {
    var disabled = !toggleEnabled.checked;
    dependentControls.classList.toggle('is-disabled', disabled);
    rangeHoverDelay.disabled = disabled;
    rangeHoverDelay.closest('.expand-range').classList.toggle('is-disabled', disabled);
    dependentControls.querySelectorAll('input').forEach(function (input) {
      input.disabled = disabled;
    });
    [
      { toggle: toggleDiagrams, input: thresholdDiagramArea },
      { toggle: toggleImages, input: thresholdImageSize },
      { toggle: toggleSvgs, input: thresholdSvgArea }
    ].forEach(function (item) {
      var inputDisabled = disabled || !item.toggle.checked;
      item.input.disabled = inputDisabled;
      item.input.closest('.expand-number').classList.toggle('is-disabled', !disabled && inputDisabled);
    });
  }

  // Load current settings and set checkbox states
  chrome.storage.local.get(STORAGE_KEY, function (result) {
    var settings = result[STORAGE_KEY] || DEFAULTS;
    toggleDiagrams.checked = settings.diagrams !== false;
    toggleImages.checked = settings.images !== false;
    toggleSvgs.checked = settings.svgs !== false;
    toggleTables.checked = settings.tables !== false;
    toggleEnabled.checked = settings.enabled !== false;
    thresholdDiagramArea.value = readNumber(settings.minDiagramArea, DEFAULTS.minDiagramArea);
    thresholdImageSize.value = readNumber(settings.minImageSize, DEFAULTS.minImageSize);
    thresholdSvgArea.value = readNumber(settings.minSvgArea, DEFAULTS.minSvgArea);
    var delay = settings.hoverDelay != null ? settings.hoverDelay : 0.7;
    rangeHoverDelay.value = delay;
    delayValue.textContent = delay + 's';
    updateEnabledState();
  });

  function saveSettings() {
    var settings = {
      diagrams: toggleDiagrams.checked,
      images: toggleImages.checked,
      svgs: toggleSvgs.checked,
      tables: toggleTables.checked,
      enabled: toggleEnabled.checked,
      minDiagramArea: readNumber(thresholdDiagramArea.value, DEFAULTS.minDiagramArea),
      minImageSize: readNumber(thresholdImageSize.value, DEFAULTS.minImageSize),
      minSvgArea: readNumber(thresholdSvgArea.value, DEFAULTS.minSvgArea),
      hoverDelay: parseFloat(rangeHoverDelay.value)
    };
    var data = {};
    data[STORAGE_KEY] = settings;
    chrome.storage.local.set(data);
  }

  toggleDiagrams.addEventListener('change', function () {
    updateEnabledState();
    saveSettings();
  });
  toggleImages.addEventListener('change', function () {
    updateEnabledState();
    saveSettings();
  });
  toggleSvgs.addEventListener('change', function () {
    updateEnabledState();
    saveSettings();
  });
  toggleTables.addEventListener('change', saveSettings);
  toggleEnabled.addEventListener('change', function () {
    updateEnabledState();
    saveSettings();
  });
  thresholdDiagramArea.addEventListener('change', saveSettings);
  thresholdImageSize.addEventListener('change', saveSettings);
  thresholdSvgArea.addEventListener('change', saveSettings);
  thresholdDiagramArea.addEventListener('input', function () {
    if (thresholdDiagramArea.value !== '') saveSettings();
  });
  thresholdImageSize.addEventListener('input', function () {
    if (thresholdImageSize.value !== '') saveSettings();
  });
  thresholdSvgArea.addEventListener('input', function () {
    if (thresholdSvgArea.value !== '') saveSettings();
  });
  rangeHoverDelay.addEventListener('input', function () {
    delayValue.textContent = rangeHoverDelay.value + 's';
    saveSettings();
  });
})();
