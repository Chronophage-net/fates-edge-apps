/**
 * Cantor – Songs, Corruption, and the Voice of the Patron
 *
 * "You think you need a lute? My larynx is older than any tree.
 *  Hum, and the world will listen. Scream, and it might answer back."
 * – The Gray Wanderer
 *
 * Features:
 * - Patron's Rites as Songs with Push It mechanics
 * - Resonant Rites that advance Corruption
 * - Corruption table with unlocked tiers
 * - Current Corruption progress
 * - Cantor talents from wiki.json
 * - Voice of the Cantor (wisdom and guidance)
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml } from '../../../core/utils.js';
import { getState } from '../../../core/state.js';
import { showToast } from '../../../components/Toast.js';
import { renderRites } from './rites.js';

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

function findPatronData(state, patronId) {
    if (state.patrons?.cosmic) {
        const found = state.patrons.cosmic.find(p => p.id === patronId);
        if (found) return found;
    }
    if (state.patrons?.terrestrial) {
        const found = state.patrons.terrestrial.find(p => p.id === patronId);
        if (found) return found;
    }
    if (state.patrons?.religions) {
        for (const religion of state.patrons.religions) {
            if (religion.orders) {
                const found = religion.orders.find(o => o.id === patronId);
                if (found) return found;
            }
        }
    }
    return null;
}

function rollDice(pool) {
    let successes = 0;
    for (let i = 0; i < pool; i++) {
        const roll = Math.floor(Math.random() * 10) + 1;
        if (roll >= 6) successes++;
        if (roll === 10) successes++;
    }
    return successes;
}

// ============================================================
// TALENT LOADER (from wiki.json)
// ============================================================

async function loadCantorTalents() {
    try {
        const response = await fetch('./data/wiki.json');
        if (response.ok) {
            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
                // Find entries tagged with "cantor" and "talent" or "magic"
                return data.data.filter(entry =>
                    entry.tags &&
                    Array.isArray(entry.tags) &&
                    (entry.tags.includes('cantor') || entry.tags.includes('magic')) &&
                    (entry.tags.includes('talent') || entry.tags.includes('prestige') || entry.tags.includes('epic'))
                );
            }
        }
    } catch (e) {
        console.warn('Could not load wiki.json for Cantor talents.');
    }
    // Fallback: hardcoded Cantor talents from the grimoire
    return getFallbackCantorTalents();
}

function getFallbackCantorTalents() {
    return [
        {
            id: 'cantors-path',
            title: "Cantor's Path",
            category: 'magic',
            body: 'Required for Cantor. Grants access to Songs and a Corruption Timer (size = Spirit).',
            tags: ['talent', 'magic', 'cantor'],
            cost: 8
        },
        {
            id: 'master-cantor',
            title: 'Master Cantor',
            category: 'magic',
            body: 'Once per session, treat a significant Performance roll as one degree better (Miss→Partial, etc.). Once per arc, inspire a community; allies gain +1 die to a single goal for one session.',
            tags: ['talent', 'magic', 'cantor', 'prestige'],
            cost: 10
        },
        {
            id: 'embraced-corruption',
            title: 'Embraced Corruption',
            category: 'magic',
            body: 'You have learned to treat the bloom not as disease but as evolution. When you voluntarily fill your Corruption Timer through Resonant Rites, choose your corruption trait. You may Push Songs without marking Fatigue once per session. After filling your Corruption Timer seven times, develop the Fugal Self: +1 die to all Performance rolls.',
            tags: ['talent', 'magic', 'cantor', 'epic'],
            cost: 12
        },
        {
            id: 'high-cantor',
            title: 'High Cantor',
            category: 'magic',
            body: 'Tier II+ prestige talent. Allows weaving Standard Rites into instant, powerful Songs. Each such casting marks your Corruption Timer, but the effects are immediate and devastating.',
            tags: ['talent', 'magic', 'cantor', 'prestige'],
            cost: 18
        },
        {
            id: 'shadow-song',
            title: 'Shadow Song (Ikasha\'s Whisper)',
            category: 'magic',
            body: 'Learn Cradle Song (Low: lull a single target, Resist DV 3, costs 1 Fatigue) and Lockpick\'s Refrain (Standard: unlock one mundane or warded lock, costs 1 Obligation). Requires Patron: Ikasha.',
            tags: ['talent', 'magic', 'cantor', 'prestige'],
            cost: 7
        },
        {
            id: 'desperate-cadence',
            title: "Desperate Cadence (Malachai's False Note)",
            category: 'magic',
            body: 'Learn The Lucky Pick (Low: reroll a failed Stealth or Subterfuge roll, costs 1 Fatigue and 1 Corruption) and Blood Price (Standard: curse a rival, they suffer -1 die on next heist, costs 2 Fatigue and marks a Reckoning Timer). Requires Patron: Malachai.',
            tags: ['talent', 'magic', 'cantor', 'prestige'],
            cost: 7
        },
        {
            id: 'velvet-hook',
            title: "Velvet Hook (Livaea's Whisper)",
            category: 'magic',
            body: 'Learn Golden Tongue (Low: +2 dice to Sway for one social exchange, costs 1 Fatigue) and The Unrefusable Offer (Standard: sing a bargain, target must accept or suffer -2 dice until they do, costs 2 Obligation). Requires Patron: Livaea.',
            tags: ['talent', 'magic', 'cantor', 'prestige'],
            cost: 7
        }
    ];
}

// ============================================================
// MAIN RENDER
// ============================================================

export async function renderCantor(el) {
    const char = getCharacterData();
    if (!char || char.magicPath !== 'cantor') {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🎵</div>
                <p>Cantor interface is only available for Cantors.</p>
                <p style="font-size:0.85rem;">Select a character with the Cantor magic path.</p>
            </div>
        `;
        return;
    }

    const patronId = char.patron;
    if (!patronId) {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🎵</div>
                <p>No patron selected. A Cantor must have a patron to sing their songs.</p>
                <p style="font-size:0.85rem;">Assign a patron to this character to view their Cantor abilities.</p>
            </div>
        `;
        return;
    }

    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (!patronData) {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🎵</div>
                <p>Patron "<strong>${escHtml(patronId)}</strong>" not found.</p>
                <p style="font-size:0.85rem;">Make sure the patron's JSON file is loaded.</p>
            </div>
        `;
        return;
    }

    const rites = patronData.rites || [];
    const corruption = patronData.corruption || [];
    const currentCorruption = char.corruption || 0;
    const corruptionMax = char.corruptionMax || char.spirit || 1;
    const corruptionPct = Math.min(100, (currentCorruption / corruptionMax) * 100);

    // Compute unlocked corruption tier (each 2 corruption = 1 tier, max = corruption.length)
    const unlockedTier = Math.min(corruption.length, Math.floor(currentCorruption / 2) + 1);

    // Load talents from wiki
    const talents = await loadCantorTalents();

    // Check for Resonant Rite tracking
    const resonantRites = char.resonantRites || [];

    let html = `
        <div class="cantor-container" style="display:flex;flex-direction:column;gap:0.8rem;">

            <!-- Header -->
            <div class="cantor-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:1px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.2rem;">🎵</span>
                    <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Cantor</span>
                    <span style="font-size:0.7rem;color:var(--text3);">${escHtml(patronData.name || patronId)}</span>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-secondary" onclick="window.cantorRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- Corruption Track -->
            <div class="cantor-corruption-track" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--purple);">
                <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
                    <span style="color:var(--purple);">🎵 Corruption</span>
                    <span>${currentCorruption}/${corruptionMax}</span>
                    <span style="font-size:0.7rem;color:var(--text3);">Tier ${unlockedTier} / ${corruption.length}</span>
                    <button class="btn btn-xs btn-secondary" onclick="window.cantorAdvanceCorruption(1)" title="Advance corruption (for testing)">+</button>
                    <button class="btn btn-xs btn-secondary" onclick="window.cantorAdvanceCorruption(-1)" title="Reduce corruption">-</button>
                </div>
                <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${corruptionPct}%;height:100%;background:${corruptionPct > 80 ? 'var(--red)' : 'var(--purple)'};border-radius:3px;"></div>
                </div>
                ${corruptionPct >= 100 ? `<div style="color:var(--red);font-size:0.75rem;margin-top:0.1rem;">⚠️ Corruption full! The bloom is near. Perform a Resonant Rite to bloom.</div>` : ''}
            </div>

            <!-- Corruption Table -->
            ${corruption.length > 0 ? `
                <div class="cantor-corruption-table" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--purple);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                        <span style="font-size:0.85rem;font-weight:600;color:var(--purple);">⚠️ The Bloom: Corruption Tiers</span>
                        <span style="font-size:0.6rem;color:var(--text3);">Unlocked: ${unlockedTier} / ${corruption.length}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.2rem;max-height:200px;overflow-y:auto;font-size:0.75rem;">
                        ${corruption.map((c, idx) => {
                            const tier = c.tier || (idx + 1);
                            const isUnlocked = (idx + 1) <= unlockedTier;
                            const benefit = safeString(c.benefit);
                            const cost = safeString(c.cost);
                            return `
                                <div style="display:grid;grid-template-columns:1fr 2fr 2fr;gap:0.3rem;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);${isUnlocked ? 'background:var(--bg3);border-left:3px solid var(--gold);' : 'opacity:0.5;'}">
                                    <span style="font-weight:${isUnlocked ? '600' : '400'};color:${isUnlocked ? 'var(--gold)' : 'var(--text3)'};">Tier ${tier}</span>
                                    <span style="color:${isUnlocked ? 'var(--text)' : 'var(--text3)'};">${escHtml(benefit)}</span>
                                    <span style="color:${isUnlocked ? 'var(--red)' : 'var(--text3)'};">${escHtml(cost)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div style="font-size:0.6rem;color:var(--text3);margin-top:0.2rem;">The bloom transforms you. Embrace it, or resist it.</div>
                </div>
            ` : ''}

            <!-- Songs / Rites with Push It -->
            <div class="cantor-songs" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;flex-wrap:wrap;gap:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🎶 Songs (Rites)</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${rites.length} songs</span>
                    <div style="display:flex;gap:0.2rem;">
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorMarkResonant()">🔮 Resonant Rite</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.cantorResetCorruption()" style="color:var(--red);">✕ Reset</button>
                    </div>
                </div>
                <div id="cantor-rites-container" style="display:flex;flex-direction:column;gap:0.3rem;"></div>
            </div>

            <!-- Resonant Rites Tracking -->
            ${resonantRites.length > 0 ? `
                <div class="cantor-resonant" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.8rem;font-weight:600;color:var(--gold);">🔮 Resonant Rites Performed</span>
                        <span style="font-size:0.7rem;color:var(--text3);">${resonantRites.length}</span>
                    </div>
                    <div style="font-size:0.7rem;color:var(--text2);">
                        ${resonantRites.slice(-3).map(r => `• ${escHtml(r)}`).join(' ')}
                        ${resonantRites.length > 3 ? `<span style="color:var(--text3);">(+${resonantRites.length - 3} more)</span>` : ''}
                    </div>
                    <div style="font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">Resonant Rites advance your Corruption Timer.</div>
                </div>
            ` : ''}

            <!-- Cantor Talents -->
            <div class="cantor-talents" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⚡ Cantor Talents</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${talents.length} talents</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.2rem;max-height:150px;overflow-y:auto;font-size:0.75rem;">
                    ${talents.map(t => {
                        const name = safeString(t.title || t.name);
                        const description = safeString(t.body || t.description);
                        const cost = t.cost || '?';
                        const tags = (t.tags || []).join(', ');
                        return `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);">
                                <div style="flex:1;">
                                    <span style="font-weight:600;">${escHtml(name)}</span>
                                    <span style="font-size:0.6rem;color:var(--text3);">${escHtml(tags)}</span>
                                    <div style="font-size:0.65rem;color:var(--text2);">${formatText(description)}</div>
                                </div>
                                <span style="font-size:0.65rem;color:var(--gold);margin-left:0.3rem;">${cost} XP</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="font-size:0.6rem;color:var(--text3);margin-top:0.2rem;">Talents are learned with XP during downtime.</div>
            </div>

            <!-- Cantor Wisdom -->
            <div class="cantor-wisdom" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <div style="font-size:0.75rem;color:var(--text3);font-style:italic;">
                    "The voice is a flame. Lean too close, and you will find yourself consumed—not by hellfire, but by the applause of the crowd, which is hungrier than any demon."
                    <span style="display:block;text-align:right;font-size:0.65rem;color:var(--text2);">— The Gray Wanderer</span>
                </div>
            </div>

        </div>
    `;

    el.innerHTML = html;

    // Render the rites with Push It support
    const ritesContainer = document.getElementById('cantor-rites-container');
    if (ritesContainer) {
        // Custom render with Push It support
        renderCantorRites(ritesContainer, patronData, char);
    }
}

// ============================================================
// CANTOR RITES RENDER (with Push It)
// ============================================================

function renderCantorRites(container, patronData, char) {
    const rites = patronData.rites || [];
    const patronName = patronData.name || patronData.title || 'Unknown Patron';

    if (rites.length === 0) {
        container.innerHTML = `<div style="font-size:0.8rem;color:var(--text3);text-align:center;">No songs found for ${escHtml(patronName)}.</div>`;
        return;
    }

    const sortedRites = [...rites].sort((a, b) => {
        const tiers = { 'Cantrip': 0, 'Basic': 1, 'Low': 1, 'Standard': 2, 'Advanced': 3, 'Master': 4, 'Epic': 5 };
        return (tiers[a.tier] || 99) - (tiers[b.tier] || 99);
    });

    let html = '';
    sortedRites.forEach((rite, idx) => {
        const name = safeString(rite.name);
        const tier = safeString(rite.tier || 'Basic');
        const xp = rite.xp || rite.cost;
        const effect = safeString(rite.effect || rite.description);
        const pushIt = safeString(rite.push_it);
        const hasPush = pushIt && pushIt.length > 0;
        const cost = safeString(rite.cost || '');

        const colorMap = {
            'Cantrip': 'var(--text3)',
            'Basic': '#6baa7a',
            'Low': '#6baa7a',
            'Standard': '#d4af37',
            'Advanced': '#c47a7a',
            'Master': '#b84a8a',
            'Epic': '#d94a4a'
        };
        const color = colorMap[tier] || 'var(--text2)';

        html += `
            <div class="rite-item" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:3px solid ${color};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                    <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                        <span style="font-weight:600;font-size:0.85rem;">${escHtml(name)}</span>
                        <span style="font-size:0.6rem;color:${color};">${escHtml(tier)}</span>
                        ${xp ? `<span style="font-size:0.6rem;color:var(--text3);">${xp} XP</span>` : ''}
                    </div>
                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;">
                        ${cost ? `<span style="font-size:0.6rem;color:var(--text3);">${escHtml(cost)}</span>` : ''}
                        ${hasPush ? `<button class="btn btn-xs btn-primary" onclick="window.cantorPushRite('${patronData.id}', ${idx}, '${escHtml(name)}')" title="Push It: Resolve instantly, mark Fatigue + Corruption">⚡ Push</button>` : ''}
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorMarkResonantRite('${escHtml(name)}')" title="Mark as Resonant Rite (advances Corruption)">🔮</button>
                    </div>
                </div>
                ${effect ? `<div style="font-size:0.75rem;color:var(--text2);margin-top:0.1rem;line-height:1.3;">${formatText(effect)}</div>` : ''}
                ${hasPush ? `<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">⚡ Push: ${formatText(pushIt)}</div>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============================================================
// GLOBAL FUNCTIONS (onclick handlers)
// ============================================================

window.cantorPushRite = function(patronId, riteIndex, riteName) {
    const char = getCharacterData();
    if (!char) return;

    // Get the rite from patron data
    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (!patronData) {
        showToast('Patron not found.', 'error');
        return;
    }

    const rite = patronData.rites?.[riteIndex];
    if (!rite) {
        showToast('Rite not found.', 'error');
        return;
    }

    // Push It mechanics:
    // - Mark 1 Fatigue
    // - Advance Corruption Timer by 1
    // - Optionally, apply the Push effect immediately

    // Check if the character has the Cantor's Path talent (we'll assume yes if they're a Cantor)
    // Push It: The song resolves immediately (in fiction, it's instant)

    const fatigue = char.fatigue || 0;
    const fatigueMax = (char.body || 1) * 3;

    if (fatigue >= fatigueMax) {
        showToast('Cannot Push — Fatigue track is full!', 'error');
        return;
    }

    // Mark Fatigue
    char.fatigue = fatigue + 1;

    // Mark Corruption
    const corruption = char.corruption || 0;
    const corruptionMax = char.corruptionMax || char.spirit || 1;
    char.corruption = Math.min(corruption + 1, corruptionMax);

    // Save
    saveCharacter({ fatigue: char.fatigue, corruption: char.corruption });

    // Show feedback
    const pushEffect = rite.push_it || 'The song resolves instantly.';
    showToast(`⚡ Pushed "${riteName}"! Fatigue +1, Corruption +1. ${pushEffect}`, 'success');

    // Refresh the view
    window.cantorRefresh();

    // If corruption is full, trigger bloom warning
    if (char.corruption >= corruptionMax) {
        showToast('⚠️ Corruption is full! The bloom is near. Perform a Resonant Rite to embrace transformation.', 'warning');
    }
};

window.cantorMarkResonantRite = function(riteName) {
    const char = getCharacterData();
    if (!char) return;

    // Track resonant rites
    if (!char.resonantRites) char.resonantRites = [];

    // Don't duplicate
    if (char.resonantRites.includes(riteName)) {
        showToast(`"${riteName}" is already marked as resonant.`, 'info');
        return;
    }

    char.resonantRites.push(riteName);

    // Advance Corruption (Resonant Rites advance the timer)
    const corruption = char.corruption || 0;
    const corruptionMax = char.corruptionMax || char.spirit || 1;
    char.corruption = Math.min(corruption + 1, corruptionMax);

    saveCharacter({ resonantRites: char.resonantRites, corruption: char.corruption });

    showToast(`🔮 "${riteName}" marked as Resonant Rite! Corruption +1.`, 'info');
    window.cantorRefresh();
};

window.cantorAdvanceCorruption = function(amount = 1) {
    const char = getCharacterData();
    if (!char) return;

    const corruption = char.corruption || 0;
    const corruptionMax = char.corruptionMax || char.spirit || 1;
    char.corruption = Math.max(0, Math.min(corruption + amount, corruptionMax));

    saveCharacter({ corruption: char.corruption });
    window.cantorRefresh();
    showToast(`Corruption: ${char.corruption}/${corruptionMax}`, 'info');
};

window.cantorResetCorruption = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!confirm('Reset Corruption and clear Resonant Rites?')) return;

    char.corruption = 0;
    char.resonantRites = [];
    saveCharacter({ corruption: 0, resonantRites: [] });
    showToast('Corruption reset.', 'info');
    window.cantorRefresh();
};

window.cantorRefresh = function() {
    const el = document.getElementById('spellcraft-content');
    if (el) {
        renderCantor(el);
    } else {
        // Try to find the container
        const container = document.querySelector('.cantor-container')?.parentElement;
        if (container) renderCantor(container);
    }
    showToast('🔄 Cantor refreshed.', 'info');
};

// ============================================================
// EXPORT
// ============================================================

export default { renderCantor };
