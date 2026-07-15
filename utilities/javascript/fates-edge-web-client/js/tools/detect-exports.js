// js/tools/detect-exports.js
/**
 * Export Detection Script - No external dependencies
 * 
 * Scans JavaScript files for:
 * - Missing exports (functions that are used but not exported)
 * - Duplicate exports (same name exported from multiple files)
 * - Unused exports (exported but never imported)
 * 
 * Usage: node js/tools/detect-exports.js [--fix] [--verbose] [--report]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// FIND PROJECT ROOT
// ============================================================

function findProjectRoot(startDir) {
    let currentDir = startDir;
    while (currentDir !== path.parse(currentDir).root) {
        // Check for package.json or js folder
        if (fs.existsSync(path.join(currentDir, 'package.json')) ||
            fs.existsSync(path.join(currentDir, 'js'))) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    return startDir;
}

const PROJECT_ROOT = findProjectRoot(__dirname);
const JS_ROOT = path.join(PROJECT_ROOT, 'js');

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    rootDir: PROJECT_ROOT,
    jsRoot: JS_ROOT,
    // Directories to scan (relative to js root)
    scanDirs: ['core', 'features', 'components'],
    // File extensions to scan
    extensions: ['.js', '.mjs'],
    // Exclude patterns
    excludeDirs: ['node_modules', 'dist', 'build', '.git', 'tests', 'test'],
    // Report file path
    reportFile: path.join(PROJECT_ROOT, 'export-report.json'),
    verbose: false,
    fix: false
};

// ============================================================
// PARSE COMMAND LINE ARGUMENTS
// ============================================================

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node js/tools/detect-exports.js [options]

Options:
  --fix         Attempt to fix missing exports (experimental)
  --verbose     Verbose output with detailed analysis
  --report      Generate a JSON report file
  --help        Show this help message

Examples:
  node js/tools/detect-exports.js
  node js/tools/detect-exports.js --verbose
  node js/tools/detect-exports.js --report
  node js/tools/detect-exports.js --fix --verbose
    `);
    process.exit(0);
}

if (args.includes('--fix')) CONFIG.fix = true;
if (args.includes('--verbose')) CONFIG.verbose = true;
if (args.includes('--report')) CONFIG.report = true;

// ============================================================
// FILE SYSTEM UTILITIES
// ============================================================

/**
 * Recursively get all JS files in a directory
 */
function getJsFiles(dir, relativePath = '') {
    const files = [];
    try {
        if (!fs.existsSync(dir)) {
            if (CONFIG.verbose) {
                console.warn(`Directory not found: ${dir}`);
            }
            return files;
        }
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
            
            if (entry.isDirectory()) {
                if (CONFIG.excludeDirs.includes(entry.name)) continue;
                files.push(...getJsFiles(fullPath, relPath));
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (CONFIG.extensions.includes(ext)) {
                    files.push({
                        fullPath,
                        relativePath: relPath,
                        name: entry.name,
                        dir: relativePath
                    });
                }
            }
        }
    } catch (e) {
        if (CONFIG.verbose) {
            console.warn(`Could not read directory ${dir}:`, e.message);
        }
    }
    return files;
}

/**
 * Read file content
 */
function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        if (CONFIG.verbose) {
            console.warn(`Could not read file ${filePath}:`, e.message);
        }
        return null;
    }
}

// ============================================================
// PARSING FUNCTIONS
// ============================================================

/**
 * Extract all import statements from a file
 */
function extractImports(content) {
    const imports = [];
    
    // Import statements: import { x } from 'module'
    const importRegex = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        const names = match[1].split(',').map(s => s.trim());
        for (const name of names) {
            if (name && !name.startsWith('*')) {
                const [localName, importedName] = name.split(/\s+as\s+/).map(s => s.trim());
                imports.push({
                    localName: localName || importedName,
                    importedName: importedName || localName,
                    source: match[2]
                });
            }
        }
    }
    
    // Import default: import x from 'module'
    const defaultRegex = /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
    while ((match = defaultRegex.exec(content)) !== null) {
        imports.push({
            localName: match[1],
            importedName: 'default',
            source: match[2],
            isDefault: true
        });
    }
    
    // Import namespace: import * as x from 'module'
    const namespaceRegex = /import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
    while ((match = namespaceRegex.exec(content)) !== null) {
        imports.push({
            localName: match[1],
            importedName: '*',
            source: match[2],
            isNamespace: true
        });
    }
    
    // Dynamic imports: import('module')
    const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicRegex.exec(content)) !== null) {
        imports.push({
            localName: null,
            importedName: null,
            source: match[1],
            isDynamic: true
        });
    }
    
    return imports;
}

/**
 * Extract all export statements from a file
 */
