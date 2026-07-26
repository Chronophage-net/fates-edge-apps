/**
 * Rites / Songs / Arts – Patron-specific magical abilities
 * 
 * Displays rites from the patron's JSON data with expandable details,
 * obligation tracking, and integration with the character's magic path.
 * 
 * Data source: /data/patrons/<patron-id>.json (loaded by patrons feature)
 */

import { getState } from '../../../core/state.js';
import { showToast } from '../../../components/Toast.js';
import { escHtml } from '../../../core/utils.js';

// ============================================================
// HELPERS
// ============================================================

function safeString(val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => safeString(v)).join(', ');
    if (typeof val === 'object') {
        if (val.name) return safeString(val.name);
        if (val.label) return safeString(val.label);
        if (val.description) return safeString(val.description);
        if (val.effect) return safeString(val.effect);
        if (val.text) return safeString(val.text);
        if (val.quote) return safeString(val.quote);
        if (val.lore) return safeString(val.lore);
        try { return JSON.stringify(val); } catch (e) { return '[object]'; }
    }
    return String(val);
}

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

function sortRites(a, b) {
    const tiers = { 'Cantrip': 0, 'Basic': 1, 'Low': 1, 'Standard': 2, 'Advanced': 3, 'Master': 4, 'Epic': 5 };
    const tierA = tiers[a.tier] ?? 99;
    const tierB = tiers[b.tier] ?? 99;
    if (tierA !== tierB) return tierA - tierB;
    return (a.name || '').localeCompare(b.name || '');
}

function getTierColor(tier) {
    const colors = {
        'Cantrip': 'var(--text3)',
        'Basic': '#6baa7a',
        'Low': '#6baa7a',
        'Standard': '#d4af37',
        'Advanced': '#c47a7a',
        'Master': '#b84a8a',
        'Epic': '#d94a4a'
    };
    return colors[tier] || 'var(--text2)';
}

function getTierBadge(tier) {
    const labels = {
        'Cantrip': '🎵',
        'Basic': '🟢',
        'Low': '🟢',
        'Standard': '🟡',
        'Advanced': '🟠',
        'Master': '🔴',
        'Epic': '🟣'
    };
    return labels[tier] || '📜';
}

// ============================================================
// MAIN RENDER
// ============================================================

