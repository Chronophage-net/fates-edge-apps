/**
 * Parses region descriptions containing LaTeX-like markup into clean HTML.
 *
 * Handles:
 *   - [colback=...,colframe=...,title={Title,breakable]  → styled box with title
 *   - *{Content}                                          → section heading or label+desc
 *   - tabular{|p{...|p{...|} ... tabular                  → HTML table
 *   - longtable{|p{...|p{...|} ... longtable              → HTML table
 *   - itemize ... itemize                                 → bullet list
 *   - enumerate ... enumerate                             → numbered list
 *   - quote ... quote                                     → blockquote
 *   - ``text''                                            → <em>text</em>
 *   - --- / --                                            → em dash / en dash
 * 
 * Also safely handles raw HTML strings by stripping tags and parsing paragraphs.
 */

export function parseRegionDescription(raw) {
    if (!raw) return '';
    const items = extractItems(raw);
    return buildHtml(items);
}

function extractItems(html) {
    const items = [];

    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/);
    if (h1Match) items.push({ type: 'heading', text: h1Match[1] });

    const pRegex = /<p class="region-text">(.*?)<\/p>/gs;
    let m;
    while ((m = pRegex.exec(html)) !== null) {
        items.push({ type: 'paragraph', text: m[1].trim() });
    }

    if (items.length === 0) {
        // Fallback for raw HTML or plain text strings
        const stripped = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '\n').trim();
        stripped.split('\n').forEach(line => {
            const t = line.trim();
            if (t) items.push({ type: 'paragraph', text: t });
        });
    }

    return items;
}

