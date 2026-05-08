// content/detector.js — Content detection and activation button injection
(function () {
  'use strict';

  var mutationObserver = null;
  var debounceTimer = null;

  var DEFAULT_MIN_IMG_SIZE = 64;
  var DEFAULT_MIN_SVG_AREA = 2000;
  var DEFAULT_MIN_DIAGRAM_AREA = 0;
  var COMPACT_THRESHOLD = 120;

  // Selector matching elements that are themselves interactive. Wrapping a
  // candidate that lives inside one of these would (a) disrupt the host's
  // layout and (b) produce nested <button> elements (invalid HTML5 that
  // breaks click/focus on the outer control). See fix/skip-interactive-ancestors.
  var INTERACTIVE_ANCESTOR_SELECTOR =
    'a[href], button, summary, label, select, ' +
    '[role="button"], [role="link"], [role="menuitem"], ' +
    '[role="menuitemcheckbox"], [role="menuitemradio"], ' +
    '[role="tab"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"], ' +
    '[contenteditable=""], [contenteditable="true"]';

  function isInsideInteractive(el) {
    if (!el || !el.closest) return false;
    return el.closest(INTERACTIVE_ANCESTOR_SELECTOR) != null;
  }

  var KNOWN_DIAGRAM_TYPES = [
    'flowchart', 'sequence', 'classDiagram', 'stateDiagram',
    'gantt', 'pie', 'er', 'journey', 'gitGraph',
    'mindmap', 'timeline', 'quadrant', 'sankey', 'xychart'
  ];

  var SITE_SELECTORS = [
    '.js-mermaid-viewer > svg',
    '.mermaid > svg',
    '[data-mermaid] > svg',
    'pre[lang="mermaid"] + div > svg',
    // GitHub inline rendering (when enrichment injects SVG directly, not via iframe)
    'section[data-type="mermaid"] .js-render-enrichment-target > svg'
  ];

  var HEURISTIC_CLASSES = [
    'flowchart', 'node', 'edgePaths', 'cluster',
    'sequence', 'classDiagram', 'stateDiagram'
  ];

  function findContainer(svg) {
    // For GitHub enrichment sections, use the section as the container
    var section = svg.closest && svg.closest('section[data-type="mermaid"]');
    if (section) return section;
    return svg.parentElement || svg;
  }

  function readThreshold(value, fallback) {
    var num = Number(value);
    return isFinite(num) && num >= 0 ? num : fallback;
  }

  function getThresholds(settings) {
    settings = settings || {};
    return {
      minDiagramArea: readThreshold(settings.minDiagramArea, DEFAULT_MIN_DIAGRAM_AREA),
      minImageSize: readThreshold(settings.minImageSize, DEFAULT_MIN_IMG_SIZE),
      minSvgArea: readThreshold(settings.minSvgArea, DEFAULT_MIN_SVG_AREA)
    };
  }

  function getRenderedRect(el) {
    if (!el || !el.getBoundingClientRect) {
      return { width: 0, height: 0 };
    }
    return el.getBoundingClientRect();
  }

  function passesAreaThreshold(el, minArea) {
    if (!minArea) return true;
    var rect = getRenderedRect(el);
    if (!rect.width && !rect.height) return false;
    return rect.width * rect.height >= minArea;
  }

  function isDiagramResult(diagram) {
    return diagram.type === 'svg' && diagram.detectionTier !== 6;
  }

  function passesDiagramThreshold(diagram, thresholds) {
    if (!isDiagramResult(diagram)) return true;
    if (!thresholds.minDiagramArea) return true;
    if (passesAreaThreshold(diagram.svgElement, thresholds.minDiagramArea)) return true;
    return passesAreaThreshold(diagram.container, thresholds.minDiagramArea);
  }

  function scanForDiagrams(settings) {
    var thresholds = getThresholds(settings);
    var seen = new Set();
    var results = [];

    function addResult(svg, tier) {
      if (seen.has(svg)) return;
      if (isInsideInteractive(svg)) return;
      if (!passesAreaThreshold(svg, thresholds.minDiagramArea)) return;
      seen.add(svg);
      results.push({
        svgElement: svg,
        imgElement: null,
        tableElement: null,
        container: findContainer(svg),
        type: 'svg',
        detectionTier: tier,
        sourceText: null
      });
    }

    // Tier 1: aria-roledescription
    var allSvgs = document.querySelectorAll('svg[aria-roledescription]');
    allSvgs.forEach(function (svg) {
      var role = svg.getAttribute('aria-roledescription');
      if (KNOWN_DIAGRAM_TYPES.indexOf(role) !== -1) {
        addResult(svg, 1);
      }
    });

    // Tier 2: ID prefix mermaid- or dmermaid-
    document.querySelectorAll('svg[id^="mermaid-"], svg[id^="dmermaid-"]').forEach(function (svg) {
      addResult(svg, 2);
    });

    // Tier 3: Site-specific container selectors
    SITE_SELECTORS.forEach(function (selector) {
      try {
        document.querySelectorAll(selector).forEach(function (svg) {
          if (svg.tagName.toLowerCase() === 'svg') {
            addResult(svg, 3);
          }
        });
      } catch (e) {
        // Invalid selector — skip
      }
    });

    // Tier 4: Internal class heuristics
    document.querySelectorAll('svg').forEach(function (svg) {
      if (seen.has(svg)) return;
      var hasRole = svg.getAttribute('role');
      if (hasRole && hasRole.indexOf('graphics-document') !== -1) {
        addResult(svg, 4);
        return;
      }
      var children = svg.querySelectorAll('[class]');
      for (var i = 0; i < children.length; i++) {
        var cls = children[i].getAttribute('class') || '';
        for (var j = 0; j < HEURISTIC_CLASSES.length; j++) {
          if (cls.indexOf(HEURISTIC_CLASSES[j]) !== -1) {
            addResult(svg, 4);
            return;
          }
        }
      }
    });

    // Tier 5: Shadow DOM (e.g., MkDocs Material wraps SVGs in closed shadow roots)
    // shadow-accessor.js forces open mode so we can reach inside.
    document.querySelectorAll('.mermaid').forEach(function (el) {
      if (!el.shadowRoot) return;
      if (isInsideInteractive(el)) return;
      var svg = el.shadowRoot.querySelector('svg');
      if (!svg) return;
      if (seen.has(svg)) return;
      if (!passesAreaThreshold(svg, thresholds.minDiagramArea)) return;
      seen.add(svg);
      // Wrap host element for button placement — shadow DOM hides
      // light DOM children, so we need an outer container for the button.
      var container = el.parentElement;
      if (container && container.hasAttribute('data-expand-shadow-wrap')) {
        // Already wrapped from a previous scan
      } else {
        container = document.createElement('div');
        container.setAttribute('data-expand-shadow-wrap', 'true');
        container.setAttribute('data-expand', 'true');
        container.style.position = 'relative';
        el.parentNode.insertBefore(container, el);
        container.appendChild(el);
      }
      results.push({
        svgElement: svg,
        imgElement: null,
        tableElement: null,
        container: container,
        type: 'svg',
        detectionTier: 5,
        sourceText: null
      });
    });

    return results;
  }

  function scanForImages(settings) {
    var minImageSize = getThresholds(settings).minImageSize;
    var results = [];
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      // Skip our own injected elements
      if (img.hasAttribute('data-expand')) continue;
      if (img.closest && img.closest('[data-expand]')) continue;
      // Skip images that live inside interactive controls (button, link, etc.)
      if (isInsideInteractive(img)) continue;
      // Skip images that haven't loaded or are below size threshold
      if (!img.complete || !img.naturalWidth) continue;
      if (img.naturalWidth < minImageSize || img.naturalHeight < minImageSize) continue;
      var rect = img.getBoundingClientRect();
      var renderedWidth = img.offsetWidth || rect.width || 0;
      var renderedHeight = img.offsetHeight || rect.height || 0;
      // Skip invisible images and small UI assets backed by large source files
      if (!renderedWidth && !renderedHeight) continue;
      if (renderedWidth < minImageSize || renderedHeight < minImageSize) continue;
      // Skip if already wrapped
      if (img.parentElement && img.parentElement.hasAttribute('data-expand-img-wrap')) continue;

      var isCompact = renderedWidth < COMPACT_THRESHOLD || renderedHeight < COMPACT_THRESHOLD;

      var wrapper = document.createElement('span');
      wrapper.setAttribute('data-expand', 'true');
      wrapper.setAttribute('data-expand-img-wrap', 'true');
      if (isCompact) wrapper.classList.add('expand-compact');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);

      results.push({
        svgElement: null,
        imgElement: img,
        tableElement: null,
        container: wrapper,
        type: 'img',
        detectionTier: 0,
        sourceText: null
      });
    }
    return results;
  }

  function scanForSvgs(settings) {
    var minSvgArea = getThresholds(settings).minSvgArea;
    var results = [];
    var svgs = document.querySelectorAll('svg');
    for (var i = 0; i < svgs.length; i++) {
      var svg = svgs[i];
      // Skip our own injected elements (toolbar icons, etc.)
      if (svg.hasAttribute('data-expand')) continue;
      if (svg.closest && svg.closest('[data-expand]')) continue;
      // Skip SVGs that live inside interactive controls (icon buttons, etc.)
      if (isInsideInteractive(svg)) continue;
      // Skip nested SVGs inside other SVGs
      if (svg.parentElement && svg.parentElement.closest && svg.parentElement.closest('svg')) continue;
      // Skip SVGs already detected as Mermaid diagrams (have activation button in container)
      var parent = svg.parentElement;
      if (parent && parent.querySelector && parent.querySelector('.expand-activation-btn')) continue;
      // Skip invisible/off-screen SVGs (use getBoundingClientRect — offsetWidth is unreliable for SVGElement)
      var rect = svg.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      // Skip SVGs below size threshold (area-based to allow wide-but-short SVGs like sparklines)
      if (rect.width * rect.height < minSvgArea) continue;
      // Skip if already wrapped
      if (parent && parent.hasAttribute('data-expand-svg-wrap')) continue;

      var isCompact = rect.width < COMPACT_THRESHOLD || rect.height < COMPACT_THRESHOLD;

      var wrapper = document.createElement('span');
      wrapper.setAttribute('data-expand', 'true');
      wrapper.setAttribute('data-expand-svg-wrap', 'true');
      if (isCompact) wrapper.classList.add('expand-compact');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      svg.parentNode.insertBefore(wrapper, svg);
      wrapper.appendChild(svg);

      results.push({
        svgElement: svg,
        imgElement: null,
        tableElement: null,
        container: wrapper,
        type: 'svg',
        detectionTier: 6,
        sourceText: null
      });
    }
    return results;
  }

  function scanForTables() {
    var results = [];
    var tables = document.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i];
      // Skip our own injected elements
      if (table.hasAttribute('data-expand')) continue;
      if (table.closest && table.closest('[data-expand]')) continue;
      // Skip tables that live inside interactive controls (link, button, etc.)
      if (isInsideInteractive(table)) continue;
      // Skip invisible tables
      if (!table.offsetWidth && !table.offsetHeight) continue;
      // Skip if already wrapped
      if (table.parentElement && table.parentElement.hasAttribute('data-expand-table-wrap')) continue;

      var wrapper = document.createElement('div');
      wrapper.setAttribute('data-expand', 'true');
      wrapper.setAttribute('data-expand-table-wrap', 'true');
      wrapper.style.position = 'relative';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);

      results.push({
        svgElement: null,
        imgElement: null,
        tableElement: table,
        container: wrapper,
        type: 'table',
        detectionTier: 0,
        sourceText: null
      });
    }
    return results;
  }

  function injectActivationButtons(diagrams, settings) {
    if (settings && settings.enabled === false) return;
    var thresholds = getThresholds(settings);
    diagrams.forEach(function (diagram) {
      if (!passesDiagramThreshold(diagram, thresholds)) return;
      var container = diagram.container;
      // Skip if already has an activation button
      if (container.querySelector('.expand-activation-btn')) return;

      // Ensure container is positioned for absolute button placement
      var pos = window.getComputedStyle(container).position;
      if (pos === 'static') {
        container.style.position = 'relative';
      }

      // Use compact button for small containers
      if (container.offsetWidth < COMPACT_THRESHOLD || container.offsetHeight < COMPACT_THRESHOLD) {
        container.classList.add('expand-compact');
      }

      var btn = document.createElement('button');
      btn.className = 'expand-activation-btn';
      btn.setAttribute('data-expand', 'true');
      var ariaLabels = { table: 'View table in lightbox', img: 'View image in lightbox' };
      btn.setAttribute('aria-label', ariaLabels[diagram.type] || 'View diagram in lightbox');
      btn.setAttribute('type', 'button');
      btn.textContent = '⛶';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.ExpandLightbox !== 'undefined') {
          window.ExpandLightbox.openLightbox(diagram, btn);
        }
      });

      container.appendChild(btn);
    });
  }

  function startObserver(callback) {
    stopObserver();
    mutationObserver = new MutationObserver(function () {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        callback();
      }, 200);
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function stopObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function cleanup() {
    stopObserver();
    stopViewscreenListener();
    var buttons = document.querySelectorAll('[data-expand].expand-activation-btn');
    buttons.forEach(function (btn) { btn.remove(); });
    // Unwrap shadow DOM wrappers
    var wrappers = document.querySelectorAll('[data-expand-shadow-wrap]');
    wrappers.forEach(function (wrap) {
      while (wrap.firstChild) {
        wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      }
      wrap.remove();
    });
    // Unwrap image wrappers
    var imgWrappers = document.querySelectorAll('[data-expand-img-wrap]');
    imgWrappers.forEach(function (wrap) {
      while (wrap.firstChild) {
        wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      }
      wrap.remove();
    });
    // Unwrap table wrappers
    var tableWrappers = document.querySelectorAll('[data-expand-table-wrap]');
    tableWrappers.forEach(function (wrap) {
      while (wrap.firstChild) {
        wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      }
      wrap.remove();
    });
    // Unwrap SVG wrappers
    var svgWrappers = document.querySelectorAll('[data-expand-svg-wrap]');
    svgWrappers.forEach(function (wrap) {
      while (wrap.firstChild) {
        wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      }
      wrap.remove();
    });
  }

  // ── GitHub viewscreen iframe support ───────────────────────────────────
  // GitHub renders Mermaid diagrams inside cross-origin iframes from
  // viewscreen.githubusercontent.com. The viewscreen-bridge.js content
  // script (injected into those iframes) posts the SVG to the parent page.

  var viewscreenHandler = null;

  function listenForViewscreenDiagrams(callback) {
    if (viewscreenHandler) return; // already listening
    viewscreenHandler = function (e) {
      if (!e.data || e.data.type !== 'expand-svg-ready') return;
      if (!e.data.svgHtml) return;

      // Match the message source to a viewscreen iframe on this page
      var iframes = document.querySelectorAll('iframe');
      var sourceFrame = null;
      for (var i = 0; i < iframes.length; i++) {
        try {
          if (iframes[i].contentWindow === e.source) {
            sourceFrame = iframes[i];
            break;
          }
        } catch (err) { /* cross-origin property access error */ }
      }
      if (!sourceFrame) return;

      // Find the parent enrichment container
      var container = sourceFrame.closest('section[data-type="mermaid"]') ||
                      sourceFrame.closest('.js-render-enrichment-target') ||
                      sourceFrame.parentElement;
      if (!container) return;

      // Defensive: never inject inside an interactive ancestor
      if (isInsideInteractive(container)) return;

      // Skip if already has an activation button
      if (container.querySelector('.expand-activation-btn')) return;

      // Parse SVG safely via DOMParser (no script execution)
      var parser = new DOMParser();
      var doc = parser.parseFromString(e.data.svgHtml, 'text/html');
      var svg = doc.querySelector('svg');
      if (!svg) return;
      svg = document.adoptNode(svg);

      var diagram = {
        svgElement: svg,
        imgElement: null,
        tableElement: null,
        container: container,
        type: 'svg',
        detectionTier: 0,
        sourceText: null
      };

      callback([diagram]);
    };
    window.addEventListener('message', viewscreenHandler);
  }

  function stopViewscreenListener() {
    if (viewscreenHandler) {
      window.removeEventListener('message', viewscreenHandler);
      viewscreenHandler = null;
    }
  }

  function requestViewscreenSvgs() {
    var iframes = document.querySelectorAll(
      'iframe[src*="viewscreen.githubusercontent.com"]'
    );
    iframes.forEach(function (iframe) {
      try {
        iframe.contentWindow.postMessage({ type: 'expand-request-svg' }, '*');
      } catch (err) { /* iframe not yet loaded */ }
    });
  }

  var exports = {
    scanForDiagrams: scanForDiagrams,
    scanForImages: scanForImages,
    scanForSvgs: scanForSvgs,
    scanForTables: scanForTables,
    injectActivationButtons: injectActivationButtons,
    startObserver: startObserver,
    stopObserver: stopObserver,
    cleanup: cleanup,
    listenForViewscreenDiagrams: listenForViewscreenDiagrams,
    requestViewscreenSvgs: requestViewscreenSvgs,
    isInsideInteractive: isInsideInteractive,
    KNOWN_DIAGRAM_TYPES: KNOWN_DIAGRAM_TYPES,
    DEFAULT_MIN_IMG_SIZE: DEFAULT_MIN_IMG_SIZE,
    DEFAULT_MIN_SVG_AREA: DEFAULT_MIN_SVG_AREA,
    DEFAULT_MIN_DIAGRAM_AREA: DEFAULT_MIN_DIAGRAM_AREA
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof window !== 'undefined') {
    window.ExpandDetector = exports;
  }
})();
