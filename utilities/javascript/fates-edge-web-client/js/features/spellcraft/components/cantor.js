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
 * - High Cantor talent grants access to Standard rites as well
 *
 * ────────────────────────────────────────────────────────────────────────
 * RULES FIX (this pass) — Songs must be learned, not free access:
 * Player's Guide §9.7 walks a Runekeeper through buying two starting Low
 * Rites individually with XP ("Road-Sense (Low, 4 XP)"), and every Rite in
 * every patron's catalog throughout the book carries its own XP cost.
 * §3.3's player-managed-modules table lists "Repertoire" as a Cantor
 * progression timer alongside Corruption — i.e. Cantors track a growing,
 * individually-learned set of Songs, not blanket access to a patron's
 * whole Low (or Low+Standard) catalog the moment they take Cantor's Path.
 * This file used to show every Low/Standard rite from the bound (or all)
 * patron(s) as immediately usable. It now checks each Song against
 * `char.repertoire` (a plain array of learned Song names — the same field
 * name already used elsewhere in the character schema) and only allows
 * Push/Resonant marking on Songs actually in that list. Unknown Songs
 * still display in full (so you can browse and decide what's worth
 * learning) with a "📖 Learn (X XP)" button that spends the Song's own
 * listed `xp` cost via the new cantorLearnSong().
 * ────────────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────────────
 * NEW: VTT integration — Push and Bloom events now send formatted cards
 * to the VTT via window.sendToVTT.
 * ────────────────────────────────────────────────────────────────────────
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, safeParseInt } from '../../../core/utils.js';
import { getState, saveState } from '../../../core/state.js';
import { showToast } from '../../../components/Toast.js';
import { performRoll } from '../../../core/dice.js';
import patrons from '../../patrons/index.js';
const { loadPatronData, getPatronObligation, savePatronData } = patrons;

// ============================================================
// HELPERS (same as rites.js for consistency)
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

// ─── Tier helpers (standardized) ─────────────────────────────
// NOTE: 'Basic'/'Advanced'/'Master'/'Epic' are kept here as a safety net for
// any legacy-format rite data that might still be floating around in an old
// cached state blob. Current-generation patron files use Low/Standard/High.

function getTierColor(tier) {
    const colors = {
        'Cantrip': 'var(--text3)',
        'Basic': '#6baa7a',
        'Low': '#6baa7a',
        'Standard': '#d4af37',
        'Advanced': '#c47a7a',
        'Master': '#b84a8a',
        'Epic': '#d94a4a',
        'High': '#8e44ad'
    };
    return colors[tier] || 'var(--text2)';
}

function getTierBadge(tier) {
    const badges = {
        'Cantrip': '🎵',
        'Basic': '🟢',
        'Low': '🟢',
        'Standard': '🟡',
        'Advanced': '🟠',
        'Master': '🔴',
        'Epic': '🟣',
        'High': '👑'
    };
    return badges[tier] || '📜';
}

function getTierIcon(tier) {
    const icons = {
        'Low': '🌿',
        'Standard': '⚜️',
        'High': '👑'
    };
    return icons[tier] || '📜';
}

function sortRites(a, b) {
    const tiers = {
        'Cantrip': 0,
        'Basic': 1,
        'Low': 1,
        'Standard': 2,
        'Advanced': 3,
        'Master': 4,
        'Epic': 5,
        'High': 6
    };
    const tierA = tiers[a.tier] ?? 99;
    const tierB = tiers[b.tier] ?? 99;
    if (tierA !== tierB) return tierA - tierB;
    return (a.name || '').localeCompare(b.name || '');
}

// ─── Patron lookup (same as rites.js) ────────────────────────

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
// VTT HELPERS (NEW)
// ============================================================

function sendVTTMessage(html) {
    if (typeof window.sendToVTT === 'function') {
        window.sendToVTT(html, 'System', { isHTML: true });
    } else {
        console.warn('[Cantor] VTT not available — message not sent.');
    }
}

