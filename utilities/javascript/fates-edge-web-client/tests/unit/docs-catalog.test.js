import { describe, it, assertEqual, assertTrue } from '../runner.js';

describe('Published document catalog', () => {
    it('lists every shipped HTML page, including translations and collection indexes', async () => {
        const { readdirSync, readFileSync } = await import('node:fs');
        const { fileURLToPath } = await import('node:url');
        const path = await import('node:path');
        const root = fileURLToPath(new URL('../../data/docs/', import.meta.url));
        const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
        const covered = new Set();
        for (const doc of manifest.documents) {
            for (const file of [doc.file, ...(doc.pages || []).map(page => page.file)]) {
                covered.add(path.join(doc.path.replace(/^\/data\/docs\//, ''), file));
            }
        }
        const visit = dir => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const file = path.join(dir, entry.name);
                if (entry.isDirectory()) visit(file);
                else if (entry.name.endsWith('.html')) {
                    assertTrue(covered.has(path.relative(root, file)), `Missing catalog entry: ${path.relative(root, file)}`);
                }
            }
        };
        visit(root);
        for (const locale of ['de', 'fr']) {
            const localized = manifest.documents.filter(doc => doc.category === locale);
            assertTrue(localized.length > 0, `${locale} translations must be discoverable`);
            assertTrue(localized.every(doc => doc.path === `/data/docs/${locale}/`));
        }
        const added = manifest.documents.filter(doc => ['de', 'fr'].includes(doc.category) || doc.id === 'novels_catalog');
        for (const doc of added) {
            assertEqual(manifest.documents.filter(other => other.id === doc.id).length, 1,
                `New catalog entry must have an unambiguous ID: ${doc.id}`);
        }
    });
});
