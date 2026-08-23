import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

// ─── Configuration ────────────────────────────────────────────────
const DATA_DIRS = [
  { dir: 'data/patrons', type: 'simple' },
  { dir: 'data/terrestrial', type: 'simple' },
  { dir: 'data/religions', type: 'simple' },
  { dir: 'data/adventures', type: 'simple' },
  { dir: 'data/factions', type: 'simple' },
  { dir: 'data/regions', type: 'simple' },
  { dir: 'data/docs', type: 'docs' },
];

const EXCLUDED_FILES = new Set(['manifest.json', 'manifest-core.json', 'manifest-core.json.tmp']);
// FIX: EXCLUDED_FILES only ever caught the exact name "manifest.json" --
// any *other* manifest-shaped file living alongside real data (e.g.
// data/factions/factions-manifest.json, a leftover/alternate manifest)
// slipped through the `f.endsWith('.json')` filter below and got listed
// as if it were a real faction/patron/etc. entry, which then 404s when
// something tries to fetch "factions-manifest.json" as actual content.
const EXCLUDED_FILE_PATTERN = /manifest.*\.json(\.tmp)?$/i;

// ─── Category mapping: subdir → category info ────────────────────
const CATEGORY_MAP = {
  'core': { id: 'core', label: '📘 Core', path: '/data/docs/core/' },
  'quickstart': { id: 'quickstart', label: '⚡ Quickstart', path: '/data/docs/quickstart/' },
  'players-guide': { id: 'players-guide', label: '🎲 Player\'s Guide', path: '/data/docs/players-guide/', book: true },
  'gm-guide': { id: 'gm-guide', label: '🎬 GM Guide', path: '/data/docs/gm-guide/', book: true },
  'resources': { id: 'resources', label: '📚 Resources', path: '/data/docs/resources/' },
  'adventures': { id: 'adventures', label: '🗡️ Adventures', path: '/data/docs/adventures/' },
  'expansions': { id: 'expansions', label: '📦 Expansions', path: '/data/docs/expansions/' },
  'anthology': { id: 'anthology', label: '📖 Anthology', path: '/data/docs/anthology/' },
  'travel': { id: 'travel', label: '🗺️ Travel', path: '/data/docs/travel/' },
  'design': { id: 'design', label: '🎨 Design', path: '/data/docs/design/' },
  // Kon'reh and Toll & Veil are each a single standalone mini-game
  // reference rather than a full expansion or line of their own -- they
  // share the 'other-games' category id/label so they land in one
  // "Other Games" section instead of each getting its own single-item
  // category tile.
  'konreh': { id: 'other-games', label: '🎲 Other Games', path: '/data/docs/konreh/' },
  'tollveil': { id: 'other-games', label: '🎲 Other Games', path: '/data/docs/tollveil/' },
  'uploaded': { id: 'uploaded', label: '📤 Uploaded', path: '/data/docs/uploaded/' },
  // Witnessed Prey and Saikou Compendium are Fate's Edge expansions, so
  // they share the 'expansions' category id/label with the rest of the
  // Expansions folder even though each lives in its own book directory.
  'witnessed-prey': { id: 'expansions', label: '📦 Expansions', path: '/data/docs/witnessed-prey/', book: true },
  'saikou-compendium': { id: 'expansions', label: '📦 Expansions', path: '/data/docs/saikou-compendium/', book: true },
};

const SUBDIRS = Object.keys(CATEGORY_MAP);

// ─── Helpers ──────────────────────────────────────────────────────
function getFileSlug(filename) {
  return filename.replace(/\.json$/, '').replace(/\.html$/, '');
}

