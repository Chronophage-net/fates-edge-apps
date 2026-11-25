import { describe,it,assert,assertEqual } from '../runner.js';
import { filterDocuments,groupDocuments,listSubcategories,readReadingState,toggleSaved,isSaved } from '../../js/features/docs/workspace.js';
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
    it('orders a category by subcategory, then reading order, and filters to one subcategory',()=>{
        const novels=[
            {title:'Zeta Saga II',type:'novels',fullPath:'/z2',subcategory:'saga',subcategoryLabel:'The Saga',subcategoryOrder:1,order:2},
            {title:'Alpha Standalone',type:'novels',fullPath:'/a',subcategory:'solo',subcategoryLabel:'Standalones',subcategoryOrder:2,order:1},
            {title:'Yonder Saga I',type:'novels',fullPath:'/z1',subcategory:'saga',subcategoryLabel:'The Saga',subcategoryOrder:1,order:1},
            {title:'Guide',type:'novels',fullPath:'/g',subcategory:'guides',subcategoryLabel:'Guides',subcategoryOrder:0,order:1},
            {title:'Unshelved',type:'novels',fullPath:'/u'},
            {title:'Elsewhere',type:'core',fullPath:'/c'}];
        const one=filterDocuments(novels,{type:'novels'},reading).map(d=>d.fullPath);
        assertEqual(one.join(','),'/g,/z1,/z2,/a,/u');
        assertEqual(filterDocuments(novels,{type:'novels',subcategory:'saga'},reading).map(d=>d.fullPath).join(','),'/z1,/z2');
        // Across all categories the list stays alphabetical and ignores the subcategory filter.
        assertEqual(filterDocuments(novels,{type:'all',subcategory:'saga'},reading)[0].fullPath,'/a');
        const groups=groupDocuments(filterDocuments(novels,{type:'novels'},reading));
        assertEqual(groups.map(g=>g.label).join('|'),'Guides|The Saga|Standalones|Other');
        assertEqual(groups[1].docs.length,2);
        assertEqual(listSubcategories(novels,'novels').map(s=>s.id+':'+s.count).join(','),'guides:1,saga:2,solo:1');
        assertEqual(groupDocuments([{title:'x'}]).length,0);
        assert(filterDocuments(novels,{type:'novels',query:'standalones'},reading).some(d=>d.fullPath==='/a'));
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
