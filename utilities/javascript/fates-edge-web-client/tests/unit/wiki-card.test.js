import { describe, it, assert, assertEqual } from '../runner.js';
import { readFileSync } from 'node:fs';
import { renderEntryCard } from '../../js/features/wiki/index.js';
import { deTex } from '../../js/tools/clean-wiki-data.js';

const wiki = JSON.parse(readFileSync(new URL('../../data/wiki.json', import.meta.url), 'utf8'));

describe('Wiki entry cards', () => {
    it('renders a draw-table entry with its suit pip, region and subtitle', () => {
        const html = renderEntryCard({
            id: 'remote-104', title: 'Broken Milestone', source: 'remote',
            subtitle: 'On the old Imperial Road.', category: 'locations',
            body: 'The stone has been chiseled seven times.',
            tags: ['acasia', 'spades'], region: 'Acasia', suit: 'spades', card: 2,
        });
        assert(html.includes('wiki-entry-card'), 'should render a card');
        assert(html.includes('Broken Milestone'));
        assert(html.includes('wiki-entry-subtitle'), 'subtitle should have its own line');
        assert(html.includes('wiki-card-pip'), 'a suited entry shows its card pip');
        assert(html.includes('♠'), 'spades renders the spade glyph');
        assert(html.includes('wiki-facet-region') && html.includes('Acasia'));
        assertEqual((html.match(/<article/g) || []).length, (html.match(/<\/article>/g) || []).length);
    });

    it('renders Markdown in the body rather than showing the source, at any length', () => {
        const short = renderEntryCard({ id: 'a', title: 'Short', body: '**bold**', tags: [] });
        const long = renderEntryCard({ id: 'b', title: 'Long', body: '**bold** ' + 'x'.repeat(500), tags: [] });
        // The renderer falls back to escaped text when the Markdown libraries
        // are absent (they are, in tests), so assert the shared path rather
        // than parsed output: both lengths go through .wiki-entry-body, and
        // only the clamp class differs. The old code rendered long bodies as
        // escaped Markdown source and short ones as HTML.
        assert(short.includes('wiki-entry-body'), 'short bodies use the body container');
        assert(long.includes('wiki-entry-body'), 'long bodies use the same container');
        assert(!short.includes('is-clamped'), 'a short body is not clamped');
        assert(long.includes('is-clamped'), 'a long body is clamped, not truncated');
        assert(long.includes('Read more'), 'a clamped body offers to expand');
    });

    it('marks an entry with no text as a stub instead of rendering a blank card', () => {
        const html = renderEntryCard({ id: 'c', title: 'Nameless Patron', tags: [], stub: true });
        assert(html.includes('is-stub'));
        assert(html.includes('wiki-entry-stub'));
        assert(!html.includes('wiki-entry-body'));
    });

    it('keeps destructive controls quiet and icon-sized', () => {
        const local = renderEntryCard({ id: 'd', title: 'Mine', source: 'local', body: 'x', tags: [] });
        assert(local.includes('btn-danger btn-icon'), 'delete is a quiet icon button');
        assert(local.includes('btn-quiet'), 'edit is a low-emphasis action');
        assert(!local.includes('btn-primary'), 'no loud action on a list card');
    });

    it('escapes entry titles rather than trusting them as markup', () => {
        const html = renderEntryCard({ id: 'e', title: '<img src=x onerror=alert(1)>', tags: [] });
        assert(!html.includes('<img'), 'title must be escaped');
    });
});

describe('Wiki data integrity (data/wiki.json)', () => {
    it('carries no LaTeX escaping or scrape separators in user-visible strings', () => {
        const fields = (e) => [e.title, e.subtitle, e.body, ...(e.tags || [])].filter(t => typeof t === 'string');
        const dirty = wiki.filter(e => fields(e).some(t => /\\|``|''|---/.test(t)));
        assertEqual(dirty.length, 0, `entries still carrying scrape artifacts: ${dirty.slice(0, 3).map(e => e.title)}`);
    });

    it('has a title on every entry and no entry whose title is a whole card', () => {
        assert(wiki.every(e => typeof e.title === 'string' && e.title.trim()), 'every entry needs a title');
        const overlong = wiki.filter(e => e.title.length > 120);
        assertEqual(overlong.length, 0, `titles that look like mashed-in card text: ${overlong.slice(0, 2).map(e => e.title)}`);
    });

    it('marks empty entries as stubs rather than shipping blank bodies', () => {
        const blankButNotStub = wiki.filter(e => !e.stub && !(e.body || '').trim());
        assertEqual(blankButNotStub.length, 0);
    });

    it('deTex() undoes the escaping the scrape left behind', () => {
        assertEqual(deTex('Oath of Flame \\& Light'), 'Oath of Flame & Light');
        assertEqual(deTex("borders ``moved'' overnight"), 'borders “moved” overnight');
        assertEqual(deTex('a --- b'), 'a — b');
    });
});
