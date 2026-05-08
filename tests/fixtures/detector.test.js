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

describe('skips candidates inside interactive ancestors', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('no-diagrams.html');
    detector = loadDetector(win);
    win.document.body.innerHTML = '';
  });

  function markImageLoaded(img, w, h) {
    Object.defineProperty(img, 'complete', { value: true, writable: true });
    Object.defineProperty(img, 'naturalWidth', { value: w, writable: true });
    Object.defineProperty(img, 'naturalHeight', { value: h, writable: true });
    Object.defineProperty(img, 'offsetWidth', { value: w, writable: true, configurable: true });
    Object.defineProperty(img, 'offsetHeight', { value: h, writable: true, configurable: true });
  }

  it('exports the isInsideInteractive helper', () => {
    expect(typeof detector.isInsideInteractive).toBe('function');
  });

  it('scanForImages skips an <img> inside a <button>', () => {
    win.document.body.innerHTML = `
      <button type="button" id="host-btn">
        <img id="btn-img" src="icon.png" width="200" height="200" />
      </button>
    `;
    const img = win.document.getElementById('btn-img');
    markImageLoaded(img, 200, 200);

    const results = detector.scanForImages();
    expect(results.length).toBe(0);
    // Host button must remain unwrapped
    expect(win.document.querySelector('[data-expand-img-wrap]')).toBeNull();
    expect(img.parentElement.id).toBe('host-btn');
  });

  it('scanForImages skips an <img> inside an element with role="button"', () => {
    win.document.body.innerHTML = `
      <div role="button" id="host-role-btn" tabindex="0">
        <img id="role-img" src="icon.png" width="200" height="200" />
      </div>
    `;
    const img = win.document.getElementById('role-img');
    markImageLoaded(img, 200, 200);

    const results = detector.scanForImages();
    expect(results.length).toBe(0);
    expect(win.document.querySelector('[data-expand-img-wrap]')).toBeNull();
    expect(img.parentElement.id).toBe('host-role-btn');
  });

  it('scanForSvgs skips a generic <svg> inside an icon button (ADO Copilot pattern)', () => {
    win.document.body.innerHTML = `
      <button aria-label="Ask Copilot" class="bolt-icon-button" id="ask-copilot" role="menuitem" type="button">
        <svg id="copilot-icon" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"></path></svg>
      </button>
    `;
    const svg = win.document.getElementById('copilot-icon');
    mockRect(svg, 100, 100); // area = 10000, well above DEFAULT_MIN_SVG_AREA (2000)

    const results = detector.scanForSvgs();
    expect(results.length).toBe(0);
    // Host button must remain unwrapped and the SVG still its direct child
    expect(win.document.querySelector('[data-expand-svg-wrap]')).toBeNull();
    expect(svg.parentElement.id).toBe('ask-copilot');
  });

  it('scanForTables skips a <table> inside an <a href="#">', () => {
    win.document.body.innerHTML = `
      <a href="#" id="host-link">
        <table id="link-table"><tr><td>cell</td></tr></table>
      </a>
    `;
    const table = win.document.getElementById('link-table');
    Object.defineProperty(table, 'offsetWidth', { value: 400, writable: true, configurable: true });
    Object.defineProperty(table, 'offsetHeight', { value: 200, writable: true, configurable: true });

    const results = detector.scanForTables();
    expect(results.length).toBe(0);
    expect(win.document.querySelector('[data-expand-table-wrap]')).toBeNull();
    expect(table.parentElement.id).toBe('host-link');
  });

  it('scanForDiagrams skips a Mermaid SVG inside an element with role="menuitem"', () => {
    win.document.body.innerHTML = `
      <div role="menuitem" id="host-menuitem" tabindex="0">
        <svg id="menu-mermaid" aria-roledescription="flowchart" viewBox="0 0 200 200">
          <g class="flowchart"></g>
        </svg>
      </div>
    `;
    const svg = win.document.getElementById('menu-mermaid');
    mockRect(svg, 200, 200);

    const results = detector.scanForDiagrams();
    expect(results.length).toBe(0);
    // Sanity: the helper agrees this SVG is inside an interactive ancestor
    expect(detector.isInsideInteractive(svg)).toBe(true);
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

describe('skips candidates inside ephemeral popup containers (ADO Bolt callout regression)', () => {
  let detector, win;

  beforeEach(() => {
    win = loadFixture('no-diagrams.html');
    detector = loadDetector(win);
    win.document.body.innerHTML = '';
  });

  function markImageLoaded(img, w, h) {
    Object.defineProperty(img, 'complete', { value: true, writable: true });
    Object.defineProperty(img, 'naturalWidth', { value: w, writable: true });
    Object.defineProperty(img, 'naturalHeight', { value: h, writable: true });
    Object.defineProperty(img, 'offsetWidth', { value: w, writable: true, configurable: true });
    Object.defineProperty(img, 'offsetHeight', { value: h, writable: true, configurable: true });
  }

  it('exports the isInsideEphemeralContainer helper', () => {
    expect(typeof detector.isInsideEphemeralContainer).toBe('function');
  });

  it('scanForImages skips a bolt-coin <img> inside a Bolt-style portaled callout (the ADO regression)', () => {
    // Mirrors what the v0.0.4 release did on the ADO work-item page: when
    // the "Ask Copilot" chevron opened the callout, the framework portaled
    // a [role="menu"] subtree into <body>, our MutationObserver fired ~200ms
    // later, scanForImages wrapped a `bolt-coin` <img> inside that subtree,
    // and the wrapper insertion tripped Bolt's dismiss-on-mutation logic so
    // the menu closed immediately. The fix is to skip the whole subtree.
    win.document.body.innerHTML = `
      <div class="bolt-callout" role="menu" id="ado-callout">
        <ul>
          <li role="menuitem">
            Create a pull request with GitHub Copilot
            <img id="coin-img" class="bolt-coin-content using-image size24" src="copilot.png" width="200" height="200" />
          </li>
        </ul>
      </div>
    `;
    const img = win.document.getElementById('coin-img');
    markImageLoaded(img, 200, 200);

    const results = detector.scanForImages();
    expect(results.length).toBe(0);
    // Critical: the callout subtree must be untouched. A wrapper here is
    // exactly what trips Bolt's dismiss-on-mutation.
    expect(win.document.querySelector('[data-expand-img-wrap]')).toBeNull();
    expect(img.parentElement.tagName.toLowerCase()).toBe('li');
  });

  it('scanForSvgs skips an <svg> inside [role="dialog"]', () => {
    win.document.body.innerHTML = `
      <div role="dialog" aria-modal="true" id="modal">
        <svg id="dialog-svg" viewBox="0 0 200 200"><rect width="200" height="200"/></svg>
      </div>
    `;
    const svg = win.document.getElementById('dialog-svg');
    mockRect(svg, 200, 200);

    const results = detector.scanForSvgs();
    expect(results.length).toBe(0);
    expect(win.document.querySelector('[data-expand-svg-wrap]')).toBeNull();
  });

  it('scanForSvgs skips an <svg> inside [role="tooltip"]', () => {
    win.document.body.innerHTML = `
      <div role="tooltip" id="tip">
        <svg id="tip-svg" viewBox="0 0 200 200"><rect width="200" height="200"/></svg>
      </div>
    `;
    const svg = win.document.getElementById('tip-svg');
    mockRect(svg, 200, 200);

    const results = detector.scanForSvgs();
    expect(results.length).toBe(0);
  });

  it('scanForSvgs skips an <svg> inside [role="listbox"]', () => {
    win.document.body.innerHTML = `
      <div role="listbox" id="lb">
        <div role="option"><svg id="opt-svg" viewBox="0 0 200 200"><rect width="200" height="200"/></svg></div>
      </div>
    `;
    const svg = win.document.getElementById('opt-svg');
    mockRect(svg, 200, 200);

    const results = detector.scanForSvgs();
    expect(results.length).toBe(0);
  });

  it('scanForTables skips a <table> inside [aria-modal="true"] (modal dialog)', () => {
    win.document.body.innerHTML = `
      <div aria-modal="true" id="amodal">
        <table id="modal-table"><tr><td>cell</td></tr></table>
      </div>
    `;
    const table = win.document.getElementById('modal-table');
    Object.defineProperty(table, 'offsetWidth', { value: 400, writable: true, configurable: true });
    Object.defineProperty(table, 'offsetHeight', { value: 200, writable: true, configurable: true });

    const results = detector.scanForTables();
    expect(results.length).toBe(0);
    expect(win.document.querySelector('[data-expand-table-wrap]')).toBeNull();
  });

  it('scanForDiagrams skips a Mermaid SVG inside [role="dialog"]', () => {
    win.document.body.innerHTML = `
      <div role="dialog" id="d">
        <svg id="dialog-mermaid" aria-roledescription="flowchart" viewBox="0 0 200 200">
          <g class="flowchart"></g>
        </svg>
      </div>
    `;
    const svg = win.document.getElementById('dialog-mermaid');
    mockRect(svg, 200, 200);

    const results = detector.scanForDiagrams();
    expect(results.length).toBe(0);
    expect(detector.isInsideEphemeralContainer(svg)).toBe(true);
  });

  it('does NOT skip an <img> in regular page content (non-popup)', () => {
    // Sanity check: the new selector must not over-match. An <img> inside
    // an ordinary <article> with no popup role should still be wrapped.
    win.document.body.innerHTML = `
      <article id="content">
        <img id="page-img" src="figure.png" width="400" height="300" />
      </article>
    `;
    const img = win.document.getElementById('page-img');
    markImageLoaded(img, 400, 300);

    const results = detector.scanForImages();
    expect(results.length).toBe(1);
    expect(win.document.querySelector('[data-expand-img-wrap]')).not.toBeNull();
  });
});
