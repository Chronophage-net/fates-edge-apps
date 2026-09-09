import { describe, it, assertEqual } from '../runner.js';
import { auditCss } from '../../js/tools/css-audit.js';

// A var() with no fallback that names an undefined property doesn't fall back
// to anything — it invalidates the whole declaration. Nineteen of these had
// accumulated (--accent, --warn, --danger, --font, --panel, --ink …), quietly
// voiding colours and panel backgrounds across ten feature modules. Keep the
// count at zero: either define the token or write var(--x, fallback).
describe('CSS custom properties', () => {
    it('every var() the app references is defined somewhere', () => {
        const { undefinedVars } = auditCss();
        const names = undefinedVars.map(v => `${v.name} (${v.files[0]})`);
        assertEqual(names.join('\n'), '', 'undefined custom properties');
    });
});

// A standalone game's definitions must not mask missing toolkit styles.
describe('CSS audit document boundaries', () => {
    it('recognizes a standalone HTML stylesheet only in its own document', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const path = await import('node:path');
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-css-audit-'));
        try {
            fs.mkdirSync(path.join(root, 'css'));
            fs.writeFileSync(path.join(root, 'css/app.css'), '');
            fs.writeFileSync(path.join(root, 'index.html'), '<main></main>');
            fs.writeFileSync(path.join(root, 'game.html'), '<style>:root{--game-color:red}.game-card{color:var(--game-color)}</style><div class="game-card">Game</div>');
            assertEqual(auditCss(root).undefinedClasses.length, 0);
            assertEqual(auditCss(root).undefinedVars.length, 0);
            fs.writeFileSync(path.join(root, 'module.js'), 'const html = `<div class="game-card" style="color:var(--game-color)">App</div>`;');
            const result = auditCss(root);
            assertEqual(result.inlineStyledOnly.some(c => c.name === 'game-card'), true);
            assertEqual(result.undefinedVars.some(v => v.name === '--game-color'), true);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
