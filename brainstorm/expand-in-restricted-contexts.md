---
title: Re-enable expand affordance inside interactive and ephemeral popup contexts
slug: expand-in-restricted-contexts
status: draft
spec_path:
---

# Brainstorm: Re-enable expand affordance inside interactive and ephemeral popup contexts

## User Draft

Now that we understand the root cause of the v0.0.4 nested-`<button>` bug and the v0.0.5 popup-dismissal bug, can we re-enable the expand affordance on elements that currently get skipped by `isInsideInteractive` and `isInsideEphemeralContainer` — for example the Copilot icon button on the ADO toolbar, and presumably other SVG/image content that lives inside interactive triggers or open menus/dialogs?

The ask is **re-enable, don't replace**: keep the existing skip rules in the scan paths so we don't re-introduce the prior regressions, but find a way to surface the expand action for those targets through a different delivery surface.

(Captured from a TTS chat, so the original phrasing was loose; intent above is the normalized version.)

<!-- dude:managed:start -->
## Normalized Intent
- Let users open the lightbox for image / SVG / table / Mermaid candidates that currently get skipped by `isInsideInteractive` (matches inside `INTERACTIVE_ANCESTOR_SELECTOR`) or `isInsideEphemeralContainer` (matches inside `EPHEMERAL_CONTAINER_SELECTOR`).
- Concrete in-scope examples: the Copilot icon button on the ADO toolbar (interactive ancestor case) and SVG icons inside open ADO Bolt / Fluent UI / MUI / Radix / Headless UI menus and dialogs (ephemeral container case).
- Deliver the affordance through a surface that does not mutate DOM under the host control or under an open popup — i.e. without re-introducing the v0.0.4 nested-button bug or the v0.0.5 mutation-triggered dismiss bug.
- Reuse `window.ExpandLightbox.openLightbox(diagram, btn)` as the lightbox entry point; do not introduce a second viewer surface.

## Constraints
- Must not append a `<button>` inside another `<button>` or other interactive trigger (HTML5 nested-interactive-content rule).
- Must not insert DOM nodes under an open `[role=menu|listbox|dialog|alertdialog|tooltip|combobox|tree|grid]` or `[aria-modal=true]` while it is rendered, because host frameworks (Bolt, Fluent UI, etc.) treat that mutation as a dismissal trigger.
- Must not break keyboard navigation or focus traps inside menus and dialogs.
- Must work in Manifest V3 with the existing content-script architecture: `content/detector.js` runs in the isolated world, `content/shadow-accessor.js` runs in the MAIN world.
- Must reuse `window.ExpandLightbox.openLightbox(diagram, btn)` from `content/lightbox.js`; no new lightbox surface.
- Must respect the existing enable/disable toggle and the size threshold (`DEFAULT_MIN_IMG_SIZE = 64`).
- Must keep the existing 68 regression tests green, including the v0.0.4 (nested-interactive) and v0.0.5 (ephemeral-container) coverage.
- The fix is additive: existing `isInsideInteractive` and `isInsideEphemeralContainer` skip rules in the four scan paths (`scanForImages`, `scanForSvgs`, `scanForTables`, `scanForDiagrams`) stay in place — the new affordance is delivered through a different surface, not by removing those guards.
<!-- dude:managed:end -->

## Open Questions
1. Scope: should the new affordance cover **all four** content types (`<img>`, inline `<svg>`, `<table>`, Mermaid diagrams) inside restricted contexts, or start with `<img>` only — the actually-reported case is the Copilot icon button?
2. UX: is right-click + context menu (Option B) acceptable on its own, or is a visible hover/focus indicator required (Option A or the Option C hybrid)?
3. UX: should restricted-context targets be subject to the same `DEFAULT_MIN_IMG_SIZE = 64` threshold, or a different one — e.g. should a 24-px Copilot icon be eligible at all, or only icons above some explicit "decorative" cutoff?

