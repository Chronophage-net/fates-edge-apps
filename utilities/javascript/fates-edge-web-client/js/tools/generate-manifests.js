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
  { dir: 'data/docs', type: 'docs' },      // Rich manifest for docs
];

const EXCLUDED_FILES = new Set(['manifest.json', 'manifest-core.json', 'manifest-core.json.tmp']);

// ─── Helpers ──────────────────────────────────────────────────────
function getFileSlug(filename) {
  return filename.replace(/\.json$/, '').replace(/\.html$/, '');
}

function getDocType(file) {
  const adventurePatterns = ['Saga', 'Dreams', 'Serpent', 'Blood', 'Carnival', 'Adventure', 'Coil', 'Lantern'];
  if (adventurePatterns.some(p => file.includes(p))) return 'adventures';
  if (file.includes('Screen') || file.includes('GM')) return 'resources';
  if (file.includes('Reference') || file.includes('SRD') || file.includes('Essentials') || file.includes('Essential')) return 'core';
  return 'other';
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

// ─── Generate Docs Manifest (rich format) ──────────────────────
function generateDocsManifest(docsPath) {
  const fullPath = ensureDirectory(docsPath);
  const documents = [];

  // Scan for HTML files in docs root
  let files = [];
  try {
    files = fs.readdirSync(fullPath);
  } catch (_) { return null; }

  // Also scan subdirectories
  const subdirs = ['core', 'resources', 'adventures', 'expansions', 'travel', 'design', 'konreh', 'uploaded'];
  for (const subdir of subdirs) {
    const subPath = path.join(fullPath, subdir);
    if (fs.existsSync(subPath)) {
      const subFiles = fs.readdirSync(subPath);
      for (const file of subFiles) {
        if (file.endsWith('.html') && !EXCLUDED_FILES.has(file)) {
          const title = getDocTitle(file);
          const type = getDocType(file);
          const id = generateId(title);
          documents.push({
            id: id,
            title: title,
            file: file,
            path: `/data/docs/${subdir}/`,
            category: type,
            categoryLabel: type === 'adventures' ? '🗡️ Adventures' :
                           type === 'resources' ? '📚 Resources' :
                           type === 'core' ? '📘 Core' : '📄 Other',
            core: type === 'core',
            active: true
          });
        }
      }
    }
  }

  // Scan root for HTML files
  for (const file of files) {
    if (file.endsWith('.html') && !EXCLUDED_FILES.has(file)) {
      const title = getDocTitle(file);
      const type = getDocType(file);
      const id = generateId(title);
      if (!documents.some(d => d.file === file)) {
        documents.push({
          id: id,
          title: title,
          file: file,
          path: '/data/docs/',
          category: type,
          categoryLabel: type === 'adventures' ? '🗡️ Adventures' :
                         type === 'resources' ? '📚 Resources' :
                         type === 'core' ? '📘 Core' : '📄 Other',
          core: type === 'core',
          active: true
        });
      }
    }
  }

  // Sort: core first, then alphabetically
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
    _license: "Fate's Edge Proprietary Content – © 2024 Nicholas A. Gasper. All rights reserved."
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
    .filter(f => f.endsWith('.json') && !EXCLUDED_FILES.has(f))
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
    // Write empty manifest if directory exists but has no content
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