export function renderRites(el, patronId, characterId = 'default-character') {
    if (!el) return;

    // If no patronId provided, try to get it from the character
    if (!patronId) {
        const state = getState();
        const char = state.characters?.[characterId];
        patronId = char?.patron;
        if (!patronId) {
            el.innerHTML = `
                <div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">
                    <div style="font-size:1.5rem;">🔮</div>
                    <p>No patron selected.</p>
                    <p style="font-size:0.85rem;">Assign a patron to a character to view their rites.</p>
                </div>
            `;
            return;
        }
    }

    // Look up the patron in the global patron state
    const state = getState();
    const patronData = findPatronData(state, patronId);

    if (!patronData) {
        el.innerHTML = `
            <div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">
                <div style="font-size:1.5rem;">🔮</div>
                <p>Patron "<strong>${escHtml(patronId)}</strong>" not found.</p>
                <p style="font-size:0.85rem;">Make sure the patron's JSON file is loaded.</p>
            </div>
        `;
        return;
    }

    const rites = patronData.rites || [];
    const name = safeString(patronData.name || patronData.title || patronId);
    const icon = safeString(patronData.icon || '🔮');
    const domain = safeString(patronData.domain || patronData.subtitle || '');

    if (rites.length === 0) {
        el.innerHTML = `
            <div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">
                <div style="font-size:1.5rem;">${escHtml(icon)}</div>
                <p><strong>${escHtml(name)}</strong> has no rites listed.</p>
                <p style="font-size:0.85rem;">Check the patron's JSON file at <code>/data/patrons/${patronId}.json</code></p>
            </div>
        `;
        return;
    }

    const sortedRites = [...rites].sort(sortRites);

    // Group by tier
    const grouped = {};
    sortedRites.forEach(rite => {
        const tier = rite.tier || 'Basic';
        if (!grouped[tier]) grouped[tier] = [];
        grouped[tier].push(rite);
    });

    const obligation = getPatronObligation(state, characterId, patronId);

    let html = `
        <div class="rites-container" style="display:flex;flex-direction:column;gap:0.5rem;">
            <!-- Header -->
            <div class="rites-header" style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:0.3rem;">
                <span style="font-size:1.5rem;">${escHtml(icon)}</span>
                <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">${escHtml(name)}</span>
                ${domain ? `<span style="font-size:0.8rem;color:var(--text3);">— ${escHtml(domain)}</span>` : ''}
                <span style="font-size:0.7rem;color:var(--text3);margin-left:auto;">${rites.length} rites · Obligation: ${obligation}</span>
            </div>

            <!-- Obligation Controls -->
            <div class="rites-obligation" style="display:flex;gap:0.3rem;align-items:center;font-size:0.8rem;">
                <span style="color:var(--text3);">⛓️ Obligation:</span>
                <span style="font-weight:600;">${obligation}</span>
                <button class="btn btn-xs btn-primary" onclick="window.addRiteObligation('${patronId}', 1)">+1</button>
                <button class="btn btn-xs btn-secondary" onclick="window.addRiteObligation('${patronId}', -1)">−1</button>
                <button class="btn btn-xs btn-ghost" onclick="window.clearRiteObligation('${patronId}')" style="color:var(--red);">✕ Clear</button>
            </div>

            <!-- Rites list -->
            <div class="rites-list" style="display:flex;flex-direction:column;gap:0.4rem;max-height:400px;overflow-y:auto;padding:0.1rem;">
    `;

    // Render grouped rites
    const tierOrder = ['Cantrip', 'Basic', 'Low', 'Standard', 'Advanced', 'Master', 'Epic'];
    tierOrder.forEach(tier => {
        if (!grouped[tier]) return;
        const ritesInTier = grouped[tier];
        const color = getTierColor(tier);
        const badge = getTierBadge(tier);

        html += `
            <div class="rite-tier-group" style="margin-top:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;font-size:0.75rem;color:${color};font-weight:600;border-bottom:1px solid var(--border);padding-bottom:0.1rem;margin-bottom:0.2rem;">
                    ${badge} ${tier} (${ritesInTier.length})
                </div>
        `;

        ritesInTier.forEach((rite, idx) => {
            html += renderRiteItem(rite, patronId, idx);
        });

        html += `</div>`;
    });

    html += `
            </div>
        </div>
    `;

    el.innerHTML = html;

    // Attach toggle events for expandable rites
    el.querySelectorAll('.rite-expandable .rite-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const item = header.closest('.rite-item');
            if (!item) return;
            const details = item.querySelector('.rite-details');
            if (!details) return;
            const isExpanded = details.style.display !== 'none';
            details.style.display = isExpanded ? 'none' : 'block';
            const icon = item.querySelector('.rite-expand-icon');
            if (icon) icon.textContent = isExpanded ? '▸' : '▾';
            const riteId = item.dataset.riteId;
            if (riteId) {
                const expanded = JSON.parse(sessionStorage.getItem('fates-edge-expanded-rites') || '{}');
                if (isExpanded) delete expanded[riteId];
                else expanded[riteId] = true;
                sessionStorage.setItem('fates-edge-expanded-rites', JSON.stringify(expanded));
            }
        });
    });

    // Restore expanded states
    const expanded = JSON.parse(sessionStorage.getItem('fates-edge-expanded-rites') || '{}');
    el.querySelectorAll('.rite-item[data-rite-id]').forEach(item => {
        const id = item.dataset.riteId;
        if (expanded[id]) {
            const details = item.querySelector('.rite-details');
            if (details) details.style.display = 'block';
            const icon = item.querySelector('.rite-expand-icon');
            if (icon) icon.textContent = '▾';
        }
    });
}

// ============================================================
// RENDER A SINGLE RITE
// ============================================================

