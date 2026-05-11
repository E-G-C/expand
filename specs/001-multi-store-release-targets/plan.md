# Implementation Plan: Multi-Store Release Targets

## Summary

Generalize the existing Edge-only release packaging path into one shared multi-store packaging and release flow. The packager will use a small in-file target configuration with per-target manifest transforms, the release workflow will package Edge, Chrome, and Firefox from one tag before publishing release assets, and documentation will shift from Edge-only guidance to manual multi-store release guidance with Safari explicitly deferred.

## Technical Context

**Language/Version**: JavaScript package tooling running under Node.js 20 in release automation  
**Primary Dependencies**: Node.js standard library, npm scripts, Vitest, GitHub Actions, GitHub CLI in the release runner  
**Storage**: N/A  
**Testing**: Vitest plus release/package smoke checks  
**Target Platform**: Browser extension packages for Microsoft Edge Add-ons, Chrome Web Store, and Mozilla Add-ons  
**Project Type**: Browser extension with release/packaging infrastructure  
**Performance Goals**: Package all runtime files once per target without introducing a build pipeline or large dependency footprint  
**Constraints**: No automated store API upload, no Safari artifact, no per-store permission or branding divergence beyond gecko keep/strip, one shared `vMAJOR.MINOR.PATCH` tag

## Guardrail Check

- `.github/dudestuff/guardrails.md` currently contains only bundle defaults. This plan follows the required separation: `spec.md` stays technology-agnostic and this file carries implementation details.
- Relevant durable decision: tag-driven release versioning is the project standard, deriving package version from the `v*` tag before packaging and syncing version files back to the default branch.
- No new project-wide guardrail is needed for this definition. The multi-store behavior is feature-specific and is captured in the spec, plan, tasks, and quickstart.

## Current State

- `scripts/package-extension.mjs` throws unless `--target edge` is supplied or implied.
- `buildManifest` only strips Gecko settings for Edge.
- `validateEdgeVersion` has Edge-specific naming and Edge-specific error messages.
- `.github/workflows/release-edge.yml` packages one Edge zip and publishes it immediately after that package exists.
- `docs/release.md` and `README.md` describe Edge-only packaging and release behavior.
- `package.json` exposes only `package:edge` for local packaging.

## Proposed Architecture

### Packager Target Model

- Add a `TARGETS` / `target -> transformFn` map in `scripts/package-extension.mjs` instead of external manifest override files.
- Keep `manifest.json` as the source of truth. It remains Firefox-shaped with `browser_specific_settings.gecko` present.
- Configure `edge` and `chrome` transforms to strip `browser_specific_settings.gecko`.
- Configure `firefox` to keep the source gecko settings intact.
- Validate requested targets against the map and return a target-neutral unsupported-target error listing supported targets.
- Keep Safari out of the supported target map for this iteration, with a TODO/doc seam explaining that Safari will need a different packaging path later.

### Version Validation

- Generalize `validateEdgeVersion` to target-neutral naming and wording, while preserving the strict numeric browser manifest rules: one to four dot-separated integer segments, no prerelease labels, each segment no greater than 65535.
- Keep the release workflow tag contract stricter than the packager validator: release tags must be exactly `vMAJOR.MINOR.PATCH`.
- Rename workflow validation messages such as `Edge manifest version segment` to target-neutral wording.

### Package Scripts

- Keep `package:edge` unchanged for compatibility.
- Add `package:chrome` and `package:firefox` scripts in `package.json`, each passing its target to the shared packager.
- Rely on the existing default output naming pattern so local package commands create `dist/expand-edge-<version>.zip`, `dist/expand-chrome-<version>.zip`, and `dist/expand-firefox-<version>.zip` unless an explicit `--output` is supplied.

### Release Workflow

