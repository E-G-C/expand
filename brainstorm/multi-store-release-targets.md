---
title: Support multiple store release targets (Edge, Chrome, Firefox now; Safari later) sharing one packager and workflow
slug: multi-store-release-targets
status: defined
spec_path: specs/001-multi-store-release-targets/spec.md
---

# Brainstorm: Support multiple store release targets (Edge, Chrome, Firefox now; Safari later) sharing one packager and workflow

## User Draft

Originally picked option 2 from a 3-option recommendation:

> Add a `chrome` target to the existing packager + workflow (small). Generalize `scripts/package-extension.mjs` so `--target chrome` produces `dist/expand-chrome-<version>.zip` (functionally identical to Edge today, but named/labeled distinctly so future store-specific differences — e.g., key, OAuth client ID, narrower host permissions — have a place to land). Add one more `Package Chrome zip` + upload step to `.github/workflows/release-edge.yml` (and probably rename it `release.yml`). One workflow, two assets.

Option 3 (full automated Chrome Web Store API upload) was explicitly **not** chosen.

Then the user expanded scope:

> "I'd like to release also for firefox, and maybe later for safari, take this into consideration so we make use of the common artifacts"

So this brainstorm is no longer "add Chrome alongside Edge" — it is "support multiple store release targets (Edge today, plus Chrome and Firefox in this iteration, with a clean seam for Safari later) sharing as much packaging infrastructure as possible." Automated store API uploads remain out of scope.

Latest clarification answers:

> 1. suggest best/more practical approach
> 2. rename
> 3. one tag
> 4. atomic
> 5. TODO

Latest user acceptance:

> "let's go with your suggestions"

<!-- dude:managed:start -->
## Normalized Intent
- Ship three store-targeted zips per release tag in this iteration: Edge (existing), Chrome (new), Firefox (new). Safari is intentionally deferred.
- Maximize shared infrastructure: one packager script, one release workflow, one tag shape, with target-specific behavior isolated behind a small target configuration / `target -> transformFn` map rather than parallel pipelines or branched if/else ladders.
- Keep external `manifest.<target>.json` override files deferred unless real per-store divergence appears later.
- Manual store dashboard uploads remain the publishing model for all three targets this iteration. No Chrome Web Store, Microsoft Edge Add-ons, or Mozilla AMO API automation.
- Leave a documented seam (transform map entry, config, or doc note) where a future Safari target plugs in, without committing to implementing it now.
<!-- dude:managed:end -->

<!-- dude:managed:start -->
## Constraints
- The packager today throws on any `--target` other than `edge` — adding `chrome` and `firefox` is real code, not flag flips.
- `removeFirefoxOnlySettings` currently strips `browser_specific_settings.gecko` only when `options.target === 'edge'`. Chrome needs the same strip; **Firefox needs the inverse — keep `browser_specific_settings.gecko` intact** because AMO requires it for add-on identity. The per-target transform must express both behaviors in one place instead of one-off branches.
- Source `manifest.json` already includes `browser_specific_settings.gecko.id = "expand@browser-extension"`, so the runtime/source manifest is already Firefox-shaped. Chromium targets remove the gecko block; Firefox keeps it.
- `validateEdgeVersion` enforces 1–4 dot-separated integers each ≤ 65535. Chrome's published rule is the same shape. Firefox/AMO accepts SemVer-style versions and additionally allows pre-release suffixes that Chromium rejects, but for this iteration we keep the strict `vMAJOR.MINOR.PATCH` tag shape so the same validator works for all three; the validator and its error wording need to become target-neutral.
- The release workflow's bash regex enforces the stricter `vMAJOR.MINOR.PATCH` (3-segment) tag shape and the same 65535 ceiling, with an error message labeled `"Edge manifest version segment"`. The JS validator allows 1–4 segments. Reconciling the names and messages is now a multi-store concern, not Edge-vs-Chrome.
- The current workflow runs `npm run package:edge -- --version … --output …` and uploads exactly one zip; the `Record Edge publishing placeholders` step writes Edge-Add-ons-only secret reminders to the job summary. Multi-store needs the workflow to package all three targets and attach all three zips to the same GitHub Release.
- Firefox AMO accepts `.zip` for submission (an XPI is a renamed zip), so the packager output shape can stay as `.zip` for all three targets. No special signing or `.xpi` step is required for AMO submission of unsigned listed add-ons.
- MV3 is supported on Firefox 109+. The current `manifest.json` is MV3, so the same source manifest works on modern Firefox; no MV2 fallback is in scope.
- Safari ships Web Extensions wrapped in an Xcode project. Producing a Safari artifact in a Linux GitHub Actions runner is not practical without macOS runners + Xcode + App Store Connect credentials. Safari is deferred, but the packager and workflow shape must not foreclose it (e.g., do not hardcode "the output is always a `.zip` in `dist/`" in places that would force a future fork).
- The `version-writeback` job that syncs `package.json`, `package-lock.json`, and `manifest.json` back to `main` is target-agnostic and should remain a single job per release tag, not per target.
- Out of scope items below are firm.
<!-- dude:managed:end -->

