---
title: Retire the GitHub viewscreen iframe bridge once inline rendering is universal
slug: retire-viewscreen-bridge
status: draft
spec_path:
---

# Brainstorm: Retire the GitHub viewscreen iframe bridge once inline rendering is universal

## User Draft

GitHub has been migrating Mermaid rendering away from cross-origin viewscreen iframes and toward inline enrichment in the page itself: a `<section data-type="mermaid">` containing an inline `<svg aria-roledescription="flowchart">`. The detector already covers the inline path through tier 1 (the `aria-roledescription` heuristic) and tier 3 (the `section[data-type="mermaid"] .js-render-enrichment-target > svg` site selector).

When the iframe rendering path is no longer reachable on github.com, github.dev, and Codespaces, the bridge becomes vestigial. At that point we can delete:

- `content/viewscreen-bridge.js`
- the matching `content_scripts` entry for `viewscreen.githubusercontent.com` in `manifest.json`
- `listenForViewscreenDiagrams` and `requestViewscreenSvgs` in `content/detector.js`
- the related `viewscreenHandler` plumbing and any tests that exercise it

This brainstorm tracks the **monitoring practice + eventual deletion**, not an immediate code change. We need a way to know when the iframe path is gone for our targeted GitHub surfaces, and a clear retirement bar that triggers the removal PR.

<!-- dude:managed:start -->
## Normalized Intent
- Establish a monitoring practice for the inline-vs-iframe Mermaid rendering path on the GitHub surfaces we care about (github.com, github.dev, Codespaces, and possibly GHES).
- Define the retirement bar that lets us delete the viewscreen bridge code, its `manifest.json` entry, the parent-side listener, and related tests as a single PR.

## Constraints
- No extension behavior change until the inline rendering path is confirmed universal on the targeted GitHub surfaces.
- Deletion must remove all four artifacts as one PR — bridge script, manifest entry, parent-side handler, and tests.
<!-- dude:managed:end -->

## Open Questions
1. Scope: include GitHub Enterprise Server in the retirement bar, or keep the bridge alive for older GHES versions and only retire on github.com / github.dev / Codespaces?
2. UX: do we need a transitional period where both paths run and we prefer the inline path if both fire on the same page? The detector already deduplicates by SVG identity, so this may be a non-issue.
3. Technical: what concrete signal will trigger retirement — a manual quarterly check, a flag we expose to ourselves in dev tools, or a specific GitHub release that ships the change?

## Assumptions
- The detector's tier 1 + tier 3 paths already detect GitHub's inline Mermaid rendering today, verified by the existing `tests/fixtures/github-mermaid.html` fixture and the tier-1 tests in `tests/fixtures/detector.test.js`.
- A coordinator-led test fixture mirroring GitHub's enrichment markup is being added in parallel to lock that coverage in (`tests/fixtures/github-inline-mermaid.html`, work in flight on a separate branch).

<!-- dude:managed:start -->
## Definition Checklist
- [ ] Outcome is clear
- [ ] Scope is bounded
- [ ] Open questions are resolved or consciously assumed

## Coordinator Log
- No coordinator events yet
<!-- dude:managed:end -->
