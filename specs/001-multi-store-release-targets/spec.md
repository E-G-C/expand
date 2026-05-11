# Feature Specification: Multi-Store Release Targets

## User Scenarios & Testing

### User Story 1 - Produce Store Packages From One Release Identity (Priority: P1)

A maintainer can start one release and receive Edge, Chrome, and Firefox store packages that all share the same release identity and version.

**Why this priority**: This is the core release outcome. Without it, the project still has a single-store pipeline and maintainers must coordinate store artifacts manually.

**Independent Test**: Start packaging from one valid release identity and verify that exactly three target packages are produced for Edge, Chrome, and Firefox with the same version.

**Acceptance Scenarios**:

1. **Given** a valid release identity using `vMAJOR.MINOR.PATCH`, **When** release packaging succeeds, **Then** Edge, Chrome, and Firefox packages are available under the same release identity.
2. **Given** one target package fails validation, **When** the release process runs, **Then** no release assets are published for any target.
3. **Given** the package set is complete, **When** a maintainer reviews the artifact names, **Then** each target package is clearly labeled for its store target and the shared version.

### User Story 2 - Verify Target Package Contents Before Store Upload (Priority: P2)

A maintainer can manually inspect each target package before uploading it to a store dashboard and confirm that the manifest shape and runtime payload are correct.

**Why this priority**: Store uploads remain manual in this iteration, so maintainers need a reliable way to confirm package correctness before submitting artifacts.

**Independent Test**: Open each target package and verify manifest rules, package naming, version consistency, and runtime payload consistency across targets.

**Acceptance Scenarios**:

1. **Given** target packages for Edge, Chrome, and Firefox, **When** a maintainer inspects their manifests, **Then** Firefox keeps `browser_specific_settings.gecko` and Edge/Chrome do not include it.
2. **Given** target packages for the same release, **When** a maintainer compares their runtime payloads, **Then** the payloads match except for approved per-target manifest transforms.
3. **Given** local package instructions, **When** a maintainer follows them, **Then** they can produce and inspect all three target packages without using store upload automation.

### User Story 3 - Preserve A Future Safari Extension Point (Priority: P3)

A maintainer can see where Safari support would be added later without this iteration producing or advertising a Safari artifact.

**Why this priority**: Safari packaging is materially different from the other targets, but the multi-store structure should not make a future Safari implementation harder.

**Independent Test**: Review the release documentation and target model and verify that Safari is documented as deferred, with an explicit extension point and no shipped Safari package.

**Acceptance Scenarios**:

1. **Given** the multi-store release documentation, **When** a maintainer looks for Safari guidance, **Then** Safari is identified as deferred and the future integration point is described.
2. **Given** a release is produced in this iteration, **When** the artifacts are listed, **Then** no Safari package is present.
3. **Given** store upload guidance, **When** a maintainer follows it, **Then** Safari-specific signing, Xcode packaging, and App Store submission are not required for this feature.

## Edge Cases

- A release identity is missing the leading `v`, has fewer or more than three version segments, contains prerelease labels, or contains non-numeric segments.
- A release identity contains a numeric segment above the browser manifest ceiling of 65535.
- A Firefox package is missing `browser_specific_settings.gecko`, which would break add-on identity expectations.
- An Edge or Chrome package includes `browser_specific_settings.gecko`, which should be stripped for Chromium-family targets.
- Runtime package contents diverge across targets outside the approved manifest transform.
- One target package builds successfully but another target fails validation before release asset publication.
- Release asset publication is retried for a release identity that already exists.
- A maintainer expects automated store API upload even though this iteration only supports manual dashboard uploads.
- A maintainer expects Safari output even though Safari is deferred.

## Functional Requirements

- **FR-001**: The system MUST produce Edge, Chrome, and Firefox target packages from one shared release identity.
- **FR-002**: The shared release identity MUST use a strict `vMAJOR.MINOR.PATCH` tag format for this iteration.
- **FR-003**: All target packages MUST use the same version derived from the shared release identity.
- **FR-004**: All target packages MUST share the same runtime payload except for approved per-target manifest transforms and target-specific artifact labels.
- **FR-005**: The Firefox target package MUST keep `browser_specific_settings.gecko` in its manifest.
- **FR-006**: Edge and Chrome target packages MUST NOT include `browser_specific_settings.gecko` in their manifests.
- **FR-007**: If any target build, validation, or required check fails, the system MUST NOT publish release assets for any target.
- **FR-008**: Maintainers MUST be able to produce Edge, Chrome, and Firefox packages locally before store upload.
- **FR-009**: Maintainers MUST be able to manually verify each target package's manifest shape, runtime payload, artifact label, and version before store upload.
- **FR-010**: Documentation MUST explain local packaging, manual store upload expectations, strict version policy, Firefox MV3 support floor, and the deferred Safari seam.
- **FR-011**: The system MUST NOT perform automated store API uploads in this iteration.
- **FR-012**: The system MUST NOT introduce per-store permission or branding divergence beyond the Firefox gecko keep/strip behavior.
- **FR-013**: Any release version synchronization MUST remain target-independent and occur once per shared release identity.
- **FR-014**: Safari support MUST remain a documented future extension point and MUST NOT produce a Safari artifact in this iteration.

## Key Entities

- **Release Identity**: A maintainer-visible release tag that determines the shared version for all target packages.
- **Store Target**: A browser store destination with a target label and a defined manifest treatment. This iteration includes Edge, Chrome, and Firefox; Safari is deferred.
- **Target Package**: A store-uploadable artifact containing the extension manifest and runtime payload for one store target.
- **Manifest Transform**: The approved per-target manifest difference applied while keeping the runtime payload common.
- **Runtime Payload**: The extension files included in every target package, excluding target-specific manifest differences.

## Success Criteria

- **SC-001**: A valid release identity produces exactly three target packages: Edge, Chrome, and Firefox.
- **SC-002**: Each target package uses the same version from the release identity and is clearly labeled for its target.
- **SC-003**: Package inspection confirms Firefox includes `browser_specific_settings.gecko` and Edge/Chrome omit it.
- **SC-004**: Package comparison confirms runtime payload contents are identical across targets aside from approved manifest transforms.
- **SC-005**: A failure in any target build, validation, or required check prevents release asset publication for all targets.
- **SC-006**: Release documentation enables a maintainer to package locally, verify target artifacts, understand manual store upload, and identify the Safari deferred seam.
- **SC-007**: No store API credentials, store API upload steps, or Safari packaging artifacts are required for this iteration.

## Assumptions

- The source manifest remains Firefox-shaped so the Firefox package can keep its gecko add-on identity.
- Firefox MV3 support is limited to modern Firefox versions, with Firefox 109+ as the documented support floor.
- Firefox store submission can use a zip package for this iteration; signing or XPI generation is not part of this feature.
- The strict shared version policy intentionally excludes prerelease labels even though Firefox may allow version shapes that Chromium-family stores reject.
- Manual upload to Microsoft Edge Add-ons, Chrome Web Store, and Mozilla Add-ons remains the publishing model.
- Safari requires a materially different packaging and signing path, so this feature only documents where Safari would plug in later.
