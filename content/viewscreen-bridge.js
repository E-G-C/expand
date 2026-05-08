// content/viewscreen-bridge.js — Posts Mermaid SVGs from GitHub viewscreen iframes to parent
(function () {
  'use strict';

  // Only run inside iframes, never in top-level frames
  if (window === window.top) return;

  var posted = false;

  // Find the actual diagram SVG, skipping spinner icons and tiny UI SVGs.
  // Mermaid renders all chart types (including sankey, pie, xy) as SVG.
  function findDiagramSvg() {
    // Prefer SVGs with mermaid-specific attributes
    var svg = document.querySelector(
      'svg[id^="mermaid"], svg[id^="dmermaid"], ' +
      'svg[aria-roledescription], svg[role="graphics-document"]'
    );
    if (svg) return svg;

    // Fall back: any SVG with a viewBox large enough to be a diagram (not an icon)
    var all = document.querySelectorAll('svg[viewBox]');
    for (var i = 0; i < all.length; i++) {
      var parts = all[i].getAttribute('viewBox').split(/[\s,]+/);
      if (parts.length === 4) {
        var w = parseFloat(parts[2]);
        var h = parseFloat(parts[3]);
        if (w > 50 && h > 50) return all[i];
      }
    }

    return null;
  }

  function postSvg() {
    var svg = findDiagramSvg();
    if (!svg) return false;
    posted = true;
    window.parent.postMessage({
      type: 'expand-svg-ready',
      svgHtml: svg.outerHTML
    }, '*');
    return true;
  }

  // Try immediately — SVG may already be rendered
  if (!postSvg()) {
    // Wait for SVG to appear (viewscreen renders Mermaid client-side)
    var observer = new MutationObserver(function () {
      if (postSvg()) {
        observer.disconnect();
      }
    });
    var target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  // Respond to explicit requests from the parent page.
  // This handles the case where the parent's listener wasn't ready
  // when we first posted, so the parent pings us to re-send.
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'expand-request-svg') {
      postSvg();
    }
  });
})();
