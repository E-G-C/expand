// tests/fixtures/detector.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
  const html = readFileSync(resolve(__dirname, name), 'utf-8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
  return dom.window;
}

function loadDetector(win) {
  const code = readFileSync(resolve(__dirname, '../../content/detector.js'), 'utf-8');
  // Use the Script API from jsdom's vm to run in the window context
  const scriptEl = win.document.createElement('script');
  scriptEl.textContent = code;
  win.document.head.appendChild(scriptEl);
  return win.ExpandDetector;
}

function mockRect(element, width, height) {
  element.getBoundingClientRect = () => ({
    width,
    height,
    top: 0,
    right: width,
    bottom: height,
    left: 0,
    x: 0,
    y: 0
  });
}

describe('scanForDiagrams — github-mermaid.html', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('github-mermaid.html');
    detector = loadDetector(win);
  });

  it('detects 2 diagrams', () => {
    const results = detector.scanForDiagrams();
    expect(results.length).toBe(2);
  });

  it('detects diagrams at tier 1 (aria-roledescription)', () => {
    const results = detector.scanForDiagrams();
    expect(results[0].detectionTier).toBe(1);
    expect(results[1].detectionTier).toBe(1);
  });

  it('populates container field', () => {
    const results = detector.scanForDiagrams();
    results.forEach((r) => {
      expect(r.container).toBeTruthy();
      expect(r.container.tagName).toBeDefined();
    });
  });

  it('deduplicates by SVG identity', () => {
    const results = detector.scanForDiagrams();
    const svgs = results.map((r) => r.svgElement);
    const unique = new Set(svgs);
    expect(unique.size).toBe(svgs.length);
  });
});

describe('scanForDiagrams — generic-mermaid.html', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('generic-mermaid.html');
    detector = loadDetector(win);
  });

  it('detects 2 diagrams', () => {
    const results = detector.scanForDiagrams();
    expect(results.length).toBe(2);
  });

  it('detects via id prefix (tier 2) or container (tier 3)', () => {
    const results = detector.scanForDiagrams();
    results.forEach((r) => {
      expect(r.detectionTier).toBeLessThanOrEqual(3);
    });
  });
});

describe('scanForDiagrams — no-diagrams.html', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('no-diagrams.html');
    detector = loadDetector(win);
  });

  it('returns zero results', () => {
    const results = detector.scanForDiagrams();
    expect(results.length).toBe(0);
  });
});

describe('scanForDiagrams — configurable minimum area', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('no-diagrams.html');
    detector = loadDetector(win);
    win.document.body.innerHTML = `
      <div class="mermaid">
        <svg id="mermaid-small" viewBox="0 0 50 50" aria-roledescription="flowchart">
          <g class="flowchart"></g>
        </svg>
      </div>
    `;
    mockRect(win.document.getElementById('mermaid-small'), 50, 50);
  });

  it('keeps the default behavior when no diagram minimum is set', () => {
    const results = detector.scanForDiagrams();
    expect(results.length).toBe(1);
  });

  it('skips diagrams below a custom minimum area', () => {
    const results = detector.scanForDiagrams({ minDiagramArea: 3000 });
    expect(results.length).toBe(0);
  });
});

describe('scanForSvgs — configurable minimum area', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('no-diagrams.html');
    detector = loadDetector(win);
    win.document.body.innerHTML = '<svg id="generic-svg" viewBox="0 0 50 50"><rect width="50" height="50"></rect></svg>';
    mockRect(win.document.getElementById('generic-svg'), 50, 50);
  });

  it('detects SVGs above the default minimum area', () => {
    const results = detector.scanForSvgs();
    expect(results.length).toBe(1);
  });

  it('skips SVGs below a custom minimum area', () => {
    const results = detector.scanForSvgs({ minSvgArea: 3000 });
    expect(results.length).toBe(0);
  });
});

describe('scanForDiagrams — type field', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('github-mermaid.html');
    detector = loadDetector(win);
  });

  it('sets type to svg for diagram results', () => {
    const results = detector.scanForDiagrams();
    results.forEach((r) => {
      expect(r.type).toBe('svg');
      expect(r.svgElement).toBeTruthy();
      expect(r.imgElement).toBeNull();
    });
  });
});