## Assumptions
- The fix is additive: existing `isInsideInteractive` / `isInsideEphemeralContainer` skip rules in `scanForImages`, `scanForSvgs`, `scanForTables`, and `scanForDiagrams` stay in place; the new affordance is delivered through a different surface, not by removing those skip rules.
- Lightbox UX itself does not change — same toolbar, same close behavior, same `window.ExpandLightbox.openLightbox(diagram, btn)` entry point.
- Tests are vitest 4.x + jsdom 28; any new code path needs a matching unit test under `tests/`.
- Source is a Chrome MV3 extension; this feature is not retargeting Firefox, Safari, or other browsers.

## Deferred Clarifications
- D1 (technical): For Option A, where does the floating overlay live — page DOM, Shadow DOM, or an iframe — and how does it avoid being clobbered by the host page's own click-outside / dismiss-on-mutation handlers?
- D2 (technical): For Option B, do we need to add `"contextMenus"` to `manifest.json` and route through a background service worker, or can a content-script `contextmenu` event listener cover it without a new permission?
- D3 (UX): Should the affordance be opt-in per host page (allowlist), opt-out (blocklist), or unconditional?
- D4 (scope): Do we also want to surface the affordance for elements that are currently skipped because they fail the size threshold (e.g. a 32-px logo the user actually wants to view at full size)?
- D5 (security/privacy): Does adding a global hover overlay or a context-menu entry constitute a meaningful tracking-surface change worth disclosing in `PRIVACY.md`?

## Options Considered

> No decision yet — these are alternatives to weigh against the Open Questions above.

### Option A — Floating hover overlay (portaled outside the host)

A single `position: fixed` `⛶` button rendered at the end of `<body>`. On `mouseenter` of a candidate, position it over a corner of the element; hide on `mouseleave`, scroll, or resize. Click opens the lightbox via the existing `ExpandLightbox.openLightbox` API.

- **Pro**: zero DOM mutation under the host control or inside a popup, so neither the v0.0.4 nor the v0.0.5 regression returns. Reuses the existing lightbox entry point unchanged.
- **Con**: hover-only is hostile to touch and keyboard. Tiny framework iconography (16–24 px persona/coin icons that may already pass a 64-px threshold by accident on some pages) would re-introduce the visual-noise problem the size threshold was meant to suppress. Requires a parallel "detect-only, don't-wrap" scan path. Positioning needs to recompute on scroll, resize, and SPA route changes.
- **Effort**: medium.

### Option B — Right-click context menu entry

`chrome.contextMenus.create({ id: 'expand-this', title: 'Expand this in lightbox', contexts: [...] })`. The background service worker forwards the click to the active tab content script, which resolves the clicked element and calls the existing lightbox open API.

- **Pro**: zero DOM mutation, works in any host context including open menus, dialogs, and inside `<button>`. Smallest code change. No accidental coverage of decorative iconography, since the user explicitly invokes it.
- **Con**: less discoverable than a hover button — only triggers on user action, so there is no visual hint that an element is expandable. For non-`<img>` targets the browser's native context types don't match cleanly: Chrome's `contexts: ['image']` only fires for `<img>` and CSS-background images, not for inline `<svg>` or `<table>`. Covering inline SVG and tables uniformly likely needs `contexts: ['all']` plus a runtime element check, or a page-side custom `contextmenu` listener. Adds a new `"contextMenus"` permission to `manifest.json` (currently not declared).
- **Effort**: small for `<img>`-only; medium if we want it to cover inline SVG and tables uniformly.

### Option C — Hybrid (A + B)

Floating overlay (Option A) for restricted spots that have room for it (e.g. a standalone Copilot icon button on its own), plus the context menu (Option B) as the universal escape hatch for menus, dialogs, and tiny targets.

- **Pro**: best discoverability for the common case, with a guaranteed fallback for the cases where the overlay is wrong (touch, keyboard, tiny icons in tight popups).
- **Con**: two surfaces to design, build, and test; the size-threshold and noise-suppression decisions in Q3 apply twice.
- **Effort**: small + medium = the sum of A and B.

<!-- dude:managed:start -->
## Definition Checklist
- [ ] Outcome is clear
- [ ] Scope is bounded
- [ ] Open questions are resolved or consciously assumed

## Coordinator Log
- 2026-05-08 13:00 — drafted from chat (options A/B/C captured)
<!-- dude:managed:end -->
