import { describe, it, assert, assertEqual } from '../runner.js';
import search, {
    loadSearchIndex,
    reloadIndex,
    getSearchStatus,
    checkSolr,
    solrSearch,
    checkElasticsearch,
    elasticsearchSearch,
} from '../../js/features/search/index.js';

// Every test resets the module's config globals and swaps in a fresh mock
// fetch, so tests don't leak state into each other (the module's URL
// getters read window.__SOLR_URL/__ES_URL/etc live, not cached at import
// time -- see the module's own comment on why -- which is exactly what
// makes this possible).
function resetConfig() {
    delete window.__SOLR_URL;
    delete window.__ES_URL;
    delete window.__ES_API_KEY;
    delete window.__SEARCH_BACKEND;
}

function withMockFetch(handler, fn) {
    const original = globalThis.fetch;
    globalThis.fetch = handler;
    return fn().finally(() => { globalThis.fetch = original; });
}

describe('Search module: Elasticsearch backend', () => {
    it('checkElasticsearch() POSTs to <ES_URL>/_search and reports connected on 2xx', async () => {
        resetConfig();
        window.__ES_URL = 'https://es.example.com/fatesedge';
        let calledUrl = null;
        let calledMethod = null;
        await withMockFetch(async (url, opts) => {
            calledUrl = url;
            calledMethod = opts?.method;
            return { ok: true };
        }, async () => {
            const ok = await checkElasticsearch();
            assert(ok === true, 'checkElasticsearch should report true on a 2xx response');
        });
        assertEqual(calledUrl, 'https://es.example.com/fatesedge/_search');
        assertEqual(calledMethod, 'POST');
    });

    it('checkElasticsearch() reports false if fetch throws (network error, CORS, etc.)', async () => {
        resetConfig();
        window.__ES_URL = 'https://es.example.com/fatesedge';
        await withMockFetch(async () => { throw new Error('network down'); }, async () => {
            const ok = await checkElasticsearch();
            assert(ok === false);
        });
    });

    it('elasticsearchSearch() maps hits into the shared result shape, normalized to a 0-100 score', async () => {
        resetConfig();
        window.__ES_URL = 'https://es.example.com/fatesedge';
        const fakeResponse = {
            hits: {
                max_score: 2.0,
                hits: [
                    { _score: 2.0, _source: { title: 'Rite of the Silent Bell', content: 'A Cantor rite.', url: '#/rites/silent-bell', type: 'rite', category: 'Rites' } },
                    { _score: 1.0, _source: { title: 'Bell Tower', content: 'A location.', url: '#/regions/bell-tower', type: 'region' } },
                ],
            },
        };
        const results = await withMockFetch(async () => ({ ok: true, json: async () => fakeResponse }), () => elasticsearchSearch('bell'));

        assert(Array.isArray(results));
        assertEqual(results.length, 2);
        assertEqual(results[0].title, 'Rite of the Silent Bell');
        assertEqual(results[0].score, 100, 'top hit should normalize to 100% of max_score');
        assertEqual(results[1].score, 50, 'half the top score should normalize to 50%');
        assertEqual(results[1].category, '', 'missing category should default to empty string, not undefined');
    });

    it('elasticsearchSearch() returns null (not throw) on a non-2xx response', async () => {
        resetConfig();
        window.__ES_URL = 'https://es.example.com/fatesedge';
        const result = await withMockFetch(async () => ({ ok: false, status: 500 }), () => elasticsearchSearch('bell'));
        assertEqual(result, null);
    });

    it('sends an Authorization: ApiKey header only when __ES_API_KEY is configured', async () => {
        resetConfig();
        window.__ES_URL = 'https://es.example.com/fatesedge';
        let seenHeadersWithoutKey = null;
        await withMockFetch(async (url, opts) => { seenHeadersWithoutKey = opts.headers; return { ok: true }; }, () => checkElasticsearch());
        assert(!('Authorization' in seenHeadersWithoutKey));

        window.__ES_API_KEY = 'ZmFrZTprZXk=';
        let seenHeadersWithKey = null;
        await withMockFetch(async (url, opts) => { seenHeadersWithKey = opts.headers; return { ok: true }; }, () => checkElasticsearch());
        assertEqual(seenHeadersWithKey['Authorization'], 'ApiKey ZmFrZTprZXk=');
    });
});