function renderRiteItem(rite, patronId, idx) {
    const riteId = `${patronId}-rite-${idx}`;
    const name = safeString(rite.name);
    const tier = safeString(rite.tier || 'Basic');
    const xp = rite.xp || rite.cost;
    const action = safeString(rite.action || '');
    const range = safeString(rite.range || '');
    const resist = safeString(rite.resist || '');
    const tags = rite.tags || [];
    const materials = safeString(rite.materials || '');
    const effect = safeString(rite.effect || rite.description || '');
    const pushIt = safeString(rite.push_it || '');
    const cost = safeString(rite.cost || '');
    const requires = safeString(rite.requires || '');
    const invoke = safeString(rite.invoke || '');
    const duration = safeString(rite.duration || '');
    const timer = safeString(rite.timer || '');

    const hasDetails = !!(effect || pushIt || materials || cost || requires || invoke || duration || timer || tags.length > 0);
    const color = getTierColor(tier);

    // Check if we should expand by default (if it's the first rite or has no details)
    const expanded = idx === 0 && hasDetails ? true : false;

    let detailsHtml = '';
    if (hasDetails) {
        detailsHtml = `
            <div class="rite-details" style="margin-top:0.4rem;padding:0.4rem 0.6rem;background:var(--bg2);border-radius:var(--radius);${expanded ? '' : 'display:none;'}">
                ${effect ? `<div class="rite-description" style="margin-bottom:0.3rem;line-height:1.5;font-size:0.9rem;">${formatText(effect)}</div>` : ''}
                ${materials ? `<div class="rite-meta" style="font-size:0.8rem;color:var(--text2);margin-bottom:0.15rem;"><strong>📦 Materials:</strong> ${formatText(materials)}</div>` : ''}
                ${pushIt ? `<div class="rite-meta" style="font-size:0.8rem;color:var(--text2);margin-bottom:0.15rem;"><strong>⚡ Push It:</strong> ${formatText(pushIt)}</div>` : ''}
                <div style="display:flex;flex-wrap:wrap;gap:0.3rem 0.8rem;font-size:0.75rem;color:var(--text3);margin-top:0.15rem;">
                    ${action ? `<span><strong>Action:</strong> ${escHtml(action)}</span>` : ''}
                    ${range ? `<span><strong>Range:</strong> ${escHtml(range)}</span>` : ''}
                    ${resist ? `<span><strong>Resist:</strong> ${escHtml(resist)}</span>` : ''}
                    ${duration ? `<span><strong>Duration:</strong> ${escHtml(duration)}</span>` : ''}
                    ${invoke ? `<span><strong>Invoke:</strong> ${escHtml(invoke)}</span>` : ''}
                    ${requires ? `<span><strong>Requires:</strong> ${escHtml(requires)}</span>` : ''}
                    ${cost ? `<span><strong>Cost:</strong> ${escHtml(cost)}</span>` : ''}
                    ${timer ? `<span><strong>Timer:</strong> ${escHtml(timer)}</span>` : ''}
                </div>
                ${tags.length > 0 ? `
                    <div class="rite-tags" style="display:flex;gap:0.2rem;flex-wrap:wrap;margin-top:0.2rem;">
                        ${tags.map(t => `<span class="tag-badge" style="display:inline-block;padding:0.05rem 0.4rem;border-radius:8px;background:var(--bg3);border:1px solid var(--border);font-size:0.65rem;color:var(--text3);">${escHtml(safeString(t))}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    return `
        <div class="rite-item ${hasDetails ? 'rite-expandable' : ''}" data-rite-id="${escHtml(riteId)}" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.6rem;border-left:3px solid ${color};">
            <div class="rite-header" style="display:flex;justify-content:space-between;align-items:center;cursor:${hasDetails ? 'pointer' : 'default'};">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    <span class="rite-name" style="font-weight:600;font-size:0.9rem;">${escHtml(name)}</span>
                    ${xp ? `<span style="font-size:0.7rem;color:var(--text3);">${escHtml(xp)} XP</span>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    ${tier ? `<span style="font-size:0.6rem;color:${color};font-weight:600;">${escHtml(tier)}</span>` : ''}
                    ${hasDetails ? `<span class="rite-expand-icon" style="font-size:0.7rem;color:var(--text3);">${expanded ? '▾' : '▸'}</span>` : ''}
                </div>
            </div>
            ${detailsHtml}
        </div>
    `;
}

// ============================================================
// PATRON DATA LOOKUP
// ============================================================

function findPatronData(state, patronId) {
    // Check cosmic patrons
    if (state.patrons?.cosmic) {
        const found = state.patrons.cosmic.find(p => p.id === patronId);
        if (found) return found;
    }

    // Check terrestrial patrons
    if (state.patrons?.terrestrial) {
        const found = state.patrons.terrestrial.find(p => p.id === patronId);
        if (found) return found;
    }

    // Check religions (for patron orders)
    if (state.patrons?.religions) {
        for (const religion of state.patrons.religions) {
            if (religion.orders) {
                const found = religion.orders.find(o => o.id === patronId);
                if (found) {
                    // Return a merged object with religion context
                    return {
                        ...found,
                        _religion: religion.name,
                        _religionIcon: religion.icon
                    };
                }
            }
        }
    }

    return null;
}

// ============================================================
// OBLIGATION MANAGEMENT
// ============================================================

function getPatronObligation(state, characterId, patronId) {
    if (!state.patrons?.obligation) return 0;
    if (!state.patrons.obligation[characterId]) return 0;
    return state.patrons.obligation[characterId][patronId] || 0;
}

function setPatronObligation(state, characterId, patronId, value) {
    if (!state.patrons) state.patrons = {};
    if (!state.patrons.obligation) state.patrons.obligation = {};
    if (!state.patrons.obligation[characterId]) state.patrons.obligation[characterId] = {};
    state.patrons.obligation[characterId][patronId] = Math.max(0, value);
}

// ============================================================
// GLOBAL FUNCTIONS (for onclick handlers)
// ============================================================

window.addRiteObligation = function(patronId, amount = 1) {
    const state = getState();
    const characterId = 'default-character';
    const current = getPatronObligation(state, characterId, patronId);
    setPatronObligation(state, characterId, patronId, current + amount);
    // Save state
    import('../../../core/state.js').then(({ saveState }) => saveState());
    showToast(`Obligation ${amount > 0 ? '+' : ''}${amount} for ${patronId}`, amount > 0 ? 'success' : 'info');
    // Refresh the rites view
    const container = document.getElementById('rites-container');
    if (container) renderRites(container, patronId, characterId);
};

window.clearRiteObligation = function(patronId) {
    const state = getState();
    const characterId = 'default-character';
    setPatronObligation(state, characterId, patronId, 0);
    import('../../../core/state.js').then(({ saveState }) => saveState());
    showToast(`Obligation cleared for ${patronId}`, 'info');
    const container = document.getElementById('rites-container');
    if (container) renderRites(container, patronId, characterId);
};

// ============================================================
// EXPORT
// ============================================================

export default { renderRites };
