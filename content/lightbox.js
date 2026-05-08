// content/lightbox.js — Full-screen overlay viewer
(function () {
  'use strict';

  var controller = null;
  var resizeObserver = null;
  var activationSource = null;
  var viewerState = null;
  var contentEl = null;
  var overlayEl = null;
  var toolbarEl = null;
  var open = false;

  var baseDims = null;
  var activeContentType = null;
  var activeSettings = null;

  function applyTransform() {
    if (!contentEl || !viewerState || !baseDims) return;
    if (activeContentType === 'table') {
      // Tables don't visually scale via width/height — use CSS transform scale
      var scaledW = baseDims.width * viewerState.scale;
      var scaledH = baseDims.height * viewerState.scale;
      var tx = -scaledW / 2 + viewerState.offsetX;
      var ty = -scaledH / 2 + viewerState.offsetY;
      contentEl.style.transformOrigin = '0 0';
      contentEl.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + viewerState.scale + ')';
    } else {
      var scaledW = baseDims.width * viewerState.scale;
      var scaledH = baseDims.height * viewerState.scale;
      contentEl.style.width = scaledW + 'px';
      contentEl.style.height = scaledH + 'px';
      // Use exact pixel offsets instead of translate(-50%,-50%) to avoid
      // sub-pixel rounding drift that accumulates across zoom steps
      var tx = -scaledW / 2 + viewerState.offsetX;
      var ty = -scaledH / 2 + viewerState.offsetY;
      contentEl.style.transform = 'translate(' + tx + 'px, ' + ty + 'px)';
    }
  }

  function getSvgDimensions(svg) {
    var vb = svg.getAttribute('viewBox');
    if (vb) {
      var parts = vb.split(/[\s,]+/).map(Number);
      if (parts.length === 4) return { width: parts[2], height: parts[3] };
    }
    var w = parseFloat(svg.getAttribute('width')) || svg.getBoundingClientRect().width || 300;
    var h = parseFloat(svg.getAttribute('height')) || svg.getBoundingClientRect().height || 150;
    return { width: w, height: h };
  }

  function getContentDimensions(diagram) {
    if (diagram.type === 'img') {
      var img = diagram.imgElement;
      return {
        width: img.naturalWidth || img.width || 300,
        height: img.naturalHeight || img.height || 150
      };
    }
    if (diagram.type === 'table') {
      var table = diagram.tableElement;
      var rect = table.getBoundingClientRect();
      return {
        width: table.offsetWidth || rect.width || 300,
        height: table.offsetHeight || rect.height || 150
      };
    }
    return getSvgDimensions(diagram.svgElement);
  }

  function createFocusTrap(container) {
    var focusable = container.querySelectorAll('button, [tabindex="0"]');
    if (focusable.length === 0) return;
    focusable[0].focus();

    container.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }, { signal: controller.signal });
  }

  function openLightbox(diagram, button) {
    if (open) closeLightbox();

    var Viewport = window.MViewViewport;
    var Theme = window.MViewTheme;

    controller = new AbortController();
    activationSource = button;
    open = true;

    // Load stored dark-mode preference before detecting theme
    var preferenceReady = Theme.loadDarkModePreference ? Theme.loadDarkModePreference() : Promise.resolve(null);

    preferenceReady.then(function () {
    overlayEl = document.createElement('div');
    overlayEl.className = 'mview-overlay';
    overlayEl.setAttribute('data-mview', 'true');

    var theme = Theme.detectTheme();
    overlayEl.classList.add(Theme.getThemeClass(theme));

    var backdrop = document.createElement('div');
    backdrop.className = 'mview-backdrop';
    backdrop.setAttribute('data-mview', 'true');

    var viewer = document.createElement('div');
    viewer.className = 'mview-viewer';
    viewer.setAttribute('data-mview', 'true');

    // Create content element (SVG clone, image, or table clone)
    var isImage = diagram.type === 'img';
    var isTable = diagram.type === 'table';
    var contentType = isTable ? 'table' : (isImage ? 'img' : 'svg');
    activeContentType = contentType;
    if (isTable) {
      contentEl = diagram.tableElement.cloneNode(true);
      if (typeof window.MViewExport !== 'undefined' && window.MViewExport.inlineComputedStyles) {
        window.MViewExport.inlineComputedStyles(diagram.tableElement, contentEl);
      }
      // Reset width/height — inlineComputedStyles may have copied a fixed
      // width from the page context (e.g. "width: 980px" from width:100%).
      // Without this the clone's box is wider than its content, and left-
      // aligned content within it causes a visual leftward offset.
      contentEl.style.width = 'auto';
      contentEl.style.height = 'auto';
    } else if (isImage) {
      contentEl = document.createElement('img');
      contentEl.src = diagram.imgElement.currentSrc || diagram.imgElement.src;
      contentEl.setAttribute('draggable', 'false');
    } else {
      contentEl = diagram.svgElement.cloneNode(true);
    }
    contentEl.setAttribute('data-mview', 'true');
    contentEl.style.position = 'absolute';
    contentEl.style.left = '50%';
    contentEl.style.top = '50%';
    contentEl.style.transformOrigin = '0 0';
    // Clear size constraints inherited from the page or Mermaid's own styles
    // (e.g. max-width: 800px) — without this, zooming past 1:1 causes drift
    // because the browser caps rendered width while our math assumes scaledW.
    contentEl.style.maxWidth = 'none';
    contentEl.style.maxHeight = 'none';
    contentEl.style.minWidth = '0';
    contentEl.style.minHeight = '0';
    // Clear margins that inlineComputedStyles may have copied from the page
    // (e.g. margin: 0 auto) — on absolutely-positioned elements margin still
    // offsets from left/top, breaking the centering math.
    contentEl.style.margin = '0';

    // Store base dimensions for vector-quality resizing
    var dims = getContentDimensions(diagram);
    baseDims = { width: dims.width, height: dims.height };

    viewer.appendChild(contentEl);
    overlayEl.appendChild(backdrop);
    overlayEl.appendChild(viewer);
    document.body.appendChild(overlayEl);

    // For tables, re-measure from the clone now that it's in the DOM —
    // the original table's offsetWidth may differ from the clone's actual
    // rendered width (different parent context, position: absolute, etc.)
    if (isTable) {
      var cloneW = contentEl.offsetWidth;
      var cloneH = contentEl.offsetHeight;
      if (cloneW && cloneH) {
        dims = { width: cloneW, height: cloneH };
        baseDims = { width: cloneW, height: cloneH };
      }
    }

    // Initialize ViewerState
    var rect = viewer.getBoundingClientRect();
    viewerState = Viewport.createViewerState(
      dims.width, dims.height,
      rect.width || window.innerWidth,
      rect.height || window.innerHeight
    );
    applyTransform();

    // Event listeners
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    }, { signal: controller.signal });

    // Scroll-wheel zoom (T015) — center-based zoom, pan to region of interest
    viewer.addEventListener('wheel', function (e) {
      e.preventDefault();
      var direction = e.deltaY < 0 ? 1 : -1;
      viewerState = Viewport.zoomAtPoint(viewerState, 0, 0, direction);
      applyTransform();
    }, { passive: false, signal: controller.signal });

    // Click-drag pan (T016)
    var isDragging = false;
    var dragMoved = false;
    var startX = 0, startY = 0;
    var lastX = 0, lastY = 0;

    viewer.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      isDragging = true;
      dragMoved = false;
      startX = lastX = e.clientX;
      startY = lastY = e.clientY;
      viewer.classList.add('mview-dragging');
      e.preventDefault();
    }, { signal: controller.signal });

    document.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      // 3px dead zone so mouse jitter during a click doesn't count as a drag
      if (!dragMoved) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (dx * dx + dy * dy < 9) return;
        dragMoved = true;
      }
      var deltaX = e.clientX - lastX;
      var deltaY = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      viewerState = Viewport.pan(viewerState, deltaX, deltaY);
      applyTransform();
    }, { signal: controller.signal });

    document.addEventListener('mouseup', function () {
      if (!isDragging) return;
      isDragging = false;
      viewer.classList.remove('mview-dragging');
      if (!dragMoved) closeLightbox();
    }, { signal: controller.signal });

    // ResizeObserver (T017)
    resizeObserver = new ResizeObserver(function (entries) {
      var entry = entries[0];
      if (entry && viewerState) {
        viewerState = Viewport.updateContainer(
          viewerState,
          entry.contentRect.width,
          entry.contentRect.height
        );
        applyTransform();
      }
    });
    resizeObserver.observe(viewer);

    // Live theme observation (T022/T023)
    Theme.observeThemeChanges(function (newTheme) {
      if (!overlayEl) return;
      var cls = Theme.getThemeClass(newTheme);
      overlayEl.classList.remove('mview-theme-dark', 'mview-theme-light');
      overlayEl.classList.add(cls);
      if (toolbarEl) {
        toolbarEl.classList.remove('mview-theme-dark', 'mview-theme-light');
        toolbarEl.classList.add(cls);
      }
    });

    // Toolbar (T018/T019) — created if toolbar module is available
    if (typeof window.MViewToolbar !== 'undefined') {
      var sourceElement = isTable ? diagram.tableElement : (isImage ? diagram.imgElement : diagram.svgElement);
      var toolbar = window.MViewToolbar.createToolbar({
        onZoomIn: function () {
          viewerState = Viewport.zoomByStep(viewerState, 1);
          applyTransform();
        },
        onZoomOut: function () {
          viewerState = Viewport.zoomByStep(viewerState, -1);
          applyTransform();
        },
        onFitToScreen: function () {
          viewerState = Viewport.fitToScreen(viewerState);
          applyTransform();
        },
        onCopyPng: function () {
          if (typeof window.MViewExport !== 'undefined') {
            window.MViewExport.copyPngToClipboard(sourceElement, viewerState.scale).then(function () {
              var btn = toolbar.querySelector('.mview-btn-copy');
              if (btn) {
                btn.classList.add('mview-copy-success');
                setTimeout(function () { btn.classList.remove('mview-copy-success'); }, 1000);
              }
            }).catch(function (err) {
              console.error('Expand: clipboard copy failed', err);
            });
          }
        },
        onExportPng: function () {
          if (typeof window.MViewExport !== 'undefined') {
            if (isTable) {
              window.MViewExport.downloadTablePng(sourceElement, undefined, viewerState.scale).catch(function (err) {
                console.error('Expand: table PNG export failed', err);
              });
            } else if (isImage) {
              window.MViewExport.downloadImage(sourceElement).catch(function (err) {
                console.error('Expand: image download failed', err);
              });
            } else {
              window.MViewExport.downloadPng(sourceElement, undefined, viewerState.scale).catch(function (err) {
                console.error('Expand: PNG export failed', err);
              });
            }
          }
        },
        onExportSvg: function () {
          if (isImage || isTable) return;
          if (typeof window.MViewExport !== 'undefined') {
            window.MViewExport.downloadSvg(sourceElement).catch(function (err) {
              console.error('Expand: SVG export failed', err);
            });
          }
        },
        onCopyHtml: function () {
          if (!isTable) return;
          if (typeof window.MViewExport !== 'undefined') {
            window.MViewExport.copyHtmlToClipboard(sourceElement).then(function () {
              var btn = toolbar.querySelector('.mview-btn-copy-html');
              if (btn) {
                btn.classList.add('mview-copy-success');
                setTimeout(function () { btn.classList.remove('mview-copy-success'); }, 1000);
              }
            }).catch(function (err) {
              console.error('Expand: HTML copy failed', err);
            });
          }
        },
        onCopyJson: function () {
          if (!isTable) return;
          if (typeof window.MViewExport !== 'undefined') {
            window.MViewExport.copyJsonToClipboard(sourceElement).then(function () {
              var btn = toolbar.querySelector('.mview-btn-copy-json');
              if (btn) {
                btn.classList.add('mview-copy-success');
                setTimeout(function () { btn.classList.remove('mview-copy-success'); }, 1000);
              }
            }).catch(function (err) {
              console.error('Expand: JSON copy failed', err);
            });
          }
        },
        onCopyJsonFlat: function () {
          if (!isTable) return;
          if (typeof window.MViewExport !== 'undefined') {
            window.MViewExport.copyJsonFlatToClipboard(sourceElement).then(function () {
              var btn = toolbar.querySelector('.mview-btn-copy-json-flat');
              if (btn) {
                btn.classList.add('mview-copy-success');
                setTimeout(function () { btn.classList.remove('mview-copy-success'); }, 1000);
              }
            }).catch(function (err) {
              console.error('Expand: JSON flat copy failed', err);
            });
          }
        },
        onClose: closeLightbox,
        onToggleTheme: function () {
          // Cycle: auto → dark → light → auto
          var current = Theme.getDarkModeOverride();
          var next;
          if (current === null) next = 'dark';
          else if (current === 'dark') next = 'light';
          else next = null;
          Theme.setDarkModeOverride(next);
          // Re-detect and apply theme
          var newTheme = Theme.detectTheme();
          var cls = Theme.getThemeClass(newTheme);
          overlayEl.classList.remove('mview-theme-dark', 'mview-theme-light');
          overlayEl.classList.add(cls);
          if (toolbarEl) {
            toolbarEl.classList.remove('mview-theme-dark', 'mview-theme-light');
            toolbarEl.classList.add(cls);
            window.MViewToolbar.updateThemeButton(toolbarEl, next);
          }
        }
      }, { contentType: contentType });
      toolbar.classList.add(Theme.getThemeClass(theme));
      // Set initial theme button state
      window.MViewToolbar.updateThemeButton(toolbar, Theme.getDarkModeOverride());
      toolbarEl = toolbar;
      // Toolbar appended to body so SVG stacking context can never overlap it
      document.body.appendChild(toolbar);
    }

    // Focus trap
    createFocusTrap(overlayEl);
    }); // end preferenceReady.then
  }

  function closeLightbox() {
    if (!open) return;
    open = false;

    if (controller) {
      controller.abort();
      controller = null;
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (typeof window.MViewTheme !== 'undefined') {
      window.MViewTheme.stopObserving();
    }

    // Remove overlay and toolbar from body
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    if (toolbarEl && toolbarEl.parentNode) {
      toolbarEl.parentNode.removeChild(toolbarEl);
    }
    overlayEl = null;
    toolbarEl = null;
    contentEl = null;
    viewerState = null;
    baseDims = null;
    activeContentType = null;

    if (activationSource) {
      activationSource.focus();
      activationSource = null;
    }
  }

  function isOpen() {
    return open;
  }

  // Initialization — detect diagrams and inject buttons
  function init() {
    var Detector = window.MViewDetector;
    if (!Detector) return;

    var Settings = window.MViewSettings;
    var settingsReady = Settings
      ? Settings.loadSettings()
      : Promise.resolve({
          diagrams: true,
          images: true,
          svgs: true,
          tables: true,
          enabled: true,
          hoverDelay: 0.7,
          minDiagramArea: 0,
          minImageSize: 64,
          minSvgArea: 2000
        });

    settingsReady.then(function (settings) {
      activeSettings = settings;

      applyHoverDelay(settings.hoverDelay);

      if (settings.enabled !== false) {
        scanAndInject(Detector, settings);
      }

      // GitHub viewscreen iframe support — listen for SVGs posted from
      // viewscreen-bridge.js running inside cross-origin iframes
      if (settings.diagrams && Detector.listenForViewscreenDiagrams) {
        Detector.listenForViewscreenDiagrams(function (newDiagrams) {
          if (!activeSettings) return;
          if (activeSettings.enabled === false || !activeSettings.diagrams) return;
          Detector.injectActivationButtons(newDiagrams, activeSettings);
        });
        // Ping any already-loaded viewscreen iframes
        Detector.requestViewscreenSvgs();
      }

      // Dynamic content detection (T024/T025)
      Detector.startObserver(function () {
        if (!activeSettings) return;
        if (activeSettings.enabled === false) return;
        if (activeSettings.diagrams) {
          var newDiagrams = Detector.scanForDiagrams(activeSettings);
          Detector.injectActivationButtons(newDiagrams, activeSettings);
        }
        if (activeSettings.images) {
          var newImages = Detector.scanForImages(activeSettings);
          Detector.injectActivationButtons(newImages, activeSettings);
        }
        if (activeSettings.svgs) {
          var newSvgs = Detector.scanForSvgs(activeSettings);
          Detector.injectActivationButtons(newSvgs, activeSettings);
        }
        if (activeSettings.tables) {
          var newTables = Detector.scanForTables();
          Detector.injectActivationButtons(newTables, activeSettings);
        }
        // Ping newly appeared viewscreen iframes immediately, and again after
        // a delay — the iframe might not have loaded when first added to the DOM
        if (activeSettings.diagrams && Detector.requestViewscreenSvgs) {
          Detector.requestViewscreenSvgs();
          setTimeout(Detector.requestViewscreenSvgs, 1500);
        }
      });

      // Re-scan for images/tables after all resources are loaded — catches
      // images whose naturalWidth was 0 at initial scan time
      window.addEventListener('load', function () {
        if (!activeSettings) return;
        if (activeSettings.enabled === false) return;
        if (activeSettings.images) {
          var lateImages = Detector.scanForImages(activeSettings);
          Detector.injectActivationButtons(lateImages, activeSettings);
        }
        if (activeSettings.tables) {
          var lateTables = Detector.scanForTables();
          Detector.injectActivationButtons(lateTables, activeSettings);
        }
      });

      // Listen for live settings changes from the popup
      listenForSettingsChanges(Detector);
    });
  }

  function scanAndInject(Detector, settings) {
    if (settings.diagrams) {
      var diagrams = Detector.scanForDiagrams(settings);
      Detector.injectActivationButtons(diagrams, settings);
    }
    if (settings.images) {
      var images = Detector.scanForImages(settings);
      Detector.injectActivationButtons(images, settings);
    }
    if (settings.svgs) {
      var svgs = Detector.scanForSvgs(settings);
      Detector.injectActivationButtons(svgs, settings);
    }
    if (settings.tables) {
      var tables = Detector.scanForTables();
      Detector.injectActivationButtons(tables, settings);
    }
  }

  function applyHoverDelay(delay) {
    var val = (delay != null ? delay : 0.7) + 's';
    document.documentElement.style.setProperty('--mview-hover-delay', val);
  }

  function removeButtonsAndWrappers() {
    // Remove all activation buttons
    var buttons = document.querySelectorAll('[data-mview].mview-activation-btn');
    buttons.forEach(function (btn) { btn.remove(); });
    // Unwrap image wrappers
    var imgWrappers = document.querySelectorAll('[data-mview-img-wrap]');
    imgWrappers.forEach(function (wrap) {
      while (wrap.firstChild) {
        wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      }
      wrap.remove();
    });
    // Unwrap table wrappers
    var tableWrappers = document.querySelectorAll('[data-mview-table-wrap]');
    tableWrappers.forEach(function (wrap) {
      while (wrap.firstChild) {
        wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      }
      wrap.remove();
    });
    // Unwrap SVG wrappers
    var svgWrappers = document.querySelectorAll('[data-mview-svg-wrap]');
    svgWrappers.forEach(function (wrap) {
      while (wrap.firstChild) {
        wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      }
      wrap.remove();
    });
  }

  function listenForSettingsChanges(Detector) {
    var storage = typeof chrome !== 'undefined' && chrome.storage;
    if (!storage || !storage.onChanged) return;
    storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes.mviewSettings) return;
      var newVal = changes.mviewSettings.newValue || {};
      activeSettings = {
        diagrams: newVal.diagrams !== false,
        images: newVal.images !== false,
        svgs: newVal.svgs !== false,
        tables: newVal.tables !== false,
        enabled: newVal.enabled !== false,
        minDiagramArea: newVal.minDiagramArea != null ? Number(newVal.minDiagramArea) : 0,
        minImageSize: newVal.minImageSize != null ? Number(newVal.minImageSize) : 64,
        minSvgArea: newVal.minSvgArea != null ? Number(newVal.minSvgArea) : 2000,
        hoverDelay: newVal.hoverDelay != null ? Number(newVal.hoverDelay) : 0.7
      };
      applyHoverDelay(activeSettings.hoverDelay);
      // Close the lightbox if open — the content may no longer be enabled
      if (open) closeLightbox();
      // Remove existing buttons/wrappers and rescan with new settings
      removeButtonsAndWrappers();
      if (activeSettings.enabled) {
        scanAndInject(Detector, activeSettings);
        if (activeSettings.diagrams && Detector.requestViewscreenSvgs) {
          Detector.requestViewscreenSvgs();
        }
      }
    });
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var exports = {
    openLightbox: openLightbox,
    closeLightbox: closeLightbox,
    isOpen: isOpen
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof window !== 'undefined') {
    window.MViewLightbox = exports;
  }
})();
