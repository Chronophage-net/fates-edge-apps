import { describe, it, assert, assertEqual } from '../runner.js';
import { filterLibrary, libraryPage, mergeBundledEntries } from '../../js/features/wiki/library.js';
import { readFileSync } from 'node:fs';
import { renderEntryCard } from '../../js/features/wiki/index.js';
const entries = [
    { id:'remote-0', title:'Bell keeper', category:'people', region:'Acasia', tags:['harbor'], body:'A bronze key.', source:'remote' },
    { id:'local-1', title:'Tide', category:'lore', body:'Keeper of the sea.' },
    { id:'remote-2', title:'Bell tower', category:'locations', body:'', stub:true, source:'remote' }
];
describe('Wiki library', () => {
    it('merges atomically while preserving local edits, hidden IDs and structured metadata', () => {
        const bundle=[{id:0,title:'Recipe',recipe:{tier:2},tags:'work, steel'}, {id:1,title:'Tide'}, {id:2,title:'Hidden'}];
        const before=JSON.stringify(entries);
        const merged=mergeBundledEntries(entries,bundle,['remote-2']);
        assertEqual(merged.added,1);
        assertEqual(merged.entries[1].id,'remote-0');
        assertEqual(merged.entries[1].recipe.tier,2);
        assertEqual(merged.entries[1].tags[1],'steel');
        assertEqual(merged.entries[0].body,'Keeper of the sea.');
        assertEqual(JSON.stringify(entries),before);
        let rejected=false; try { mergeBundledEntries(entries,[null,{}]); } catch { rejected=true; }
        assert(rejected); assertEqual(JSON.stringify(entries),before);
    });
    it('restores hidden references by clearing the hidden filter without duplicating locals', () => {
        assertEqual(mergeBundledEntries(entries,[{id:2,title:'Bell tower'}],['remote-2']).added,0);
        assertEqual(mergeBundledEntries(entries,[{id:2,title:'Bell tower'}],[]).added,1);
    });
    it('editor targets the current screen, preserves custom categories and updates stub status', () => {
        const source=readFileSync(new URL('../../js/features/wiki/editor.js',import.meta.url),'utf8');
        assert(!source.includes("querySelector('.modal')"));
        assert(source.includes("querySelector('.editor-screen')"));
        assert(source.includes('stub: !bodyTextarea.value.trim()'));
        assert(source.includes('escHtml(entry.category)'));
    });
    it('matches every search term across title, body, tags and region', () => {
        assertEqual(filterLibrary(entries,{search:' BELL bronze harbor acasia '}).length,1);
        assertEqual(filterLibrary(entries,{search:'bell sea'}).length,0);
    });
    it('combines source, category and region facets', () => {
        assertEqual(filterLibrary(entries,{source:'remote',category:'people',region:'Acasia'}).length,1);
        assertEqual(filterLibrary(entries,{source:'local'}).length,1);
        assertEqual(filterLibrary(entries,{source:'bookmarks'},['remote-0'])[0].title,'Bell keeper');
    });
    it('sorts a copy and handles legacy entries without optional fields', () => {
        const before=JSON.stringify(entries);
        assertEqual(filterLibrary(entries)[0].id,'local-1');
        assertEqual(filterLibrary(entries,{sort:'title'})[0].id,'remote-0');
        assertEqual(JSON.stringify(entries),before);
    });
    it('clamps pages after entries are removed and handles an empty library', () => {
        assertEqual(libraryPage(entries,99,2).page,2);
        assertEqual(libraryPage(entries,2,2).items.length,1);
        assertEqual(libraryPage([],99).page,1);
        assertEqual(libraryPage(entries,-2).page,1);
    });
    it('escapes imported draw-card metadata and provides keyboard-accessible facets', () => {
        const html=renderEntryCard({...entries[0],suit:'hearts',card:'" onmouseover="bad'});
        assert(!html.includes(' onmouseover="bad'));
        assert(html.includes('type="button" class="wiki-entry-category"'));
        assert(html.includes('data-action="bookmark"'));
    });
});
