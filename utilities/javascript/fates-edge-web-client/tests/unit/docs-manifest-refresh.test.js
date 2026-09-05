import { describe, it, assertEqual, assertTrue } from '../runner.js';

const loadSource = async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    return readFileSync(path.resolve(here, '..', '..', 'js', 'features', 'docs', 'index.js'), 'utf8');
};

describe('Document manifest refresh: source guard', () => {
    it('refreshes the shipped manifest on the first Docs load only', async () => {
        const source = await loadSource();
        assertTrue(source.includes('!refreshedManifestThisPage'), 'the first load should bypass the browser list cache');
        assertTrue(source.includes('refreshedManifestThisPage = true'), 'later route activations should know the refresh happened');
        assertTrue(source.includes('if (docsLoadPromise) return docsLoadPromise'), 'render and onActivate should share one request');
    });

    it('bypasses the HTTP cache when rebuilding the browser manifest', async () => {
        const source = await loadSource();
        assertTrue(source.includes("{ cache: 'no-store' }"), 'the initial refresh should not reuse a stale HTTP response');
        assertTrue(source.includes('manifest_refresh=${Date.now()}'), 'the manifest URL should carry a deployment-refresh nonce');
    });

    it('preserves uploaded documents and makes manual refresh explicit', async () => {
        const source = await loadSource();
        assertTrue(source.includes('allDocs = mergeUploadedDocs(docs)'), 'a manifest rebuild should merge local uploads back in');
        assertTrue(source.includes('loadDocs({ refreshManifest: true })'), 'the toolbar and public refresh path should force a rebuild');
    });
});

describe('Document manifest refresh: behavior', () => {
    it('rebuilds stale cache once and retains browser uploads', async () => {
        const originalGetElementById = document.getElementById;
        const originalFetch = globalThis.fetch;
        const list = { innerHTML: '', querySelectorAll: () => [] };
        document.getElementById = id => id === 'doc-list' ? list : null;

        localStorage.setItem('fates-edge-docs-cache', JSON.stringify({
            docs: [{ id: 'stale', title: 'Stale', file: 'stale.html', type: 'other' }]
        }));
        localStorage.setItem('fates-edge-uploaded-docs', JSON.stringify([{
            id: 'uploaded-note',
            title: 'Table Note',
            file: 'table_note.html',
            type: 'uploaded',
            fullPath: '/data/docs/uploaded/table_note.html',
            uploaded: true
        }]));

        const calls = [];
        globalThis.fetch = async (url, options) => {
            calls.push({ url: String(url), options });
            return {
                ok: true,
                async json() {
                    return {
                        documents: [{
                            id: 'fresh',
                            title: 'Fresh Guide',
                            file: 'fresh.html',
                            category: 'core',
                            path: '/data/docs/'
                        }]
                    };
                }
            };
        };

        try {
            const { loadDocs, destroy } = await import('../../js/features/docs/index.js');
            const first = await loadDocs();
            assertEqual(calls.length, 1, 'first Docs load should fetch exactly once');
            assertTrue(calls[0].url.includes('manifest_refresh='), 'first fetch should be cache-busted');
            assertEqual(calls[0].options.cache, 'no-store');
            assertEqual(first.map(doc => doc.id).sort().join(','), 'fresh,uploaded-note');

            await loadDocs();
            assertEqual(calls.length, 1, 'second load should use the rebuilt cache');
            const cached = JSON.parse(localStorage.getItem('fates-edge-docs-cache'));
            assertEqual(cached.docs.map(doc => doc.id).sort().join(','), 'fresh,uploaded-note');
            destroy();
        } finally {
            document.getElementById = originalGetElementById;
            globalThis.fetch = originalFetch;
            localStorage.removeItem('fates-edge-docs-cache');
            localStorage.removeItem('fates-edge-uploaded-docs');
        }
    });
});
