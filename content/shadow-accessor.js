// content/shadow-accessor.js — Open shadow DOM on Mermaid containers
//
// Some sites (e.g., MkDocs Material) render Mermaid diagrams inside closed
// shadow DOMs, making the SVG inaccessible to content-script DOM queries.
// This script patches Element.prototype.attachShadow to force open mode on
// elements with class "mermaid", so the detector can reach the rendered SVG.
//
// Runs in the MAIN world at document_start (before page scripts).
(function () {
  'use strict';
  var origAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    if (init && init.mode === 'closed' &&
        this.classList && this.classList.contains('mermaid')) {
      init = {mode: 'open'};
    }
    return origAttachShadow.call(this, init);
  };
})();
