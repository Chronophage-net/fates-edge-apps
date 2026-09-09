import { describe, it, assert, assertEqual } from '../runner.js';
import { renderWikiMarkdown } from '../../js/features/wiki/markdown.js';

describe('Wiki Markdown rendering', () => {
    it('fails closed when sanitization is unavailable, including raw HTML and URLs', () => {
        const { marked, DOMPurify } = window;
        const createElement = document.createElement;
        // The lightweight Node DOM does not serialize text nodes. Model only
        // that browser behavior here; actual sanitization is checked in-browser.
        document.createElement = () => ({ textContent: '', get innerHTML() {
            return this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } });
        try {
            window.marked = { parse: () => { throw new Error('must not parse without sanitizer'); } };
            window.DOMPurify = undefined;
            const html = renderWikiMarkdown('<img src=x onerror=alert(1)>\n[link](javascript:alert(1))');
            assert(!html.includes('<img'), 'raw HTML is escaped');
            assert(!html.includes('<a'), 'unsafe links cannot become anchors');
            assert(html.includes('<br>'), 'line breaks are preserved');
        } finally { Object.assign(window, { marked, DOMPurify }); document.createElement = createElement; }
    });
    it('returns sanitized parser output and disables active UI and style attributes', () => {
        const { marked, DOMPurify } = window;
        const createElement = document.createElement;
        // The lightweight Node DOM does not serialize text nodes. Model only
        // that browser behavior here; actual sanitization is checked in-browser.
        document.createElement = () => ({ textContent: '', get innerHTML() {
            return this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } });
        try {
            let received, options;
            window.marked = { parse: () => '<strong>Bold</strong><script>bad()</script>' };
            window.DOMPurify = { sanitize: (html, config) => {
                received = html; options = config; return '<strong>Bold</strong>';
            } };
            assertEqual(renderWikiMarkdown('**Bold**'), '<strong>Bold</strong>');
            assert(received.includes('<script>'), 'parser output goes through sanitizer');
            assert(options.FORBID_TAGS.includes('form'), 'embedded forms forbidden');
            assert(options.FORBID_ATTR.includes('style'), 'CSS cannot escape entry layout');
            assertEqual(options.ALLOW_DATA_ATTR, false, 'entry content cannot impersonate delegated actions');
            window.DOMPurify.sanitize = () => { throw new Error('unavailable'); };
            assertEqual(renderWikiMarkdown('<b>text</b>'), '&lt;b&gt;text&lt;/b&gt;');
        } finally { Object.assign(window, { marked, DOMPurify }); document.createElement = createElement; }
    });
});
