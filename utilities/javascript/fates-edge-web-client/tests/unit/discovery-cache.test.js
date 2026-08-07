import { describe, it, assert, assertEqual, assertDeepEqual } from '../runner.js';
import { discoverPatrons, discoverRegions } from '../../js/core/discovery.js';

// discovery.js caches discovered slug lists in localStorage for 1 hour.
// Regression coverage for the Cantor "needs a manual refresh" bug: the
// discovery-level cache must be respected by default but bypassable via a
// `force` flag, so a real forced reload (loadPatronData(true) /
// window.cantorRefresh()) actually re-discovers instead of trusting a
// stale local cache.

function installFakeFetch(okSlugs) {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
        calls.push({ url, method: opts?.method || 'GET' });
        if (url.endsWith('manifest.json')) {
            return { ok: false };
        }
        // HEAD checks for individual slug files
        const matched = okSlugs.some(slug => url.includes(`${slug}.json`));
        return { ok: matched, json: async () => ({}) };
    };
    return {
        calls,
        restore() { globalThis.fetch = originalFetch; }
    };
}

describe('discovery.js: discoverPatrons cache + force bypass', () => {
    it('uses a populated localStorage cache on a normal call (no fetch calls made)', async () => {
        const fake = installFakeFetch(['mykkiel']);
        try {
            localStorage.setItem('fates-edge-patrons-cache-cosmic', JSON.stringify({
                slugs: ['cached-slug-a', 'cached-slug-b'],
                timestamp: Date.now()
            }));

            const result = await discoverPatrons('cosmic', './data/patrons/');
            assertDeepEqual(result, ['cached-slug-a', 'cached-slug-b'], 'should return the cached slugs verbatim');
            assertEqual(fake.calls.length, 0, 'should not have made any fetch calls when a fresh cache exists');
        } finally {
            fake.restore();
            localStorage.removeItem('fates-edge-patrons-cache-cosmic');
        }
    });

    it('bypasses the cache when force=true, and re-populates it afterward', async () => {
        const fake = installFakeFetch(['mykkiel']);
        try {
            localStorage.setItem('fates-edge-patrons-cache-cosmic', JSON.stringify({
                slugs: ['stale-cached-slug'],
                timestamp: Date.now()
            }));

            const result = await discoverPatrons('cosmic', './data/patrons/', null, true);
            assert(fake.calls.length > 0, 'force=true should trigger real discovery (fetch calls)');
            assert(!result.includes('stale-cached-slug'), 'stale cached slug should not leak into a forced result');

            // Cache should be repopulated with the freshly-discovered result.
            const raw = localStorage.getItem('fates-edge-patrons-cache-cosmic');
            assert(raw, 'cache should be re-written after a forced discovery');
            const parsed = JSON.parse(raw);
            assert(!parsed.slugs.includes('stale-cached-slug'), 'repopulated cache should reflect the fresh discovery, not the old stale entry');
        } finally {
            fake.restore();
            localStorage.removeItem('fates-edge-patrons-cache-cosmic');
        }
    });

    it('still writes the cache after a normal (non-forced) miss', async () => {
        const fake = installFakeFetch([]);
        try {
            localStorage.removeItem('fates-edge-patrons-cache-religion');
            await discoverPatrons('religion', './data/patrons/');
            const raw = localStorage.getItem('fates-edge-patrons-cache-religion');
            assert(raw, 'a cache-miss discovery should still write a fresh cache entry');
        } finally {
            fake.restore();
            localStorage.removeItem('fates-edge-patrons-cache-religion');
        }
    });
});

describe('discovery.js: discoverRegions cache + force bypass', () => {
    it('uses a populated localStorage cache on a normal call', async () => {
        const fake = installFakeFetch([]);
        try {
            localStorage.setItem('fates-edge-region-cache', JSON.stringify({
                names: ['Cached Region'],
                timestamp: Date.now()
            }));

            const result = await discoverRegions('./data/regions');
            assertDeepEqual(result, ['Cached Region']);
            assertEqual(fake.calls.length, 0, 'should not hit the network when the region cache is fresh');
        } finally {
            fake.restore();
            localStorage.removeItem('fates-edge-region-cache');
        }
    });

    it('bypasses the region cache when force=true', async () => {
        const fake = installFakeFetch([]);
        try {
            localStorage.setItem('fates-edge-region-cache', JSON.stringify({
                names: ['Stale Cached Region'],
                timestamp: Date.now()
            }));

            const result = await discoverRegions('./data/regions', true);
            assert(fake.calls.length > 0, 'force=true should trigger real discovery for regions too');
            assert(!result.includes('Stale Cached Region'), 'forced call should not just echo the stale cache');
        } finally {
            fake.restore();
            localStorage.removeItem('fates-edge-region-cache');
        }
    });
});