## In Scope

- New packager modes: `--target chrome` and `--target firefox`, alongside the existing `--target edge`. All three produce a `.zip` in `dist/` whose filename includes the target slug and version (e.g., `expand-chrome-<version>.zip`, `expand-firefox-<version>.zip`).
- Per-target manifest transform layer in `scripts/package-extension.mjs` — for example, a small `target -> transformFn` map — so Edge's gecko-strip, Chrome's gecko-strip, and Firefox's gecko-keep are all expressed in the same place. Replaces the current single-branch `if (options.target === 'edge')` block.
- Workflow updates so a single release tag triggers packaging of all three target zips and attaches all three to the same GitHub Release, sharing one checkout / install / test pass where practical.
- Generalize `validateEdgeVersion` and the workflow's `"Edge manifest version segment"` error message to be target-neutral (name and wording), keeping the same numeric rules.
- Explicit local package scripts for each target: keep the existing `package:edge` script and add `package:chrome` / `package:firefox` scripts.
- Documentation refresh in `docs/release.md` covering all three targets and an explicit note that Safari is intentionally deferred.
- A documented TODO-only Safari seam in the target configuration or docs, describing where a future Safari target would plug in without adding a working `--target safari` stub or implementing Safari packaging.
- README touch-ups so the install / packaging instructions reflect three targets instead of one.

## Out of Scope

- Automated store API uploads to Chrome Web Store, Microsoft Edge Add-ons, or Mozilla AMO. Manual zip upload to each store dashboard remains the publishing model this iteration.
- Implementing the Safari target itself, adding macOS runners, Xcode signing, App Store Connect submission, or `.xcodeproj`/`.appex` generation.
- Narrowing `host_permissions` per-store, splitting `<all_urls>`, store listing assets (screenshots, promo tiles, descriptions), and privacy disclosure copy.
- Per-store manifest divergence beyond the gecko keep/strip — Chrome `key`, `oauth2`, `update_url`, per-store branding (`name`, `description`), or AMO-specific keys outside `browser_specific_settings.gecko`.
- Restructuring the `version-writeback` job that syncs `package.json` / `package-lock.json` / `manifest.json` back to `main`. It stays target-agnostic.
- Changing the release tag format from `vMAJOR.MINOR.PATCH`. Pre-release suffixes that AMO would accept are deferred.
- Adding new repository secrets or environments. No store API credentials in this iteration.

## Resolved Decisions

- **Per-target transform shape**: Use one shared packager with a small target configuration / `target -> transformFn` map inside `scripts/package-extension.mjs`. Edge and Chrome strip `browser_specific_settings.gecko`; Firefox keeps it. Do not introduce external `manifest.<target>.json` override files yet; add them later only if real per-store divergence appears. Avoid an `if/else` ladder so common artifacts stay central and Safari remains easier to add later.
- **Workflow filename and release shape**: Conceptually rename `.github/workflows/release-edge.yml` to `.github/workflows/release.yml` during implementation and keep one shared release workflow. This is a brainstorm decision only; no workflow file is renamed by this update.
- **Release tag shape**: One shared `vMAJOR.MINOR.PATCH` tag drives Edge, Chrome, and Firefox zips on one GitHub Release.
- **Failure isolation**: Releases are atomic. If any target package/test step fails, do not publish partial release assets.
- **Safari seam**: Add only a documented TODO/seam for Safari in the target configuration or docs. Do not add a working `--target safari` and do not implement Safari packaging in this iteration.
- **npm scripts**: Keep the existing `package:edge` script and add `package:chrome` / `package:firefox` scripts instead of replacing them with a single generic `package` script.
- **Workflow concurrency**: Use one workflow-level `release-${ref}` concurrency group for the shared multi-store release workflow.
- **Publishing placeholder details**: Move store-publishing placeholder details into `docs/release.md` instead of keeping target-specific placeholder blocks in the workflow summary.
- **Manifest source of truth**: Keep `manifest.json` as the Firefox-shaped source of truth. Chromium targets strip `browser_specific_settings.gecko` through per-target transforms.

## Open Questions

None currently; remaining implementation details are covered by resolved decisions and assumptions.

## Assumptions

