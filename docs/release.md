# Release Pipeline

Expand's GitHub release workflow uses one shared `vMAJOR.MINOR.PATCH` tag to package Microsoft Edge, Chrome, and Firefox store artifacts. A successful release produces three zips attached to the GitHub Release:

- `expand-edge-<version>.zip`
- `expand-chrome-<version>.zip`
- `expand-firefox-<version>.zip`

## Release Tags And Version Policy

Create a tag that uses exactly three numeric version segments:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The workflow strips the leading `v`, validates the version, runs `npm test`, normalizes `package.json` and `package-lock.json` in the runner workspace with `npm version`, and writes the same version into each packaged `manifest.json`.

Release tags must use `vMAJOR.MINOR.PATCH` with numeric segments only. Prerelease labels are not accepted for this shared release path, even though Mozilla Add-ons can accept broader version shapes. Each numeric segment must be `65535` or lower to satisfy browser manifest limits.

The runner workspace normalization is build-time only. If the released version also needs to be committed back to the default branch, keep that writeback target-agnostic and update the package files from the shared release identity rather than per store.

## Packaged Files

Each target zip contains the same runtime files:

- `manifest.json`
- `content/`
- `styles/`
- `popup/`
- `icons/`

The zips exclude development files such as tests, specs, docs, Node dependencies, and workflow files.

Target packages differ only by approved manifest treatment:

- Edge and Chrome strip `browser_specific_settings.gecko`.
- Firefox keeps `browser_specific_settings.gecko.id`.

## Local Packaging

```bash
npm run package:edge
npm run package:chrome
npm run package:firefox
```

Pass an explicit version and output path when preparing a specific artifact:

```bash
npm run package:edge -- --version 1.2.3 --output dist/expand-edge-1.2.3.zip
npm run package:chrome -- --version 1.2.3 --output dist/expand-chrome-1.2.3.zip
npm run package:firefox -- --version 1.2.3 --output dist/expand-firefox-1.2.3.zip
```

The local package commands stage a target-specific manifest in the zip without changing the source `manifest.json`.

## Store Uploads

Upload the generated zips manually after inspecting them:

- Microsoft Edge Add-ons: `expand-edge-<version>.zip`
- Chrome Web Store: `expand-chrome-<version>.zip`
- Mozilla Add-ons: `expand-firefox-<version>.zip`

Store API uploads are out of scope for this iteration, and no repository secrets are required for store publishing. Firefox support targets MV3 on Firefox 109 and newer. Mozilla Add-ons accepts the generated zip for this iteration; no XPI generation or signing step is added.

## GitHub Release Asset Retries

Package, test, and output checks run before GitHub Release assets are published. GitHub asset upload to an existing release is not perfectly transactional, so a failed retry can leave partial assets behind. If that happens, remove or overwrite the partial assets before rerunning the release.

## Safari

Safari packaging is deferred. A future Safari target will need macOS runners, Xcode packaging and signing, and an App Store Connect submission path. This release flow does not produce a Safari package.

