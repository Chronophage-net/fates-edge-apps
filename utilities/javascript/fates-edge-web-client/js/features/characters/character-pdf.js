/**
 * Print-ready character sheets.
 *
 * The layout mirrors the canonical Player Sheets booklet in fates-edge-docs:
 * landscape letter pages, quiet rules, and enough room for the human parts of
 * a character. The first page is always the core sheet. A company page is
 * added when the character has relationships or assets, and the relevant
 * practice page is added for a major magic/build system.
 */

import { ALL_SKILLS, HERITAGES, getTierFromXp } from './editor.js';
import { showToast } from '@components/Toast.js';
import { t as i18nText } from '@core/i18n.js';

const PAGE = { width: 792, height: 612, left: 30, right: 762, top: 34, bottom: 580 }; // rtl-physical: PDF page coordinates
const COLORS = {
    ink: [36, 31, 26],
    red: [122, 37, 38],
    gold: [156, 118, 44],
    wash: [244, 239, 229],
    line: [139, 129, 118],
    gray: [91, 85, 78],
    white: [255, 255, 255]
};

const PATH_META = {
    'free-caster': { title: 'Free Caster', subtitle: 'Name the change. Name what might go wrong.' },
    runekeeper: { title: 'Runekeeper', subtitle: 'The Codex keeps the rite. The Thiasos keeps company.' },
    invoker: { title: 'Invoker', subtitle: 'A symbol is a door you have agreed to carry.' },
    cantor: { title: 'Cantor', subtitle: 'What enters through the ear does not leave unchanged.' },
    witch: { title: 'Witchcraft', subtitle: 'A threshold notices who crosses it.' },
    'hedge-gifts': { title: 'Witchcraft', subtitle: 'A threshold notices who crosses it.', canonical: 'witch' },
    psion: { title: 'Psionics', subtitle: 'Privacy begins as courtesy and ends as discipline.' },
    summoner: { title: 'Summoning', subtitle: 'Call a person, not a tool.' },
    monk: { title: 'Monastic Practice', subtitle: 'The pause is part of the answer.' },
    'familiar-only': { title: 'Runekeeper', subtitle: 'The Thiasos keeps company.', canonical: 'runekeeper' }
};

function getJsPDFCtor() {
    return (window.jspdf && window.jspdf.jsPDF) || null;
}

function text(value, fallback = '') {
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
}

