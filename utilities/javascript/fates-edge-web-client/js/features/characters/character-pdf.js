/**
 * Character sheet -> PDF export, built with jsPDF + jsPDF-autotable (both
 * already loaded via CDN in index.html for a planned-but-never-built export
 * feature -- see the <script> tags for jspdf/jspdf.plugin.autotable).
 *
 * Deliberately NOT a DOM screenshot: that would need html2canvas (not
 * loaded), and would bake in the dark theme, form-input chrome, and
 * whatever edit-mode state the sheet happened to be in. This instead reads
 * straight from the character's own data object -- the same one the editor
 * loads and saves -- and lays it out as a plain, print-ready sheet.
 *
 * Scope note: this is deliberately character-sheet-only. The SRD /
 * Essentials / Campfire Mode docs get their own "Print" button
 * (js/features/docs/index.js) that uses the browser's native print-to-PDF
 * instead -- those are already complete, well-formatted HTML pages, so
 * re-rendering them through jsPDF's low-level text/table primitives would
 * only throw away their formatting for no benefit. Every other doc category
 * (adventures, patron lore, bestiary, etc.) intentionally gets no export
 * button at all: per the repo root README's license section, that content
 * is proprietary and distributed for personal use, not meant to be
 * repackaged as a portable file from inside the app. A character sheet is
 * the player's own data, so it isn't subject to that restriction.
 */

import { ALL_SKILLS, HERITAGES, getTierFromXp } from './editor.js';
import { showToast } from '@components/Toast.js';

const PAGE_MARGIN_X = 40;
const PAGE_BREAK_Y = 700;
const CONTENT_WIDTH = 515; // 612pt (US Letter) - 2*40 margin

function getJsPDFCtor() {
    return (window.jspdf && window.jspdf.jsPDF) || null;
}

function addSectionHeading(doc, text, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(text, PAGE_MARGIN_X, y);
    return y + 8;
}

function addListTable(doc, title, items, formatRow, y) {
    if (!items || !items.length) return y;
    if (y > PAGE_BREAK_Y) {
        doc.addPage();
        y = 46;
    }
    y = addSectionHeading(doc, title, y);
    doc.autoTable({
        startY: y,
        body: items.map(formatRow),
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2, textColor: [20, 20, 20] },
        margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X }
    });
    return doc.lastAutoTable.finalY + 14;
}

/**
 * Build and download a PDF for the given character. Silently no-ops (with a
 * toast) if jsPDF hasn't finished loading yet -- it's a deferred CDN
 * <script>, so this can in principle be clicked before it's ready on a slow
 * connection.
 */
export function exportCharacterPDF(c) {
    if (!c) return;

    const JsPDFCtor = getJsPDFCtor();
    if (!JsPDFCtor) {
        showToast('PDF export isn’t ready yet (still loading) — try again in a moment.', 'error');
        return;
    }

    const doc = new JsPDFCtor({ unit: 'pt', format: 'letter' });
    let y = 46;

    const heritage = HERITAGES.find(h => h.id === c.heritage);
    const { tier, name: tierName } = getTierFromXp(c.totalXp || 32);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text(c.name || 'Unnamed Character', PAGE_MARGIN_X, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const subtitle = [
        heritage ? heritage.label.split(' — ')[0] : null,
        c.region || null,
        c.magicPath && c.magicPath !== 'none' ? c.magicPath : null,
        `Tier ${tier} (${tierName})`,
        `${c.totalXp || 0} XP`
    ].filter(Boolean).join('   •   ');
    doc.text(subtitle, PAGE_MARGIN_X, y);
    y += 20;

    // Attributes
    doc.autoTable({
        startY: y,
        head: [['Body', 'Wits', 'Spirit', 'Presence']],
        body: [[c.body ?? 1, c.wits ?? 1, c.spirit ?? 1, c.presence ?? 1]],
        theme: 'grid',
        styles: { halign: 'center', fontSize: 10, textColor: [20, 20, 20] },
        headStyles: { fillColor: [45, 45, 45] },
        margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X }
    });
    y = doc.lastAutoTable.finalY + 16;

    // Skills, two per row (Skill/Rating/Skill/Rating) to keep the sheet to
    // roughly half a page instead of 16 single-column rows.
    const skillRows = [];
    for (let i = 0; i < ALL_SKILLS.length; i += 2) {
        const a = ALL_SKILLS[i];
        const b = ALL_SKILLS[i + 1];
        const av = c.skills?.[a.toLowerCase()] ?? 0;
        const bv = b ? (c.skills?.[b.toLowerCase()] ?? 0) : '';
        skillRows.push([a, av, b || '', bv]);
    }
    doc.autoTable({
        startY: y,
        head: [['Skill', 'Rating', 'Skill', 'Rating']],
        body: skillRows,
        theme: 'striped',
        styles: { fontSize: 9, textColor: [20, 20, 20] },
        headStyles: { fillColor: [45, 45, 45] },
        margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X }
    });
    y = doc.lastAutoTable.finalY + 16;

    // Trackers
    doc.autoTable({
        startY: y,
        head: [['Harm', 'Fatigue', 'Corruption', 'Obligation']],
        body: [[
            `${c.harm ?? 0}`,
            `${c.fatigue ?? 0} / ${c.fatigueMax ?? 1}`,
            `${c.corruption ?? 0} / ${c.corruptionMax ?? 1}`,
            `${c.obligation ?? 0} / ${c.obligationCapacity ?? 2}`
        ]],
        theme: 'grid',
        styles: { halign: 'center', fontSize: 10, textColor: [20, 20, 20] },
        headStyles: { fillColor: [45, 45, 45] },
        margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X }
    });
    y = doc.lastAutoTable.finalY + 16;

    y = addListTable(doc, 'Talents', (c.talents || []).filter(t => t && t.name),
        t => [t.name, t.effect || ''], y);
    y = addListTable(doc, 'Equipment', (c.equipment || []).filter(e => e && e.name),
        e => [e.name, e.note || e.description || ''], y);
    y = addListTable(doc, 'Assets', (c.assets || []).filter(a => a && a.name),
        a => [a.name, a.note || a.description || ''], y);
    y = addListTable(doc, 'Bonds', (c.bonds || []).filter(b => b && b.name),
        b => [b.name, b.note || b.description || ''], y);
    y = addListTable(doc, 'Complications', (c.complications || []).filter(x => x && x.name),
        x => [x.name, x.note || x.description || ''], y);

    if (c.background) {
        if (y > PAGE_BREAK_Y) {
            doc.addPage();
            y = 46;
        }
        y = addSectionHeading(doc, 'Background', y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(20, 20, 20);
        const lines = doc.splitTextToSize(c.background, CONTENT_WIDTH);
        doc.text(lines, PAGE_MARGIN_X, y);
    }

    const safeName = (c.name || 'character').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'character';
    doc.save(`${safeName}.pdf`);
}
