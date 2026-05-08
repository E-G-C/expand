# Release Pipeline

Expand's GitHub release workflow first targets Microsoft Edge. A release tag packages the extension runtime files into a zip and attaches that zip to the GitHub Release.

## Edge Release Tags

Create a tag that uses a plain numeric semantic version:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The workflow strips the leading `v`, validates the version for Edge's manifest rules, runs `npm test`, normalizes `package.json` and `package-lock.json` in the runner workspace, and writes the same version into the packaged `manifest.json`.

This version normalization is build-time only. If the released version also needs to be committed back to the default branch, update `package.json`, `package-lock.json`, and `manifest.json` together in a follow-up PR.

## Packaged Files

The Edge zip contains only extension runtime files:

- `manifest.json`
- `content/`
- `styles/`
- `popup/`
- `icons/`

The zip excludes development files such as tests, specs, docs, Node dependencies, and workflow files.

## Local Packaging

```bash
npm run package:edge
npm run package:edge -- --version 1.2.3 --output dist/expand-edge-1.2.3.zip
```

The local package command stages an Edge-targeted manifest in the zip without changing the source `manifest.json`.