- Rename `.github/workflows/release-edge.yml` to `.github/workflows/release.yml`.
- Rename workflow and job language from Edge-specific wording to multi-store release wording where applicable.
- Change concurrency from an Edge-specific group to a release-level group keyed as `release-${ref}`.
- Derive one version from a `vMAJOR.MINOR.PATCH` tag.
- Install dependencies once, run the test suite once, and normalize the package version once.
- Package all three target zips in one package job after tests pass.
- Verify that all expected zip outputs exist before any release asset publication step runs.
- Upload workflow artifacts only after the full package set exists.
- Publish all three GitHub Release assets only after all package outputs exist.
- Keep the version writeback as one target-agnostic job after package success.
- Remove target-specific publishing placeholder blocks from the workflow summary; move those details into `docs/release.md`.

### Atomic Publication Mitigation

The release flow can guarantee that package/test failures do not publish partial release assets by gating publication on successful creation and verification of all three zip outputs. GitHub Release asset upload itself is not fully transactional: if uploading multiple assets to an existing release fails partway through, earlier assets may already exist. Mitigation:

- For a new release, create the release with all three assets in one `gh release create` command after package verification.
- For an existing release, run a staging check that verifies all asset paths before publication, then upload all three assets in one `gh release upload ... --clobber` step.
- Document the residual retry/cleanup risk for existing-release retries in `docs/release.md` so maintainers know to remove or overwrite partial assets before rerunning if the GitHub API fails mid-upload.

### Documentation

- Update `docs/release.md` from Edge-only to multi-store release guidance.
- Document local package commands for Edge, Chrome, and Firefox.
- Document manual upload destinations and make clear that store API upload automation is out of scope.
- Document the strict shared version policy and why prerelease labels are deferred.
- Document Firefox MV3 support as modern Firefox only, with Firefox 109+ as the floor.
- Document that AMO accepts a zip for this iteration and that no XPI/signing step is added.
- Document the Safari deferred seam and why Safari needs a later macOS/Xcode/App Store Connect path.
- Update `README.md` packaging and release sections to point to the three target commands and the multi-store release doc.

## Project Structure

Future implementation work should touch these existing files only where needed:

```text
.github/workflows/release-edge.yml  -> .github/workflows/release.yml
scripts/package-extension.mjs
package.json
docs/release.md
README.md
tests/
```

The definition package for this feature lives at:

```text
specs/001-multi-store-release-targets/
  spec.md
  plan.md
  quickstart.md
  tasks.md
  checklists/test.md
```

No `data-model.md` or `contracts/` directory is planned because this feature changes release/package infrastructure rather than persistent data or external APIs.

## Risks And Tradeoffs

- GitHub Release asset publication is not fully atomic for existing releases. The plan minimizes partial publication risk by staging all package checks before upload and using one release create/upload step, but API failures may still require cleanup or a clobber retry.
- Renaming the workflow changes the visible Actions workflow/check name, which may affect branch protection or user expectations if those checks are referenced elsewhere.
- Firefox MV3 compatibility applies to modern Firefox only; older Firefox versions are not supported by this feature.
- AMO accepts zip upload, so this iteration avoids XPI generation and signing. That keeps the release path lean but leaves signing/store review details manual.
- Keeping one strict `vMAJOR.MINOR.PATCH` policy makes the release identity common across stores but defers Firefox-specific prerelease version flexibility.
- Deferring external manifest override files keeps the packager simple now, but future per-store branding, permissions, keys, or OAuth differences may justify adding that layer later.

## Phases

1. Generalize packager target configuration, manifest transforms, target-neutral version validation, and package scripts.
2. Add tests for Edge, Chrome, and Firefox manifest shape, output naming, and version behavior.
3. Rename and generalize the release workflow so one tag packages all targets and publishes release assets only after all outputs exist.
4. Update release documentation and README content for multi-store local packaging, manual upload, strict versioning, Firefox support floor, and Safari deferral.
5. Verify local package commands, test suite, workflow structure, and documentation coverage against the spec.