describe('scanForImages — images.html', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('images.html');
    detector = loadDetector(win);
    // Simulate loaded images — JSDOM doesn't load resources or compute layout
    const imgs = win.document.querySelectorAll('img');
    imgs.forEach((img) => {
      const w = parseInt(img.getAttribute('width')) || 0;
      const h = parseInt(img.getAttribute('height')) || 0;
      Object.defineProperty(img, 'complete', { value: true, writable: true });
      Object.defineProperty(img, 'naturalWidth', { value: w, writable: true });
      Object.defineProperty(img, 'naturalHeight', { value: h, writable: true });
      Object.defineProperty(img, 'offsetWidth', { value: w, writable: true });
      Object.defineProperty(img, 'offsetHeight', { value: h, writable: true });
    });
  });

  it('exports scanForImages function', () => {
    expect(typeof detector.scanForImages).toBe('function');
  });

  it('returns results with type img', () => {
    const results = detector.scanForImages();
    results.forEach((r) => {
      expect(r.type).toBe('img');
      expect(r.imgElement).toBeTruthy();
      expect(r.svgElement).toBeNull();
      expect(r.detectionTier).toBe(0);
    });
  });

  it('skips images below MIN_IMG_SIZE (64)', () => {
    const results = detector.scanForImages();
    // Only large-img (300x200) and medium-img (100x100) qualify;
    // small-icon (32x32) and pixel (1x1) should be filtered out
    expect(results.length).toBe(2);
    const ids = results.map((r) => r.imgElement.id);
    expect(ids).toContain('large-img');
    expect(ids).toContain('medium-img');
    expect(ids).not.toContain('small-icon');
    expect(ids).not.toContain('pixel');
  });

  it('honors a custom image minimum side length', () => {
    const results = detector.scanForImages({ minImageSize: 128 });
    const ids = results.map((r) => r.imgElement.id);
    expect(ids).toContain('large-img');
    expect(ids).not.toContain('medium-img');
  });

  it('skips small rendered UI images even when the source asset is large', () => {
    const logo = win.document.createElement('img');
    logo.id = 'nav-logo';
    logo.src = '/playwright-logo.svg';
    logo.width = 32;
    logo.height = 32;
    win.document.body.appendChild(logo);

    Object.defineProperty(logo, 'complete', { value: true, writable: true });
    Object.defineProperty(logo, 'naturalWidth', { value: 400, writable: true });
    Object.defineProperty(logo, 'naturalHeight', { value: 400, writable: true });
    Object.defineProperty(logo, 'offsetWidth', { value: 32, writable: true, configurable: true });
    Object.defineProperty(logo, 'offsetHeight', { value: 32, writable: true, configurable: true });

    const results = detector.scanForImages();
    const ids = results.map((r) => r.imgElement.id);
    expect(ids).not.toContain('nav-logo');
    expect(win.document.querySelector('[data-expand-img-wrap] #nav-logo')).toBeNull();
  });

  it('wraps images in a container with data-expand-img-wrap', () => {
    const results = detector.scanForImages();
    results.forEach((r) => {
      expect(r.container.hasAttribute('data-expand-img-wrap')).toBe(true);
      expect(r.container.hasAttribute('data-expand')).toBe(true);
    });
  });

  it('does not re-wrap already wrapped images on second scan', () => {
    const first = detector.scanForImages();
    const second = detector.scanForImages();
    expect(second.length).toBe(0);
    // Wrappers from first scan still exist
    const wrappers = win.document.querySelectorAll('[data-expand-img-wrap]');
    expect(wrappers.length).toBe(first.length);
  });
});