function extractExports(content) {
    const exports = [];
    
    // Named exports: export const x = ...
    const namedRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
    let match;
    while ((match = namedRegex.exec(content)) !== null) {
        exports.push({
            name: match[1],
            type: 'named',
            line: content.substring(0, match.index).split('\n').length
        });
    }
    
    // Export list: export { x, y, z }
    const listRegex = /export\s*\{([^}]*)\}/g;
    while ((match = listRegex.exec(content)) !== null) {
        const names = match[1].split(',').map(s => s.trim());
        for (const name of names) {
            if (name) {
                const [localName, exportedName] = name.split(/\s+as\s+/).map(s => s.trim());
                exports.push({
                    name: exportedName || localName,
                    localName: localName || exportedName,
                    type: 'list',
                    line: content.substring(0, match.index).split('\n').length
                });
            }
        }
    }
    
    // Export default: export default ...
    const defaultRegex = /export\s+default\s+(\w+)/g;
    while ((match = defaultRegex.exec(content)) !== null) {
        exports.push({
            name: 'default',
            value: match[1],
            type: 'default',
            line: content.substring(0, match.index).split('\n').length
        });
    }
    
    // Export default as object: export default { ... }
    const defaultObjectRegex = /export\s+default\s*\{([^}]*)\}/g;
    while ((match = defaultObjectRegex.exec(content)) !== null) {
        const props = match[1].split(',').map(s => s.trim());
        for (const prop of props) {
            if (prop) {
                const [key, value] = prop.split(':').map(s => s.trim());
                exports.push({
                    name: key || value,
                    value: value || key,
                    type: 'default-object',
                    line: content.substring(0, match.index).split('\n').length
                });
            }
        }
    }
    
    // Export from: export { x } from 'module'
    const fromRegex = /export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
    while ((match = fromRegex.exec(content)) !== null) {
        const names = match[1].split(',').map(s => s.trim());
        for (const name of names) {
            if (name) {
                const [localName, exportedName] = name.split(/\s+as\s+/).map(s => s.trim());
                exports.push({
                    name: exportedName || localName,
                    localName: localName || exportedName,
                    source: match[2],
                    type: 're-export',
                    line: content.substring(0, match.index).split('\n').length
                });
            }
        }
    }
    
    return exports;
}

/**
 * Find all used variables (approximate)
 */
function findUsedVariables(content) {
    const used = new Set();
    
    // Function calls: x()
    const callRegex = /(\w+)\s*\(/g;
    let match;
    while ((match = callRegex.exec(content)) !== null) {
        used.add(match[1]);
    }
    
    // Variable references
    const refRegex = /(?<![.\w])(\w+)(?=\s*[=;,.])/g;
    while ((match = refRegex.exec(content)) !== null) {
        used.add(match[1]);
    }
    
    // Property access: obj.x
    const propRegex = /\.(\w+)/g;
    while ((match = propRegex.exec(content)) !== null) {
        used.add(match[1]);
    }
    
    // Export references
    const exportRefRegex = /export\s*\{([^}]*)\}/g;
    while ((match = exportRefRegex.exec(content)) !== null) {
        const names = match[1].split(',').map(s => s.trim());
        for (const name of names) {
            if (name) {
                const [localName] = name.split(/\s+as\s+/).map(s => s.trim());
                if (localName) used.add(localName);
            }
        }
    }
    
    return used;
}

/**
 * Find local declarations in a file
 */
function findLocalDeclarations(content) {
    const locals = new Set();
    
    const declRegex = /(?:var|let|const)\s+(\w+)/g;
    let match;
    while ((match = declRegex.exec(content)) !== null) {
        locals.add(match[1]);
    }
    
    const funcRegex = /function\s+(\w+)/g;
    while ((match = funcRegex.exec(content)) !== null) {
        locals.add(match[1]);
    }
    
    const classRegex = /class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
        locals.add(match[1]);
    }
    
    const paramRegex = /function\s*\(([^)]*)\)/g;
    while ((match = paramRegex.exec(content)) !== null) {
        const params = match[1].split(',').map(s => s.trim());
        for (const param of params) {
            if (param) locals.add(param);
        }
    }
    
    const arrowRegex = /\(([^)]*)\)\s*=>/g;
    while ((match = arrowRegex.exec(content)) !== null) {
        const params = match[1].split(',').map(s => s.trim());
        for (const param of params) {
            if (param) locals.add(param);
        }
    }
    
    return locals;
}

/**
 * Check if a name is a built-in JavaScript identifier
 */
function isBuiltIn(name) {
    const builtins = [
        'console', 'window', 'document', 'Math', 'Number', 'String',
        'Array', 'Object', 'Function', 'Boolean', 'Date', 'RegExp',
        'Error', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet',
        'JSON', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
        'module', 'exports', 'require', 'global', 'process',
        'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
        'fetch', 'localStorage', 'sessionStorage', 'alert', 'confirm',
        'URL', 'URLSearchParams', 'Blob', 'File', 'FormData',
        'AbortController', 'AbortSignal', 'Event', 'CustomEvent',
        'import', 'export', 'default'
    ];
    return builtins.includes(name) || /^[A-Z][A-Z_]*$/.test(name);
}

