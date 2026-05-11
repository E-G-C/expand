import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

const RUNTIME_PATHS = ['manifest.json', 'content', 'styles', 'popup', 'icons'];
const UTF8_FLAG = 0x0800;
const DEFLATE_METHOD = 8;
const VERSION_NEEDED = 20;
const VERSION_MADE_BY = 0x0314;
const FILE_MODE = (0o100644 << 16) >>> 0;
const CRC_TABLE = createCrcTable();
const TARGETS = {
  edge: {
    transformManifest: removeFirefoxOnlySettings,
  },
  chrome: {
    transformManifest: removeFirefoxOnlySettings,
  },
  firefox: {
    transformManifest: keepFirefoxSettings,
  },
};
const SUPPORTED_TARGETS = Object.keys(TARGETS);

const options = parseArgs(process.argv.slice(2));
const sourceDir = path.resolve(options.sourceDir || process.cwd());
const targetConfig = TARGETS[options.target];

if (!targetConfig) {
  throw new Error(`Unsupported target "${options.target}". Supported targets: ${SUPPORTED_TARGETS.join(', ')}.`);
}

const sourceManifestPath = path.join(sourceDir, 'manifest.json');
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, 'utf8'));
const manifest = buildManifest(sourceManifest, options, targetConfig);
const version = manifest.version;

validateManifestVersion(version);
validateManifestShape(manifest);

const outputPath = path.resolve(
  sourceDir,
  options.output || path.join('dist', `${slugify(manifest.name || 'extension')}-${options.target}-${version}.zip`),
);

const entries = await collectRuntimeEntries(sourceDir, manifest, sourceManifestPath);
validateManifestReferences(manifest, new Set(entries.map((entry) => entry.relativePath)));

await mkdir(path.dirname(outputPath), { recursive: true });
await rm(outputPath, { force: true });
await writeFile(outputPath, createZip(entries));

console.log(`Created ${path.relative(sourceDir, outputPath)} with ${entries.length} files.`);

function parseArgs(args) {
  const parsed = {
    target: 'edge',
    sourceDir: undefined,
    output: undefined,
    version: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextValue = () => {
      index += 1;
      if (index >= args.length || args[index].startsWith('--')) {
        throw new Error(`Missing value for ${arg}.`);
      }
      return args[index];
    };

    if (arg === '--target') {
      parsed.target = nextValue();
    } else if (arg === '--source-dir') {
      parsed.sourceDir = nextValue();
    } else if (arg === '--output') {
      parsed.output = nextValue();
    } else if (arg === '--version') {
      parsed.version = nextValue();
    } else {
      throw new Error(`Unknown argument ${arg}.`);
    }
  }

  return parsed;
}

function buildManifest(sourceManifest, options, targetConfig) {
  const manifest = JSON.parse(JSON.stringify(sourceManifest));

  if (options.version) {
    manifest.version = options.version;
  }

  targetConfig.transformManifest(manifest);

  return manifest;
}

function keepFirefoxSettings() {}

function removeFirefoxOnlySettings(manifest) {
  if (!manifest.browser_specific_settings) {
    return;
  }

  delete manifest.browser_specific_settings.gecko;

  if (Object.keys(manifest.browser_specific_settings).length === 0) {
    delete manifest.browser_specific_settings;
  }
}

function validateManifestShape(manifest) {
  if (manifest.manifest_version !== 3) {
    throw new Error('Expected an MV3 extension manifest.');
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new Error('Manifest must include a string name.');
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new Error('Manifest must include a string version.');
  }
}

function validateManifestVersion(version) {
  const partPattern = '(0|[1-9][0-9]*)';
  const versionPattern = new RegExp(`^${partPattern}(\\.${partPattern}){0,3}$`);

  if (!versionPattern.test(version)) {
    throw new Error(`Manifest version "${version}" must be one to four dot-separated integers without prerelease labels.`);
  }

  for (const part of version.split('.')) {
    const value = Number(part);
    if (value > 65535) {
      throw new Error(`Manifest version segment "${part}" must be 65535 or lower.`);
    }
  }
}