function getDocTitle(file) {
  return file
    .replace(/\.html$/, '')
    .replace(/Fates_-_Edge_-_-/g, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

function generateId(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function ensureDirectory(dirPath) {
  const fullPath = path.resolve(rootDir, dirPath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
  return fullPath;
}

// ─── Multi-page "book" documents ──────────────────────────────────
// A book directory (gm-guide/, players-guide/, ...) holds one chapter per
// .html file plus a book.json written by tools/generate_book_index.py in
// the docs repo (and propagated here by sync_data_to_consumers.py). Such
// a directory becomes ONE manifest entry -- pointing at its index.html --
// carrying a `pages` array so the UI can present it as a single document
// with internal chapter navigation, instead of one manifest row per
// chapter (which is what made the doc list unwieldy as guides were added).
function readBookManifestEntry(subPath, category) {
  const bookJsonPath = path.join(subPath, 'book.json');
  if (!fs.existsSync(bookJsonPath)) {
    console.warn(`⚠️  ${category.id} is marked as a book but has no book.json (run tools/generate_book_index.py in fates-edge-docs and re-sync) -- falling back to one entry per file`);
    return null;
  }

  let book;
  try {
    book = JSON.parse(fs.readFileSync(bookJsonPath, 'utf8'));
  } catch (err) {
    console.error(`❌ Failed to parse ${bookJsonPath}:`, err.message);
    return null;
  }

  const pages = (book.chapters || []).map(c => ({
    file: c.file,
    label: c.label,
    title: c.title,
  }));

  if (pages.length === 0) return null;

  return {
    id: book.id || category.id,
    title: book.title || category.label,
    subtitle: book.subtitle || '',
    file: book.index || 'index.html',
    path: category.path,
    category: category.id,
    categoryLabel: category.label,
    core: false,
    active: true,
    book: true,
    pages: pages,
  };
}

// ─── Generate Docs Manifest ──────────────────────────────────────
function generateDocsManifest(docsPath) {
  const fullPath = ensureDirectory(docsPath);
  const documents = [];

  let rootFiles = [];
  try {
    rootFiles = fs.readdirSync(fullPath);
  } catch (_) { return null; }

  // ─── Scan subdirectories ──────────────────────────────────────────
  for (const subdir of SUBDIRS) {
    const subPath = path.join(fullPath, subdir);
    if (!fs.existsSync(subPath)) continue;

    const category = CATEGORY_MAP[subdir];

    if (category.book) {
      const bookEntry = readBookManifestEntry(subPath, category);
      if (bookEntry) {
        documents.push(bookEntry);
        continue;
      }
      // else: no book.json found yet -- fall through and list chapters
      // individually so the docs still show up somehow.
    }

    const files = fs.readdirSync(subPath);

    for (const file of files) {
      if (!file.endsWith('.html')) continue;
      if (EXCLUDED_FILES.has(file)) continue;
      if (file.toLowerCase() === 'index.html') continue;

      const title = getDocTitle(file);
      const id = generateId(title);
      const isCore = subdir === 'core';

      documents.push({
        id: id,
        title: title,
        file: file,
        path: category.path,
        category: category.id,
        categoryLabel: category.label,
        core: isCore,
        active: true
      });
    }
  }

  // ─── Scan root directory ──────────────────────────────────────────
  // Only process files that aren't in a subdirectory
  for (const file of rootFiles) {
    if (!file.endsWith('.html')) continue;
    if (EXCLUDED_FILES.has(file)) continue;

    // Check if this file is already in a subdirectory (shouldn't happen)
    const alreadyIndexed = documents.some(d => d.file === file);
    if (alreadyIndexed) continue;

    const title = getDocTitle(file);
    const id = generateId(title);

    // Root files: try to infer category from filename, default to 'other'
    let category = 'other';
    let label = '📄 Other';
    let path = '/data/docs/';
    let core = false;

    // Simple filename-based inference for root files
    const lower = file.toLowerCase();
    if (lower.includes('srd') || lower.includes('reference')) {
      category = 'core';
      label = '📘 Core';
      path = '/data/docs/';
      core = true;
    } else if (lower.includes('screen') || lower.includes('gm') || lower.includes('essential')) {
      category = 'resources';
      label = '📚 Resources';
      path = '/data/docs/';
    } else if (lower.includes('saga') || lower.includes('dreams') || lower.includes('serpent') || lower.includes('adventure')) {
      category = 'adventures';
      label = '🗡️ Adventures';
      path = '/data/docs/';
    }

    documents.push({
      id: id,
      title: title,
      file: file,
      path: path,
      category: category,
      categoryLabel: label,
      core: core,
      active: true
    });
  }

  // ─── Sort: core first, then by title ─────────────────────────────
  documents.sort((a, b) => {
    if (a.core && !b.core) return -1;
    if (!a.core && b.core) return 1;
    return a.title.localeCompare(b.title);
  });

  if (documents.length === 0) {
    console.log(`📭 No HTML documents found in ${docsPath}`);
    return null;
  }

  return {
    version: '1.0',
    generated: new Date().toISOString(),
    documents: documents,
    total_count: documents.length,
    active_count: documents.filter(d => d.active !== false).length,
    _license: "Fate's Edge Copyright – © 2024 - 2026 Nicholas A. Gasper. Used with permission, All rights reserved."
  };
}

// ─── Generate Simple Manifest (slugs only) ──────────────────────
function generateSimpleManifest(dirPath) {
  const fullPath = ensureDirectory(dirPath);

  let files = [];
  try {
    files = fs.readdirSync(fullPath);
  } catch (_) { return null; }

  const slugs = files
    .filter(f => f.endsWith('.json') && !EXCLUDED_FILES.has(f) && !EXCLUDED_FILE_PATTERN.test(f))
    .map(f => getFileSlug(f));

  if (slugs.length === 0) {
    console.log(`📭 No JSON files found in ${dirPath}`);
    return [];
  }

  return slugs;
}

// ─── Main Execution ──────────────────────────────────────────────
console.log('📄 Generating manifests...\n');

for (const entry of DATA_DIRS) {
  const { dir, type } = entry;
  const fullPath = path.resolve(rootDir, dir);

  let manifestData;
  let count = 0;

  if (type === 'docs') {
    manifestData = generateDocsManifest(dir);
    if (manifestData) {
      count = manifestData.documents.length;
    }
  } else {
    manifestData = generateSimpleManifest(dir);
    if (Array.isArray(manifestData)) {
      count = manifestData.length;
    }
  }

  if (manifestData !== null && manifestData !== undefined) {
    const manifestPath = path.join(fullPath, 'manifest.json');
    try {
      fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
      console.log(`✅ Generated manifest for ${dir} (${count} entries)`);
    } catch (err) {
      console.error(`❌ Failed to write manifest to ${dir}:`, err.message);
    }
  } else {
    const manifestPath = path.join(fullPath, 'manifest.json');
    try {
      fs.writeFileSync(manifestPath, JSON.stringify([], null, 2));
      console.log(`📭 Created empty manifest for ${dir} (no entries)`);
    } catch (err) {
      console.error(`❌ Failed to write empty manifest to ${dir}:`, err.message);
    }
  }
}

console.log('\n🎯 All manifests generated successfully.');