/**
 * Find the line number of a name in content
 */
function findLineNumber(content, name) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(name)) {
            return i + 1;
        }
    }
    return 0;
}

// ============================================================
// MAIN ANALYZER
// ============================================================

class ExportAnalyzer {
    constructor() {
        this.files = [];
        this.fileExports = new Map();
        this.fileImports = new Map();
        this.fileContent = new Map();
        this.issues = [];
        this.allExports = new Map();
    }
    
    /**
     * Load and analyze all files
     */
    analyze() {
        console.log('🔍 Scanning for JavaScript files...');
        console.log(`   Root: ${CONFIG.rootDir}`);
        console.log(`   JS Root: ${CONFIG.jsRoot}\n`);
        
        // Get all files
        const allFiles = [];
        for (const scanDir of CONFIG.scanDirs) {
            const fullPath = path.join(CONFIG.jsRoot, scanDir);
            if (fs.existsSync(fullPath)) {
                const files = getJsFiles(fullPath, scanDir);
                allFiles.push(...files);
                if (CONFIG.verbose) {
                    console.log(`   Found ${files.length} files in ${scanDir}`);
                }
            } else if (CONFIG.verbose) {
                console.warn(`   Directory not found: ${fullPath}`);
            }
        }
        
        this.files = allFiles;
        console.log(`\n   Total: ${this.files.length} files\n`);
        
        // First pass: collect all exports and imports
        for (const file of this.files) {
            const content = readFile(file.fullPath);
            if (!content) continue;
            
            this.fileContent.set(file.relativePath, content);
            
            const exports = extractExports(content);
            this.fileExports.set(file.relativePath, exports);
            
            const imports = extractImports(content);
            this.fileImports.set(file.relativePath, imports);
            
            // Track all exports globally
            for (const exp of exports) {
                if (exp.type === 'default' || exp.type === 're-export') continue;
                if (exp.name === 'default') continue;
                if (!this.allExports.has(exp.name)) {
                    this.allExports.set(exp.name, []);
                }
                this.allExports.get(exp.name).push({
                    file: file.relativePath,
                    line: exp.line || 0
                });
            }
        }
        
        // Second pass: analyze each file
        for (const file of this.files) {
            this.analyzeFile(file);
        }
        
        return this;
    }
    
    /**
     * Analyze a single file
     */
    analyzeFile(file) {
        const content = this.fileContent.get(file.relativePath);
        if (!content) return;
        
        const exports = this.fileExports.get(file.relativePath) || [];
        const imports = this.fileImports.get(file.relativePath) || [];
        
        // Check for missing exports (functions used but not exported)
        const used = findUsedVariables(content);
        const exportNames = exports.map(e => e.name);
        const localDeclarations = findLocalDeclarations(content);
        const importNames = imports.map(i => i.localName);
        
        // Check each used variable
        for (const name of used) {
            // Skip if it's a local declaration
            if (localDeclarations.has(name)) continue;
            
            // Skip if it's a built-in
            if (isBuiltIn(name)) continue;
            
            // Skip if it's imported
            if (importNames.includes(name)) continue;
            
            // Skip if it's exported
            if (exportNames.includes(name)) continue;
            
            // It might be a missing export
            if (CONFIG.verbose) {
                console.log(`   ${file.relativePath}:${findLineNumber(content, name)} - Possible missing export: ${name}`);
            }
            
            this.issues.push({
                type: 'missing_export',
                file: file.relativePath,
                name: name,
                line: findLineNumber(content, name),
                message: `'${name}' is used but not exported or imported`
            });
        }
        
        // Check for unused exports
        for (const exp of exports) {
            if (exp.type === 'default' || exp.type === 're-export') continue;
            if (exp.name === 'default') continue;
            
            // Check if this export is used anywhere
            let isUsed = false;
            for (const [otherFile, otherImports] of this.fileImports) {
                if (otherFile === file.relativePath) continue;
                for (const imp of otherImports) {
                    if (imp.localName === exp.name || 
                        imp.importedName === exp.name ||
                        imp.importedName === '*') {
                        isUsed = true;
                        break;
                    }
                }
                if (isUsed) break;
            }
            
            if (!isUsed) {
                this.issues.push({
                    type: 'unused_export',
                    file: file.relativePath,
                    name: exp.name,
                    line: exp.line || 0,
                    message: `'${exp.name}' is exported but never imported`
                });
            }
        }
    }
    
