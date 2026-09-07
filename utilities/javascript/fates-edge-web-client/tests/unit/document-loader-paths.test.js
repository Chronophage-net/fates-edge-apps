import { describe, it, assertEqual } from '../runner.js';
import { documentLoader } from '../../js/document-loader.js';

describe('Published document paths', () => {
    it('resolves current manifest directory paths without doubling data/docs', () => {
        const entry = documentLoader.normalizeDocumentEntry({path: '/data/docs/players-guide/', file: 'index.html'});
        assertEqual(entry.path, '/data/docs/players-guide/index.html');
        assertEqual(documentLoader.normalizeDocumentEntry({path: '/data/docs/srd.html', file: 'srd.html'}).path, '/data/docs/srd.html');
        assertEqual(documentLoader.normalizeDocumentEntry({file: 'srd.html'}).path, '/data/docs/srd.html');
        assertEqual(documentLoader.normalizeDocumentEntry({path: 'https://example.org/book.html'}).path, 'https://example.org/book.html');
    });
    it('retains distinct books sharing a directory and deduplicates repeated entries', async () => {
        const originalFetch = globalThis.fetch;
        const loader = new documentLoader.constructor();
        globalThis.fetch = async () => ({ok: true, json: async () => ({documents: [
            {path: '/data/docs/', file: 'srd.html'},
            {path: '/data/docs/', file: 'invoker.html'}
        ]})});
        try {
            await loader.loadFromManifest('/data/docs/manifest.json');
            await loader.loadFromManifest('/data/docs/manifest.json');
            assertEqual(loader.documents.length, 2);
            assertEqual(loader.documents[1].path, '/data/docs/invoker.html');
        } finally { globalThis.fetch = originalFetch; }
    });
});
