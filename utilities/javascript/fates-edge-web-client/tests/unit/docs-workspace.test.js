import { describe,it,assert,assertEqual } from '../runner.js';
import { filterDocuments,readReadingState,toggleSaved,isSaved } from '../../js/features/docs/workspace.js';
import { readFileSync } from 'node:fs';
const docs=[{title:'Player Guide',type:'core',fullPath:'/player',description:'Create heroes',pages:[{title:'Crafting equipment'}]},{title:'Dragon Mountain',type:'adventures',fullPath:'/dragon',author:'Test Author'},{title:'Essentials',type:'core',fullPath:'/essentials'}];
const reading={saved:['/dragon'],recent:[{path:'/player'},{path:'/essentials'}]};
describe('Docs reading workspace',()=>{
    it('searches across categories including chapter titles and descriptions',()=>{
        assertEqual(filterDocuments(docs,{query:'crafting heroes'},reading)[0].fullPath,'/player');
        assertEqual(filterDocuments(docs,{query:'test author'},reading)[0].fullPath,'/dragon');
    });
    it('combines category and saved filters',()=>{
        assertEqual(filterDocuments(docs,{shelf:'saved'},reading).length,1);
        assertEqual(filterDocuments(docs,{shelf:'saved',type:'core'},reading).length,0);
    });
    it('sorts recently read without changing manifest order',()=>{
        const recent=filterDocuments(docs,{shelf:'recent'},reading);
        assertEqual(recent[0].fullPath,'/player');assertEqual(recent[1].fullPath,'/essentials');
        filterDocuments(docs,{},reading);assertEqual(docs[0].fullPath,'/player');
    });
    it('tolerates documents with missing optional metadata',()=>{
        assertEqual(filterDocuments([{fullPath:'/x'}],{query:'missing'},reading).length,0);
    });
    it('toggles saved documents and recovers malformed preference storage',()=>{
        const before=localStorage.getItem('fates-edge-docs-reading-v1');
        try {
            localStorage.setItem('fates-edge-docs-reading-v1','bad json');assertEqual(readReadingState().saved.length,0);
            assert(toggleSaved('/qa'));assert(isSaved('/qa'));assert(toggleSaved('/qa'));assert(!isSaved('/qa'));
        } finally {if(before===null)localStorage.removeItem('fates-edge-docs-reading-v1');else localStorage.setItem('fates-edge-docs-reading-v1',before);}
    });
    it('rejects stale document loads and keeps print allowlisting',()=>{
        const source=readFileSync(new URL('../../js/features/docs/index.js',import.meta.url),'utf8');
        assertEqual((source.match(/if\(request!==documentRequest \|\| !viewer.isConnected\)return;/g)||[]).length,4);
        assert(source.includes('PRINTABLE_DOC_IDS.has(doc.id)'));
        assert(source.includes('documentRequest++;'));
        assert(source.includes('const sanitized = sanitizeHtml(html)'));
    });
});
