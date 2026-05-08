---
title: Harden the GitHub viewscreen iframe bridge
slug: harden-viewscreen-bridge
status: draft
spec_path:
---

# Brainstorm: Harden the GitHub viewscreen iframe bridge

## User Draft

The bridge between `content/viewscreen-bridge.js` (running inside GitHub's viewscreen iframe) and the parent-side `listenForViewscreenDiagrams` handler in `content/detector.js` currently accepts and emits cross-frame `postMessage` traffic without origin checks or payload bounds. Any other iframe embedded on the page can spoof messages that the parent listener will accept, and the bridge itself does not validate that incoming `expand-request-svg` messages come from the parent window we trust. There is also no upper bound on the `svgHtml` payload we relay back, so a pathological diagram (or a hostile message) could push very large strings through the bridge.

Harden the bridge so it is safe against spoofed messages from other iframes embedded on the same page and against pathological payload sizes, without changing behavior for legitimate github.com / github.dev / Codespaces users.

<!-- dude:managed:start -->
## Normalized Intent
- Add a parent-side origin allowlist check in `listenForViewscreenDiagrams` so messages from origins outside the trusted GitHub viewscreen origin are dropped.
- Add a bridge-side validation in `content/viewscreen-bridge.js` that incoming `expand-request-svg` messages come from `window.parent` and from a trusted parent origin.
- Enforce a payload size cap on `svgHtml` (and any other relayed strings) so oversized messages are rejected on both sides instead of being relayed.

## Constraints
- No behavior change for legitimate github.com / github.dev / Codespaces users.
- No new permissions or host entries in `manifest.json`.
<!-- dude:managed:end -->

## Open Questions
1. Scope: should the parent listener accept messages only from `https://viewscreen.githubusercontent.com`, or also from a configured allowlist (for example to cover GitHub Enterprise Server installations)?
2. Security: what is the right upper bound on `svgHtml` payload size before we reject? 5 MB is a reasonable starting point — do enterprise diagrams ever exceed that?
3. Technical: should the bridge-side listener for `expand-request-svg` also validate the message source (`e.source === window.parent`) in addition to the origin allowlist?

<!-- dude:managed:start -->
## Definition Checklist
- [ ] Outcome is clear
- [ ] Scope is bounded
- [ ] Open questions are resolved or consciously assumed

## Coordinator Log
- No coordinator events yet
<!-- dude:managed:end -->