function buildSongCardHtml(songName, patronName, patronIcon, effect, costDetails, extraNote = '') {
    return `
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-left:4px solid var(--gold);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1.2rem;">${escHtml(patronIcon || '🎵')}</span>
                    <span style="font-weight:700;font-size:1.05rem;color:var(--gold);">${escHtml(songName)}</span>
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${escHtml(patronName || 'Cantor')}</span>
            </div>
            ${effect ? `<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${formatText(effect)}</div>` : ''}
            ${costDetails ? `<div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;">${formatText(costDetails)}</div>` : ''}
            ${extraNote ? `<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">${formatText(extraNote)}</div>` : ''}
        </div>
    `;
}

function buildBloomCardHtml(patronName, patronIcon, bloomCount, tierUnlocked, corruptionMax, effect = '') {
    return `
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--gold);
            border-left:4px solid var(--gold);
            box-shadow: 0 2px 12px rgba(212,175,55,0.3);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="text-align:center;font-size:1.5rem;">🌸🌿🌸</div>
            <div style="text-align:center;font-weight:700;font-size:1.2rem;color:var(--gold);">THE BLOOM</div>
            <div style="text-align:center;font-size:0.9rem;color:var(--text2);">
                ${patronName ? `A song of <strong>${escHtml(patronName)}</strong> resonates through you.` : 'The Weave answers your voice.'}
            </div>
            ${effect ? `<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${formatText(effect)}</div>` : ''}
            <div style="margin-top:0.2rem;font-size:0.75rem;color:var(--text3);border-top:1px solid var(--border);padding-top:0.15rem;">
                🌸 Bloom #${bloomCount} · Corruption: 0/${corruptionMax} · Tier ${tierUnlocked}
            </div>
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

