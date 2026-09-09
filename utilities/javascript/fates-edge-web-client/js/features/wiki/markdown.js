import { escHtml } from '@core/utils.js';

/** Render wiki Markdown identically in the list and editor preview.
 * If either CDN library is unavailable, show escaped source text.
 */
export function renderWikiMarkdown(value) {
    const text = String(value ?? '');
    if (!text) return '';
    const plain = () => escHtml(text).replace(/\n/g, '<br>');
    const parser = globalThis.window?.marked;
    const purifier = globalThis.window?.DOMPurify;
    if (typeof purifier?.sanitize !== 'function') return plain();
    try {
        const html = typeof parser?.parse === 'function' ? parser.parse(text)
            : typeof parser === 'function' ? parser(text) : null;
        if (typeof html !== 'string') return plain();
        return purifier.sanitize(html, {
            USE_PROFILES: { html: true },
            FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select'],
            FORBID_ATTR: ['style', 'id', 'name'],
            ALLOW_DATA_ATTR: false,
        });
    } catch {
        return plain();
    }
}