describe('scanForTables — tables.html', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('tables.html');
    detector = loadDetector(win);
    // JSDOM doesn't compute layout — mock offsetWidth/offsetHeight for visible tables
    const tables = win.document.querySelectorAll('table');
    tables.forEach((table) => {
      const style = win.getComputedStyle(table);
      const isHidden = style.display === 'none';
      Object.defineProperty(table, 'offsetWidth', { value: isHidden ? 0 : 400, writable: true, configurable: true });
      Object.defineProperty(table, 'offsetHeight', { value: isHidden ? 0 : 200, writable: true, configurable: true });
    });
  });

  it('exports scanForTables function', () => {
    expect(typeof detector.scanForTables).toBe('function');
  });

  it('returns results with type table', () => {
    const results = detector.scanForTables();
    results.forEach((r) => {
      expect(r.type).toBe('table');
      expect(r.tableElement).toBeTruthy();
      expect(r.svgElement).toBeNull();
      expect(r.imgElement).toBeNull();
      expect(r.detectionTier).toBe(0);
    });
  });

  it('detects visible tables and skips hidden and data-expand internal', () => {
    const results = detector.scanForTables();
    // basic-table, no-thead-table, empty-headers are visible
    // hidden-table (display:none) and expand-internal-table (inside data-expand) should be skipped
    expect(results.length).toBe(3);
    const ids = results.map((r) => r.tableElement.id);
    expect(ids).toContain('basic-table');
    expect(ids).toContain('no-thead-table');
    expect(ids).toContain('empty-headers');
    expect(ids).not.toContain('hidden-table');
    expect(ids).not.toContain('expand-internal-table');
  });

  it('wraps tables in a container with data-expand-table-wrap', () => {
    const results = detector.scanForTables();
    results.forEach((r) => {
      expect(r.container.hasAttribute('data-expand-table-wrap')).toBe(true);
      expect(r.container.hasAttribute('data-expand')).toBe(true);
      expect(r.container.tagName.toLowerCase()).toBe('div');
    });
  });

  it('does not re-wrap already wrapped tables on second scan', () => {
    const first = detector.scanForTables();
    const second = detector.scanForTables();
    expect(second.length).toBe(0);
    // Wrappers from first scan still exist
    const wrappers = win.document.querySelectorAll('[data-expand-table-wrap]');
    expect(wrappers.length).toBe(first.length);
  });
});

describe('scanForDiagrams — github-inline-mermaid.html (post-iframe enrichment)', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('github-inline-mermaid.html');
    detector = loadDetector(win);
    // jsdom doesn't lay out SVGs — mock rendered rects so area thresholds pass.
    const flow = win.document.getElementById('mermaid-flow-1');
    const seq = win.document.getElementById('mermaid-seq-1');
    if (flow) mockRect(flow, 320, 160);
    if (seq) mockRect(seq, 240, 120);
  });

  it('detects 2 diagrams', () => {
    const results = detector.scanForDiagrams();
    expect(results.length).toBe(2);
  });

  it('detects via tier 1 (aria-roledescription)', () => {
    const results = detector.scanForDiagrams();
    // Both diagrams use aria-roledescription values that appear in
    // KNOWN_DIAGRAM_TYPES ("flowchart", "sequence"), so both hit tier 1.
    const byId = Object.fromEntries(results.map((r) => [r.svgElement.id, r]));
    expect(byId['mermaid-flow-1'].detectionTier).toBe(1);
    expect(byId['mermaid-seq-1'].detectionTier).toBe(1);
  });

  it('populates container with the enrichment section', () => {
    const results = detector.scanForDiagrams();
    results.forEach((r) => {
      expect(r.container).toBeTruthy();
      expect(r.container.tagName.toLowerCase()).toBe('section');
      expect(r.container.getAttribute('data-type')).toBe('mermaid');
    });
  });

  it('assigns type svg and clears other element fields', () => {
    const results = detector.scanForDiagrams();
    results.forEach((r) => {
      expect(r.type).toBe('svg');
      expect(r.svgElement).toBeTruthy();
      expect(r.imgElement).toBeNull();
      expect(r.tableElement).toBeNull();
    });
  });

  it('tier-3 site selector also matches the enrichment SVGs', () => {
    // Strip aria-roledescription from the flowchart svg so tier 1 can no
    // longer match it. The site selector
    //   section[data-type="mermaid"] .js-render-enrichment-target > svg
    // (and the id-prefix tier) must still catch it.
    win.document.querySelectorAll('svg').forEach((svg) => {
      if (svg.id === 'mermaid-flow-1') svg.removeAttribute('aria-roledescription');
    });

    const results = detector.scanForDiagrams();
    expect(results.length).toBe(2);
    const flow = results.find((r) => r.svgElement.id === 'mermaid-flow-1');
    expect(flow).toBeTruthy();
    // Either tier 2 (id^="mermaid-") or tier 3 (site selector) is acceptable —
    // tier 2 wins in practice because it is checked first, but locking in the
    // weaker assertion keeps this test resilient if iteration order changes.
    expect(flow.detectionTier === 2 || flow.detectionTier === 3).toBe(true);
  });
});