- Source `manifest.json` keeps the Firefox-required `browser_specific_settings.gecko.id` and remains the canonical input to the packager. Per-target transforms run in `scripts/package-extension.mjs`.
- The practical packager direction is a small in-file target configuration / `target -> transformFn` map. External per-target manifest override files stay deferred until actual store divergence justifies them.
- Keep the existing `package:edge` npm script and add explicit `package:chrome` / `package:firefox` aliases for local packaging; do not collapse them into one generic `package` command this iteration.
- The existing MV3 manifest is functionally compatible with Edge, Chrome, and Firefox 109+; the only guaranteed per-target difference is whether `browser_specific_settings.gecko` is kept (Firefox) or stripped (Edge, Chrome).
- All three store zips are byte-comparable in their `content/`, `popup/`, `icons/`, and `styles/` payloads — the only differences come from per-target manifest transforms and the filename label.
- One `vMAJOR.MINOR.PATCH` GitHub Release tag attaches all three store zips for this iteration. No per-store tag fan-out.
- The release workflow is renamed conceptually from `.github/workflows/release-edge.yml` to `.github/workflows/release.yml` during implementation.
- The shared release workflow uses one workflow-level concurrency group keyed as `release-${ref}`.
- Release asset publication is all-or-nothing: tests/package steps for every target must pass before any target zip is uploaded to the GitHub Release.
- Store-publishing reminders and placeholder details live in `docs/release.md`; the workflow summary should not carry target-specific placeholder blocks.
- The default packager output naming pattern (`${slug}-${target}-${version}.zip`) is fine — adding `chrome` and `firefox` produces `expand-chrome-<version>.zip` and `expand-firefox-<version>.zip` for free without overriding `--output`.
- Manual upload to each store dashboard remains the publishing model. No new repository secrets are required this iteration.
- The `version-writeback` job runs once per release tag and stays target-agnostic.
- Safari is deferred to a separate future feature; this brainstorm only commits to a TODO-only seam in target configuration or docs, not to adding a working `--target safari` or implementing Safari packaging.

<!-- dude:managed:start -->
## Definition Checklist
- [x] Outcome is clear
- [x] Scope is bounded
- [x] Open questions are resolved or consciously assumed

## Coordinator Log
- 2026-05-11 — rescoped from "chrome-only release target" to "multi-store release targets (Edge, Chrome, Firefox now; Safari deferred)" after user expansion request; brainstorm renamed `chrome-store-release-target.md` -> `multi-store-release-targets.md`, slug and title updated, scope/constraints/open-questions/assumptions rewritten to reflect shared packager + shared workflow + per-target transform layer
- 2026-05-11 00:00 UTC — recorded user's clarification decisions for transform map, workflow rename, one shared tag, atomic release publishing, and TODO-only Safari seam; cleaned resolved open questions
- 2026-05-11 00:00 UTC — recorded user's acceptance of the remaining suggested defaults for npm scripts, workflow concurrency, publishing placeholder docs, and manifest source-of-truth model; brainstorm ready for definition
- 2026-05-11 00:00 UTC — defined -> specs/001-multi-store-release-targets/spec.md
- 2026-05-11 00:00 UTC — cleaned stale brainstorm wording after definition
- 2026-05-11 14:37 UTC — Lightweight Execution started; T001@4f7a2c9b marked [~] for packager target configuration, manifest transforms, validator, and package scripts
- 2026-05-11 14:58 UTC — T001@4f7a2c9b marked [x] after Release Manager implementation, Tester package verification, and Reviewer approval; board refreshed with T002@8c1de4a6 and T004@61e7c3b8 ready
- 2026-05-11 15:05 UTC — T002@8c1de4a6 marked [~] for package behavior tests; T004@61e7c3b8 remains ready
- 2026-05-11 15:44 UTC — T002@8c1de4a6 marked [x] after Tester implementation, coordinator independent npm test re-run (84/84 passed), and Reviewer approval; board refreshed with T004@61e7c3b8 ready
- 2026-05-11 15:56 UTC — T003@f2a9b0d4 and T004@61e7c3b8 marked [~] for parallel workflow and documentation implementation
- 2026-05-11 16:19 UTC — T003@f2a9b0d4 and T004@61e7c3b8 marked [x] after implementation, Tester verification, coordinator checks (git diff --check, workflow YAML parse, npm test 84/84), and Reviewer approval; board refreshed with T005@a7d5e290 ready
- 2026-05-11 16:20 UTC — T005@a7d5e290 marked [~] for final verification across package commands, tests, manifests, workflow gates, and docs
- 2026-05-11 16:30 UTC — T005@a7d5e290 marked [x] after final Tester verification, generated artifact cleanup, Reviewer approval, and local checks; Lightweight Execution complete
<!-- dude:managed:end -->
