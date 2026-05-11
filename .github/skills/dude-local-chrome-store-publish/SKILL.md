---
name: "dude-local-chrome-store-publish"
description: "Use when preparing this browser extension for Chrome Web Store review or submission: permission audits, manifest readiness, privacy policy alignment, store listing copy, permission justifications, and store asset checks. Excludes packaging/build workflow creation and Playwright-based asset capture."
---

# Chrome Web Store Publishing Readiness

Use this skill to prepare this extension for Chrome Web Store review without importing a separate build process or screenshot automation stack.

## Source Adaptation

This local skill was adapted from `https://github.com/ofelipelourenco/chrome-store-publish/blob/main/SKILL.md`.

Kept:

- Permission, host-access, manifest, privacy, listing, asset, and final submission readiness checks.
- Store-facing constraints such as name length, short-description length, permission justifications, and required image dimensions.

Excluded:

- Creating `build.sh` or a new packaging flow.
- Importing `scripts/build_extension_zip.py` or any sibling reference files.
- Playwright installation, capture scripts, or generated HTML screenshot workflows.

## When To Run

- The user wants to publish, submit, or prepare the extension for the Chrome Web Store.
- The user asks for store review readiness, permission review, manifest cleanup, privacy policy checks, store listing copy, screenshots, promotional images, or permission justifications.
- A release is headed toward Chrome Web Store submission and needs policy/compliance evidence before packaging or upload.

For tag-driven release versioning, package manifest write-back, or cross-pipeline release parity, route to the existing release-management skills instead.

## Workflow

### 1. Establish The Project Baseline

Read the repository's current extension and release artifacts before suggesting changes:

- `manifest.json`
- `package.json`
- `PRIVACY.md`, if present
- `docs/release.md`, if packaging or release behavior matters
- Any existing store listing, permission justification, or asset files

Record the manifest fields that affect review:

- `manifest_version`, `name`, `version`, and `description`
- `permissions`, `optional_permissions`, and `host_permissions`
- `content_scripts[].matches`, `background`, `action`, `icons`, and `web_accessible_resources`
- Browser-specific settings that Chrome may ignore but reviewers may still see in source

Do not introduce a new build script, packaging command, or screenshot automation as part of this skill. If a package artifact already exists, inspect it as evidence; if packaging is needed, use the project's existing release docs or ask before changing release tooling.

### 2. Audit Permissions And Host Access

Map every declared permission to actual code usage and user-facing need.

Common mappings:

- `storage` -> `chrome.storage`
- `tabs` -> `chrome.tabs`
- `activeTab` -> user-initiated access, content-script injection, or `chrome.scripting.executeScript`
- `scripting` -> `chrome.scripting`
- `alarms` -> `chrome.alarms`
- `notifications` -> `chrome.notifications`
- `webNavigation` -> `chrome.webNavigation`
- `webRequest` -> `chrome.webRequest`
- `cookies` -> `chrome.cookies`
- `downloads` -> `chrome.downloads`
- `bookmarks` -> `chrome.bookmarks`
- `history` -> `chrome.history`
- `clipboardWrite` / `clipboardRead` -> `navigator.clipboard` or `document.execCommand`

For each permission, classify it as `KEEP`, `REMOVE`, `MOVE_TO_OPTIONAL`, or `NEEDS_JUSTIFICATION`.

For URL access, check both `host_permissions` and `content_scripts[].matches`:

- Flag broad patterns such as `<all_urls>` and `*://*/*` unless the product behavior clearly requires page-level operation across arbitrary sites.
- Prefer narrower host patterns when the extension only works on known domains.
- When broad access is genuinely required, produce a plain-language justification that explains what is read locally, what is not collected, and what user action starts the behavior.

Also scan shipped code for network calls and sensitive data:

- `fetch(`, `XMLHttpRequest`, WebSocket usage, analytics SDKs, or external API clients
- API keys, tokens, credentials, `.env` files, and other secrets that must not ship
- Local storage or sync storage usage that must be described in privacy materials

### 3. Verify Manifest Readiness

Check the manifest against Chrome Web Store review expectations:

- `manifest_version` is `3`.
- `description` is accurate, under 132 characters, and does not imply hidden or automatic action without consent.
- Icons referenced at 16, 48, and 128 pixels exist and are valid PNG files.
- Content scripts run only where intended and at the needed `run_at` timing.
- `web_accessible_resources` entries are limited to files that must be exposed.
- `homepage_url`, support URLs, or other public links are present when needed and contain no placeholders.
- Version is higher than the last submitted Chrome Web Store version when preparing an upload.

If the manifest is not MV3, guide the migration conceptually but do not perform a broad migration unless the user explicitly asks for implementation.

### 4. Align Privacy And Data Statements

Derive the privacy story from the audit evidence, not from marketing claims.

Confirm the policy states:

- What data the extension reads from pages, URLs, or browser APIs.
- What data is stored locally, if any.
- Whether data is transmitted to any server or third party.
- Whether analytics, advertising, tracking, or external APIs are used.
- How users can contact the maintainer.

If the repository already has `PRIVACY.md`, prefer verifying and updating it over creating a second policy file. If the Chrome Web Store listing needs a public privacy-policy URL, verify the chosen URL is live before calling the submission ready.

### 5. Prepare Listing And Permission Justifications

For store listing copy, enforce Chrome Web Store constraints:

- Name: 45 characters or fewer, clear, and not keyword-stuffed.
- Short description: 132 characters or fewer, accurate, and user-facing.
- Detailed description: explain what the extension does, key features, basic use, privacy commitment, and support path.
- Category: choose the closest Chrome Web Store category based on actual behavior.

For every permission and broad URL access pattern, write a user-facing justification with:

- What capability the permission enables.
- When the extension uses it.
- What data is accessed.
- Whether data leaves the browser.

Use this report shape when useful:

| Item | Evidence | Verdict | Store Justification |
|------|----------|---------|---------------------|
| `storage` | `chrome.storage` usage in settings code | KEEP | Saves local preferences on the user's device. |

Create or update listing/justification documents only when the user asks for persistent artifacts; otherwise include the draft content in the response.

### 6. Check Store Assets

Know the required image constraints, but do not add screenshot automation:

| Asset | Size | Required |
|-------|------|----------|
| Extension icon | 128x128 PNG | Yes |
| Screenshot | 1280x800 or 640x400 | Yes, 1-5 |
| Small promo tile | 440x280 PNG | Yes |
| Marquee promo tile | 1400x560 PNG | No |

Asset checks:

- Images use real extension UI or realistic product states.
- Screenshots are not dark, blurred, cropped, or purely atmospheric when users need to inspect the product.
- Dimensions match Chrome Web Store requirements exactly.
- Promotional images do not make unsupported claims or imply behavior the extension does not have.

If the user later asks to generate assets, treat that as a separate frontend/design task and ask before adding any new automation or dependencies.

### 7. Final Readiness Checklist

Before saying the extension is ready for Chrome Web Store submission, verify fresh evidence for each applicable item:

- Manifest is MV3.
- Every permission has code evidence and a user-facing justification.
- Broad URL access is either narrowed or explicitly justified.
- No hardcoded secrets or credentials ship.
- Privacy policy matches actual data behavior and has a live public URL if required.
- Store name and short description meet length limits.
- Store listing text matches actual functionality and avoids misleading claims.
- Required icons and store assets exist with correct dimensions.
- If a package artifact is provided, `manifest.json` is at the package root and development-only files are excluded.
- The extension loads locally without console errors in developer mode when validation includes runtime checks.

If any checklist item fails, report it as a blocker and avoid submission-ready language.

## Output Format

Prefer a concise readiness report:

- `Ready`: items that pass with evidence.
- `Needs work`: concrete blockers before submission.
- `Suggested fixes`: smallest scoped changes or documents to create.
- `Store copy`: draft listing text or permission justifications when requested.
- `Verification`: commands, manual checks, or file evidence used during the review.

## Boundaries

- Do not import build scripts, package-generation logic, Playwright flows, capture scripts, or external template/reference files through this skill.
- Do not submit to the Chrome Web Store or automate publisher API credentials.
- Do not claim readiness without fresh verification evidence.
- Do not broaden permissions or host access for convenience; prefer least privilege and clear justification.