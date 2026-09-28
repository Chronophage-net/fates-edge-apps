import { describe, it, assertEqual, assert } from '../runner.js';
import { sanitizeHtml } from '../../js/core/utils.js';

describe('Shared HTML sanitization', () => {
    it('escapes all markup when the sanitizer is missing or fails', () => {
        const previous = window.DOMPurify;
        const payload = '<a href="javascript:alert(1)"><img src=x onerror=alert(1)></a>';
        try {
            for (const purifier of [undefined, {}, { sanitize() { throw new Error('failed'); } }]) {
                window.DOMPurify = purifier;
                const result = sanitizeHtml(payload);
                assert(!result.includes('<'), 'fallback must never emit tags');
                assert(result.includes('&lt;a'), 'text is preserved');
            }
        } finally { window.DOMPurify = previous; }
    });
    it('blocks embedded controls, CSS and delegated action attributes', () => {
        const previous = window.DOMPurify;
        try {
            window.DOMPurify = { sanitize(html, options) {
                assertEqual(html, '<b>text</b>');
                assert(options.FORBID_TAGS.includes('button'));
                assert(options.FORBID_ATTR.includes('style'));
                assertEqual(options.ALLOW_DATA_ATTR, false);
                return '<b>text</b>';
            } };
            assertEqual(sanitizeHtml('<b>text</b>'), '<b>text</b>');
        } finally { window.DOMPurify = previous; }
    });
});

describe('Object merge trust boundary', () => {
    it('ignores prototype keys in imported JSON at every depth', async () => {
        const { deepMerge } = await import('../../js/core/utils.js');
        const payload = JSON.parse('{"__proto__":{"polluted":true},"nested":{"constructor":{"prototype":{"polluted":true}},"value":2}}');
        const result = deepMerge({ nested: { keep: 1 } }, payload);
        assertEqual(result.polluted, undefined);
        assertEqual(result.nested.value, 2);
        assertEqual(result.nested.keep, 1);
        assertEqual(Object.hasOwn(result.nested, 'constructor'), false);
        assertEqual({}.polluted, undefined);
    });
});
