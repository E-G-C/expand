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

## Edge Add-ons Placeholders

The current workflow creates a GitHub Release asset for manual upload to Microsoft Edge Add-ons. Before adding automated Edge store submission, configure the publish path and store the required values as repository secrets or an environment-protected secret set:

- `EDGE_ADDONS_PRODUCT_ID`: Edge Add-ons listing or product identifier
- `EDGE_ADDONS_CLIENT_ID`: publishing API client or application identifier
- `EDGE_ADDONS_CLIENT_SECRET`: publishing API secret
- `EDGE_ADDONS_TENANT_ID`: tenant identifier, if required by the chosen auth flow
- `EDGE_ADDONS_SUBMIT_FOR_REVIEW`: optional gate for upload-only versus submit-for-review behavior

Do not weaken branch protection or broaden token permissions to publish. Add only the minimum permissions required by the chosen Edge Add-ons API integration.