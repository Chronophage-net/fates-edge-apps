export function matchesCatalogQuery(item, query) {
    const words = String(query || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const text = [item.name, item.title, item.description, item.body, item.prerequisites, ...(Array.isArray(item.tags) ? item.tags : [])].filter(Boolean).join(' ').toLocaleLowerCase();
    return words.every(word => text.includes(word));
}

// Keep mechanical effects and catalog identity when a wizard row is collected.
export function collectTalentRecord(previous, name, cost) {
    const original = previous.find(t => t.name === name && Number(t.cost) === cost);
    return {...(original || {}), name, cost};
}
