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
 * - Corruption table with unlocked tiers and bloom descriptions
 * - Current Corruption progress with visual tracking
 * - Cantor talents from wiki.json (with Learn/Unlearn)
 * - Simulate Push: see the outcome before you commit
 * - Voice of the Cantor (wisdom and guidance)
 * - Bloom tracker – how many times you've bloomed
 * - Fugal Self progression (after 7 blooms)
 * - Bound Patron talent: +1 position for bound patron, -1 for others, bound corruption
 * - Unbound Cantors access all patrons' Low rites
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml } from '../../../core/utils.js';
import { getState, saveState } from '../../../core/state.js';
import { showToast } from '../../../components/Toast.js';
import { performRoll } from '../../../core/dice.js';
// ─── Import patrons module for data loading ────────────────
import patrons from '../../patrons/index.js';
const { loadPatronData, getPatronObligation, savePatronData } = patrons;

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

// ─── Find a patron in state by ID (copied from rites module) ──
function findPatronData(state, patronId) {
    if (!patronId) return null;
    
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
                if (found) {
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

// ─── Get all patrons (cosmic, terrestrial, and religion orders) ──
function getAllPatrons(state) {
    const all = [];
    if (state.patrons?.cosmic) all.push(...state.patrons.cosmic);
    if (state.patrons?.terrestrial) all.push(...state.patrons.terrestrial);
    if (state.patrons?.religions) {
        for (const rel of state.patrons.religions) {
            if (rel.orders) {
                for (const order of rel.orders) {
                    all.push({
                        ...order,
                        _religion: rel.name,
                        _religionIcon: rel.icon
                    });
                }
            }
        }
    }
    return all;
}

// ─── Magic Paths Reference (kept for fallback) ──────────────
const MAGIC_PATH_REFERENCE = [
    { icon: '🔥', label: 'Free Caster', blurb: 'Raw TAGS grammar, no patron — pure will and improvisation.' },
    { icon: '📖', label: 'Runekeeper', blurb: 'Bound to one patron via Thiasos or Codex; steady Rites.' },
    { icon: '🔯', label: 'Invoker', blurb: 'Carries Symbols from multiple patrons; risks Cross-Resonance.' },
    { icon: '🎵', label: 'Cantor', blurb: "Sings a patron's Rites as Songs; Corruption blooms with Pushing." },
    { icon: '👁️', label: 'Summoner', blurb: 'Binds spirits from the Bestiary; manages the Leash.' },
    { icon: '🌿', label: 'Witch', blurb: 'Hedge magic at Thresholds, paid in Shadow, Shame, Identity Strain.' },
    { icon: '🧠', label: 'Psion', blurb: 'Mind-born power fueled by Mental Strain.' },
    { icon: '🧘', label: 'Monk', blurb: 'Patron-optional path of Breath States and monastic Techniques.' },
    { icon: '🦅', label: 'Familiar Only', blurb: 'A bonded companion without a full magic path.' },
    { icon: '🍃', label: 'Hedge Gifts', blurb: 'Small universal gifts available to any character.' }
];

function renderMagicPathReferenceHtml(highlightLabel) {
    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.4rem;text-align:left;margin-top:0.8rem;">
            ${MAGIC_PATH_REFERENCE.map(p => `
                <div style="padding:0.4rem 0.5rem;border-radius:var(--radius);background:var(--bg2);border:1px solid ${p.label === highlightLabel ? 'var(--gold)' : 'var(--border)'};">
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:1.1rem;">${p.icon}</span>
                        <strong style="font-size:0.82rem;${p.label === highlightLabel ? 'color:var(--gold);' : ''}">${p.label}</strong>
                    </div>
                    <div style="font-size:0.68rem;color:var(--text3);margin-top:0.15rem;line-height:1.3;">${p.blurb}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================
// TALENT LOADER (from wiki.json, with Bound Patron added)
// ============================================================

async function loadCantorTalents() {
    try {
        const response = await fetch('./data/wiki.json');
        if (response.ok) {
            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
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
            title: "Shadow Song (Ikasha's Whisper)",
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
        },
        // ─── NEW: Bound Patron talent ────────────────────────────
        {
            id: 'bound-patron',
            title: 'Bound Patron',
            category: 'magic',
            body: 'Choose one patron. You gain +1 position when singing that patron’s rites, but suffer -1 position when singing any other patron’s rites. Your Corruption is bound to that patron’s bloom table.',
            tags: ['talent', 'cantor'],
            cost: 5
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
                ${!char ? `
                    <div style="margin-top:0.5rem;font-weight:600;color:var(--gold);">📚 Magic Paths Reference</div>
                    ${renderMagicPathReferenceHtml('Cantor')}
                ` : ''}
            </div>
        `;
        return;
    }

    // Ensure patron data is loaded
    await loadPatronData();
    const state = getState();

    // Determine bound patron (fallback to char.patron for backward compatibility)
    const boundPatronId = char.boundPatron || char.patron || null;
    const boundPatronData = boundPatronId ? findPatronData(state, boundPatronId) : null;
    const isBound = !!boundPatronData;

    // Collect rites
    let rites = [];
    if (isBound) {
        // Bound: use that patron's rites (all tiers)
        rites = (boundPatronData.rites || []).map(r => ({
            ...r,
            patronId: boundPatronId,
            patronName: boundPatronData.name || boundPatronData.title,
            patronIcon: boundPatronData.icon,
            patronColor: boundPatronData.color || 'var(--gold)',
        }));
    } else {
        // Unbound: collect all Low rites from all patrons
        const allPatrons = getAllPatrons(state);
        for (const p of allPatrons) {
            if (p.rites && Array.isArray(p.rites)) {
                const low = p.rites.filter(r => (r.tier || '').toLowerCase() === 'low');
                for (const r of low) {
                    rites.push({
                        ...r,
                        patronId: p.id,
                        patronName: p.name || p.title,
                        patronIcon: p.icon,
                        patronColor: p.color || 'var(--gold)',
                    });
                }
            }
        }
    }

    // Corruption data
    const corruptionTable = isBound ? (boundPatronData.corruption || []) : [];
    const currentCorruption = char.corruption || 0;
    const corruptionMax = char.corruptionMax || char.spirit || 1;
    const corruptionPct = Math.min(100, (currentCorruption / corruptionMax) * 100);

    // Bloom tracking
    const bloomCount = char.bloomCount || 0;
    const hasFugalSelf = bloomCount >= 7;

    // Unlocked corruption tier (each 2 corruption = 1 tier, min 1)
    const unlockedTier = isBound ? Math.min(corruptionTable.length, Math.floor(currentCorruption / 2) + 1) : 0;
    const isCorruptionFull = currentCorruption >= corruptionMax;

    // Resonant Rites
    const resonantRites = char.resonantRites || [];

    // Learned talents
    const learnedTalents = char.learnedTalents || [];

    // Load talents from wiki
    const talents = await loadCantorTalents();

    // Build patron quote
    const patronQuote = isBound
        ? (boundPatronData.lore?.quotes?.[0] || boundPatronData.lore?.quote || 'Sing, and the Weave answers.')
        : 'The Weave speaks through all voices.';

    let html = `
        <div class="cantor-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="cantor-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🎵</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Cantor</span>
                        ${isBound ? `<span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">of ${escHtml(boundPatronData.name || boundPatronId)}</span>` : `<span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">of the Weave (unbound)</span>`}
                        ${isBound ? `<span style="font-size:0.65rem;color:var(--text2);margin-left:0.2rem;">🎯 +1/-1 position</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-secondary" onclick="window.cantorRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Corruption Track ───────────────────────────── -->
            <div class="cantor-corruption-track" style="background:var(--bg2);border-radius:var(--radius);padding:0.4rem 0.6rem;border-left:4px solid ${isBound ? 'var(--purple)' : 'var(--text3)'};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span style="font-size:0.85rem;font-weight:600;color:${isBound ? 'var(--purple)' : 'var(--text3)'};">🎵 Corruption</span>
                        <span style="font-size:0.8rem;font-weight:600;">${currentCorruption}/${corruptionMax}</span>
                        ${isCorruptionFull ? `<span style="font-size:0.7rem;color:var(--red);font-weight:600;">⚠️ FULL – ${isBound ? 'BLOOM NEAR' : 'CORRUPTION PEAKED'}</span>` : ''}
                    </div>
                    <div style="display:flex;gap:0.2rem;align-items:center;">
                        ${isBound ? `<span style="font-size:0.65rem;color:var(--text3);">Tier ${unlockedTier}/${corruptionTable.length}</span>` : `<span style="font-size:0.65rem;color:var(--text3);">Unfocused</span>`}
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorAdvanceCorruption(1)" title="Advance corruption">+</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorAdvanceCorruption(-1)" title="Reduce corruption">−</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.cantorSimulatePush()" style="color:var(--gold);font-size:0.6rem;" title="Simulate what happens when you Push a Song">⚡ Simulate Push</button>
                    </div>
                </div>
                <div style="width:100%;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-top:0.2rem;">
                    <div style="width:${corruptionPct}%;height:100%;background:${corruptionPct > 80 ? 'var(--red)' : (isBound ? 'var(--purple)' : 'var(--text3)')};border-radius:4px;transition:width 0.3s ease;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">
                    <span>${bloomCount} blooms</span>
                    <span>${hasFugalSelf ? '✨ Fugal Self: +1 die to Performance' : `${7 - bloomCount} blooms to Fugal Self`}</span>
                    <span>Resonant Rites: ${resonantRites.length}</span>
                </div>
            </div>

            <!-- ─── Corruption Table (only if bound) ──────────── -->
            ${isBound && corruptionTable.length > 0 ? `
                <div class="cantor-corruption-table" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--purple);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                        <span style="font-size:0.8rem;font-weight:600;color:var(--purple);">⚠️ The Bloom: Corruption Tiers</span>
                        <span style="font-size:0.65rem;color:var(--text3);">Unlocked: ${unlockedTier} / ${corruptionTable.length}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:220px;overflow-y:auto;font-size:0.75rem;">
                        ${corruptionTable.map((c, idx) => {
                            const tier = c.tier || (idx + 1);
                            const isUnlocked = (idx + 1) <= unlockedTier;
                            const benefit = safeString(c.benefit);
                            const cost = safeString(c.cost);
                            const isCurrent = isUnlocked && (idx + 1) === unlockedTier;
                            return `
                                <div style="display:grid;grid-template-columns:1fr 2fr 2fr;gap:0.2rem;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);${isCurrent ? 'background:var(--bg3);border-left:3px solid var(--gold);' : ''}${isUnlocked ? '' : 'opacity:0.5;'}">
                                    <span style="font-weight:${isUnlocked ? '600' : '400'};color:${isCurrent ? 'var(--gold)' : isUnlocked ? 'var(--text)' : 'var(--text3)'};">Tier ${tier}</span>
                                    <span style="color:${isUnlocked ? 'var(--text)' : 'var(--text3)'};">${escHtml(benefit)}</span>
                                    <span style="color:${isUnlocked ? 'var(--red)' : 'var(--text3)'};">${escHtml(cost)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${isCorruptionFull ? `
                        <div style="margin-top:0.2rem;padding:0.3rem;background:rgba(212,175,55,0.15);border-radius:var(--radius);border:1px solid var(--gold);font-size:0.75rem;color:var(--gold);">
                            🌸 <strong>The Bloom Beckons!</strong> Your Corruption is full. Perform a <strong>Resonant Rite</strong> to embrace the bloom and advance to the next tier.
                            ${bloomCount >= 7 ? '<br>✨ You have achieved the Fugal Self. The bloom is now your ally.' : ''}
                        </div>
                    ` : ''}
                </div>
            ` : (isBound ? '' : `
                <div class="cantor-corruption-unbound" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--text3);font-size:0.75rem;color:var(--text3);">
                    🌿 Unbound – your corruption is not tied to any patron’s bloom. No tiers or benefits.
                </div>
            `)}

            <!-- ─── Songs / Rites ──────────────────────────────── -->
            <div class="cantor-songs" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;flex-wrap:wrap;gap:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🎶 Songs (Rites)</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${rites.length} songs${isBound ? '' : ' (Low rites only)'}</span>
                    <div style="display:flex;gap:0.2rem;">
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorMarkResonant()">🔮 Resonant Rite</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.cantorResetCorruption()" style="color:var(--red);">✕ Reset</button>
                    </div>
                </div>
                <div id="cantor-rites-container" style="display:flex;flex-direction:column;gap:0.3rem;"></div>
            </div>

            <!-- ─── Resonant Rites Tracker ──────────────────────── -->
            ${resonantRites.length > 0 ? `
                <div class="cantor-resonant" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.8rem;font-weight:600;color:var(--gold);">🔮 Resonant Rites Performed</span>
                        <span style="font-size:0.7rem;color:var(--text3);">${resonantRites.length}</span>
                    </div>
                    <div style="font-size:0.7rem;color:var(--text2);max-height:60px;overflow-y:auto;">
                        ${resonantRites.slice(-5).map(r => `• ${escHtml(r)}`).join(' ')}
                        ${resonantRites.length > 5 ? `<span style="color:var(--text3);">(+${resonantRites.length - 5} more)</span>` : ''}
                    </div>
                    <div style="font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">
                        Resonant Rites advance your Corruption Timer. Each Resonant Rite = +1 Corruption.
                        ${isBound ? (bloomCount > 0 ? `You have bloomed ${bloomCount} time${bloomCount > 1 ? 's' : ''}.` : '') : 'No bloom without a bound patron.'}
                    </div>
                </div>
            ` : ''}

            <!-- ─── Cantor Talents ──────────────────────────────── -->
            <div class="cantor-talents" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⚡ Cantor Talents</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${talents.length} talents · ${learnedTalents.length} learned</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:180px;overflow-y:auto;font-size:0.75rem;">
                    ${talents.map(t => {
                        const name = safeString(t.title || t.name);
                        const description = safeString(t.body || t.description);
                        const cost = t.cost || '?';
                        const tags = (t.tags || []).join(', ');
                        const isLearned = learnedTalents.includes(t.id || name);
                        // Special handling for Bound Patron
                        const isBoundPatron = (t.id === 'bound-patron');
                        const isBound = !!char.boundPatron;
                        return `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);${isLearned ? 'background:var(--bg3);border-left:3px solid var(--gold);' : ''}">
                                <div style="flex:1;min-width:0;">
                                    <span style="font-weight:${isLearned ? '600' : '400'};color:${isLearned ? 'var(--gold)' : 'var(--text)'};">${escHtml(name)}</span>
                                    ${isLearned ? `<span style="font-size:0.55rem;color:var(--gold);margin-left:0.2rem;">✓ Learned</span>` : ''}
                                    ${isBoundPatron && isBound ? `<span style="font-size:0.55rem;color:var(--text2);margin-left:0.2rem;">(Bound to ${escHtml(char.boundPatron)})</span>` : ''}
                                    <div style="font-size:0.65rem;color:var(--text2);">${formatText(description)}</div>
                                </div>
                                <div style="display:flex;align-items:center;gap:0.2rem;flex-shrink:0;margin-left:0.3rem;">
                                    <span style="font-size:0.65rem;color:var(--gold);">${cost} XP</span>
                                    <button class="btn btn-xs ${isLearned ? 'btn-secondary' : 'btn-primary'}" onclick="window.cantorToggleTalent('${escHtml(t.id || name)}')" style="font-size:0.55rem;padding:0.05rem 0.3rem;">
                                        ${isLearned ? '✕ Unlearn' : '✓ Learn'}
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="font-size:0.6rem;color:var(--text3);margin-top:0.15rem;">Talents are learned with XP during downtime.</div>
            </div>

            <!-- ─── Cantor Wisdom ──────────────────────────────── -->
            <div class="cantor-wisdom" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <div style="display:flex;flex-direction:column;gap:0.1rem;">
                    <div style="font-size:0.7rem;color:var(--text3);font-style:italic;">
                        "${formatText(patronQuote)}"
                        <span style="display:block;text-align:right;font-size:0.6rem;color:var(--text2);">— ${isBound ? (boundPatronData.name || boundPatronId) : 'The Weave'}</span>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;font-size:0.6rem;color:var(--text3);border-top:1px solid var(--border);padding-top:0.15rem;">
                        <span>💡 <strong>Push It:</strong> Resolve a song instantly, but mark Fatigue + Corruption</span>
                        ${isBound ? `<span>🌸 <strong>Bloom:</strong> When Corruption is full, perform a Resonant Rite to transform</span>` : `<span>🌿 <strong>Unbound:</strong> No bloom – corruption is unfocused</span>`}
                        <span>🎵 <strong>Voice:</strong> Your larynx is older than any tree</span>
                    </div>
                </div>
            </div>

        </div>
    `;

    el.innerHTML = html;

    // Render the rites with Push It support
    const ritesContainer = document.getElementById('cantor-rites-container');
    if (ritesContainer) {
        renderCantorRites(ritesContainer, rites, char);
    }
}

// ============================================================
// CANTOR RITES RENDER (with Push It)
// ============================================================

function renderCantorRites(container, rites, char) {
    if (rites.length === 0) {
        container.innerHTML = `<div style="font-size:0.8rem;color:var(--text3);text-align:center;">${char.boundPatron ? 'No songs found for this patron.' : 'No Low rites found across all patrons.'}</div>`;
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

        // Show patron info if unbound (patronId may be present)
        const patronName = rite.patronName ? safeString(rite.patronName) : null;
        const patronIcon = rite.patronIcon ? safeString(rite.patronIcon) : null;

        // Check if this rite has been marked as Resonant
        const resonantRites = char.resonantRites || [];
        const isResonant = resonantRites.includes(name);

        html += `
            <div class="rite-item" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:3px solid ${color};${isResonant ? 'border-right:3px solid var(--gold);' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                    <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                        ${patronIcon ? `<span style="font-size:1rem;">${patronIcon}</span>` : ''}
                        <span style="font-weight:600;font-size:0.85rem;">${escHtml(name)}</span>
                        ${patronName ? `<span style="font-size:0.6rem;color:var(--text3);">(${escHtml(patronName)})</span>` : ''}
                        <span style="font-size:0.6rem;color:${color};">${escHtml(tier)}</span>
                        ${xp ? `<span style="font-size:0.6rem;color:var(--text3);">${xp} XP</span>` : ''}
                        ${isResonant ? `<span style="font-size:0.55rem;color:var(--gold);">🔮 Resonant</span>` : ''}
                    </div>
                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;">
                        ${cost ? `<span style="font-size:0.6rem;color:var(--text3);">${escHtml(cost)}</span>` : ''}
                        ${hasPush ? `
                            <button class="btn btn-xs btn-primary" onclick="window.cantorPushRite('${escHtml(rite.patronId || '')}', ${idx}, '${escHtml(name)}')" title="Push It: Resolve instantly, mark Fatigue + Corruption">
                                ⚡ Push
                            </button>
                        ` : ''}
                        <button class="btn btn-xs ${isResonant ? 'btn-secondary' : 'btn-ghost'}" 
                                onclick="window.cantorToggleResonantRite('${escHtml(name)}')" 
                                style="${isResonant ? '' : 'color:var(--text3);'}"
                                title="${isResonant ? 'Unmark as Resonant' : 'Mark as Resonant Rite (advances Corruption)'}">
                            ${isResonant ? '🔮✕' : '🔮'}
                        </button>
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

// ─── Push Rite ────────────────────────────────────────────────

window.cantorPushRite = function(patronId, riteIndex, riteName) {
    const char = getCharacterData();
    if (!char) return;

    // Get patron data from state (using helper)
    const state = getState();
    const boundPatronId = char.boundPatron || char.patron || null;
    const isBound = !!boundPatronId;

    // Find the rite data
    // We need to find the rite from the current list; we can pass the full rite object instead of patronId/riteIndex.
    // However, we only have patronId and riteIndex from the button click. We need to retrieve the rite from the patron data.
    // Since we have patronId, we can load that patron's data.
    let rite = null;
    if (patronId) {
        const patronData = findPatronData(state, patronId);
        if (patronData && patronData.rites && patronData.rites[riteIndex]) {
            rite = patronData.rites[riteIndex];
        }
    }
    if (!rite) {
        // Fallback: try to find by name? For safety, we'll show error.
        showToast('Rite not found. Please refresh.', 'error');
        return;
    }

    // Check Fatigue
    const fatigue = char.fatigue || 0;
    const fatigueMax = (char.body || 1);

    if (fatigue >= fatigueMax) {
        showToast('Cannot Push — Fatigue track is full!', 'error');
        return;
    }

    // ─── Calculate pool with bonus/penalty ──────────────────────
    let pool = (char.spirit || 1) + (char.performance || 0);

    if (isBound) {
        const ritePatronId = patronId;
        if (ritePatronId === boundPatronId) {
            // Bonus: +1 position (or defined bonus)
            pool += (char.boundPatronBonus || 1);
        } else {
            // Penalty: -1 position
            pool -= 1;
        }
    }
    // Ensure pool >= 0
    pool = Math.max(pool, 0);

    // Roll
    const dv = rite.dv || 3;
    const rollResult = performRoll(pool, dv);

    const success = rollResult.successes >= dv;
    const sb = rollResult.storyBeats || 0;

    // Apply effects
    const fatigueCost = 1;
    const corruptionCost = 1;

    char.fatigue = fatigue + fatigueCost;
    char.corruption = Math.min((char.corruption || 0) + corruptionCost, char.corruptionMax || char.spirit || 1);

    saveCharacter({ fatigue: char.fatigue, corruption: char.corruption });

    // Build result message
    let outcome = success ? '✅ Success' : '❌ Failure';
    let outcomeColor = success ? 'var(--gold)' : 'var(--red)';
    let detail = success ? `The song resolves with ${rollResult.successes} successes.` : `The song falters with ${rollResult.successes}/${dv} successes.`;
    if (sb > 0) detail += ` ${sb} Story Beats generated.`;

    const pushEffect = rite.push_it || 'The song resolves instantly.';

    let bonusInfo = '';
    if (isBound) {
        if (patronId === boundPatronId) {
            bonusInfo = '🎯 +1 position (Bound Patron)';
        } else {
            bonusInfo = '⚠️ -1 position (not your Bound Patron)';
        }
    }

    showToastWithHTML(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;font-size:1rem;color:${outcomeColor};">${outcome}</span>
                <span style="font-size:0.75rem;color:var(--text3);">⚡ Pushed</span>
            </div>
            <div style="font-size:0.9rem;font-weight:500;">"${escHtml(riteName)}"</div>
            <div style="font-size:0.75rem;color:var(--text2);">${detail}</div>
            <div style="font-size:0.7rem;color:var(--text3);">${formatText(pushEffect)}</div>
            ${bonusInfo ? `<div style="font-size:0.7rem;color:var(--text2);">${bonusInfo}</div>` : ''}
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.75rem;">
                <span style="color:var(--orange);">💪 Fatigue +1</span>
                <span style="color:var(--purple);margin-left:0.5rem;">🎵 Corruption +1</span>
                <span style="color:var(--text3);margin-left:0.5rem;">(${char.fatigue}/${fatigueMax} Fatigue · ${char.corruption}/${char.corruptionMax || char.spirit || 1} Corruption)</span>
            </div>
            ${char.corruption >= (char.corruptionMax || char.spirit || 1) ? `<div style="color:var(--red);font-weight:600;font-size:0.8rem;">${char.boundPatron ? '🌸 The bloom is near! Perform a Resonant Rite to transform.' : '🌿 Corruption peaked – but without a bound patron, there is no bloom.'}</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `, success ? 'success' : 'warning');

    window.cantorRefresh();
};

// ─── Simulate Push ────────────────────────────────────────────

window.cantorSimulatePush = function() {
    const char = getCharacterData();
    if (!char) return;

    const isBound = !!(char.boundPatron || char.patron);

    // Base pool
    let basePool = (char.spirit || 1) + (char.performance || 0);
    // For simulation, we assume two scenarios: with bonus and with penalty (if bound)
    // We'll simulate both: singing bound patron's rite (with bonus) and singing a different patron's rite (with penalty).
    // If unbound, just use base pool.

    const pools = [];
    if (isBound) {
        pools.push({
            label: 'Bound Patron Rite',
            pool: basePool + (char.boundPatronBonus || 1),
            bonus: true
        });
        pools.push({
            label: 'Other Patron Rite',
            pool: basePool - 1,
            bonus: false
        });
    } else {
        pools.push({
            label: 'Any Rite',
            pool: basePool,
            bonus: null
        });
    }

    const resultsHtml = pools.map(p => {
        const results = [];
        for (let i = 0; i < 5; i++) {
            const roll = performRoll(p.pool, 4); // average DV 4
            results.push({
                successes: roll.successes,
                sb: roll.storyBeats || 0,
                success: roll.successes >= 4
            });
        }
        const successCount = results.filter(r => r.success).length;
        const avgSuccesses = results.reduce((acc, r) => acc + r.successes, 0) / results.length;
        return `
            <div style="background:var(--bg3);border-radius:var(--radius);padding:0.2rem 0.5rem;margin-top:0.2rem;">
                <div style="font-weight:600;font-size:0.8rem;${p.bonus === true ? 'color:var(--gold);' : p.bonus === false ? 'color:var(--red);' : ''}">${p.label}</div>
                <div style="font-size:0.75rem;">Pool: ${p.pool}d</div>
                <div style="font-size:0.75rem;">${results.map(r => r.success ? '✅' : '❌').join(' ')}</div>
                <div style="font-size:0.7rem;color:var(--text3);">${successCount}/5 succeed · Avg: ${avgSuccesses.toFixed(1)} successes</div>
            </div>
        `;
    }).join('');

    const html = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">⚡ Push Simulation</div>
            <div style="font-size:0.8rem;color:var(--text2);">Base pool: ${basePool}d (Spirit ${char.spirit || 1} + Performance ${char.performance || 0})</div>
            ${resultsHtml}
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.75rem;color:var(--text3);">
                <strong>On a Push:</strong> Fatigue +1, Corruption +1.
            </div>
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `;

    showToastWithHTML(html, 'info');
};

// ─── Resonant Rite Toggle ─────────────────────────────────────

window.cantorToggleResonantRite = function(riteName) {
    const char = getCharacterData();
    if (!char) return;

    if (!char.resonantRites) char.resonantRites = [];

    const index = char.resonantRites.indexOf(riteName);
    if (index >= 0) {
        char.resonantRites.splice(index, 1);
        saveCharacter({ resonantRites: char.resonantRites });
        showToast(`"${riteName}" unmarked as Resonant.`, 'info');
    } else {
        // Check if bound
        const isBound = !!(char.boundPatron || char.patron);
        const corruption = char.corruption || 0;
        const corruptionMax = char.corruptionMax || char.spirit || 1;
        const isFull = corruption >= corruptionMax;

        char.resonantRites.push(riteName);
        // Advance Corruption
        char.corruption = Math.min(corruption + 1, corruptionMax);
        saveCharacter({ resonantRites: char.resonantRites, corruption: char.corruption });

        if (isFull || char.corruption >= corruptionMax) {
            if (isBound) {
                // Bloom!
                const bloomCount = (char.bloomCount || 0) + 1;
                char.bloomCount = bloomCount;
                saveCharacter({ bloomCount: char.bloomCount });

                // Determine corruption table length from bound patron
                const state = getState();
                const boundPatronId = char.boundPatron || char.patron;
                const patronData = boundPatronId ? findPatronData(state, boundPatronId) : null;
                let corruptionTableLength = 0;
                if (patronData?.corruption?.length) {
                    corruptionTableLength = patronData.corruption.length;
                }
                const unlockedTier = Math.min(
                    (char.corruption || 0) > 0 ? Math.floor(char.corruption / 2) + 1 : 1,
                    corruptionTableLength || 1
                );

                showToastWithHTML(`
                    <div style="display:flex;flex-direction:column;gap:0.3rem;">
                        <div style="font-size:1.2rem;text-align:center;">🌸🌿🌸</div>
                        <div style="font-weight:600;font-size:1.1rem;color:var(--gold);text-align:center;">THE BLOOM</div>
                        <div style="font-size:0.9rem;color:var(--text2);text-align:center;">
                            "${escHtml(riteName)}" resonates through you.<br>
                            You have bloomed <strong>${bloomCount}</strong> time${bloomCount > 1 ? 's' : ''}.
                        </div>
                        <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.8rem;color:var(--text3);">
                            Corruption: ${char.corruption}/${corruptionMax} · Tier ${unlockedTier}/${corruptionTableLength || '?'}
                            ${bloomCount >= 7 ? '<br>✨ <strong>Fugal Self achieved!</strong> +1 die to all Performance rolls.' : ''}
                        </div>
                        <div style="font-size:0.65rem;color:var(--text3);font-style:italic;text-align:center;">
                            "The bloom is not an ending. It is a beginning."
                        </div>
                        <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
                    </div>
                `, 'success');
            } else {
                // Unbound: no bloom, just message
                showToastWithHTML(`
                    <div style="display:flex;flex-direction:column;gap:0.3rem;">
                        <div style="font-size:1.2rem;text-align:center;">🌿</div>
                        <div style="font-weight:600;font-size:1rem;color:var(--text3);text-align:center;">Corruption Peaked</div>
                        <div style="font-size:0.9rem;color:var(--text2);text-align:center;">
                            Your corruption is full, but without a bound patron, there is no bloom.
                            You remain unbound.
                        </div>
                        <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
                    </div>
                `, 'warning');
            }
        } else {
            showToast(`🔮 "${riteName}" marked as Resonant! Corruption +1.`, 'info');
        }
    }

    window.cantorRefresh();
};

// ─── Mark Resonant (helper) ──────────────────────────────────

window.cantorMarkResonant = function() {
    // This opens a prompt or just toggles? We'll keep the existing toggle per rite.
    showToast('Click the 🔮 button on a rite to mark it as Resonant.', 'info');
};

// ─── Advance Corruption ───────────────────────────────────────

window.cantorAdvanceCorruption = function(amount = 1) {
    const char = getCharacterData();
    if (!char) return;

    const corruption = char.corruption || 0;
    const corruptionMax = char.corruptionMax || char.spirit || 1;
    char.corruption = Math.max(0, Math.min(corruption + amount, corruptionMax));

    saveCharacter({ corruption: char.corruption });
    window.cantorRefresh();

    if (char.corruption >= corruptionMax) {
        if (char.boundPatron || char.patron) {
            showToast('🌸 Corruption is full! Perform a Resonant Rite to bloom.', 'warning');
        } else {
            showToast('🌿 Corruption is full – but you are unbound. No bloom.', 'warning');
        }
    } else {
        showToast(`Corruption: ${char.corruption}/${corruptionMax}`, 'info');
    }
};

// ─── Reset Corruption ─────────────────────────────────────────

window.cantorResetCorruption = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!confirm('Reset Corruption, Resonant Rites, and Bloom count?')) return;

    char.corruption = 0;
    char.resonantRites = [];
    char.bloomCount = 0;
    saveCharacter({ corruption: 0, resonantRites: [], bloomCount: 0 });
    showToast('Corruption reset.', 'info');
    window.cantorRefresh();
};

// ─── Toggle Talent ─────────────────────────────────────────────

window.cantorToggleTalent = function(talentId) {
    const char = getCharacterData();
    if (!char) return;

    if (!char.learnedTalents) char.learnedTalents = [];

    const index = char.learnedTalents.indexOf(talentId);
    if (index >= 0) {
        // Unlearn
        if (talentId === 'bound-patron') {
            // Clear bound patron
            char.boundPatron = null;
            // Optionally reset corruption? Not required.
            saveCharacter({ boundPatron: null });
        }
        char.learnedTalents.splice(index, 1);
        showToast(`Unlearned: ${talentId}`, 'info');
    } else {
        // Learn
        if (talentId === 'bound-patron') {
            // Prompt for patron selection
            const state = getState();
            const allPatrons = getAllPatrons(state);
            if (allPatrons.length === 0) {
                showToast('No patrons available. Please load patron data first.', 'error');
                return;
            }
            // Build a modal with a select dropdown
            const modalHtml = `
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                    <p style="font-weight:600;">Choose a patron to bind to:</p>
                    <select id="bound-patron-select" style="padding:0.3rem;border-radius:var(--radius);background:var(--bg2);color:var(--text);border:1px solid var(--border);">
                        ${allPatrons.map(p => `<option value="${p.id}">${p.icon || '🔮'} ${p.name || p.title}</option>`).join('')}
                    </select>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-primary" id="bound-patron-confirm">Bind</button>
                        <button class="btn btn-secondary" id="bound-patron-cancel">Cancel</button>
                    </div>
                </div>
            `;
            showToastWithHTML(modalHtml, 'info');
            // Attach events after modal is rendered
            setTimeout(() => {
                const confirmBtn = document.getElementById('bound-patron-confirm');
                const cancelBtn = document.getElementById('bound-patron-cancel');
                const select = document.getElementById('bound-patron-select');
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', () => {
                        const selected = select.value;
                        if (selected) {
                            char.boundPatron = selected;
                            char.boundPatronBonus = 1; // default bonus
                            if (!char.learnedTalents.includes(talentId)) {
                                char.learnedTalents.push(talentId);
                            }
                            saveCharacter({ boundPatron: selected, boundPatronBonus: 1, learnedTalents: char.learnedTalents });
                            showToast(`Bound to ${selected}`, 'success');
                            window.cantorRefresh();
                            // Close the toast
                            const toast = document.querySelector('.toast-container')?.lastElementChild;
                            if (toast) toast.remove();
                        }
                    });
                }
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => {
                        const toast = document.querySelector('.toast-container')?.lastElementChild;
                        if (toast) toast.remove();
                    });
                }
            }, 100);
            return; // Don't proceed with normal learning; it's handled above.
        } else {
            char.learnedTalents.push(talentId);
            showToast(`Learned: ${talentId} ✨`, 'success');
        }
    }

    saveCharacter({ learnedTalents: char.learnedTalents });
    window.cantorRefresh();
};

// ─── Refresh ──────────────────────────────────────────────────

window.cantorRefresh = function() {
    const el = document.querySelector('.cantor-container')?.parentElement || document.getElementById('spellcraft-content');
    if (el) {
        renderCantor(el);
    }
    showToast('🔄 Cantor refreshed.', 'info');
};

// ============================================================
// TOAST WITH HTML (shared)
// ============================================================

function showToastWithHTML(html, type = 'info') {
    if (typeof window.spellbookShowToastWithHTML === 'function') {
        window.spellbookShowToastWithHTML(html, type);
        return;
    }

    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.2rem; border-radius: var(--radius);
        max-width: 420px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 80vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.textContent = `
            @keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 12000);
}

// ============================================================
// EXPORT
// ============================================================

export default { renderCantor };