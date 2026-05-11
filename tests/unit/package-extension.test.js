// tests/unit/package-extension.test.js
//
// Regression coverage for scripts/package-extension.mjs (T001 -> T002).
// Spawns the real packager via `node scripts/package-extension.mjs` so the
// behavior under test matches what release automation runs.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../..');
const PACKAGER = path.join(REPO_ROOT, 'scripts', 'package-extension.mjs');
const DIST_DIR = path.join(REPO_ROOT, 'dist');

// Clearly test-only version used for the default-output naming tests so we
// never collide with real release artifacts and can clean up afterwards.
const NAMING_VERSION = '9.99.99';
const DEFAULT_NAMING_OUTPUTS = ['edge', 'chrome', 'firefox'].map((target) =>
  path.join(DIST_DIR, `expand-${target}-${NAMING_VERSION}.zip`),
);

const RUN_DIR = path.join(
  DIST_DIR,
  'test-output',
  `t002-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
);

// `unzip` is part of the macOS/Linux base image and the GitHub Actions runners
// the release workflow uses. Detect once so we can skip (rather than fail) the
// zip-inspection assertions on systems that lack it.
const HAS_UNZIP = spawnSync('which', ['unzip']).status === 0;

function runPackager(args) {
  return spawnSync(process.execPath, [PACKAGER, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function readManifestFromZip(zipPath) {
  const result = spawnSync('unzip', ['-p', zipPath, 'manifest.json'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`unzip -p failed for ${zipPath}: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function listZipEntries(zipPath) {
  const result = spawnSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`unzip -Z1 failed for ${zipPath}: ${result.stderr}`);
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort();
}

beforeAll(() => {
  mkdirSync(RUN_DIR, { recursive: true });
});

afterAll(() => {
  // Clean the per-run output dir and the shared test-output parent.
  rmSync(RUN_DIR, { recursive: true, force: true });
  const testOutputParent = path.join(DIST_DIR, 'test-output');
  if (existsSync(testOutputParent)) {
    rmSync(testOutputParent, { recursive: true, force: true });
  }

  // Clean the default-naming zips written into the real dist/ folder.
  for (const out of DEFAULT_NAMING_OUTPUTS) {
    if (existsSync(out)) {
      rmSync(out, { force: true });
    }
  }
});

describe('package-extension default output naming', () => {
  for (const target of ['edge', 'chrome', 'firefox']) {
    it(`writes dist/expand-${target}-<version>.zip when --output is omitted`, () => {
      const expected = path.join(DIST_DIR, `expand-${target}-${NAMING_VERSION}.zip`);
      // Pre-clean in case a prior aborted run left the file behind.
      if (existsSync(expected)) {
        rmSync(expected, { force: true });
      }

      const result = runPackager(['--target', target, '--version', NAMING_VERSION]);
      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      expect(existsSync(expected)).toBe(true);
    });
  }
});

describe('package-extension manifest gecko keep/strip', () => {
  const builds = {};

  beforeAll(() => {
    if (!HAS_UNZIP) return;
    for (const target of ['edge', 'chrome', 'firefox']) {
      const outPath = path.join(RUN_DIR, `${target}-1.2.3.zip`);
      const result = runPackager([
        '--target', target,
        '--version', '1.2.3',
        '--output', path.relative(REPO_ROOT, outPath),
      ]);
      if (result.status !== 0) {
        throw new Error(`packager failed for ${target}: ${result.stderr}`);
      }
      builds[target] = outPath;
    }
  });

  it.skipIf(!HAS_UNZIP)('Edge manifest does not include browser_specific_settings.gecko', () => {
    const manifest = readManifestFromZip(builds.edge);
    expect(manifest.version).toBe('1.2.3');
    // Either the whole block is gone, or at minimum gecko is gone.
    if (manifest.browser_specific_settings) {
      expect(manifest.browser_specific_settings.gecko).toBeUndefined();
    } else {
      expect(manifest.browser_specific_settings).toBeUndefined();
    }
  });

  it.skipIf(!HAS_UNZIP)('Chrome manifest does not include browser_specific_settings.gecko', () => {
    const manifest = readManifestFromZip(builds.chrome);
    expect(manifest.version).toBe('1.2.3');
    if (manifest.browser_specific_settings) {
      expect(manifest.browser_specific_settings.gecko).toBeUndefined();
    } else {
      expect(manifest.browser_specific_settings).toBeUndefined();
    }
  });

  it.skipIf(!HAS_UNZIP)('Firefox manifest keeps browser_specific_settings.gecko', () => {
    const manifest = readManifestFromZip(builds.firefox);
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.browser_specific_settings).toBeDefined();
    expect(manifest.browser_specific_settings.gecko).toBeDefined();
    expect(manifest.browser_specific_settings.gecko.id).toBe('expand@browser-extension');
  });

  it.skipIf(!HAS_UNZIP)('all three target manifests share the same version', () => {
    const versions = ['edge', 'chrome', 'firefox'].map((t) => readManifestFromZip(builds[t]).version);
    expect(versions).toEqual(['1.2.3', '1.2.3', '1.2.3']);
  });
});

