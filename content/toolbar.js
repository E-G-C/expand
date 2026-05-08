// content/toolbar.js — Toolbar creation with button actions and accessibility
(function () {
  'use strict';

  // Inline SVG paths — external <use href> doesn't work in content scripts
  var ICONS = {
    'icon-zoom-in': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
    'icon-zoom-out': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>',
    'icon-fit': '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
    'icon-copy': '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    'icon-export-png': '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2" fill="currentColor" stroke="none"/><path d="M22 15l-5-5-3 3-3-3-9 9v1a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5z" fill="currentColor" opacity="0.3" stroke="none"/>',
    'icon-export-svg': '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="14" y1="4" x2="10" y2="20"/>',
    'icon-close': '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'icon-theme-dark': '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    'icon-theme-light': '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    'icon-theme-auto': '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none"/>',
    'icon-copy-html': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 12 8 15 10 18"/><polyline points="14 12 16 15 14 18"/>',
    'icon-copy-json': '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 1 2 2 2 2 0 0 1-2 2v5a2 2 0 0 1-2 2h-1"/>',
    'icon-copy-json-flat': '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>'
  };

  function createIcon(symbolId) {
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[symbolId] || '';
    return svg;
  }

  function createButton(label, cssClass, iconId, onClick) {
    var btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('tabindex', '0');
    btn.className = cssClass;
    btn.appendChild(createIcon(iconId));
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  function createSeparator() {
    var sep = document.createElement('div');
    sep.className = 'expand-toolbar-separator';
    sep.setAttribute('aria-hidden', 'true');
    return sep;
  }

  function createToolbar(callbacks, options) {
    options = options || {};
    var contentType = options.contentType || (options.hideSvgExport ? 'img' : 'svg');
    var isTable = contentType === 'table';

    var toolbar = document.createElement('div');
    toolbar.className = 'expand-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('data-expand', 'true');
    var ariaLabels = { svg: 'Diagram viewer controls', img: 'Image viewer controls', table: 'Table viewer controls' };
    toolbar.setAttribute('aria-label', ariaLabels[contentType] || 'Viewer controls');

    // View buttons
    toolbar.appendChild(createButton('Zoom in', 'expand-btn-zoom-in', 'icon-zoom-in', callbacks.onZoomIn));
    toolbar.appendChild(createButton('Zoom out', 'expand-btn-zoom-out', 'icon-zoom-out', callbacks.onZoomOut));
    toolbar.appendChild(createButton('Fit to screen', 'expand-btn-fit', 'icon-fit', callbacks.onFitToScreen));

    // Separator
    toolbar.appendChild(createSeparator());

    // Export buttons — vary by content type
    if (isTable) {
      toolbar.appendChild(createButton('Copy as HTML', 'expand-btn-copy-html expand-btn-copy', 'icon-copy-html', callbacks.onCopyHtml || function () {}));
    }
    toolbar.appendChild(createButton('Copy as PNG', 'expand-btn-copy' + (isTable ? ' expand-btn-copy-png' : ''), 'icon-copy', callbacks.onCopyPng));
    toolbar.appendChild(createButton('Download as PNG', 'expand-btn-export-png', 'icon-export-png', callbacks.onExportPng));
    if (contentType === 'svg') {
      toolbar.appendChild(createButton('Download as SVG', 'expand-btn-export-svg', 'icon-export-svg', callbacks.onExportSvg));
    }
    if (isTable) {
      toolbar.appendChild(createButton('Copy as JSON', 'expand-btn-copy-json expand-btn-copy', 'icon-copy-json', callbacks.onCopyJson || function () {}));
      toolbar.appendChild(createButton('Copy as JSON (flat)', 'expand-btn-copy-json-flat expand-btn-copy', 'icon-copy-json-flat', callbacks.onCopyJsonFlat || function () {}));
    }

    // Separator before theme toggle
    toolbar.appendChild(createSeparator());

    // Theme toggle button — icon and label are updated dynamically
    var themeBtn = createButton('Toggle dark mode', 'expand-btn-theme', 'icon-theme-auto', callbacks.onToggleTheme || function () {});
    toolbar.appendChild(themeBtn);

    // Separator before close
    toolbar.appendChild(createSeparator());

    // Close button
    toolbar.appendChild(createButton('Close viewer', 'expand-btn-close', 'icon-close', callbacks.onClose));

    return toolbar;
  }

  /**
   * Update the theme toggle button to reflect the current mode.
   * @param {HTMLElement} toolbar — the toolbar element
   * @param {string|null} mode — 'dark', 'light', or null (auto)
   */
  function updateThemeButton(toolbar, mode) {
    var btn = toolbar.querySelector('.expand-btn-theme');
    if (!btn) return;
    var iconId, label;
    if (mode === 'dark') {
      iconId = 'icon-theme-dark';
      label = 'Dark mode (click to switch to light)';
    } else if (mode === 'light') {
      iconId = 'icon-theme-light';
      label = 'Light mode (click to switch to auto)';
    } else {
      iconId = 'icon-theme-auto';
      label = 'Auto theme (click to switch to dark)';
    }
    btn.setAttribute('aria-label', label);
    // Replace icon SVG
    var oldSvg = btn.querySelector('svg');
    if (oldSvg) {
      var newSvg = createIcon(iconId);
      btn.replaceChild(newSvg, oldSvg);
    }
  }

  var exports = {
    createToolbar: createToolbar,
    updateThemeButton: updateThemeButton
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof window !== 'undefined') {
    window.ExpandToolbar = exports;
  }
})();