function buildHtml(items) {
    let html = '';
    let boxOpen = false;

    for (let i = 0; i < items.length; i++) {
        const { type, text } = items[i];

        if (type === 'heading') {
            html += `<h2 class="region-title">${text}</h2>\n`;
            continue;
        }

        const boxMatch = text.match(
            /^\[colback=[^,\]]+,colframe=[^,\]]+,title=\{([^,]+),breakable\]\s*(.*)$/
        );
        if (boxMatch) {
            if (boxOpen) html += '</div></div>\n';
            const title = boxMatch[1].trim();
            const rest = boxMatch[2].trim();
            html += `<div class="region-box">\n` +
                    `<div class="region-box-title">${title}</div>\n` +
                    `<div class="region-box-content">\n`;
            boxOpen = true;
            if (rest) {
                if (rest.startsWith('*{')) {
                    html += renderBoldSection(rest.slice(2));
                } else {
                    html += `<p>${processInline(rest)}</p>\n`;
                }
            }
            continue;
        }

        if (text.startsWith('*{')) {
            const content = text.slice(2);
            const tableIdx = content.search(/(?:tabular|longtable)\{/);

            if (tableIdx !== -1) {
                const beforeTable = content.slice(0, tableIdx).trim();
                if (beforeTable) html += renderBoldSection(beforeTable);

                const rows = [];
                i++;
                while (i < items.length) {
                    const rowText = items[i].text.trim();
                    if (rowText === 'tabular' || rowText === 'longtable') { i++; break; }
                    rows.push(rowText);
                    i++;
                }
                html += renderTable(rows);
                continue;
            }

            html += renderBoldSection(content);
            continue;
        }

        const tableSpecMatch = text.match(/^(?:tabular|longtable)\{/);
        if (tableSpecMatch) {
            const rows = [];
            i++;
            while (i < items.length) {
                const rowText = items[i].text.trim();
                if (rowText === 'tabular' || rowText === 'longtable') { i++; break; }
                rows.push(rowText);
                i++;
            }
            html += renderTable(rows);
            continue;
        }

        if (text === 'tabular' || text === 'longtable') continue;

        const itemizeMatch = text.match(/^(.*?)itemize\s+([\s\S]+?)\s+itemize(.*)$/);
        if (itemizeMatch) {
            const before = itemizeMatch[1].trim();
            const listContent = itemizeMatch[2];
            const after = itemizeMatch[3].trim();

            if (before) html += `<p>${processInline(before)}</p>\n`;

            const listItems = splitItemList(listContent);
            html += '<ul class="region-list">\n';
            listItems.forEach(item => {
                html += `  <li>${processInline(item)}</li>\n`;
            });
            html += '</ul>\n';

            if (after) html += renderAfterList(after, i, items);
            continue;
        }

        const enumMatch = text.match(/^(.*?)enumerate\s+([\s\S]+?)\s+enumerate(.*)$/);
        if (enumMatch) {
            const before = enumMatch[1].trim();
            const listContent = enumMatch[2];
            const after = enumMatch[3].trim();

            if (before) html += `<p>${processInline(before)}</p>\n`;

            const listItems = splitEnumList(listContent);
            html += '<ol class="region-list">\n';
            listItems.forEach(item => {
                html += `  <li>${processInline(item)}</li>\n`;
            });
            html += '</ol>\n';

            if (after) html += renderAfterList(after, i, items);
            continue;
        }

        const quoteMatch = text.match(/^quote\s+([\s\S]+?)\s+quote$/);
        if (quoteMatch) {
            const content = quoteMatch[1];
            const speakerMatch = content.match(/^([^:]+):\s*"([\s\S]*)"$/);
            if (speakerMatch) {
                html += `<blockquote class="region-quote">\n` +
                        `<div class="quote-speaker">${speakerMatch[1].trim()}</div>\n` +
                        `<div class="quote-text">"${speakerMatch[2]}"</div>\n` +
                        `</blockquote>\n`;
            } else {
                html += `<blockquote class="region-quote">${processInline(content)}</blockquote>\n`;
            }
            continue;
        }

        html += `<p>${processInline(text)}</p>\n`;
    }

    if (boxOpen) html += '</div></div>\n';
    return html;
}

function renderAfterList(after, currentIndex, items) {
    let result = '';
    const segmentParts = after.split(/(?=At \d+ segments:)/);
    segmentParts.forEach(part => {
        const p = part.trim();
        if (p) {
            if (p.match(/^At \d+ segments:/)) {
                result += `<p class="region-note">${processInline(p)}</p>\n`;
            } else {
                result += `<p>${processInline(p)}</p>\n`;
            }
        }
    });
    return result;
}

function renderBoldSection(content) {
    const colonIdx = content.indexOf(':');
    if (colonIdx > 0 && colonIdx < 40 && !content.slice(0, colonIdx).includes('(')) {
        return `<h4 class="region-section-heading">${processInline(content)}</h4>\n`;
    }

    if (content.length < 60 && content.split(/\s+/).length <= 6) {
        return `<h4 class="region-section-heading">${processInline(content)}</h4>\n`;
    }

    const words = content.split(/\s+/);
    if (words.length > 4) {
        const label = words.slice(0, 2).join(' ');
        const desc = words.slice(2).join(' ');
        return `<div class="region-section">` +
               `<span class="region-label">${processInline(label)}</span> ` +
               `<span class="region-desc">${processInline(desc)}</span></div>\n`;
    }

    return `<h4 class="region-section-heading">${processInline(content)}</h4>\n`;
}

function renderTable(rows) {
    if (rows.length === 0) return '';

    const headerCells = rows[0].split('&').map(c => c.trim());
    const headerHtml = headerCells
        .map(c => `<th>${processInline(c)}</th>`)
        .join('');

    let html = `<table class="region-table">\n<thead><tr>${headerHtml}</tr></thead>\n<tbody>\n`;

    for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].split('&').map(c => c.trim());
        const rowHtml = cells
            .map(c => `<td>${processInline(c)}</td>`)
            .join('');
        html += `<tr>${rowHtml}</tr>\n`;
    }

    html += '</tbody>\n</table>\n';
    return html;
}

function splitItemList(content) {
    const parts = [];
    let remaining = content;
    while (true) {
        const match = remaining.match(/\)\s+(?=[A-Z])/);
        if (!match) {
            parts.push(remaining);
            break;
        }
        const idx = match.index;
        parts.push(remaining.slice(0, idx + 1));
        remaining = remaining.slice(idx + match[0].length);
    }
    return parts.map(p => p.trim()).filter(p => p);
}

function splitEnumList(content) {
    const parts = [];
    let remaining = content;
    while (true) {
        const match = remaining.match(/\.\s+(?=A |The |An |In |On )/);
        if (!match) {
            parts.push(remaining);
            break;
        }
        const idx = match.index;
        parts.push(remaining.slice(0, idx + 1));
        remaining = remaining.slice(idx + match[0].length);
    }
    return parts.map(p => p.trim()).filter(p => p);
}

function processInline(text) {
    let result = text;

    result = result.replace(/``([^']*?)''/g, '<em>$1</em>');
    result = result.replace(/---/g, '\u2014');
    result = result.replace(/--/g, '\u2013');
    result = result.replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;');

    return result;
}

export default parseRegionDescription;