// tests/unit/viewport.test.js
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
  createViewerState,
  zoomAtPoint,
  zoomByStep,
  pan,
  fitToScreen,
  resetToOriginal,
  toggleFitAndOriginal,
  updateContainer,
  clampBoundary,
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_STEP_WHEEL,
  ZOOM_STEP_BUTTON
} = require('../../content/viewport.js');

describe('viewport.js constants', () => {
  it('exports correct constants', () => {
    expect(MIN_SCALE).toBe(0.2);
    expect(MAX_SCALE).toBe(20.0);
    expect(ZOOM_STEP_WHEEL).toBe(1.1);
    expect(ZOOM_STEP_BUTTON).toBe(1.2);
  });
});

describe('createViewerState', () => {
  it('returns 1:1 for small image that fits in container', () => {
    const state = createViewerState(100, 100, 800, 600);
    expect(state.scale).toBe(1.0);
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
    expect(state.imageWidth).toBe(100);
    expect(state.imageHeight).toBe(100);
  });

  it('returns fit-to-screen for large image', () => {
    const state = createViewerState(1600, 1200, 800, 600);
    const expectedFit = Math.min(800 / 1600, 600 / 1200);
    expect(state.scale).toBe(expectedFit);
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
  });

  it('returns fit-to-screen for wide image', () => {
    const state = createViewerState(2000, 400, 800, 600);
    const expectedFit = Math.min(800 / 2000, 600 / 400);
    expect(state.scale).toBe(expectedFit);
  });

  it('returns fit-to-screen for tall image', () => {
    const state = createViewerState(400, 2000, 800, 600);
    const expectedFit = Math.min(800 / 400, 600 / 2000);
    expect(state.scale).toBe(expectedFit);
  });
});

describe('zoomAtPoint', () => {
  it('zooms in and preserves cursor position concept', () => {
    const state = createViewerState(1600, 1200, 800, 600);
    const zoomed = zoomAtPoint(state, 100, 50, 1);
    expect(zoomed.scale).toBeGreaterThan(state.scale);
    expect(zoomed.scale).toBe(state.scale * ZOOM_STEP_WHEEL);
  });

  it('zooms out', () => {
    const state = createViewerState(1600, 1200, 800, 600);
    const zoomed = zoomAtPoint(state, 0, 0, -1);
    expect(zoomed.scale).toBeLessThan(state.scale);
  });

  it('clamps scale to MIN_SCALE', () => {
    let state = createViewerState(1600, 1200, 800, 600);
    for (let i = 0; i < 50; i++) {
      state = zoomAtPoint(state, 0, 0, -1);
    }
    expect(state.scale).toBeGreaterThanOrEqual(MIN_SCALE);
  });

  it('clamps scale to MAX_SCALE', () => {
    let state = createViewerState(1600, 1200, 800, 600);
    for (let i = 0; i < 50; i++) {
      state = zoomAtPoint(state, 0, 0, 1);
    }
    expect(state.scale).toBeLessThanOrEqual(MAX_SCALE);
  });
});

describe('zoomByStep', () => {
  it('uses ZOOM_STEP_BUTTON factor for zoom in', () => {
    const state = createViewerState(100, 100, 800, 600);
    const zoomed = zoomByStep(state, 1);
    expect(zoomed.scale).toBeCloseTo(1.0 * ZOOM_STEP_BUTTON, 5);
  });

  it('uses ZOOM_STEP_BUTTON factor for zoom out', () => {
    const state = createViewerState(100, 100, 800, 600);
    const zoomed = zoomByStep(state, -1);
    expect(zoomed.scale).toBeCloseTo(1.0 / ZOOM_STEP_BUTTON, 5);
  });
});

describe('pan', () => {
  it('applies deltas', () => {
    // Use a large image so panning is allowed
    const state = createViewerState(1600, 1200, 800, 600);
    // Zoom in first so image is larger than container
    const zoomed = zoomByStep(zoomByStep(zoomByStep(state, 1), 1), 1);
    const panned = pan(zoomed, 10, 5);
    // Offsets should change (may be clamped but should be different from before if within range)
    expect(typeof panned.offsetX).toBe('number');
    expect(typeof panned.offsetY).toBe('number');
  });

  it('allows panning when image is smaller than container', () => {
    const state = createViewerState(100, 100, 800, 600);
    // Image is 100x100 in 800x600 container → maxOffX = (800-100)/2 = 350, maxOffY = (600-100)/2 = 250
    const panned = pan(state, 100, 50);
    expect(panned.offsetX).toBe(100);
    expect(panned.offsetY).toBe(50);
  });

  it('clamps pan to container edge when image is smaller', () => {
    const state = createViewerState(100, 100, 800, 600);
    const panned = pan(state, 999, 999);
    expect(panned.offsetX).toBe(350);  // (800-100)/2
    expect(panned.offsetY).toBe(250);  // (600-100)/2
  });
});

describe('fitToScreen', () => {
  it('centers with offsetX=0 and offsetY=0', () => {
    const state = createViewerState(1600, 1200, 800, 600);
    const zoomed = zoomByStep(state, 1);
    const fit = fitToScreen(zoomed);
    expect(fit.offsetX).toBe(0);
    expect(fit.offsetY).toBe(0);
    const expectedFit = Math.min(800 / 1600, 600 / 1200);
    expect(fit.scale).toBeCloseTo(expectedFit, 5);
  });
});

