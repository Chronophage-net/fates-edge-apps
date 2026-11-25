const KEY='fates-edge-docs-reading-v1';
export function readReadingState() {
    try { const value=JSON.parse(localStorage.getItem(KEY)||'{}');return {saved:Array.isArray(value.saved)?value.saved.filter(p=>typeof p==='string'):[],recent:Array.isArray(value.recent)?value.recent.filter(r=>r&&typeof r.path==='string'):[]}; }
    catch {return {saved:[],recent:[]};}
}
export function isSaved(path) {return readReadingState().saved.includes(path);}
export function toggleSaved(path) {
    const data=readReadingState(); data.saved=data.saved.includes(path)?data.saved.filter(p=>p!==path):[...data.saved,path];
    try {localStorage.setItem(KEY,JSON.stringify(data));} catch {return false;} return true;
}
// Subcategories (e.g. a novel's series) come from the docs manifest as
// subcategory / subcategoryLabel / subcategoryOrder / order. Missing values
// sort last; Infinity - Infinity is NaN, which `||` treats as a tie.
const byTitle=(a,b)=>String(a.title).localeCompare(String(b.title));
const bySubcategory=(a,b)=>((a.subcategoryOrder??Infinity)-(b.subcategoryOrder??Infinity))
    ||String(a.subcategoryLabel||'').localeCompare(String(b.subcategoryLabel||''))
    ||((a.order??Infinity)-(b.order??Infinity))
    ||byTitle(a,b);
export function filterDocuments(docs,{type='all',query='',shelf='all',subcategory='all'}={},reading=readReadingState()) {
    const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const oneCategory=type&&type!=='all';
    const result=docs.filter(doc=>(!oneCategory||doc.type===type)
        &&(!oneCategory||!subcategory||subcategory==='all'||doc.subcategory===subcategory)
        &&(shelf!=='saved'||reading.saved.includes(doc.fullPath))
        &&(shelf!=='recent'||reading.recent.some(r=>r.path===doc.fullPath))
        &&words.every(word=>[doc.title,doc.file,doc.author,doc.description,doc.subcategoryLabel,...(doc.pages||[]).map(p=>p.title)].join(' ').toLowerCase().includes(word)));
    if(shelf==='recent')return result.sort((a,b)=>reading.recent.findIndex(r=>r.path===a.fullPath)-reading.recent.findIndex(r=>r.path===b.fullPath));
    // Inside one category, keep its subcategories together and in order (a
    // series in reading order); across all categories, alphabetical as before.
    return result.sort(oneCategory&&result.some(d=>d.subcategory)?bySubcategory:byTitle);
}
// The subcategories present in one category, in shelf order.
export function listSubcategories(docs,type) {
    const seen=new Map();
    docs.filter(d=>d.type===type&&d.subcategory).sort(bySubcategory).forEach(d=>{
        if(!seen.has(d.subcategory))seen.set(d.subcategory,{id:d.subcategory,label:d.subcategoryLabel||d.subcategory,count:0});
        seen.get(d.subcategory).count++;
    });
    return [...seen.values()];
}
// Split an already-sorted list into headed sections. Returns [] when no
// document has a subcategory, so callers fall back to the flat grid.
export function groupDocuments(docs) {
    if(!docs.some(d=>d.subcategory))return [];
    const groups=[];const byId=new Map();
    for(const doc of docs){
        const id=doc.subcategory||'';
        if(!byId.has(id)){const group={id,label:id?(doc.subcategoryLabel||id):'Other',docs:[]};byId.set(id,group);groups.push(group);}
        byId.get(id).docs.push(doc);
    }
    // Anything without a subcategory goes after the named sections.
    return [...groups.filter(g=>g.id),...groups.filter(g=>!g.id)];
}
export function arrangeDocs(root,onFilter) {
    root.classList.remove('docs-reading');
    root.classList.add('docs-workspace');
    const title=root.querySelector('h1');const eyebrow=document.createElement('p');eyebrow.className='docs-eyebrow';eyebrow.textContent='FATE’S EDGE / THE READING ROOM';title.before(eyebrow);
    const toolbar=root.querySelector('.docs-toolbar');const tools=document.createElement('details');tools.className='docs-tools';tools.innerHTML='<summary>Manage library</summary><p>Upload a local document, refresh the index, or scan for bundled documents.</p>';toolbar.before(tools);tools.append(toolbar);
    const filter=root.querySelector('.docs-filter-bar');
    const shelves=document.createElement('label');shelves.className='docs-shelf';shelves.textContent='Shelf';
    const select=document.createElement('select');select.id='docsShelf';select.innerHTML='<option value="all">All documents</option><option value="saved">Saved documents</option><option value="recent">Recently read</option>';shelves.append(select);filter.append(shelves);select.onchange=onFilter;
    root.querySelector('#docsTypeFilter').setAttribute('aria-label','Category');
    const search=root.querySelector('#docsSearchInput');search.type='search';search.placeholder='Title, author, description, or chapter…';search.removeAttribute('data-i18n-attr');search.setAttribute('aria-label','Search library');
    root.querySelector('#docsFilterStats').setAttribute('role','status');
    root.querySelector('#doc-chapter-select').setAttribute('aria-label','Chapter');
    root.querySelector('#doc-chapter-prev').setAttribute('aria-label','Previous chapter');root.querySelector('#doc-chapter-next').setAttribute('aria-label','Next chapter');
    const reader=root.querySelector('#doc-viewer-container');
    const close=root.querySelector('#doc-close-viewer');close.textContent='← Back to library';close.removeAttribute('data-i18n');
    const readingTools=document.createElement('div');readingTools.className='docs-reader-tools';
    readingTools.innerHTML='<label>Text size<select id="docsTextSize"><option value="1">Standard</option><option value="1.15">Large</option><option value="1.3">Extra large</option></select></label><details id="docsContents"><summary>On this page</summary><nav aria-label="Document contents"></nav></details>';
    reader.querySelector('#doc-viewer').before(readingTools);
    readingTools.querySelector('select').onchange=e=>root.querySelector('#doc-viewer').style.setProperty('--reader-scale',e.target.value);
}
export function enterReader(root) {
    root?.classList.add('docs-reading');
    const toc=document.querySelector('#docsContents nav');if(toc)toc.replaceChildren();
    document.getElementById('doc-viewer-container')?.scrollIntoView({block:'start'});
}
export function finishReading(viewer,path,libraryPath=path) {
    const reading=readReadingState();reading.recent=[{path:libraryPath,chapter:path},...reading.recent.filter(r=>r.path!==libraryPath)].slice(0,30);
    try {localStorage.setItem(KEY,JSON.stringify(reading));} catch {}
    const toc=document.querySelector('#docsContents nav');if(!toc)return;toc.replaceChildren();
    const headings=[...viewer.querySelectorAll('h1,h2,h3')].filter(h=>h.textContent.trim());
    headings.slice(0,150).forEach(heading=>{
        const button=document.createElement('button');button.type='button';button.textContent=heading.textContent.trim();button.className='docs-toc-link';
        button.onclick=()=>{heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:'smooth'});};toc.append(button);
    });
    if(!headings.length)toc.textContent='No section headings in this document.';
}