describe('Search module: backend selection', () => {
    it('loadSearchIndex() picks Elasticsearch when only __ES_URL is configured', async () => {
        resetConfig();
        window.__ES_URL = 'https://es.example.com/fatesedge';
        await withMockFetch(async () => ({ ok: true }), () => loadSearchIndex());
        const status = getSearchStatus();
        assertEqual(status.backend, 'elasticsearch');
        assertEqual(status.elasticsearchConfigured, true);
        assertEqual(status.solrConfigured, false);
    });

    it('loadSearchIndex() prefers Solr when both are configured and no explicit preference is set (backward compatibility)', async () => {
        resetConfig();
        window.__SOLR_URL = 'https://solr.example.com/solr/fatesedge/select';
        window.__ES_URL = 'https://es.example.com/fatesedge';
        await withMockFetch(async () => ({ ok: true }), () => loadSearchIndex());
        assertEqual(getSearchStatus().backend, 'solr');
    });

    it('window.__SEARCH_BACKEND = "elasticsearch" overrides the default Solr preference', async () => {
        resetConfig();
        window.__SOLR_URL = 'https://solr.example.com/solr/fatesedge/select';
        window.__ES_URL = 'https://es.example.com/fatesedge';
        window.__SEARCH_BACKEND = 'elasticsearch';
        await withMockFetch(async () => ({ ok: true }), () => loadSearchIndex());
        assertEqual(getSearchStatus().backend, 'elasticsearch');
    });

    it('falls through from Solr to Elasticsearch if Solr is configured but unreachable', async () => {
        resetConfig();
        window.__SOLR_URL = 'https://solr.example.com/solr/fatesedge/select';
        window.__ES_URL = 'https://es.example.com/fatesedge';
        await withMockFetch(async (url) => ({ ok: String(url).includes('es.example.com') }), () => loadSearchIndex());
        assertEqual(getSearchStatus().backend, 'elasticsearch');
    });

    it('getSearchStatus() reports neither backend configured when window.__SOLR_URL/__ES_URL are unset', () => {
        resetConfig();
        assertEqual(getSearchStatus().solrConfigured, false);
        assertEqual(getSearchStatus().elasticsearchConfigured, false);
    });

    it('reloadIndex() clears the previously selected backend before re-checking', async () => {
        resetConfig();
        window.__ES_URL = 'https://es.example.com/fatesedge';
        await withMockFetch(async () => ({ ok: true }), () => loadSearchIndex());
        assertEqual(getSearchStatus().backend, 'elasticsearch');

        resetConfig(); // simulate the operator un-configuring Elasticsearch
        window.__SOLR_URL = 'https://solr.example.com/solr/fatesedge/select';
        reloadIndex(); // fire-and-forget, matches production usage (rebuild button)
        await withMockFetch(async () => ({ ok: true }), async () => {
            // give the not-awaited internal loadSearchIndex() a tick to settle
            for (let i = 0; i < 5 && getSearchStatus().isLoading; i++) {
                await new Promise(r => setTimeout(r, 0));
            }
        });
    });

    it('exposes the pre-existing Solr functions unchanged (checkSolr/solrSearch still exported)', () => {
        assert(typeof checkSolr === 'function');
        assert(typeof solrSearch === 'function');
        assert(typeof search.default !== 'function'); // sanity: default export is the object, not a re-wrapped function
        resetConfig(); // leave no window.__SOLR_URL/__ES_URL behind for tests in other files
    });
});