async function collectRuntimeEntries(sourceDir, manifest, sourceManifestPath) {
  const entries = [];

  for (const runtimePath of RUNTIME_PATHS) {
    const absolutePath = path.join(sourceDir, runtimePath);
    const pathStat = await stat(absolutePath).catch(() => null);

    if (!pathStat) {
      continue;
    }

    if (runtimePath === 'manifest.json') {
      entries.push({
        relativePath: 'manifest.json',
        data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
        mtime: (await stat(sourceManifestPath)).mtime,
      });
    } else if (pathStat.isDirectory()) {
      entries.push(...await collectDirectoryFiles(sourceDir, absolutePath));
    } else if (pathStat.isFile()) {
      entries.push(await createFileEntry(sourceDir, absolutePath));
    }
  }

  entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return entries;
}

async function collectDirectoryFiles(sourceDir, directory) {
  const entries = [];
  const children = await readdir(directory, { withFileTypes: true });

  for (const child of children) {
    if (child.name === '.DS_Store') {
      continue;
    }

    const absolutePath = path.join(directory, child.name);

    if (child.isDirectory()) {
      entries.push(...await collectDirectoryFiles(sourceDir, absolutePath));
    } else if (child.isFile()) {
      entries.push(await createFileEntry(sourceDir, absolutePath));
    }
  }

  return entries;
}

async function createFileEntry(sourceDir, absolutePath) {
  return {
    relativePath: toZipPath(path.relative(sourceDir, absolutePath)),
    data: await readFile(absolutePath),
    mtime: (await stat(absolutePath)).mtime,
  };
}

function validateManifestReferences(manifest, includedPaths) {
  const references = collectManifestReferences(manifest);
  const missing = [...references].filter((reference) => !includedPaths.has(reference));

  if (missing.length > 0) {
    throw new Error(`Manifest references files missing from the package: ${missing.join(', ')}`);
  }
}

function collectManifestReferences(manifest) {
  const references = new Set();
  const add = (value) => {
    if (typeof value === 'string' && value.length > 0 && !value.includes('*')) {
      references.add(toZipPath(value));
    }
  };

  if (manifest.icons && typeof manifest.icons === 'object') {
    for (const iconPath of Object.values(manifest.icons)) {
      add(iconPath);
    }
  }

  add(manifest.action?.default_popup);

  for (const contentScript of manifest.content_scripts || []) {
    for (const jsPath of contentScript.js || []) {
      add(jsPath);
    }
    for (const cssPath of contentScript.css || []) {
      add(cssPath);
    }
  }

  for (const resourceGroup of manifest.web_accessible_resources || []) {
    for (const resourcePath of resourceGroup.resources || []) {
      add(resourcePath);
    }
  }

  return references;
}

function createZip(entries) {
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.relativePath, 'utf8');
    const compressedData = deflateRawSync(entry.data);
    const crc = crc32(entry.data);
    const { dosTime, dosDate } = getDosDateTime(entry.mtime);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(VERSION_NEEDED, 4);
    localHeader.writeUInt16LE(UTF8_FLAG, 6);
    localHeader.writeUInt16LE(DEFLATE_METHOD, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localRecords.push(localHeader, fileName, compressedData);
    centralRecords.push(createCentralDirectoryRecord(entry, fileName, compressedData, crc, dosTime, dosDate, offset));
    offset += localHeader.length + fileName.length + compressedData.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralRecords);
  const endRecord = Buffer.alloc(22);

  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(centralDirectoryOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localRecords, centralDirectory, endRecord]);
}

function createCentralDirectoryRecord(entry, fileName, compressedData, crc, dosTime, dosDate, localHeaderOffset) {
  const centralHeader = Buffer.alloc(46);

  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(VERSION_MADE_BY, 4);
  centralHeader.writeUInt16LE(VERSION_NEEDED, 6);
  centralHeader.writeUInt16LE(UTF8_FLAG, 8);
  centralHeader.writeUInt16LE(DEFLATE_METHOD, 10);
  centralHeader.writeUInt16LE(dosTime, 12);
  centralHeader.writeUInt16LE(dosDate, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(compressedData.length, 20);
  centralHeader.writeUInt32LE(entry.data.length, 24);
  centralHeader.writeUInt16LE(fileName.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(FILE_MODE, 38);
  centralHeader.writeUInt32LE(localHeaderOffset, 42);

  return Buffer.concat([centralHeader, fileName]);
}

function getDosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    dosTime: (hours << 11) | (minutes << 5) | seconds,
    dosDate: ((year - 1980) << 9) | (month << 5) | day,
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }

    table[index] = value >>> 0;
  }

  return table;
}

function toZipPath(filePath) {
  return filePath.split(path.sep).join('/').replace(/^\.\//, '');
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'extension';
}