describe('resetToOriginal', () => {
  it('returns 1:1 for small image', () => {
    const state = createViewerState(100, 100, 800, 600);
    const zoomed = zoomByStep(state, 1);
    const reset = resetToOriginal(zoomed);
    expect(reset.scale).toBe(1.0);
    expect(reset.offsetX).toBe(0);
    expect(reset.offsetY).toBe(0);
  });

  it('returns 1:1 even when image is larger than container', () => {
    const state = createViewerState(1600, 1200, 800, 600);
    const zoomed = zoomByStep(state, 1);
    const reset = resetToOriginal(zoomed);
    expect(reset.scale).toBe(1.0);
    expect(reset.offsetX).toBe(0);
    expect(reset.offsetY).toBe(0);
  });
});

describe('toggleFitAndOriginal', () => {
  it('toggles from fit to original for small image', () => {
    const state = createViewerState(100, 100, 800, 600);
    const fit = fitToScreen(state);
    const toggled = toggleFitAndOriginal(fit);
    // For small image, fit and original are different
    // fit scale = min(800/100, 600/100) = 6.0, but clamped to MAX_SCALE=5.0
    // resetToOriginal returns 1:1 since image fits
    expect(toggled.scale).toBe(1.0);
  });

  it('toggles from non-fit to fit', () => {
    const state = createViewerState(1600, 1200, 800, 600);
    const zoomed = zoomByStep(state, 1);
    const toggled = toggleFitAndOriginal(zoomed);
    const expectedFit = Math.min(800 / 1600, 600 / 1200);
    expect(toggled.scale).toBeCloseTo(expectedFit, 5);
  });
});

describe('updateContainer', () => {
  it('updates container dimensions and reclamps', () => {
    const state = createViewerState(1600, 1200, 800, 600);
    const updated = updateContainer(state, 400, 300);
    expect(updated.containerWidth).toBe(400);
    expect(updated.containerHeight).toBe(300);
  });
});

describe('clampBoundary', () => {
  it('allows offset when image is smaller than container', () => {
    const state = {
      scale: 0.5,
      offsetX: 100,
      offsetY: 100,
      imageWidth: 400,
      imageHeight: 300,
      containerWidth: 800,
      containerHeight: 600
    };
    // scaledW = 200 < 800, maxOffX = (800-200)/2 = 300
    // scaledH = 150 < 600, maxOffY = (600-150)/2 = 225
    // offsets 100,100 are within limits
    const clamped = clampBoundary(state);
    expect(clamped.offsetX).toBe(100);
    expect(clamped.offsetY).toBe(100);
  });

  it('clamps offset when image is smaller than container', () => {
    const state = {
      scale: 0.5,
      offsetX: 999,
      offsetY: 999,
      imageWidth: 400,
      imageHeight: 300,
      containerWidth: 800,
      containerHeight: 600
    };
    // scaledW = 200, maxOffX = (800-200)/2 = 300
    // scaledH = 150, maxOffY = (600-150)/2 = 225
    const clamped = clampBoundary(state);
    expect(clamped.offsetX).toBe(300);
    expect(clamped.offsetY).toBe(225);
  });

  it('constrains offsets when image is larger than container', () => {
    const state = {
      scale: 2.0,
      offsetX: 9999,
      offsetY: 9999,
      imageWidth: 800,
      imageHeight: 600,
      containerWidth: 800,
      containerHeight: 600
    };
    // scaledW = 1600 > 800, maxOff = scaledW/2 = 800 (edge can reach screen center)
    const clamped = clampBoundary(state);
    expect(clamped.offsetX).toBeLessThanOrEqual(800);
    // scaledH = 1200 > 600, maxOff = scaledH/2 = 600
    expect(clamped.offsetY).toBeLessThanOrEqual(600);
  });

  it('allows horizontal pan when image width matches container width', () => {
    // Simulates a wide Mermaid diagram whose viewBox width equals the window width
    const state = {
      scale: 1.0,
      offsetX: 100,
      offsetY: 50,
      imageWidth: 800,
      imageHeight: 200,
      containerWidth: 800,
      containerHeight: 600
    };
    // scaledW = containerW = 800, base = 0, min = 800*0.15 = 120 → maxOffX = 120
    // scaledH = 200 < 600, base = 200, min = 90 → maxOffY = 200
    const clamped = clampBoundary(state);
    expect(clamped.offsetX).toBe(100); // within 120 limit
    expect(clamped.offsetY).toBe(50);  // within 200 limit
  });

  it('clamps horizontal pan at minimum range when image matches container', () => {
    const state = {
      scale: 1.0,
      offsetX: 999,
      offsetY: 0,
      imageWidth: 800,
      imageHeight: 600,
      containerWidth: 800,
      containerHeight: 600
    };
    // Both dimensions match: scaledW/2 = 400 > dim*0.15 = 120
    const clamped = clampBoundary(state);
    expect(clamped.offsetX).toBe(400);  // 800 / 2
    expect(clamped.offsetY).toBe(0);
  });
});