    /**
     * Generate a report
     */
    generateReport() {
        const report = {
            summary: {
                totalFiles: this.files.length,
                totalIssues: this.issues.length,
                missingExports: this.issues.filter(i => i.type === 'missing_export').length,
                unusedExports: this.issues.filter(i => i.type === 'unused_export').length,
            },
            issues: this.issues
        };
        
        // Find duplicates
        const duplicates = [];
        for (const [name, locations] of this.allExports) {
            if (locations.length > 1) {
                duplicates.push({ name, locations });
            }
        }
        report.duplicates = duplicates;
        
        return report;
    }
    
    /**
     * Print the report
     */
    printReport() {
        const report = this.generateReport();
        
        console.log('\n📊 EXPORT ANALYSIS REPORT\n');
        console.log(`📁 Files scanned: ${report.summary.totalFiles}`);
        console.log(`⚠️  Total issues: ${report.summary.totalIssues}`);
        console.log(`   - Missing exports: ${report.summary.missingExports}`);
        console.log(`   - Unused exports: ${report.summary.unusedExports}`);
        console.log(`   - Duplicate exports: ${report.duplicates.length}\n`);
        
        if (report.issues.length > 0) {
            console.log('🔴 ISSUES:\n');
            
            const missingExports = report.issues.filter(i => i.type === 'missing_export');
            const unusedExports = report.issues.filter(i => i.type === 'unused_export');
            
            if (missingExports.length > 0) {
                console.log('  ⚠️  Missing Exports (used but not exported):');
                for (const issue of missingExports) {
                    console.log(`      ${issue.file}:${issue.line} - ${issue.name}`);
                }
                console.log('');
            }
            
            if (unusedExports.length > 0) {
                console.log('  ⚠️  Unused Exports (exported but never imported):');
                for (const issue of unusedExports) {
                    console.log(`      ${issue.file}:${issue.line} - ${issue.name}`);
                }
                console.log('');
            }
        }
        
        if (report.duplicates.length > 0) {
            console.log('🔄 DUPLICATE EXPORTS:\n');
            for (const dup of report.duplicates) {
                console.log(`  ${dup.name}:`);
                for (const loc of dup.locations) {
                    console.log(`    ${loc.file}:${loc.line}`);
                }
                console.log('');
            }
        }
        
        if (report.issues.length === 0 && report.duplicates.length === 0) {
            console.log('✅ No issues found! All exports are clean.\n');
        }
        
        // If --report flag, write JSON report
        if (CONFIG.report) {
            const exportObj = {};
            for (const [name, locations] of this.allExports) {
                exportObj[name] = locations;
            }
            
            const jsonReport = {
                summary: report.summary,
                issues: report.issues,
                duplicates: report.duplicates,
                allExports: exportObj
            };
            
            fs.writeFileSync(CONFIG.reportFile, JSON.stringify(jsonReport, null, 2));
            console.log(`📄 Report written to ${CONFIG.reportFile}\n`);
        }
    }
    
    /**
     * Attempt to fix issues (experimental)
     */
    fixIssues() {
        if (!CONFIG.fix) return;
        
        console.log('🔧 Attempting to fix issues...\n');
        
        const missingExports = this.issues.filter(i => i.type === 'missing_export');
        
        for (const issue of missingExports) {
            const filePath = path.join(CONFIG.jsRoot, issue.file);
            if (!fs.existsSync(filePath)) continue;
            
            let content = fs.readFileSync(filePath, 'utf-8');
            
            // Check if the export already exists
            if (content.includes(`export ${issue.name}`) || 
                content.includes(`export { ${issue.name}`)) {
                continue;
            }
            
            // Find the declaration
            const declRegex = new RegExp(`(const|let|var|function|class)\\s+${issue.name}`, 'g');
            const match = declRegex.exec(content);
            
            if (match) {
                const before = content.substring(0, match.index);
                const after = content.substring(match.index);
                const newContent = before + 'export ' + after;
                fs.writeFileSync(filePath, newContent);
                console.log(`  ✅ Fixed ${issue.file}:${issue.line} - Added export for '${issue.name}'`);
            } else {
                const exportsSection = `\n// ============================================================\n// EXPORTS\n// ============================================================\nexport { ${issue.name} };\n`;
                fs.appendFileSync(filePath, exportsSection);
                console.log(`  ✅ Fixed ${issue.file}:${issue.line} - Added exports section with '${issue.name}'`);
            }
        }
        
        console.log('\n🔧 Fixing complete. Please verify changes manually.\n');
    }
}

// ============================================================
// RUN
// ============================================================

console.log(`📍 Project root: ${PROJECT_ROOT}`);
console.log(`📍 JS root: ${JS_ROOT}\n`);

const analyzer = new ExportAnalyzer();
analyzer.analyze();
analyzer.printReport();

if (CONFIG.fix) {
    analyzer.fixIssues();
}

export default ExportAnalyzer;
