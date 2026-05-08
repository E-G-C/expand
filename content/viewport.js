// content/viewport.js — ViewerState pure-math module (no DOM dependencies)
(function () {
  'use strict';

  const MIN_SCALE = 0.2;
  const MAX_SCALE = 20.0;
  const ZOOM_STEP_WHEEL = 1.1;
  const ZOOM_STEP_BUTTON = 1.2;

  function clampScale(scale) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  }

  function clampBoundary(state) {
    const { scale, imageWidth, imageHeight, containerWidth, containerHeight } = state;
    let { offsetX, offsetY } = state;
    const scaledW = imageWidth * scale;
    const scaledH = imageHeight * scale;

    // Allow panning so any part of the content can be centered on screen.
    // Three tiers (take the largest):
    //   1) scaledW / 2 — edge content can reach screen center (important when zoomed in)
    //   2) |scaledW − containerW| / 2 — small images can slide edge-to-edge
    //   3) containerW * 0.15 — minimum pan range for same-size content
    const maxOffX = Math.max(scaledW / 2, Math.abs(scaledW - containerWidth) / 2, containerWidth * 0.15);
    offsetX = Math.min(maxOffX, Math.max(-maxOffX, offsetX));

    const maxOffY = Math.max(scaledH / 2, Math.abs(scaledH - containerHeight) / 2, containerHeight * 0.15);
    offsetY = Math.min(maxOffY, Math.max(-maxOffY, offsetY));

    return Object.assign({}, state, { offsetX: offsetX, offsetY: offsetY });
  }

  function createViewerState(imageWidth, imageHeight, containerWidth, containerHeight) {
    var fitScale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
    var state = {
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      imageWidth: imageWidth,
      imageHeight: imageHeight,
      containerWidth: containerWidth,
      containerHeight: containerHeight
    };
    // If image fits at 1:1, keep 1:1 centered; otherwise fit to screen
    if (imageWidth <= containerWidth && imageHeight <= containerHeight) {
      return clampBoundary(state);
    }
    state.scale = clampScale(fitScale);
    return clampBoundary(state);
  }

  function zoomAtPoint(state, cursorX, cursorY, direction) {
    var factor = direction > 0 ? ZOOM_STEP_WHEEL : 1 / ZOOM_STEP_WHEEL;
    var newScale = clampScale(state.scale * factor);
    if (newScale === state.scale) return state;
    var ratio = newScale / state.scale;
    var offsetX = cursorX - (cursorX - state.offsetX) * ratio;
    var offsetY = cursorY - (cursorY - state.offsetY) * ratio;
    return clampBoundary(Object.assign({}, state, {
      scale: newScale, offsetX: offsetX, offsetY: offsetY
    }));
  }

  function zoomByStep(state, direction) {
    var factor = direction > 0 ? ZOOM_STEP_BUTTON : 1 / ZOOM_STEP_BUTTON;
    var newScale = clampScale(state.scale * factor);
    if (newScale === state.scale) return state;
    var ratio = newScale / state.scale;
    var offsetX = state.offsetX * ratio;
    var offsetY = state.offsetY * ratio;
    return clampBoundary(Object.assign({}, state, {
      scale: newScale, offsetX: offsetX, offsetY: offsetY
    }));
  }

  function pan(state, deltaX, deltaY) {
    return clampBoundary(Object.assign({}, state, {
      offsetX: state.offsetX + deltaX,
      offsetY: state.offsetY + deltaY
    }));
  }

  function fitToScreen(state) {
    var fitScale = Math.min(
      state.containerWidth / state.imageWidth,
      state.containerHeight / state.imageHeight
    );
    return clampBoundary(Object.assign({}, state, {
      scale: clampScale(fitScale), offsetX: 0, offsetY: 0
    }));
  }

  function resetToOriginal(state) {
    return clampBoundary(Object.assign({}, state, {
      scale: 1.0, offsetX: 0, offsetY: 0
    }));
  }

  function toggleFitAndOriginal(state) {
    var fitScale = clampScale(Math.min(
      state.containerWidth / state.imageWidth,
      state.containerHeight / state.imageHeight
    ));
    if (Math.abs(state.scale - fitScale) < 0.001) {
      return resetToOriginal(state);
    }
    return fitToScreen(state);
  }

  function updateContainer(state, containerWidth, containerHeight) {
    return clampBoundary(Object.assign({}, state, {
      containerWidth: containerWidth, containerHeight: containerHeight
    }));
  }

  // Export for both browser (window) and Node.js (module) environments
  var exports = {
    MIN_SCALE: MIN_SCALE,
    MAX_SCALE: MAX_SCALE,
    ZOOM_STEP_WHEEL: ZOOM_STEP_WHEEL,
    ZOOM_STEP_BUTTON: ZOOM_STEP_BUTTON,
    createViewerState: createViewerState,
    zoomAtPoint: zoomAtPoint,
    zoomByStep: zoomByStep,
    pan: pan,
    fitToScreen: fitToScreen,
    resetToOriginal: resetToOriginal,
    toggleFitAndOriginal: toggleFitAndOriginal,
    updateContainer: updateContainer,
    clampBoundary: clampBoundary
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof window !== 'undefined') {
    window.ExpandViewport = exports;
  }
})();
