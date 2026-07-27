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
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml } from '../../../core/utils.js';
import { getState, saveState } from '../../../core/state.js';
import { showToast } from '../../../components/Toast.js';
import { performRoll } from '../../../core/dice.js';

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

// ─── Magic Paths Reference ─────────────────────────────────────
// Shown as a resource when no Cantor character is selected, so the panel
// is useful even before a character exists. Kept in sync manually with
// the richer MAGIC_PATHS object in features/characters/index.js — this is
// a small, self-contained copy rather than a cross-feature import, so a
// wrong relative path can never break this panel.
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

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

/**
 * Load patron data from state or fetch from /data/patrons/{patronId}.json
 * Caches the result in state.patrons (by category) and in a local cache.
 */
const patronCache = new Map();

async function loadPatronData(patronId) {
    if (!patronId) return null;

    if (patronCache.has(patronId)) {
        return patronCache.get(patronId);
    }

    const state = getState();

    let found = null;
    if (state.patrons) {
        if (state.patrons.cosmic) {
            found = state.patrons.cosmic.find(p => p.id === patronId);
        }
        if (!found && state.patrons.terrestrial) {
            found = state.patrons.terrestrial.find(p => p.id === patronId);
        }
        if (!found && state.patrons.religions) {
            for (const religion of state.patrons.religions) {
                if (religion.orders) {
                    found = religion.orders.find(o => o.id === patronId);
                    if (found) break;
                }
            }
        }
    }

    if (found) {
        patronCache.set(patronId, found);
        return found;
    }

    try {
        const response = await fetch(`./data/patrons/${patronId}.json`);
        if (response.ok) {
            const data = await response.json();
            if (!state.patrons) state.patrons = {};
            if (!state.patrons.cosmic) state.patrons.cosmic = [];
            if (!state.patrons.cosmic.find(p => p.id === patronId)) {
                state.patrons.cosmic.push(data);
            }
            patronCache.set(patronId, data);
            saveState();
            return data;
        } else {
            console.warn(`Patron data not found: ${patronId}`);
            patronCache.set(patronId, null);
            return null;
        }
    } catch (e) {
        console.warn(`Failed to fetch patron data for ${patronId}:`, e);
        patronCache.set(patronId, null);
        return null;
    }
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

    const patronData = await loadPatronData(patronId);
    if (!patronData) {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🎵</div>
                <p>Patron "<strong>${escHtml(patronId)}</strong>" not found.</p>
                <p style="font-size:0.85rem;">Make sure the patron's JSON file is loaded in <code>/data/patrons/${patronId}.json</code>.</p>
            </div>
        `;
        return;
    }

    const rites = patronData.rites || [];
    const corruption = patronData.corruption || [];
    const currentCorruption = char.corruption || 0;
    const corruptionMax = char.corruptionMax || char.spirit || 1;
    const corruptionPct = Math.min(100, (currentCorruption / corruptionMax) * 100);

    // Bloom tracking
    const bloomCount = char.bloomCount || 0;
    const hasFugalSelf = bloomCount >= 7;

    // Unlocked corruption tier (each 2 corruption = 1 tier, min 1)
    const unlockedTier = Math.min(corruption.length, Math.floor(currentCorruption / 2) + 1);
    const isCorruptionFull = currentCorruption >= corruptionMax;

    // Resonant Rites
    const resonantRites = char.resonantRites || [];

    // Learned talents
    const learnedTalents = char.learnedTalents || [];

    // Load talents from wiki
    const talents = await loadCantorTalents();

    // Build patron quote
    const patronQuote = patronData.lore?.quotes?.[0] || patronData.lore?.quote || 'Sing, and the Weave answers.';

    let html = `
        <div class="cantor-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="cantor-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🎵</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Cantor</span>
                        <span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">of ${escHtml(patronData.name || patronId)}</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-secondary" onclick="window.cantorRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Corruption Track ───────────────────────────── -->
            <div class="cantor-corruption-track" style="background:var(--bg2);border-radius:var(--radius);padding:0.4rem 0.6rem;border-left:4px solid var(--purple);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span style="font-size:0.85rem;font-weight:600;color:var(--purple);">🎵 Corruption</span>
                        <span style="font-size:0.8rem;font-weight:600;">${currentCorruption}/${corruptionMax}</span>
                        ${isCorruptionFull ? `<span style="font-size:0.7rem;color:var(--red);font-weight:600;">⚠️ FULL – BLOOM NEAR</span>` : ''}
                    </div>
                    <div style="display:flex;gap:0.2rem;align-items:center;">
                        <span style="font-size:0.65rem;color:var(--text3);">Tier ${unlockedTier}/${corruption.length}</span>
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorAdvanceCorruption(1)" title="Advance corruption">+</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorAdvanceCorruption(-1)" title="Reduce corruption">−</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.cantorSimulatePush()" style="color:var(--gold);font-size:0.6rem;" title="Simulate what happens when you Push a Song">⚡ Simulate Push</button>
                    </div>
                </div>
                <div style="width:100%;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-top:0.2rem;">
                    <div style="width:${corruptionPct}%;height:100%;background:${corruptionPct > 80 ? 'var(--red)' : 'var(--purple)'};border-radius:4px;transition:width 0.3s ease;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">
                    <span>${bloomCount} blooms</span>
                    <span>${hasFugalSelf ? '✨ Fugal Self: +1 die to Performance' : `${7 - bloomCount} blooms to Fugal Self`}</span>
                    <span>Resonant Rites: ${resonantRites.length}</span>
                </div>
            </div>

            <!-- ─── Corruption Table ───────────────────────────── -->
            ${corruption.length > 0 ? `
                <div class="cantor-corruption-table" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--purple);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                        <span style="font-size:0.8rem;font-weight:600;color:var(--purple);">⚠️ The Bloom: Corruption Tiers</span>
                        <span style="font-size:0.65rem;color:var(--text3);">Unlocked: ${unlockedTier} / ${corruption.length}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:220px;overflow-y:auto;font-size:0.75rem;">
                        ${corruption.map((c, idx) => {
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
            ` : ''}

            <!-- ─── Songs / Rites ──────────────────────────────── -->
            <div class="cantor-songs" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
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
                        ${bloomCount > 0 ? `You have bloomed ${bloomCount} time${bloomCount > 1 ? 's' : ''}.` : ''}
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
                        return `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);${isLearned ? 'background:var(--bg3);border-left:3px solid var(--gold);' : ''}">
                                <div style="flex:1;min-width:0;">
                                    <span style="font-weight:${isLearned ? '600' : '400'};color:${isLearned ? 'var(--gold)' : 'var(--text)'};">${escHtml(name)}</span>
                                    ${isLearned ? `<span style="font-size:0.55rem;color:var(--gold);margin-left:0.2rem;">✓ Learned</span>` : ''}
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
                        <span style="display:block;text-align:right;font-size:0.6rem;color:var(--text2);">— ${escHtml(patronData.name || patronId)}</span>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;font-size:0.6rem;color:var(--text3);border-top:1px solid var(--border);padding-top:0.15rem;">
                        <span>💡 <strong>Push It:</strong> Resolve a song instantly, but mark Fatigue + Corruption</span>
                        <span>🌸 <strong>Bloom:</strong> When Corruption is full, perform a Resonant Rite to transform</span>
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

        // Check if this rite has been marked as Resonant
        const resonantRites = char.resonantRites || [];
        const isResonant = resonantRites.includes(name);

        html += `
            <div class="rite-item" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:3px solid ${color};${isResonant ? 'border-right:3px solid var(--gold);' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                    <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                        <span style="font-weight:600;font-size:0.85rem;">${escHtml(name)}</span>
                        <span style="font-size:0.6rem;color:${color};">${escHtml(tier)}</span>
                        ${xp ? `<span style="font-size:0.6rem;color:var(--text3);">${xp} XP</span>` : ''}
                        ${isResonant ? `<span style="font-size:0.55rem;color:var(--gold);">🔮 Resonant</span>` : ''}
                    </div>
                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;">
                        ${cost ? `<span style="font-size:0.6rem;color:var(--text3);">${escHtml(cost)}</span>` : ''}
                        ${hasPush ? `
                            <button class="btn btn-xs btn-primary" onclick="window.cantorPushRite('${patronData.id}', ${idx}, '${escHtml(name)}')" title="Push It: Resolve instantly, mark Fatigue + Corruption">
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

    // Get patron data from cache or state
    const state = getState();
    const patronData = state.patrons?.cosmic?.find(p => p.id === patronId) ||
                       state.patrons?.terrestrial?.find(p => p.id === patronId);
    if (!patronData) {
        showToast('Patron not found. Please refresh.', 'error');
        return;
    }

    const rite = patronData.rites?.[riteIndex];
    if (!rite) {
        showToast('Rite not found.', 'error');
        return;
    }

    // Check Fatigue
    const fatigue = char.fatigue || 0;
    // FIX: the Fatigue track's actual size is Body (see trackers.js, which
    // implements the corrected Player's Guide rule). This used to multiply
    // by 3, which let Cantors Push far more times than the rules allow
    // before the track reads as "full".
    const fatigueMax = (char.body || 1);

    if (fatigue >= fatigueMax) {
        showToast('Cannot Push — Fatigue track is full!', 'error');
        return;
    }

    // Simulate the Push effect
    const pool = (char.spirit || 1) + (char.performance || 0);
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

    showToastWithHTML(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;font-size:1rem;color:${outcomeColor};">${outcome}</span>
                <span style="font-size:0.75rem;color:var(--text3);">⚡ Pushed</span>
            </div>
            <div style="font-size:0.9rem;font-weight:500;">"${escHtml(riteName)}"</div>
            <div style="font-size:0.75rem;color:var(--text2);">${detail}</div>
            <div style="font-size:0.7rem;color:var(--text3);">${formatText(pushEffect)}</div>
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.75rem;">
                <span style="color:var(--orange);">💪 Fatigue +1</span>
                <span style="color:var(--purple);margin-left:0.5rem;">🎵 Corruption +1</span>
                <span style="color:var(--text3);margin-left:0.5rem;">(${char.fatigue}/${fatigueMax} Fatigue · ${char.corruption}/${char.corruptionMax || char.spirit || 1} Corruption)</span>
            </div>
            ${char.corruption >= (char.corruptionMax || char.spirit || 1) ? '<div style="color:var(--red);font-weight:600;font-size:0.8rem;">🌸 The bloom is near! Perform a Resonant Rite to transform.</div>' : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest(\'div\').parentElement.remove()">Close</button>
        </div>
    `, success ? 'success' : 'warning');

    window.cantorRefresh();
};

// ─── Simulate Push ────────────────────────────────────────────

window.cantorSimulatePush = function() {
    const char = getCharacterData();
    if (!char) return;

    const pool = (char.spirit || 1) + (char.performance || 0);
    const dv = 4; // Average DV

    const results = [];
    for (let i = 0; i < 5; i++) {
        const roll = performRoll(pool, dv);
        results.push({
            successes: roll.successes,
            sb: roll.storyBeats || 0,
            success: roll.successes >= dv
        });
    }

    const successCount = results.filter(r => r.success).length;
    const avgSuccesses = results.reduce((acc, r) => acc + r.successes, 0) / results.length;

    const html = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">⚡ Push Simulation</div>
            <div style="font-size:0.8rem;color:var(--text2);">Pool: ${pool}d (Spirit ${char.spirit || 1} + Performance ${char.performance || 0})</div>
            <div style="display:flex;gap:0.5rem;font-size:0.8rem;">
                <span>🎲 ${results.map(r => r.success ? '✅' : '❌').join(' ')}</span>
                <span style="color:var(--text3);">${successCount}/5 succeed</span>
                <span style="color:var(--text3);">Avg: ${avgSuccesses.toFixed(1)} successes</span>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.75rem;color:var(--text3);">
                <strong>On a Push:</strong> Fatigue +1, Corruption +1.
                ${avgSuccesses >= 3 ? '✨ Good odds!' : avgSuccesses >= 2 ? '⚠️ Risky.' : '💀 Very risky!'}
            </div>
            <div style="font-size:0.65rem;color:var(--text3);font-style:italic;">
                ${avgSuccesses >= 3 ? '"The Weave welcomes the bold."' : '"The Weave respects caution."'}
            </div>
            <button class="btn btn-xs btn-secondary" onclick="this.closest(\'div\').parentElement.remove()">Close</button>
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
        // Check if corruption is full – if so, this triggers the bloom
        const corruption = char.corruption || 0;
        const corruptionMax = char.corruptionMax || char.spirit || 1;
        const isFull = corruption >= corruptionMax;

        char.resonantRites.push(riteName);
        // Advance Corruption
        char.corruption = Math.min(corruption + 1, corruptionMax);
        saveCharacter({ resonantRites: char.resonantRites, corruption: char.corruption });

        if (isFull || char.corruption >= corruptionMax) {
            // Bloom!
            const bloomCount = (char.bloomCount || 0) + 1;
            char.bloomCount = bloomCount;
            saveCharacter({ bloomCount: char.bloomCount });

            // FIX: this used to fall back to a hardcoded "6" tiers whenever
            // char._corruptionTableLength wasn't set — and nothing in the
            // codebase ever sets that property, so the fallback always
            // fired. The Bloom toast could report a tier number higher
            // than the patron's actual corruption table (e.g. "Tier 4/6"
            // for a patron that only defines 3 tiers). We now look up the
            // real patron and use the length of its own corruption array,
            // exactly like the main render does.
            let corruptionTableLength = 6;
            if (char.patron) {
                const state = getState();
                const patronData =
                    state.patrons?.cosmic?.find(p => p.id === char.patron) ||
                    state.patrons?.terrestrial?.find(p => p.id === char.patron);
                if (patronData?.corruption?.length) {
                    corruptionTableLength = patronData.corruption.length;
                }
            }
            const unlockedTier = Math.min(
                (char.corruption || 0) > 0 ? Math.floor(char.corruption / 2) + 1 : 1,
                corruptionTableLength
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
                        Corruption: ${char.corruption}/${corruptionMax} · Tier ${unlockedTier}/${corruptionTableLength}
                        ${bloomCount >= 7 ? '<br>✨ <strong>Fugal Self achieved!</strong> +1 die to all Performance rolls.' : ''}
                    </div>
                    <div style="font-size:0.65rem;color:var(--text3);font-style:italic;text-align:center;">
                        "The bloom is not an ending. It is a beginning."
                    </div>
                    <button class="btn btn-xs btn-secondary" onclick="this.closest(\'div\').parentElement.remove()">Close</button>
                </div>
            `, 'success');
        } else {
            showToast(`🔮 "${riteName}" marked as Resonant! Corruption +1.`, 'info');
        }
    }

    window.cantorRefresh();
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
        showToast('🌸 Corruption is full! Perform a Resonant Rite to bloom.', 'warning');
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
        char.learnedTalents.splice(index, 1);
        showToast(`Unlearned: ${talentId}`, 'info');
    } else {
        char.learnedTalents.push(talentId);
        showToast(`Learned: ${talentId} ✨`, 'success');
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
