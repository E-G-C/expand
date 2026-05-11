# Quickstart: Multi-Store Release Verification

Use this after implementation to smoke-test the multi-store package flow before uploading artifacts to store dashboards.

## 1. Install And Test

```bash
npm ci
npm test
```

## 2. Build Local Target Packages

```bash
rm -rf dist
npm run package:edge -- --version 1.2.3
npm run package:chrome -- --version 1.2.3
npm run package:firefox -- --version 1.2.3
ls dist/expand-edge-1.2.3.zip dist/expand-chrome-1.2.3.zip dist/expand-firefox-1.2.3.zip
```

## 3. Inspect Target Manifests

```bash
unzip -p dist/expand-edge-1.2.3.zip manifest.json
unzip -p dist/expand-chrome-1.2.3.zip manifest.json
unzip -p dist/expand-firefox-1.2.3.zip manifest.json
```

Expected results:

- Edge manifest omits `browser_specific_settings.gecko`.
- Chrome manifest omits `browser_specific_settings.gecko`.
- Firefox manifest keeps `browser_specific_settings.gecko.id`.
- All three manifests use version `1.2.3`.

## 4. Compare Runtime Payloads

```bash
for target in edge chrome firefox; do
  unzip -Z1 "dist/expand-${target}-1.2.3.zip" | sort > "dist/${target}-files.txt"
done
diff -u dist/edge-files.txt dist/chrome-files.txt
diff -u dist/edge-files.txt dist/firefox-files.txt
```

Expected result: file lists match. Any content differences should be limited to `manifest.json` and the target-specific package filename.

## 5. Release Dry Run

Use workflow dispatch with an existing test tag to validate package creation and workflow artifacts without relying on store dashboards. Before pushing a real release tag, confirm the workflow verifies all package outputs before any release asset publication step.

## 6. Store Upload Model

Upload the generated zips manually:

- Microsoft Edge Add-ons: `dist/expand-edge-<version>.zip`
- Chrome Web Store: `dist/expand-chrome-<version>.zip`
- Mozilla Add-ons: `dist/expand-firefox-<version>.zip`

Safari is intentionally deferred. Do not expect a Safari package from this feature.
