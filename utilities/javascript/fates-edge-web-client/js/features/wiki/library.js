/** Pure library operations: never sort or alter the saved collection in place. */
export function mergeBundledEntries(saved, bundled, hidden = []) {
    const valid = bundled.filter(e => e && typeof e.title === 'string' && e.title.trim());
    if (!valid.length) throw new Error('The bundled wiki contains no valid entries.');
    const local = saved.filter(e => e.source !== 'remote');
    const titles = new Set(local.map(e => String(e.title || '').toLowerCase().trim()));
    const remote = [];
    const ids = new Set();
    bundled.forEach((entry, index) => {
        if (!entry || typeof entry.title !== 'string' || !entry.title.trim()) return;
        const id = 'remote-' + (entry.id ?? index);
        const title = entry.title.toLowerCase().trim();
        if (hidden.includes(id) || titles.has(title) || ids.has(id)) return;
        ids.add(id);
        remote.push({
            ...entry, id, source: 'remote', category: entry.category || 'lore',
            body: String(entry.body || ''),
            tags: Array.isArray(entry.tags) ? entry.tags.map(String) : String(entry.tags || '').split(',').map(t => t.trim()).filter(Boolean),
        });
    });
    return { entries: [...local, ...remote], added: remote.length };
}

export function filterLibrary(entries, { search = '', category = '', region = '', source = '', sort = '' } = {}, bookmarks = []) {
    const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return entries.filter(e => {
        const text = [e.title, e.subtitle, e.body, e.region, ...(Array.isArray(e.tags) ? e.tags : [])].join(' ').toLowerCase();
        return terms.every(term => text.includes(term)) && (!category || e.category === category)
            && (!region || e.region === region)
            && (!source || (source === 'bookmarks' ? bookmarks.includes(String(e.id)) : source === 'remote' ? e.source === 'remote' : e.source !== 'remote'));
    }).sort((a, b) => {
        if (sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
        if (sort === 'category') {
            const category = String(a.category || '').localeCompare(String(b.category || ''));
            if (category) return category;
        }
        if (a.source === 'remote' && b.source !== 'remote') return 1;
        if (a.source !== 'remote' && b.source === 'remote') return -1;
        const stub = e => !!e.stub || !String(e.body || '').trim();
        return Number(stub(a)) - Number(stub(b)) || String(a.title || '').localeCompare(String(b.title || ''));
    });
}

export function libraryPage(entries, requested = 1, size = 12) {
    const pages = Math.max(1, Math.ceil(entries.length / size));
    const page = Math.max(1, Math.min(pages, Math.floor(Number(requested) || 1)));
    return { page, pages, items: entries.slice((page - 1) * size, page * size) };
}
