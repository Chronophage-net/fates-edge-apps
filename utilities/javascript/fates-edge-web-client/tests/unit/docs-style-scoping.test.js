import { describe, it, assertEqual, assert } from '../runner.js';
// sanitizeHtml() itself needs DOMParser, which this Node runner has no
// polyfill for; it is covered end-to-end in a browser instead. What is
// unit-tested here is the scoping, which is pure string work.
import { scopeCss, scopeSelector } from '../../js/features/docs/index.js';

describe('Published-document CSS scoping', () => {
    it('scopes ordinary selectors to the document container', () => {
        assertEqual(scopeSelector('.die'), '.integrated-document .die');
        assertEqual(scopeSelector('.roll, .tag'), '.integrated-document .roll, .integrated-document .tag');
    });
    it('remaps page-level selectors onto the container instead of dropping them', () => {
        assertEqual(scopeSelector('body'), '.integrated-document');
        assertEqual(scopeSelector(':root'), '.integrated-document');
        assertEqual(scopeSelector('html'), '.integrated-document');
        assertEqual(scopeSelector('*'), '.integrated-document *');
        assertEqual(scopeSelector('body .line'), '.integrated-document .line');
    });
    it('keeps media queries and scopes what is inside them', () => {
        const out = scopeCss('@media (max-width: 700px) { .die { padding: 0 } }');
        assert(out.includes('@media (max-width: 700px)'), 'media query preserved');
        assert(out.includes('.integrated-document .die'), 'inner selector scoped');
    });
    it('leaves at-rules that take no selectors alone', () => {
        const out = scopeCss('@keyframes spin { from { opacity: 0 } }');
        assert(out.startsWith('@keyframes spin'), 'keyframes untouched');
        assert(!out.includes('.integrated-document from'), 'keyframe stops not scoped');
    });
});