// NOTE ON THIS FALLBACK LIST: this is only shown if wiki.json fails to load.
// Descriptions below have been checked against the Player's Guide and the
// Grey Wanderer's Grimoire and corrected/annotated where they omitted a real
// mechanical cost or prerequisite. 'Bound Patron' does not appear in any of
// the three rulebooks — it's a homebrew addition, tagged as such below so it
// isn't mistaken for an official talent if a player only ever sees this list.
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
            body: 'Once per session, treat a significant Performance roll as one degree better (Miss→Partial, etc.). Once per arc, inspire a community; allies gain +1 die to a single goal for one session. Requires: Performance 4+, Presence 4+, Captivating Performance, Tier III.',
            tags: ['talent', 'magic', 'cantor', 'prestige'],
            cost: 10
        },
        {
            id: 'embraced-corruption',
            title: 'Embraced Corruption',
            category: 'magic',
            body: 'Prerequisite: Cantor\'s Path, Tier II+. You have learned to treat the bloom not as disease but as evolution. When you voluntarily fill your Corruption Timer through Resonant Rites, choose your corruption trait. You may Push Songs without marking Fatigue once per session. After filling your Corruption Timer seven times, develop the Fugal Self: +1 die to all Performance rolls. However, each morning you must test Spirit + Resolve (DV 3) or your Corruption controls your body for the first scene of the day.',
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
            body: 'Learn Cradle Song (Low: lull a single target, Resist DV 3, costs 1 Fatigue) and Lockpick\'s Refrain (Standard: unlock one mundane or warded lock, costs 1 Obligation). Requires: Performance 2+, Presence 2+, Patron: Ikasha.',
            tags: ['talent', 'magic', 'cantor', 'prestige'],
            cost: 7
        },
        {
            id: 'desperate-cadence',
            title: "Desperate Cadence (Malachai's False Note)",
            category: 'magic',
            body: 'Learn The Lucky Pick (Low: reroll a failed Stealth or Subterfuge roll, costs 1 Fatigue and 1 Corruption) and Blood Price (Standard: curse a rival, they suffer -1 die on next heist, costs 2 Fatigue and marks a Reckoning Timer). Requires: Performance 2+, Patron: Malachai.',
            tags: ['talent', 'magic', 'cantor', 'prestige'],
            cost: 7
        },
        {
            id: 'velvet-hook',
            title: "Velvet Hook (Livaea's Whisper)",
            category: 'magic',
            body: 'Learn Golden Tongue (Low: +2 dice to Sway for one social exchange, costs 1 Fatigue) and The Unrefusable Offer (Standard: sing a bargain, target must accept or suffer -2 dice until they do, costs 2 Obligation). Requires: Performance 2+, Presence 2+, Patron: Livaea.',
            tags: ['talent', 'magic', 'cantor', 'prestige'],
            cost: 7
        },
        {
            id: 'bound-patron',
            title: 'Bound Patron (Homebrew)',
            category: 'magic',
            body: 'Homebrew — not found in the core rulebooks. Choose one patron. You gain +1 position when singing that patron’s rites, but suffer -1 position when singing any other patron’s rites. Your Corruption is bound to that patron’s bloom table.',
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

    // Determine if High Cantor
    const learnedTalents = char.learnedTalents || [];
    const isHighCantor = learnedTalents.includes('high-cantor');

    // Determine bound patron
    const boundPatronId = char.boundPatron || char.patron || null;
    const boundPatronData = boundPatronId ? findPatronData(state, boundPatronId) : null;
    const isBound = !!boundPatronData;

    // ─── Collect rites with case‑insensitive tier matching ────
    const allowedTiersSet = new Set(['low']);
    if (isHighCantor) allowedTiersSet.add('standard');

    function isTierAllowed(tier) {
        if (!tier) return true; // treat missing tier as Low (allowed)
        const lowerTier = tier.toLowerCase().trim();
        return allowedTiersSet.has(lowerTier);
    }

    let rites = [];

    if (isBound) {
        if (boundPatronData.rites && Array.isArray(boundPatronData.rites)) {
            rites = boundPatronData.rites
                .filter(r => isTierAllowed(r.tier))
                .map(r => ({
                    ...r,
                    patronId: boundPatronId,
                    patronName: boundPatronData.name || boundPatronData.title,
                    patronIcon: boundPatronData.icon,
                    patronColor: boundPatronData.color || 'var(--gold)',
                }));
        }
        console.log(`[Cantor] Bound to ${boundPatronData.name || boundPatronId}, found ${rites.length} rites`);
    } else {
        const allPatrons = getAllPatrons(state);
        console.log(`[Cantor] All patrons loaded: ${allPatrons.length}`);

        const patronsWithRites = allPatrons.filter(p => p.rites && p.rites.length > 0);
        console.log(`[Cantor] Patrons with rites: ${patronsWithRites.length}`,
            patronsWithRites.map(p => `${p.name || p.id}: ${p.rites.length} rites (${p.rites.filter(r => isTierAllowed(r.tier)).length} allowed)`)
        );

        for (const p of allPatrons) {
            if (p.rites && Array.isArray(p.rites)) {
                const filtered = p.rites.filter(r => isTierAllowed(r.tier));
                for (const r of filtered) {
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
        console.log(`[Cantor] Unbound: found ${rites.length} total rites`);
    }

    // Debug: show tiers found
    const tierCounts = {};
    rites.forEach(r => {
        const tier = r.tier || 'Unknown';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });
    console.log('[Cantor] Rites by tier:', tierCounts);

    // ─── Sort rites ────────────────────────────────────────────
    rites.sort(sortRites);

    // ─── Corruption data ────────────────────────────────────────
    const corruptionTable = isBound ? (boundPatronData.corruption || []) : [];
    const currentCorruption = char.corruption || 0;
    const corruptionMax = char.corruptionMax || char.spirit || 1;
    const corruptionPct = Math.min(100, (currentCorruption / corruptionMax) * 100);
    const bloomCount = char.bloomCount || 0;
    const hasFugalSelf = bloomCount >= 7;
    const fugalSelfControlLost = !!char.fugalSelfControlLost;
    const unlockedTier = isBound ? Math.min(corruptionTable.length, Math.floor(currentCorruption / 2) + 1) : 0;
    const isCorruptionFull = currentCorruption >= corruptionMax;
    const resonantRites = char.resonantRites || [];
    const talents = await loadCantorTalents();

    const patronQuote = isBound
        ? (boundPatronData.lore?.quotes?.[0] || boundPatronData.lore?.quote || 'Sing, and the Weave answers.')
        : 'The Weave speaks through all voices.';

    const tierLabel = isHighCantor ? 'Low + Standard' : 'Low';

    // ─── Build HTML ────────────────────────────────────────────
    let html = `
        <div class="cantor-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="cantor-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🎵</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Cantor</span>
                        ${isBound ? `<span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">of ${escHtml(boundPatronData.name || boundPatronId)}</span>` : `<span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">of the Weave (unbound)</span>`}
                        ${isHighCantor ? `<span style="font-size:0.65rem;color:var(--gold);margin-left:0.2rem;">✨ High Cantor</span>` : ''}
                        ${isBound ? `<span style="font-size:0.65rem;color:var(--text2);margin-left:0.2rem;">🎯 +1/-1 position</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-secondary" onclick="window.cantorRefresh()" title="Reloads patron data from disk, bypassing any cached copy">🔄 Refresh</button>
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
                        <button class="btn btn-xs btn-ghost" onclick="window.cantorSimulatePush()" style="color:var(--gold);font-size:0.6rem;" title="Preview odds for a normal (un-Pushed) Performance roll">⚡ Simulate Roll</button>
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
                ${hasFugalSelf ? `
                    <div style="margin-top:0.3rem;padding-top:0.3rem;border-top:1px dashed var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                        <span style="font-size:0.65rem;color:${fugalSelfControlLost ? 'var(--red)' : 'var(--text3)'};" title="Grimoire §7.6.4: each morning, test Spirit + Resolve (DV 3) or Corruption controls your body for the first scene of the day.">
                            🌅 Morning Control: ${fugalSelfControlLost ? '⚠️ Corruption is in control this scene' : '✅ You are in control'}
                        </span>
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorToggleFugalControl()" title="Log the result of today's Spirit + Resolve (DV 3) test">
                            Log Morning Test
                        </button>
                    </div>
                ` : ''}
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
                    <span style="font-size:0.6rem;color:var(--text3);">${rites.length} songs${isBound ? '' : ` (${tierLabel})`}${isHighCantor ? ' · ✨ Standard included' : ''}</span>
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
                        const isLearned = learnedTalents.includes(t.id || name);
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
                        <span>💡 <strong>Push It:</strong> Resolves instantly, no roll — mark Fatigue + Corruption, GM gains 1 SB</span>
                        ${isBound ? `<span>🌸 <strong>Bloom:</strong> When Corruption is full, perform a Resonant Rite to transform</span>` : `<span>🌿 <strong>Unbound:</strong> No bloom – corruption is unfocused</span>`}
                        <span>🎵 <strong>Voice:</strong> Your larynx is older than any tree</span>
                        ${isHighCantor ? `<span>✨ <strong>High Cantor:</strong> Can sing Standard Rites</span>` : ''}
                        ${hasFugalSelf ? `<span>🌅 <strong>Fugal Self:</strong> +1 die to Performance, but test Spirit+Resolve (DV 3) each morning</span>` : ''}
                    </div>
                </div>
            </div>

        </div>
    `;

    el.innerHTML = html;

    // Render the rites grouped by patron with expandable sections
    const ritesContainer = document.getElementById('cantor-rites-container');
    if (ritesContainer) {
        renderCantorRitesGrouped(ritesContainer, rites, char);
    }
}

// ============================================================
// CANTOR RITES RENDER (grouped by patron, expandable)
// ============================================================

function renderCantorRitesGrouped(container, rites, char) {
    if (rites.length === 0) {
        container.innerHTML = `<div style="font-size:0.8rem;color:var(--text3);text-align:center;">${char.boundPatron ? 'No songs found for this patron.' : 'No available rites found across all patrons.'}</div>`;
        return;
    }

    // Build cache for Push lookups
    window._cantorRiteCache = new Map();

    // ── Group rites by patron ──
    const groups = new Map();
    rites.forEach(rite => {
        const patronId = rite.patronId || 'unbound';
        if (!groups.has(patronId)) {
            groups.set(patronId, {
                id: patronId,
                name: rite.patronName || 'Unbound',
                icon: rite.patronIcon || '🌌',
                color: rite.patronColor || 'var(--text3)',
                rites: []
            });
        }
        groups.get(patronId).rites.push(rite);
        // store in cache for Push
        window._cantorRiteCache.set(rite.name, rite);
    });

    let html = '';
    for (const [patronId, group] of groups) {
        const isUnbound = patronId === 'unbound';
        const groupName = isUnbound ? '🌌 Unbound (all patrons)' : `${group.icon} ${group.name}`;
        const riteCount = group.rites.length;

        html += `
            <details class="patron-group" style="background:var(--bg3);border-radius:var(--radius);padding:0.2rem 0.4rem;border-left:4px solid ${group.color};">
                <summary style="cursor:pointer;font-weight:600;font-size:0.85rem;color:var(--text);display:flex;justify-content:space-between;align-items:center;padding:0.2rem 0;">
                    <span>${groupName}</span>
                    <span style="font-size:0.7rem;color:var(--text3);font-weight:400;">${riteCount} rite${riteCount > 1 ? 's' : ''}</span>
                </summary>
                <div style="display:flex;flex-direction:column;gap:0.3rem;margin-top:0.3rem;padding-left:0.3rem;">
                    ${group.rites.map(rite => renderRiteItem(rite, char)).join('')}
                </div>
            </details>
        `;
    }

    container.innerHTML = html;
}

// ── Helper to render a single rite item ──
function renderRiteItem(rite, char) {
    const name = safeString(rite.name);
    const tier = safeString(rite.tier || 'Basic');
    const xp = rite.xp || rite.cost;
    const xpCost = safeParseInt(rite.xp, 0);
    const effect = safeString(rite.effect || rite.description);
    const pushIt = safeString(rite.push_it);
    const hasPush = pushIt && pushIt.length > 0;
    const cost = safeString(rite.cost || '');
    const color = getTierColor(tier);
    const icon = getTierIcon(tier);
    const patronName = rite.patronName ? safeString(rite.patronName) : null;
    const patronIcon = rite.patronIcon ? safeString(rite.patronIcon) : null;
    const resonantRites = char.resonantRites || [];
    const isResonant = resonantRites.includes(name);

    // RULES FIX (see file header note): only Songs in char.repertoire are
    // actually known — Push and Resonant marking both require it.
    const repertoire = char.repertoire || [];
    const isKnown = repertoire.includes(name);

    return `
        <div class="rite-item" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:3px solid ${color};${isResonant ? 'border-right:3px solid var(--gold);' : ''}${isKnown ? '' : 'opacity:0.75;'}">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    ${patronIcon ? `<span style="font-size:1rem;">${patronIcon}</span>` : ''}
                    <span style="font-weight:600;font-size:0.85rem;">${escHtml(name)}</span>
                    ${patronName ? `<span style="font-size:0.6rem;color:var(--text3);">(${escHtml(patronName)})</span>` : ''}
                    <span style="font-size:0.6rem;color:${color};font-weight:500;">${icon} ${escHtml(tier)}</span>
                    ${xp ? `<span style="font-size:0.6rem;color:var(--text3);">${xp} XP</span>` : ''}
                    ${isKnown
                        ? `<span style="font-size:0.55rem;color:var(--green);">✓ In Repertoire</span>`
                        : `<span style="font-size:0.55rem;color:var(--text3);">📖 Not yet learned</span>`}
                    ${isResonant ? `<span style="font-size:0.55rem;color:var(--gold);">🔮 Resonant</span>` : ''}
                </div>
                <div style="display:flex;gap:0.2rem;flex-wrap:wrap;">
                    ${cost ? `<span style="font-size:0.6rem;color:var(--text3);">${escHtml(cost)}</span>` : ''}
                    ${isKnown ? `
                        ${hasPush ? `
                            <button class="btn btn-xs btn-primary push-btn" data-rite-name="${escHtml(name)}" onclick="window.cantorPushRite('${escHtml(name)}', this)" title="Push It: resolves instantly with no roll. Mark Fatigue + Corruption; the GM gains 1 SB.">
                                ⚡ Push
                            </button>
                        ` : ''}
                        <button class="btn btn-xs ${isResonant ? 'btn-secondary' : 'btn-ghost'}" 
                                onclick="window.cantorToggleResonantRite('${escHtml(name)}')" 
                                style="${isResonant ? '' : 'color:var(--text3);'}"
                                title="${isResonant ? 'Unmark as Resonant' : 'Mark as Resonant Rite (advances Corruption)'}">
                            ${isResonant ? '🔮✕' : '🔮'}
                        </button>
                    ` : `
                        <button class="btn btn-xs btn-gold" onclick="window.cantorLearnSong('${escHtml(name)}', ${xpCost})" title="Add this Song to your Repertoire for ${xpCost} XP">
                            📖 Learn (${xpCost} XP)
                        </button>
                    `}
                </div>
            </div>
            ${effect ? `<div style="font-size:0.75rem;color:var(--text2);margin-top:0.1rem;line-height:1.3;">${formatText(effect)}</div>` : ''}
            ${hasPush && isKnown ? `<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">⚡ Push: ${formatText(pushIt)}</div>` : ''}
        </div>
    `;
}

// ============================================================
// GLOBAL FUNCTIONS (onclick handlers)
// ============================================================

// ─── Push Rite ────────────────────────────────────────────────
//
// RULES FIX (Player's Guide §4.2.4): "Push It — Resolve immediately. Mark
// Fatigue 1, mark toward Corruption accumulation, and the GM gains 1 SB
// (social/Patron fallout)." Pushing a Song is a way to SKIP the roll and
// guarantee the effect, at the cost of Fatigue/Corruption/a GM story beat.
// This used to still call performRoll() and could report a Failure, which
// defeated the entire purpose of paying to Push — a Pushed song can no
// longer fail here. There is no roll, so bound/unbound position modifiers
// (which only ever applied to a roll) no longer apply to a Push.

// ─── Learn Song (add to Repertoire) ────────────────────────────
//
// RULES FIX (see file header note): Songs must be individually learned —
// this spends the Song's own listed XP cost and adds it to
// char.repertoire, the same field name already present on the character
// schema (see editor.js/wizard.js).

window.cantorLearnSong = function(riteName, xpCost) {
    const char = getCharacterData();
    if (!char) return;

    if (!char.repertoire) char.repertoire = [];
    if (char.repertoire.includes(riteName)) {
        showToast(`"${riteName}" is already in your Repertoire.`, 'info');
        return;
    }

    const totalXp = char.totalXp || 0;
    const spent = char.xpSpent || 0;
    const available = totalXp - spent;

    if (xpCost > 0 && available < xpCost) {
        showToast(`Not enough XP. Need ${xpCost}, have ${available} available.`, 'error');
        return;
    }

    if (!confirm(`Add "${riteName}" to your Repertoire for ${xpCost} XP?`)) return;

    char.repertoire.push(riteName);
    char.xpSpent = spent + xpCost;
    saveCharacter({ repertoire: char.repertoire, xpSpent: char.xpSpent });
    showToast(`🎶 "${riteName}" added to your Repertoire (${xpCost} XP spent).`, 'success');
    window.cantorRefresh();
};

window.cantorPushRite = function(riteName, buttonElement) {
    const char = getCharacterData();
    if (!char) return;

    const rite = window._cantorRiteCache?.get(riteName);
    if (!rite) {
        showToast('Rite not found. Please refresh.', 'error');
        return;
    }

    // RULES FIX: only Songs in the Repertoire can be sung at all.
    if (!(char.repertoire || []).includes(riteName)) {
        showToast(`You haven't learned "${riteName}" yet — add it to your Repertoire first.`, 'error');
        return;
    }

    const fatigue = char.fatigue || 0;
    const fatigueMax = (char.body || 1);

    if (fatigue >= fatigueMax) {
        showToast('Cannot Push — Fatigue track is full!', 'error');
        return;
    }

    const fatigueCost = 1;
    const corruptionCost = 1;

    char.fatigue = fatigue + fatigueCost;
    char.corruption = Math.min((char.corruption || 0) + corruptionCost, char.corruptionMax || char.spirit || 1);

    saveCharacter({ fatigue: char.fatigue, corruption: char.corruption });

    const pushEffect = rite.push_it || rite.effect || 'The song resolves instantly, exactly as sung.';

    // ─── Send VTT card ──────────────────────────────────────────
    const patronName = rite.patronName || char.boundPatron || 'Cantor';
    const patronIcon = rite.patronIcon || '🎵';
    const costDetails = `Fatigue +1 · Corruption +1 · GM gains 1 SB (now ${char.fatigue}/${fatigueMax} Fatigue, ${char.corruption}/${char.corruptionMax || char.spirit || 1} Corruption)`;
    const extraNote = '⚡ Pushed — no roll required, instant success.';
    const cardHtml = buildSongCardHtml(riteName, patronName, patronIcon, pushEffect, costDetails, extraNote);
    sendVTTMessage(cardHtml);

    showToastWithHTML(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;font-size:1rem;color:var(--gold);">⚡ Pushed — Resolves Instantly</span>
            </div>
            <div style="font-size:0.9rem;font-weight:500;">"${escHtml(riteName)}"</div>
            <div style="font-size:0.75rem;color:var(--text2);">No roll — the song simply succeeds.</div>
            <div style="font-size:0.7rem;color:var(--text3);">${formatText(pushEffect)}</div>
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.75rem;">
                <span style="color:var(--orange);">💪 Fatigue +1</span>
                <span style="color:var(--purple);margin-left:0.5rem;">🎵 Corruption +1</span>
                <span style="color:var(--red);margin-left:0.5rem;">🎭 GM gains 1 SB</span>
                <span style="color:var(--text3);margin-left:0.5rem;">(${char.fatigue}/${fatigueMax} Fatigue · ${char.corruption}/${char.corruptionMax || char.spirit || 1} Corruption)</span>
            </div>
            ${char.corruption >= (char.corruptionMax || char.spirit || 1) ? `<div style="color:var(--red);font-weight:600;font-size:0.8rem;">${char.boundPatron ? '🌸 The bloom is near! Perform a Resonant Rite to transform.' : '🌿 Corruption peaked – but without a bound patron, there is no bloom.'}</div>` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `, 'success');

    window.cantorRefresh();
};

// ─── Simulate Roll ────────────────────────────────────────────
// NOTE: this previews a NORMAL (un-Pushed) Performance test, since Pushing
// no longer involves a roll at all (see cantorPushRite above) — there's
// nothing left to simulate about a Push itself, just the roll you'd be
// skipping if you chose to Push instead.

window.cantorSimulatePush = function() {
    const char = getCharacterData();
    if (!char) return;

    const isBound = !!(char.boundPatron || char.patron);

    let basePool = (char.spirit || 1) + (char.performance || 0);
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
            const roll = performRoll(p.pool, 4);
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
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">⚡ Normal Roll Simulation</div>
            <div style="font-size:0.8rem;color:var(--text2);">Base pool: ${basePool}d (Spirit ${char.spirit || 1} + Performance ${char.performance || 0})</div>
            ${resultsHtml}
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.75rem;color:var(--text3);">
                <strong>Reminder:</strong> Pushing a Song skips this roll entirely and guarantees success, for Fatigue +1, Corruption +1, and the GM gaining 1 SB.
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
        const isBound = !!(char.boundPatron || char.patron);
        const corruption = char.corruption || 0;
        const corruptionMax = char.corruptionMax || char.spirit || 1;
        const isFull = corruption >= corruptionMax;

        char.resonantRites.push(riteName);
        char.corruption = Math.min(corruption + 1, corruptionMax);
        saveCharacter({ resonantRites: char.resonantRites, corruption: char.corruption });

        if (isFull || char.corruption >= corruptionMax) {
            if (isBound) {
                const bloomCount = (char.bloomCount || 0) + 1;
                char.bloomCount = bloomCount;
                saveCharacter({ bloomCount: char.bloomCount });

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

                // ─── Send VTT bloom card ──────────────────────────
                const patronName = patronData?.name || boundPatronId || 'Unknown';
                const patronIcon = patronData?.icon || '🌸';
                const effect = patronData?.corruption?.[unlockedTier - 1]?.benefit || 'The bloom transforms you.';
                const bloomCard = buildBloomCardHtml(patronName, patronIcon, bloomCount, unlockedTier, corruptionMax, effect);
                sendVTTMessage(bloomCard);

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
                            ${bloomCount >= 7 ? '<br>✨ <strong>Fugal Self achieved!</strong> +1 die to all Performance rolls — but each morning, test Spirit + Resolve (DV 3) or Corruption controls your body for the first scene.' : ''}
                        </div>
                        <div style="font-size:0.65rem;color:var(--text3);font-style:italic;text-align:center;">
                            "The bloom is not an ending. It is a beginning."
                        </div>
                        <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
                    </div>
                `, 'success');
            } else {
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

// ─── Fugal Self: Morning Control Test ──────────────────────────
//
// Grimoire §7.6.4: once you've bloomed 7 times, you develop the Fugal Self
// (+1 die to Performance), but each morning you must test Spirit + Resolve
// (DV 3) or Corruption controls your body for the first scene of the day.
// "Resolve" isn't currently tracked as its own stat/skill on the character
// sheet here, so rather than guess at an undocumented formula, this is a
// manual log: roll it however your table already resolves Resolve tests,
// then record the outcome here so it's visible on the sheet.

window.cantorToggleFugalControl = function() {
    const char = getCharacterData();
    if (!char) return;

    if ((char.bloomCount || 0) < 7) {
        showToast('Fugal Self only applies once you have bloomed 7 times.', 'info');
        return;
    }

    char.fugalSelfControlLost = !char.fugalSelfControlLost;
    saveCharacter({ fugalSelfControlLost: char.fugalSelfControlLost });

    showToast(
        char.fugalSelfControlLost
            ? '⚠️ Corruption controls your body for the first scene today.'
            : '✅ You held control this morning.',
        char.fugalSelfControlLost ? 'warning' : 'success'
    );

    window.cantorRefresh();
};

// ─── Toggle Talent ─────────────────────────────────────────────

window.cantorToggleTalent = function(talentId) {
    const char = getCharacterData();
    if (!char) return;

    if (!char.learnedTalents) char.learnedTalents = [];

    const index = char.learnedTalents.indexOf(talentId);
    if (index >= 0) {
        if (talentId === 'bound-patron') {
            char.boundPatron = null;
            saveCharacter({ boundPatron: null });
        }
        char.learnedTalents.splice(index, 1);
        showToast(`Unlearned: ${talentId}`, 'info');
    } else {
        if (talentId === 'bound-patron') {
            const state = getState();
            const allPatrons = getAllPatrons(state);
            if (allPatrons.length === 0) {
                showToast('No patrons available. Please load patron data first.', 'error');
                return;
            }
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
            setTimeout(() => {
                const confirmBtn = document.getElementById('bound-patron-confirm');
                const cancelBtn = document.getElementById('bound-patron-cancel');
                const select = document.getElementById('bound-patron-select');
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', () => {
                        const selected = select.value;
                        if (selected) {
                            char.boundPatron = selected;
                            char.boundPatronBonus = 1;
                            if (!char.learnedTalents.includes(talentId)) {
                                char.learnedTalents.push(talentId);
                            }
                            saveCharacter({ boundPatron: selected, boundPatronBonus: 1, learnedTalents: char.learnedTalents });
                            showToast(`Bound to ${selected}`, 'success');
                            window.cantorRefresh();
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
            return;
        } else {
            char.learnedTalents.push(talentId);
            showToast(`Learned: ${talentId} ✨`, 'success');
        }
    }

    saveCharacter({ learnedTalents: char.learnedTalents });
    window.cantorRefresh();
};

// ─── Refresh ──────────────────────────────────────────────────
//
// FIX: this used to just re-render the Cantor panel from whatever patron
// data was already sitting in memory/localStorage. Since loadPatronData()
// defaults to using its cache, that meant clicking "Refresh" here could
// never pick up changes to the underlying patron JSON files (or fix a
// stale/corrupted cache) — you had to go to the Patrons tab and use ITS
// refresh button instead. Now this forces a real reload from disk first.

window.cantorRefresh = async function() {
    showToast('🔄 Reloading patron data from disk…', 'info');
    await loadPatronData(true);
    const el = document.querySelector('.cantor-container')?.parentElement || document.getElementById('spellcraft-content');
    if (el) {
        await renderCantor(el);
    }
    showToast('✅ Cantor refreshed.', 'success');
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