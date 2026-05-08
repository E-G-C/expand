# Expand

A browser extension that adds a full-screen lightbox viewer for diagrams, images, and tables on any web page.

Some content on web pages — Mermaid diagrams, images, data tables — can be small and difficult to read or extract for sharing. With Expand, you can click the expand button to open any of these in a full-screen overlay, where you can zoom, pan, and export:

![Diagram embedded in a web page -- labels and connections are hard to read at this size](docs/demo.gif)


## Features

- **Full-screen lightbox** -- Click the expand button on any Mermaid diagram, image, or table to open it in an overlay viewer
- **Zoom and pan** -- Scroll wheel to zoom (up to 20x), click-drag to pan freely at any zoom level, crisp SVG rendering at any scale
- **Toolbar controls** -- Zoom in/out, fit to screen, close
- **Export** -- Copy to clipboard as PNG, download as PNG, download as SVG (diagrams), copy as HTML/JSON (tables)
- **GitHub support** -- Works with Mermaid diagrams on GitHub (rendered in viewscreen iframes)
- **Image support** -- Works with any `<img>` element on the page
- **Table support** -- Works with any `<table>` element, with Copy as HTML and Copy as JSON export
- **Dark/light theme** -- Automatically matches the page theme
- **Dynamic detection** -- Detects content added after page load (SPAs, lazy-loaded content)
- **Settings popup** -- Toggle detection of diagrams, images, and tables independently

## Supported diagram types

Flowchart, sequence, class, state, gantt, pie, ER, journey, git graph, mindmap, timeline, quadrant, sankey, and XY chart.

## Installation

### From source (developer mode)

**Microsoft Edge / Chrome:**
1. Clone this repository
2. Go to `edge://extensions/` or `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the repository root directory

**Firefox:**
1. Clone this repository
2. Go to `about:debugging#/runtime/this-extension`
3. Click "Load Temporary Add-on..."
4. Select `manifest.json` from the repository root

### From zip file

Package the extension first (see below), then:

**Firefox:**
1. Go to `about:addons`
2. Click the gear icon -> "Install Add-on From File..."
3. Select the generated zip for that browser target

**Microsoft Edge** uses the generated Edge zip for upload in Partner Center / Edge Add-ons. For local development, use "Load unpacked" from `edge://extensions/`.

**Chrome** requires developer mode for local installation. Without it, the extension must be published to the Chrome Web Store.

### Packaging the zip

The zip needs only the runtime files, not the development files. The Edge package command writes a target-specific manifest into the zip without changing the source `manifest.json`:

```bash
npm run package:edge
npm run package:edge -- --version 1.2.3 --output dist/expand-edge-1.2.3.zip
```

The package contains:

```
expand-edge-<version>.zip
  manifest.json
  content/
    detector.js
    export.js
    lightbox.js
    settings.js
    shadow-accessor.js
    theme.js
    toolbar.js
    viewport.js
    viewscreen-bridge.js
  styles/
    lightbox.css
  popup/
    popup.html
    popup.css
    popup.js
  icons/
    icon-16.png
    icon-48.png
    icon-128.png
```

## Release Pipeline

GitHub Actions publishes the Microsoft Edge zip when a `vMAJOR.MINOR.PATCH` tag is pushed:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The workflow runs tests, normalizes the npm package version from the tag in the runner workspace, stamps the packaged manifest with the same Edge-valid version, uploads a workflow artifact, and attaches the zip to the GitHub Release. Edge Add-ons store publishing is documented in [docs/release.md](docs/release.md) and remains manual until the required publishing secrets are configured.

## How it works

1. **Detection** (`content/detector.js`) -- Scans the page for Mermaid SVGs using tiered detection: `aria-roledescription` attributes, `mermaid-` ID prefixes, site-specific container selectors, internal class heuristics, and shadow DOM inspection. Also detects `<img>` and `<table>` elements.
2. **Shadow accessor** (`content/shadow-accessor.js`) -- Runs at `document_start` in the page context to force open shadow DOM on `.mermaid` elements (required for MkDocs Material, which renders into closed shadow roots)
3. **GitHub bridge** (`content/viewscreen-bridge.js`) -- Injected into GitHub's cross-origin viewscreen iframes to extract the rendered SVG via `postMessage`
4. **Settings** (`content/settings.js`) -- Loads user preferences (which content types to detect) from `chrome.storage.local`
5. **Lightbox** (`content/lightbox.js`) -- Creates a fixed overlay with the content clone, handles zoom/pan math, keyboard shortcuts (Escape to close), and cleanup
6. **Viewport** (`content/viewport.js`) -- Pure math module for zoom-at-point, free pan with edge clamping, fit-to-screen, and scale management
7. **Toolbar** (`content/toolbar.js`) -- Builds the bottom toolbar with inline SVG icons (no external resources)
8. **Export** (`content/export.js`) -- PNG rasterization via canvas, SVG serialization, image download, table-to-HTML/JSON conversion
9. **Theme** (`content/theme.js`) -- Detects dark/light theme from page styles and observes changes

## Contributing

### Prerequisites

- Node.js (for running tests)
- A Chromium or Firefox browser for manual testing

### Setup

```bash
git clone <repo-url>
cd expand
npm install
```

### Running tests

```bash
npm test
```

### Project structure

```
expand/
  manifest.json          # Extension manifest (MV3)
  content/               # Content scripts (injected into pages)
  styles/                # CSS for lightbox and UI
  popup/                 # Settings popup
  icons/                 # Extension icons
  tests/                 # Unit and fixture tests
    fixtures/            # HTML fixtures for detector tests
    unit/                # Viewport math tests
    manual/test-pages/   # Manual test HTML pages
  docs/                  # Release and supporting docs
```

### Guidelines

- Plain ES5 JavaScript (no transpiler, no build step)
- No external dependencies in content scripts -- inline SVG icons, no CDN links
- All injected DOM elements use `data-expand="true"` for identification and cleanup
- Use `AbortController` signal pattern for event listener cleanup
- Test changes against the manual test pages in `tests/manual/test-pages/`

## Privacy

Expand does not collect, transmit, or share any data. See [PRIVACY.md](PRIVACY.md) for details.

## License

ISC