function displayName(value) {
    return text(value)
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function itemName(item) {
    return typeof item === 'string' ? item : text(item?.name || item?.title);
}

function itemDetail(item) {
    if (!item || typeof item === 'string') return '';
    return text(item.effect || item.desc || item.note || item.description || item.services || item.nature);
}

function rows(items, mapper, minimum = 0) {
    const mapped = (Array.isArray(items) ? items : []).filter(Boolean).map(mapper);
    while (mapped.length < minimum) mapped.push(mapper({}));
    return mapped;
}

function truncate(doc, value, width, maxLines = 2) {
    const parts = doc.splitTextToSize(text(value), width);
    if (parts.length <= maxLines) return parts;
    const kept = parts.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:]?$/, '')}...`;
    return kept;
}

function line(doc, x1, y1, x2, y2, color = COLORS.line, width = 0.45) {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
}

function pageTitle(doc, title, subtitle) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.red);
    doc.text(title, PAGE.left, 51);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.gray);
    doc.text(subtitle, PAGE.right, 49, { align: 'right' });
    line(doc, PAGE.left, 57, PAGE.right, 57, COLORS.gold, 0.8);
}

function box(doc, title, x, y, width, height) {
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.45);
    doc.rect(x, y, width, height, 'FD');
    doc.setFillColor(...COLORS.wash);
    doc.rect(x, y, width, 15, 'F');
    line(doc, x, y + 15, x + width, y + 15, COLORS.line, 0.35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.ink);
    doc.text(title, x + 6, y + 10.5);
    return { x: x + 7, y: y + 25, width: width - 14, height: height - 31 };
}

function labeledLine(doc, label, value, x, y, width, options = {}) {
    const labelWidth = options.labelWidth || Math.min(width * 0.42, doc.getTextWidth(label) + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(options.fontSize || 8);
    doc.setTextColor(...COLORS.ink);
    doc.text(label, x, y);
    line(doc, x + labelWidth, y + 1, x + width, y + 1, COLORS.line, 0.35);
    if (value !== undefined && value !== '') {
        doc.setFont('helvetica', 'normal');
        doc.text(truncate(doc, value, width - labelWidth - 4, 1), x + labelWidth + 2, y - 1);
    }
}

function tracker(doc, label, current, max, x, y, count = 8) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.ink);
    doc.text(label, x, y + 7);
    let boxX = x + Math.min(62, doc.getTextWidth(label) + 8);
    const shown = Math.max(1, Math.min(count, Number(max) || count));
    for (let i = 0; i < shown; i += 1) {
        const filled = i < (Number(current) || 0);
        doc.setDrawColor(...COLORS.line);
        doc.setFillColor(...(filled ? COLORS.red : COLORS.white));
        doc.rect(boxX, y, 8, 8, filled ? 'FD' : 'D');
        boxX += 11;
    }
    if ((Number(max) || 0) > shown) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`${text(current, 0)} / ${text(max)}`, boxX + 2, y + 7);
    }
}

function table(doc, x, y, width, columns, body, options = {}) {
    const head = [columns.map(column => column.label)];
    const columnStyles = {};
    columns.forEach((column, index) => {
        columnStyles[index] = { cellWidth: column.width || 'auto', halign: column.align || 'left' };
    });
    doc.autoTable({
        startY: y,
        margin: { left: x, right: PAGE.width - x - width }, // rtl-physical: PDF page coordinates
        tableWidth: width,
        head,
        body,
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: options.fontSize || 7.2,
            cellPadding: options.cellPadding ?? 2.5,
            minCellHeight: options.rowHeight || 14,
            lineColor: COLORS.line,
            lineWidth: 0.25,
            textColor: COLORS.ink,
            valign: 'middle',
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: COLORS.wash,
            textColor: COLORS.ink,
            fontStyle: 'bold',
            lineColor: COLORS.line,
            lineWidth: 0.25
        },
        alternateRowStyles: { fillColor: COLORS.white },
        columnStyles
    });
    return doc.lastAutoTable.finalY;
}

function drawPageChrome(doc, pageNumber, pageCount) {
    line(doc, PAGE.left, 22, PAGE.right, 22, COLORS.ink, 0.45);
    line(doc, PAGE.left, 584, PAGE.right, 584, COLORS.ink, 0.45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.red);
    doc.text("FATE'S EDGE", PAGE.left, 18);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text(`PLAYER SHEETS   ${pageNumber} of ${pageCount}`, PAGE.right, 18, { align: 'right' });
    doc.setFontSize(6.5);
    doc.text('Generated from the character record. Add notes by hand; leave room for play to change the answer.', PAGE.left, 595);
    doc.text("fate's edge", PAGE.right, 595, { align: 'right' });
}

function drawIdentityStrip(doc, c, y = 65) {
    const inside = box(doc, 'Name and place in the world', PAGE.left, y, PAGE.right - PAGE.left, 50);
    const heritage = HERITAGES.find(h => h.id === c.heritage);
    const fields = [
        ['Name', c.name || 'Unnamed Character', 175],
        ['Heritage', heritage ? heritage.label.split(' — ')[0] : displayName(c.heritage), 140],
        ['Culture / region', c.region, 150],
        ['Background', c.background, 225]
    ];
    let x = inside.x;
    fields.forEach(([label, value, width]) => {
        labeledLine(doc, label, value, x, inside.y + 3, width - 8, { labelWidth: doc.getTextWidth(label) + 7 });
        x += width;
    });
}

function addCorePage(doc, c) {
    pageTitle(doc, c.name || 'Character', 'Who are you when the easy answer costs someone else?');
    drawIdentityStrip(doc, c);

    const { tier, name: tierName } = getTierFromXp(c.totalXp || 0);
    const leftX = 30, leftW = 174, midX = 212, midW = 205, rightX = 425, rightW = 337;

    let b = box(doc, 'Attributes', leftX, 122, leftW, 103);
    [['Body', c.body ?? 1], ['Wits', c.wits ?? 1], ['Spirit', c.spirit ?? 1], ['Presence', c.presence ?? 1]].forEach(([label, value], i) => {
        labeledLine(doc, label, value, b.x, b.y + i * 17, b.width, { labelWidth: 64 });
    });

    b = box(doc, 'Immediate resources', leftX, 232, leftW, 111);
    tracker(doc, 'Harm', c.harm, 3, b.x, b.y, 3);
    tracker(doc, 'Fatigue', c.fatigue, c.fatigueMax || c.body || 1, b.x, b.y + 18, 8);
    tracker(doc, 'Boons', c.boons, 5, b.x, b.y + 36, 5);
    labeledLine(doc, 'Tier', `${tier} - ${tierName}`, b.x, b.y + 62, b.width, { labelWidth: 30 });
    labeledLine(doc, 'XP', c.totalXp ?? 0, b.x, b.y + 79, b.width, { labelWidth: 30 });

    b = box(doc, 'What the world sees', leftX, 350, leftW, 111);
    labeledLine(doc, 'Affinity', c.culturalAffinity, b.x, b.y, b.width, { labelWidth: 47 });
    labeledLine(doc, 'Contact', c.backgroundContact, b.x, b.y + 19, b.width, { labelWidth: 47 });
    labeledLine(doc, 'Boon', c.backgroundBoon, b.x, b.y + 38, b.width, { labelWidth: 47 });
    labeledLine(doc, 'Tell / keepsake', '', b.x, b.y + 57, b.width, { labelWidth: 70 });
    labeledLine(doc, 'First impression', '', b.x, b.y + 76, b.width, { labelWidth: 76 });

    const skillBody = [];
    for (let i = 0; i < ALL_SKILLS.length; i += 2) {
        const a = ALL_SKILLS[i], d = ALL_SKILLS[i + 1];
        skillBody.push([a, c.skills?.[a.toLowerCase()] ?? 0, d || '', d ? (c.skills?.[d.toLowerCase()] ?? 0) : '']);
    }
    table(doc, midX, 122, midW, [
        { label: 'Skill' }, { label: 'Rank', width: 30, align: 'center' },
        { label: 'Skill' }, { label: 'Rank', width: 30, align: 'center' }
    ], skillBody, { rowHeight: 18 });

    b = box(doc, 'How you enter danger', midX, 296, midW, 95);
    labeledLine(doc, 'Usual approach', '', b.x, b.y, b.width, { labelWidth: 77 });
    labeledLine(doc, 'Weapon', displayName(c.weaponClass), b.x, b.y + 18, b.width, { labelWidth: 48 });
    labeledLine(doc, 'Armor', displayName(c.armorType), b.x, b.y + 36, b.width, { labelWidth: 48 });
    labeledLine(doc, 'Shield', displayName(c.shieldType), b.x, b.y + 54, b.width, { labelWidth: 48 });

    b = box(doc, 'Position before the roll', midX, 398, midW, 63);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.ink);
    doc.text(truncate(doc, 'Controlled: room to recover. Risky: danger is close. Desperate: the consequence is already reaching for you.', b.width, 4), b.x, b.y);

    b = box(doc, 'Desire, fear, and the choice between them', rightX, 122, rightW, 108);
    [['I want', ''], ['I fear that', ''], ['I will not', ''], ['I might, if', '']].forEach(([label, value], i) => {
        labeledLine(doc, label, value, b.x, b.y + i * 19, b.width, { labelWidth: 58 });
    });

    table(doc, rightX, 237, rightW, [
        { label: 'Bond', width: 90 }, { label: 'What holds us together' }, { label: 'Where it may tear' }
    ], rows(c.bonds, item => [itemName(item), itemDetail(item), ''], 3).slice(0, 4), { rowHeight: 23 });

    table(doc, rightX, 371, rightW, [
        { label: 'Complication', width: 95 }, { label: 'How it enters the story' }, { label: 'What would resolve it' }
    ], rows(c.complications, item => [itemName(item), itemDetail(item), ''], 2).slice(0, 3), { rowHeight: 22 });

    table(doc, PAGE.left, 472, 353, [
        { label: 'Talent / signature move', width: 130 }, { label: 'Trigger / effect' }
    ], rows(c.talents, item => [itemName(item), itemDetail(item)], 3).slice(0, 3), { rowHeight: 21 });
    table(doc, 391, 472, 371, [
        { label: 'Equipment / asset', width: 135 }, { label: 'Why it matters' }
    ], rows([...(c.equipment || []), ...(c.assets || [])], item => [itemName(item), itemDetail(item)], 3).slice(0, 3), { rowHeight: 21 });
}

function hasCompanyPage(c) {
    return [c.bonds, c.assets, c.strings, c.debtTimers, c.promiseTimers].some(value => Array.isArray(value) && value.length)
        || Boolean(c.backgroundObligation || c.backgroundContact);
}

function addCompanyPage(doc, c) {
    doc.addPage();
    pageTitle(doc, 'Company, Bonds, and Claims', 'Power is also the number of people who may ask something of you.');
    drawIdentityStrip(doc, c);
    table(doc, 30, 122, 355, [
        { label: 'Person', width: 90 }, { label: 'History / affection / promise' }, { label: 'What they need now' }
    ], rows(c.bonds, item => [itemName(item), itemDetail(item), ''], 4).slice(0, 6), { rowHeight: 25 });
    table(doc, 30, 317, 355, [
        { label: 'Follower / contact', width: 100 }, { label: 'What they want' }, { label: 'What they will not do' }
    ], rows(c.strings, item => [itemName(item), itemDetail(item), ''], 3).slice(0, 5), { rowHeight: 25 });
    table(doc, 397, 122, 365, [
        { label: 'Asset', width: 95 }, { label: 'State', width: 65 }, { label: 'What it makes possible' }, { label: 'Who keeps it alive' }
    ], rows(c.assets, item => [itemName(item), text(item?.state || item?.tier), itemDetail(item), ''], 4).slice(0, 6), { rowHeight: 25 });
    const claims = [
        ...(c.debtTimers || []),
        ...(c.promiseTimers || []),
        ...(c.backgroundObligation ? [{ name: c.backgroundObligation }] : [])
    ];
    table(doc, 397, 317, 365, [
        { label: 'To whom / promise', width: 125 }, { label: 'Timer', width: 55 }, { label: 'What is actually owed' }, { label: 'What would count as care' }
    ], rows(claims, item => [itemName(item), text(item?.segments || item?.current), itemDetail(item), ''], 3).slice(0, 5), { rowHeight: 25 });
}

function practiceHeader(doc, c, meta) {
    doc.addPage();
    pageTitle(doc, meta.title, meta.subtitle);
    drawIdentityStrip(doc, c);
}

function addFreeCasterPage(doc, c, meta) {
    practiceHeader(doc, c, meta);
    let b = box(doc, 'Working in hand', 30, 122, 235, 125);
    ['Intent', 'Attribute + Arcana', 'DV / Position / Effect', 'What makes it dangerous', 'What I refuse to risk'].forEach((label, i) => labeledLine(doc, label, '', b.x, b.y + i * 19, b.width, { labelWidth: 98 }));
    table(doc, 30, 254, 235, [{ label: 'Known tags' }], rows(c.knownTags, item => [itemName(item)], 6).slice(0, 10), { rowHeight: 17 });
    table(doc, 277, 122, 485, [
        { label: 'Spell', width: 105 }, { label: 'Tags', width: 105 }, { label: 'DV', width: 34, align: 'center' }, { label: 'Effect / tell / aftermath' }
    ], rows(c.spellbook, spell => [itemName(spell), Array.isArray(spell?.tags) ? spell.tags.join(', ') : text(spell?.tags), text(spell?.dv), itemDetail(spell)], 7).slice(0, 9), { rowHeight: 28 });
    b = box(doc, 'Quick rule', 277, 408, 485, 53);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.ink);
    doc.text(truncate(doc, 'DV begins at 1 plus the number of tags; dangerous tags count as two. A one-tag cantrip needs no separate Weave action. Backlash should resemble the magic that caused it.', b.width, 3), b.x, b.y);
    addPracticeTalents(doc, c, 30, 472, 732, 3);
}

function addPracticeTalents(doc, c, x, y, width, minimum = 3) {
    table(doc, x, y, width, [{ label: 'Talent / technique', width: 180 }, { label: 'Trigger / effect' }, { label: 'Uses', width: 55 }],
        rows(c.talents, item => [itemName(item), itemDetail(item), text(item?.uses || item?.useLimit)], minimum).slice(0, minimum), { rowHeight: 22 });
}

function addRunekeeperPage(doc, c, meta) {
    practiceHeader(doc, c, meta);
    let b = box(doc, 'Patron and companions', 30, 122, 245, 151);
    [['Patron', displayName(c.patron)], ['Codex', c.codex], ['Thiasos', c.thiasos], ['What the Thiasos wants', ''], ['How we disagree', ''], ['Visible sign', '']].forEach(([label, value], i) => labeledLine(doc, label, value, b.x, b.y + i * 20, b.width, { labelWidth: 92 }));
    b = box(doc, 'Obligation', 30, 280, 245, 112);
    tracker(doc, 'Current', c.obligation, c.obligationCapacity, b.x, b.y, 10);
    labeledLine(doc, 'Capacity', c.obligationCapacity, b.x, b.y + 25, b.width, { labelWidth: 54 });
    labeledLine(doc, 'What is owed now', c.backgroundObligation, b.x, b.y + 45, b.width, { labelWidth: 88 });
    labeledLine(doc, 'What I will not surrender', '', b.x, b.y + 65, b.width, { labelWidth: 117 });
    table(doc, 287, 122, 475, [
        { label: 'Rite', width: 120 }, { label: 'Tier', width: 40 }, { label: 'Obligation', width: 62 }, { label: 'What it changes' }, { label: 'Sign / limit / push' }
    ], rows(c.rites, item => [itemName(item), text(item?.tier), text(item?.obligation || item?.cost), itemDetail(item), ''], 7).slice(0, 8), { rowHeight: 28 });
    b = box(doc, 'Patron\'s Gift', 30, 399, 245, 62);
    labeledLine(doc, 'Item imbued', '', b.x, b.y, b.width, { labelWidth: 67 });
    labeledLine(doc, 'Thematic skill / sign', '', b.x, b.y + 20, b.width, { labelWidth: 104 });
    addPracticeTalents(doc, c, 30, 472, 732, 3);
}

function addInvokerPage(doc, c, meta) {
    practiceHeader(doc, c, meta);
    const symbols = Array.isArray(c.symbols) ? c.symbols : [];
    table(doc, 30, 122, 285, [
        { label: 'Patron', width: 90 }, { label: 'Symbol / provenance' }, { label: 'State', width: 70 }
    ], rows(symbols, symbol => {
        const patron = typeof symbol === 'string' ? symbol : symbol?.patron;
        return [displayName(patron), text(symbol?.description), text(c.symbolStates?.[patron] || symbol?.state || 'active')];
    }, 4).slice(0, 5), { rowHeight: 30 });
    let b = box(doc, 'Obligation by Patron', 30, 313, 285, 148);
    tracker(doc, 'Total', c.obligation, c.obligationCapacity, b.x, b.y, 10);
    labeledLine(doc, 'Capacity', c.obligationCapacity, b.x, b.y + 26, b.width, { labelWidth: 55 });
    ['What the claim means', 'Promise nearest to breaking', 'What would answer it', 'Symbol most at risk'].forEach((label, i) => labeledLine(doc, label, '', b.x, b.y + 48 + i * 20, b.width, { labelWidth: 115 }));
    table(doc, 327, 122, 435, [
        { label: 'Rite', width: 110 }, { label: 'Patron', width: 90 }, { label: 'DV', width: 34 }, { label: 'Effect / time / cost / consequence' }
    ], rows(c.rites, item => [itemName(item), displayName(item?.patron), text(item?.dv), itemDetail(item)], 6).slice(0, 8), { rowHeight: 29 });
    b = box(doc, 'Crack the Seal', 327, 370, 435, 91);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.ink);
    doc.text(truncate(doc, 'Resolve the rite in one action; mark the increased Obligation and compromise the symbol.', b.width, 2), b.x, b.y);
    labeledLine(doc, 'What cracking it looks like', '', b.x, b.y + 29, b.width, { labelWidth: 124 });
    labeledLine(doc, 'Symbol cracked', '', b.x, b.y + 50, b.width, { labelWidth: 86 });
    addPracticeTalents(doc, c, 30, 472, 732, 3);
}

function addCantorPage(doc, c, meta) {
    practiceHeader(doc, c, meta);
    let b = box(doc, 'The voice', 30, 122, 250, 125);
    [['Bound Patron', displayName(c.boundPatron || c.patron)], ['Instrument / tradition', ''], ['What listeners remember', ''], ['The note I fear', ''], ['How the voice has changed', '']].forEach(([label, value], i) => labeledLine(doc, label, value, b.x, b.y + i * 19, b.width, { labelWidth: 105 }));
    b = box(doc, 'Corruption and blooms', 30, 254, 250, 135);
    tracker(doc, 'Corruption', c.corruption, c.corruptionMax, b.x, b.y, 8);
    labeledLine(doc, 'Floor / blooms', `${text(c.corruptionTier, 0)} / ${text(c.bloomCount, 0)}`, b.x, b.y + 25, b.width, { labelWidth: 72 });
    ['Last Patron voiced', 'Boon gained', 'Burden carried', 'Permanent mark'].forEach((label, i) => labeledLine(doc, label, '', b.x, b.y + 47 + i * 19, b.width, { labelWidth: 92 }));
    table(doc, 292, 122, 470, [
        { label: 'Song', width: 115 }, { label: 'Patron / source', width: 105 }, { label: 'DV', width: 34 }, { label: 'Effect / refrain / visible sign' }
    ], rows(c.repertoire, item => [itemName(item), displayName(item?.patron), text(item?.dv), itemDetail(item)], 7).slice(0, 8), { rowHeight: 28 });
    table(doc, 30, 399, 250, [{ label: 'Resonant rites' }], rows(c.resonantRites, item => [itemName(item)], 2).slice(0, 3), { rowHeight: 19 });
    let q = box(doc, 'Quick rule', 292, 370, 470, 91);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.ink);
    doc.text(truncate(doc, 'Begin a Song as an action; it resolves at the start of your next turn. Push It to resolve immediately, mark 1 Fatigue, and advance Corruption. When Corruption fills, the last Patron sung through leaves both a boon and a burden.', q.width, 5), q.x, q.y);
    addPracticeTalents(doc, c, 30, 472, 732, 3);
}

function addWitchPage(doc, c, meta) {
    practiceHeader(doc, c, meta);
    let b = box(doc, 'Method and observance', 30, 122, 260, 127);
    ['Order, teacher, or solitary practice', 'Familiar, if any', 'An observance I keep', 'What happened when I broke one', 'Strongest threshold'].forEach((label, i) => labeledLine(doc, label, '', b.x, b.y + i * 19, b.width, { labelWidth: 130 }));
    b = box(doc, 'Prices', 30, 256, 260, 133);
    tracker(doc, 'Shadow', c.shadow, 6, b.x, b.y, 6);
    tracker(doc, 'Shame', c.shame, 6, b.x, b.y + 20, 6);
    tracker(doc, 'Identity strain', c.identityStrain, 4, b.x, b.y + 40, 4);
    labeledLine(doc, 'Shadow tell', '', b.x, b.y + 68, b.width, { labelWidth: 68 });
    labeledLine(doc, 'Uncertain part of self', '', b.x, b.y + 89, b.width, { labelWidth: 106 });
    table(doc, 302, 122, 460, [
        { label: 'Gift / working', width: 115 }, { label: 'Intent / vector', width: 125 }, { label: 'DV', width: 34 }, { label: 'Price / consequence' }
    ], rows(c.hedgeGifts, item => [itemName(item), itemDetail(item), text(item?.dv), text(item?.price)], 7).slice(0, 8), { rowHeight: 28 });
    table(doc, 30, 399, 260, [{ label: 'Promise / beneficiary' }, { label: 'Timer', width: 55 }], rows(c.promiseTimers, item => [itemName(item), text(item?.segments)], 2).slice(0, 3), { rowHeight: 19 });
    b = box(doc, 'Quick rule', 302, 370, 460, 91);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.ink);
    doc.text(truncate(doc, 'For a working, state its Intent, Vector, and Price, then roll against scope. Pushing can deepen Shadow, Shame, or Identity Strain. Gifts follow their own text; promises belong to people, not arithmetic.', b.width, 5), b.x, b.y);
    addPracticeTalents(doc, c, 30, 472, 732, 3);
}

function addPsionPage(doc, c, meta) {
    practiceHeader(doc, c, meta);
    let b = box(doc, 'Mental strain', 30, 122, 250, 112);
    tracker(doc, 'Current', c.mentalStrain, c.mentalStrainMax || c.spirit, b.x, b.y, 8);
    ['What strain feels like', 'First outward tell', 'What restores quiet'].forEach((label, i) => labeledLine(doc, label, '', b.x, b.y + 29 + i * 20, b.width, { labelWidth: 92 }));
    b = box(doc, 'Boundaries', 30, 241, 250, 140);
    ['A mind I will not enter', 'A memory I guard', 'How I ask consent', 'What temptation sounds like', 'Mind shield / sanctuary', 'Known intrusion or scar'].forEach((label, i) => labeledLine(doc, label, '', b.x, b.y + i * 19, b.width, { labelWidth: 112 }));
    table(doc, 292, 122, 470, [
        { label: 'Art', width: 110 }, { label: 'Attribute', width: 65 }, { label: 'DV', width: 34 }, { label: 'Reach / effect' }, { label: 'Strain / risk / tell' }
    ], rows(c.psionicArts, item => [itemName(item), displayName(item?.attribute), text(item?.dv), itemDetail(item), text(item?.risk)], 7).slice(0, 8), { rowHeight: 29 });
    b = box(doc, 'Working note', 30, 391, 250, 70);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...COLORS.ink);
    doc.text(truncate(doc, 'Record what the character considers trespass. Psionic danger is clearest when the boundary was understood before it was crossed.', b.width, 4), b.x, b.y);
    addPracticeTalents(doc, c, 30, 472, 732, 3);
}

function addSummonerPage(doc, c, meta) {
    practiceHeader(doc, c, meta);
    let b = box(doc, 'The calling', 30, 122, 260, 130);
    ['Circle, threshold, or method', 'What answers readily', 'Offering or courtesy', 'Name I should not call', 'What I owe the unseen world'].forEach((label, i) => labeledLine(doc, label, '', b.x, b.y + i * 20, b.width, { labelWidth: 121 }));
    b = box(doc, 'Current leash', 30, 259, 260, 130);
    tracker(doc, 'Leash', c.leash, c.leashCapacity, b.x, b.y, 10);
    ['Bound spirit', 'Its nature', 'What strains the bond', 'What happens if it fills'].forEach((label, i) => labeledLine(doc, label, '', b.x, b.y + 30 + i * 20, b.width, { labelWidth: 108 }));
    table(doc, 302, 122, 460, [
        { label: 'Spirit', width: 105 }, { label: 'Cap', width: 34 }, { label: 'Nature', width: 100 }, { label: 'Services / gifts' }, { label: 'Terms / favored bond' }
    ], rows(c.boundSpirits, item => [itemName(item), text(item?.cap), text(item?.nature), text(item?.services), text(item?.terms)], 6).slice(0, 7), { rowHeight: 32 });
    b = box(doc, 'Leash reminders', 30, 399, 260, 62);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...COLORS.ink);
    doc.text(truncate(doc, 'The leash strains through harm, a command against nature, a crossed ward, or divided attention.', b.width, 3), b.x, b.y);
    addPracticeTalents(doc, c, 30, 472, 732, 3);
}

function addMonkPage(doc, c, meta) {
    practiceHeader(doc, c, meta);
    let b = box(doc, 'Tradition and vows', 30, 122, 260, 128);
    [['Tradition / teacher', displayName(c.monasticTradition)], ['First vow', ''], ['A teaching I resist', ''], ['What stillness reveals', ''], ['Patron tie, if any', displayName(c.patron)]].forEach(([label, value], i) => labeledLine(doc, label, value, b.x, b.y + i * 20, b.width, { labelWidth: 105 }));
    b = box(doc, 'Breath cycle', 30, 257, 260, 132);
    const state = c.breathState || 'entering';
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...COLORS.ink);
    doc.text(['entering', 'holding', 'releasing', 'empty'].map(s => `${s === state ? '[x]' : '[ ]'} ${displayName(s)}`).join('    '), b.x, b.y);
    ['Current benefit', 'What advances the breath', 'What breaks the cycle', 'Meditation intent', 'Breath scar / lasting mark'].forEach((label, i) => labeledLine(doc, label, '', b.x, b.y + 27 + i * 19, b.width, { labelWidth: 108 }));
    const techniques = c.monkTechniques && typeof c.monkTechniques === 'object'
        ? Object.entries(c.monkTechniques).map(([name, value]) => ({ name, ...(typeof value === 'object' ? value : { effect: value }) }))
        : [];
    table(doc, 302, 122, 460, [
        { label: 'Technique', width: 115 }, { label: 'Breath / trigger', width: 100 }, { label: 'Effect' }, { label: 'Cost', width: 55 }
    ], rows(techniques.length ? techniques : c.talents, item => [itemName(item), text(item?.breath || item?.trigger), itemDetail(item), text(item?.cost)], 7).slice(0, 8), { rowHeight: 29 });
    b = box(doc, 'Practice note', 30, 399, 260, 62);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...COLORS.ink);
    doc.text(truncate(doc, 'Record the discipline as lived practice: who taught it, which vow gives it shape, and what mastery is doing to the character.', b.width, 3), b.x, b.y);
    addPracticeTalents(doc, c, 30, 472, 732, 3);
}

function addPracticePage(doc, c) {
    const selected = PATH_META[c.magicPath];
    if (!selected) return;
    const path = selected.canonical || c.magicPath;
    const builders = {
        'free-caster': addFreeCasterPage,
        runekeeper: addRunekeeperPage,
        invoker: addInvokerPage,
        cantor: addCantorPage,
        witch: addWitchPage,
        psion: addPsionPage,
        summoner: addSummonerPage,
        monk: addMonkPage
    };
    builders[path]?.(doc, c, selected);
}

export function getPrintablePractice(magicPath) {
    const meta = PATH_META[magicPath];
    return meta ? (meta.canonical || magicPath) : null;
}

export function buildCharacterPDF(c) {
    if (!c) return null;
    const JsPDFCtor = getJsPDFCtor();
    if (!JsPDFCtor) return null;
    const doc = new JsPDFCtor({ unit: 'pt', format: 'letter', orientation: 'landscape', compress: true });
    addCorePage(doc, c);
    if (hasCompanyPage(c)) addCompanyPage(doc, c);
    addPracticePage(doc, c);
    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        doc.setPage(pageNumber);
        drawPageChrome(doc, pageNumber, pageCount);
    }
    doc.setProperties({
        title: `${c.name || 'Character'} - Fate's Edge Player Sheets`,
        author: 'Nicholas A. Gasper',
        subject: 'Printable Fate\'s Edge character sheet'
    });
    return doc;
}

function safeFilename(c) {
    const name = (c?.name || 'character').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'character';
    return `${name} - Fates Edge.pdf`;
}

export function exportCharacterPDF(c) {
    const doc = buildCharacterPDF(c);
    if (!doc) {
        showToast(i18nText('feature.characters.pdf.exportLoading', null, 'PDF export is still loading. Try again in a moment.'), 'error');
        return;
    }
    doc.save(safeFilename(c));
}

export function printCharacterPDF(c) {
    const doc = buildCharacterPDF(c);
    if (!doc) {
        showToast(i18nText('feature.characters.pdf.printLoading', null, 'Printable sheets are still loading. Try again in a moment.'), 'error');
        return;
    }
    if (typeof doc.autoPrint === 'function') doc.autoPrint();
    const printWindow = window.open(doc.output('bloburl'), '_blank');
    if (!printWindow) {
        showToast(i18nText('feature.characters.pdf.popupBlocked', null, 'The printable sheet was blocked by the browser. Use Download PDF instead.'), 'error');
    }
}