describe('package-extension runtime payload consistency', () => {
  const builds = {};

  beforeAll(() => {
    if (!HAS_UNZIP) return;
    for (const target of ['edge', 'chrome', 'firefox']) {
      const outPath = path.join(RUN_DIR, `payload-${target}.zip`);
      const result = runPackager([
        '--target', target,
        '--version', '1.2.3',
        '--output', path.relative(REPO_ROOT, outPath),
      ]);
      if (result.status !== 0) {
        throw new Error(`packager failed for ${target}: ${result.stderr}`);
      }
      builds[target] = outPath;
    }
  });

  it.skipIf(!HAS_UNZIP)('produces identical file lists across Edge, Chrome, and Firefox', () => {
    const edgeEntries = listZipEntries(builds.edge);
    const chromeEntries = listZipEntries(builds.chrome);
    const firefoxEntries = listZipEntries(builds.firefox);

    expect(edgeEntries.length).toBeGreaterThan(0);
    expect(chromeEntries).toEqual(edgeEntries);
    expect(firefoxEntries).toEqual(edgeEntries);

    // Sanity: manifest.json is in every package.
    expect(edgeEntries).toContain('manifest.json');
  });
});

describe('package-extension strict version validation', () => {
  it('rejects prerelease labels with target-neutral wording', () => {
    const result = runPackager(['--target', 'edge', '--version', '1.2.3-beta']);
    expect(result.status).not.toBe(0);
    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).toMatch(/one to four dot-separated integers|without prerelease labels/);
    // Wording must not be Edge-specific.
    expect(combined.toLowerCase()).not.toMatch(/\bedge\b/);
  });

  it('rejects more than four version segments', () => {
    const result = runPackager(['--target', 'chrome', '--version', '1.2.3.4.5']);
    expect(result.status).not.toBe(0);
    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).toMatch(/one to four dot-separated integers|without prerelease labels/);
    expect(combined.toLowerCase()).not.toMatch(/\bchrome\b/);
  });

  it('rejects segments above the 65535 manifest ceiling', () => {
    const result = runPackager(['--target', 'firefox', '--version', '1.70000.3']);
    expect(result.status).not.toBe(0);
    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).toMatch(/65535/);
    expect(combined.toLowerCase()).not.toMatch(/\bfirefox\b/);
  });

  it('rejects non-numeric segments', () => {
    const result = runPackager(['--target', 'edge', '--version', '1.2.x']);
    expect(result.status).not.toBe(0);
    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).toMatch(/one to four dot-separated integers|without prerelease labels/);
  });

  it('accepts a standard MAJOR.MINOR.PATCH version', () => {
    const outPath = path.join(RUN_DIR, 'valid-1-2-3.zip');
    const result = runPackager([
      '--target', 'edge',
      '--version', '1.2.3',
      '--output', path.relative(REPO_ROOT, outPath),
    ]);
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it('accepts the all-zero version', () => {
    const outPath = path.join(RUN_DIR, 'valid-0-0-0.zip');
    const result = runPackager([
      '--target', 'firefox',
      '--version', '0.0.0',
      '--output', path.relative(REPO_ROOT, outPath),
    ]);
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);
    expect(existsSync(outPath)).toBe(true);
  });
});

describe('package-extension unsupported target', () => {
  it('rejects --target safari with target-neutral wording listing supported targets', () => {
    const result = runPackager(['--target', 'safari', '--version', '1.2.3']);
    expect(result.status).not.toBe(0);
    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).toMatch(/safari/);
    expect(combined).toMatch(/edge/);
    expect(combined).toMatch(/chrome/);
    expect(combined).toMatch(/firefox/);
  });

  it('rejects --target opera', () => {
    const result = runPackager(['--target', 'opera', '--version', '1.2.3']);
    expect(result.status).not.toBe(0);
    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).toMatch(/opera/);
    expect(combined).toMatch(/edge/);
    expect(combined).toMatch(/chrome/);
    expect(combined).toMatch(/firefox/);
  });
});
