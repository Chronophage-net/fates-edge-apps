/**
 * Spellcraft & Magic – Unified interface for all magical traditions
 *
 * "The coin that never spends is the one you don't remember taking."
 * – Serafine of the Velvet Touch
 *
 * Features:
 * - Character tracks (Obligation, Corruption, Leash, Mental Strain, Shadow/Shame/Identity)
 * - Path-specific components: Rites, Spellbook, Crafting, Calculator, Summoning, Monks, Cantor
 * - Crafting (Hedge Gifts, Quick Workings, Rituals) is available to ALL characters
 * - TAGS Calculator for Free Casters (and as a learning tool for others)
 * - Unified character selection via VTT
 * - Default "Path Finder" view helps players choose their magical tradition
 */

import { vttStore } from '../../core/vtt-store.js';
import { getState, getCharacter, updateCharacter, addCharacter, saveState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';
import { escHtml, generateId, safeParseInt } from '../../core/utils.js';

// ─── Import sub‑components ──────────────────────────────────
import { renderRites } from './components/rites.js';
import { renderSpellbook } from './components/spellbook.js';
import { renderCalculator } from './components/calculator.js';
import { renderTrackers } from './components/trackers.js';
import { renderSummoning } from './components/summoning.js';
import { renderWitchcraft } from './components/witchcraft.js';
import { renderMonks } from './components/monks.js';
import { renderCantor } from './components/cantor.js';

// ============================================================
// CONSTANTS – Path metadata for the UI
// ============================================================

const PATH_META = {
    'none': {
        label: 'No Path',
        icon: '👤',
        color: 'var(--text3)',
        description: 'No magical path chosen. Crafting (Hedge Gifts, rituals) is still available.',
        longDescription: 'You have not yet chosen a magical tradition. Explore the paths below to find the one that calls to you.',
        recommendations: []
    },
    'free-caster': {
        label: 'Free Caster',
        icon: '🔮',
        color: '#8e44ad',
        description: 'Weave the raw Weave using TAGS. No patron required – only will and grammar.',
        longDescription: 'Free Casters reach directly into the Weave, shaping reality through will, word, and gesture. No Patron, no Codex, no Symbol – just you and the raw stuff of creation. The power is intoxicating, but the Backlash is entirely your own.',
        recommendations: [
            'I want to improvise and invent my own spells',
            'I love the idea of raw, untamed magic',
            'I want to be self-reliant and answer to no Patron'
        ],
        archetypes: ['Sorcerer', 'Wild Mage', 'Improviser']
    },
    'runekeeper': {
        label: 'Runekeeper',
        icon: '📜',
        color: '#d4af37',
        description: 'Bound to a single Patron. Your Codex and Thiasos are the instruments of your covenant.',
        longDescription: 'Runekeepers are the agents of the great powers – Paladins of Mykkiel, Druids of Grimmir, Artificers of the Clockwork Monad. You serve one Patron, and in return you wield structured, reliable power. Your Codex is your covenant; your Thiasos is your witness.',
        recommendations: [
            'I want clear, structured power with defined costs',
            'I like the idea of being a paladin, druid, or artificer',
            'I want a deep, committed relationship with a single Patron'
        ],
        archetypes: ['Paladin', 'Druid', 'Artificer', 'Inquisitor', 'Templar']
    },
    'invoker': {
        label: 'Invoker',
        icon: '🎴',
        color: '#e67e22',
        description: 'Carry Symbols from multiple Patrons. Power is borrowed, interest is steep.',
        longDescription: 'Invokers are gamblers who carry Symbols – physical anchors to Patrons they have never fully sworn to. They diversify their portfolio of power, juggling obligations like a merchant hedging against ruin. The power is versatile, but the interest is always compounding.',
        recommendations: [
            'I want flexibility and versatility',
            'I love risk/reward mechanics',
            'I want to be clever and find loopholes'
        ],
        archetypes: ['Warlock', 'Gambler', 'Occultist', 'Hedge-Mage']
    },
    'cantor': {
        label: 'Cantor',
        icon: '🎵',
        color: '#6b4c9a',
        description: 'Your voice is the instrument. Sing the old songs, and the Weave answers – at a cost.',
        longDescription: 'Cantors are the wild singers, the mad pipers, the hymn-leaders who become the altar. They do not swear to Patrons – they echo them. Their power is intimacy, unmediated and deeply dangerous. The voice that sings too often to the storm begins to carry thunder in its timbre.',
        recommendations: [
            'I love social/performance scenes',
            'I enjoy tragic corruption arcs',
            'I want power that is literally part of my body'
        ],
        archetypes: ['Bard', 'Siren', 'Storm-Singer', 'Prophet']
    },
    'witch': {
        label: 'Witch',
        icon: '🧹',
        color: '#27ae60',
        description: 'Threshold magic, hedge gifts, and the quiet work of names. The hedge keeps the wolves at bay.',
        longDescription: 'Witches practice the systemic magic that maintains the world – the quiet, overlooked power that is at once invisible and essential. They work with knots, thresholds, and the accumulated weight of stories. Their magic is intimate, corrupting in the old sense: not rotten, but changed.',
        recommendations: [
            'I like subtlety and preparation over flashy magic',
            'I enjoy folk horror and domestic magic',
            'I want to be underestimated and overlooked'
        ],
        archetypes: ['Hedge-Witch', 'Hearth-Mother', 'Knot-Weaver', 'Threshold-Keeper']
    },
    'psion': {
        label: 'Psion',
        icon: '🧠',
        color: '#2980b9',
        description: 'The mind is the only focus. Mental Strain is the price of bending reality with will alone.',
        longDescription: 'Psions look only to the self – the disciplined, trained, dangerous self. They carry no outward signs of their power. No glowing staff, no familiar, no song to warn you. They are accountable only to themselves, and in a world built on bonds and covenants, this makes them suspect. The mind is a fortress with no gates – safe until it isn\'t.',
        recommendations: [
            'I prefer internal struggle over external debts',
            'I like mind games and subtlety',
            'I dislike carrying obvious magical gear'
        ],
        archetypes: ['Mind-Mage', 'Telepath', 'Psychic', 'Monk']
    },
    'summoner': {
        label: 'Summoner',
        icon: '👁️',
        color: '#c0392b',
        description: 'Bind spirits with the Leash. Negotiate, command, and hope the price is worth the service.',
        longDescription: 'Summoners are the diplomats of the damned and the blessed alike – the ones who open doors and hope to close them before something follows through. The dead, the fey, the demons, the angels – they are all spirits, and they all speak the language of contract. The Leash is a courtesy extended by the spirit while it finds your measure.',
        recommendations: [
            'I like tactical "pet" management and action economy',
            'I enjoy contracts, diplomacy, and bargaining with monsters',
            'I want a "friend" that might eat me'
        ],
        archetypes: ['Necromancer', 'Demonologist', 'Spirit-Binder', 'Shaman']
    },
    'monk': {
        label: 'Monk',
        icon: '🧘',
        color: '#f39c12',
        description: 'The body is a temple. The breath is a weapon. Stillness is the greatest disguise.',
        longDescription: 'Monks of the Unbroken Way walk the path of discipline and balance. They do not bargain with Patrons – they master themselves. Their power is not in what they can do, but in what they can choose not to do. The body is a temple; the breath is a weapon; stillness is the greatest disguise.',
        recommendations: [
            'I want discipline and balance over raw power',
            'I enjoy martial arts and meditation',
            'I want to serve the balance itself'
        ],
        archetypes: ['Martial Artist', 'Monk', 'Ascetic', 'Guardian']
    }
};

// ============================================================
// STYLES (injected once)
// ============================================================

const STYLE_ID = 'spellcraft-styles';

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .spellcraft-tab {
            position: relative;
            transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
            background: transparent;
            border-color: transparent;
            color: var(--text3);
        }
        .spellcraft-tab:hover {
            color: var(--text);
            background: var(--bg3);
        }
        .spellcraft-tab.active {
            background: var(--gold);
            border-color: var(--gold);
            color: #1a1400;
            font-weight: 600;
        }
        .spellcraft-content-inner {
            animation: spellcraft-fade-in 0.15s ease;
        }
        @keyframes spellcraft-fade-in {
            from { opacity: 0; transform: translateY(2px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .spellcraft-loading {
            padding: 2rem;
            text-align: center;
            color: var(--text3);
            font-size: 0.85rem;
        }
        .spellcraft-path-desc {
            color: var(--text3);
            font-size: 0.7rem;
            max-width: 320px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .spellcraft-patron-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.2rem;
            font-size: 0.75rem;
            padding: 0.05rem 0.5rem;
            border-radius: 10px;
            background: var(--bg3);
            border: 1px solid var(--border);
            color: var(--gold);
        }

        /* ─── Path Finder Cards ──────────────────────────────── */
        .path-finder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.6rem;
        }
        .path-finder-card {
            background: var(--bg2);
            border-radius: var(--radius);
            padding: 0.6rem 0.8rem;
            border: 1px solid var(--border);
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            flex-direction: column;
            gap: 0.2rem;
        }
        .path-finder-card:hover {
            border-color: var(--gold);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .path-finder-card .path-icon {
            font-size: 1.8rem;
        }
        .path-finder-card .path-label {
            font-weight: 600;
            font-size: 0.95rem;
            color: var(--text);
        }
        .path-finder-card .path-brief {
            font-size: 0.75rem;
            color: var(--text3);
            flex: 1;
        }
        .path-finder-card .path-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.2rem;
            margin-top: 0.2rem;
        }
        .path-finder-card .path-tags span {
            font-size: 0.6rem;
            padding: 0.05rem 0.4rem;
            border-radius: 8px;
            background: var(--bg3);
            color: var(--text2);
            border: 1px solid var(--border);
        }
        .path-finder-card .path-rec {
            font-size: 0.65rem;
            color: var(--text3);
            font-style: italic;
            margin-top: 0.2rem;
            border-top: 1px solid var(--border);
            padding-top: 0.2rem;
        }
        .path-finder-card .path-archetypes {
            display: flex;
            flex-wrap: wrap;
            gap: 0.2rem;
            margin-top: 0.1rem;
        }
        .path-finder-card .path-archetypes span {
            font-size: 0.55rem;
            padding: 0.05rem 0.3rem;
            border-radius: 6px;
            background: var(--bg3);
            color: var(--gold);
            border: 1px solid rgba(212, 175, 55, 0.2);
        }
        .path-finder-card .path-choose-btn {
            margin-top: 0.3rem;
            padding: 0.15rem 0.5rem;
            font-size: 0.7rem;
            align-self: flex-start;
            background: var(--gold);
            border: none;
            border-radius: var(--radius);
            color: #1a1400;
            font-weight: 600;
            cursor: pointer;
        }
        .path-finder-card .path-choose-btn:hover {
            background: var(--gold-hover);
        }

        .path-finder-header {
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
            margin-bottom: 0.8rem;
            padding: 0.6rem 0.8rem;
            background: var(--bg2);
            border-radius: var(--radius);
            border-left: 4px solid var(--gold);
        }
        .path-finder-header h2 {
            margin: 0;
            color: var(--gold);
            font-size: 1.1rem;
        }
        .path-finder-header p {
            margin: 0;
            color: var(--text2);
            font-size: 0.85rem;
        }
    `;
    document.head.appendChild(style);
}

// ============================================================
// STATE
// ============================================================

let container = null;
let eventListeners = [];
let activeTab = 'crafting';
let renderToken = 0; // guards against a slow async tab render landing after a newer one started
let isPathFinder = false; // true when showing the default path selection view

// ============================================================
// HELPERS (exported for sub‑components)
// ============================================================

export function getCharacterData() {
    const id = vttStore.getSelectedCharacterId();
    if (!id) {
        showToast('Select a character first.', 'error');
        return null;
    }
    const char = getCharacter(id);
    if (!char) {
        showToast('Character not found.', 'error');
        return null;
    }
    return char;
}

function saveCharacter(updates) {
    const id = vttStore.getSelectedCharacterId();
    if (!id) return false;
    const result = updateCharacter(id, updates);
    if (result) {
        renderAll();
        return true;
    }
    return false;
}

export function getPatronRites(patronName) {
    // Handled by the rites component's data-driven lookup. Kept as a
    // pass-through for backward compatibility with anything still importing it.
    return [];
}

// ============================================================
// RENDER – Main
// ============================================================

export function render(el) {
    container = el;
    if (!container) return;

    ensureStyles();

    const char = getCharacterData();
    if (!char) {
        container.innerHTML = `
            <div class="spellcraft-empty" style="padding:2rem;text-align:center;color:var(--text3);background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border);">
                <div style="font-size:3rem;">🧙</div>
                <h2 style="margin:0.5rem 0;">Select a Character</h2>
                <p style="margin:0 0 0.5rem;">Go to the VTT and click a character card to view their magical abilities.</p>
                <button class="btn btn-gold" id="go-to-vtt-btn">🎯 Go to VTT</button>
            </div>
        `;
        attachEvents();
        return;
    }

    const path = char.magicPath || 'none';
    const pathMeta = PATH_META[path] || PATH_META['none'];
    const patron = char.patron || null;
    const name = char.name || 'Unnamed Character';

    // If no path is selected, show the Path Finder view
    if (path === 'none') {
        isPathFinder = true;
        activeTab = 'crafting'; // Keep crafting accessible
        renderPathFinder(char, name, pathMeta, patron);
        attachEvents();
        return;
    }

    isPathFinder = false;
    const tabs = getAvailableTabs(char);
    if (!tabs.some(t => t.id === activeTab)) {
        activeTab = 'crafting';
    }

    container.innerHTML = `
        <div class="spellcraft-container" style="display:flex;flex-direction:column;gap:0.8rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <header class="spellcraft-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;border-bottom:2px solid var(--border);padding-bottom:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                    <span style="font-size:1.8rem;">${escHtml(pathMeta.icon)}</span>
                    <div>
                        <h1 class="page-title" style="margin:0;font-size:1.2rem;">${escHtml(name)}</h1>
                        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;font-size:0.8rem;color:var(--text2);">
                            <span style="font-weight:600;color:${pathMeta.color};">${escHtml(pathMeta.label)}</span>
                            ${patron ? `<span class="spellcraft-patron-pill">🔮 ${escHtml(patron)}</span>` : ''}
                            <span class="spellcraft-path-desc" title="${escHtml(pathMeta.description)}">${escHtml(pathMeta.description)}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-ghost" id="spellcraft-refresh" title="Refresh">↻</button>
                    <button class="btn btn-sm btn-secondary" id="spellcraft-change-path" title="Change magic path">⚙️ Path</button>
                </div>
            </header>

            <!-- ─── Tracks ─────────────────────────────────────── -->
            <div id="trackers-container" class="panel" style="padding:0.3rem 0.5rem;background:var(--bg2);border-radius:var(--radius);"></div>

            <!-- ─── Tabs ────────────────────────────────────────── -->
            <div class="spellcraft-tabs" style="display:flex;gap:0.2rem;border-bottom:1px solid var(--border);padding-bottom:0.1rem;flex-wrap:wrap;">
                ${renderTabButtons(tabs)}
            </div>

            <!-- ─── Tab Content ────────────────────────────────── -->
            <div id="spellcraft-content" class="spellcraft-content" style="min-height:300px;">
                <div class="spellcraft-loading">Loading…</div>
            </div>

            <!-- ─── Footer / Quick Reference ────────────────────── -->
            <div class="spellcraft-footer" style="display:grid;grid-template-columns:2fr 1fr;gap:0.5rem;border-top:1px solid var(--border);padding-top:0.5rem;font-size:0.7rem;color:var(--text3);">
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <span>📖 <strong>Path:</strong> ${escHtml(pathMeta.label)}</span>
                    ${patron ? `<span>🔮 <strong>Patron:</strong> ${escHtml(patron)}</span>` : ''}
                    <span>📊 <strong>Tracks:</strong> ${escHtml(getTrackSummary(char))}</span>
                </div>
                <div style="text-align:right;font-style:italic;">
                    "The Weave remembers." – Lysandra
                </div>
            </div>

        </div>
    `;

    renderAll();
    attachEvents();
}

// ============================================================
// RENDER – Path Finder (Default View)
// ============================================================

function renderPathFinder(char, name, pathMeta, patron) {
    // Show the path finder view – a clean overview that helps players choose
    container.innerHTML = `
        <div class="spellcraft-container" style="display:flex;flex-direction:column;gap:0.8rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <header class="spellcraft-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;border-bottom:2px solid var(--border);padding-bottom:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                    <span style="font-size:1.8rem;">${escHtml(pathMeta.icon)}</span>
                    <div>
                        <h1 class="page-title" style="margin:0;font-size:1.2rem;">${escHtml(name)}</h1>
                        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;font-size:0.8rem;color:var(--text2);">
                            <span style="font-weight:600;color:var(--text3);">${escHtml(pathMeta.label)}</span>
                            ${patron ? `<span class="spellcraft-patron-pill">🔮 ${escHtml(patron)}</span>` : ''}
                            <span class="spellcraft-path-desc" title="${escHtml(pathMeta.description)}">${escHtml(pathMeta.description)}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-ghost" id="spellcraft-refresh" title="Refresh">↻</button>
                </div>
            </header>

            <!-- ─── Path Finder Body ───────────────────────────── -->
            <div class="path-finder-body" style="display:flex;flex-direction:column;gap:0.8rem;">

                <div class="path-finder-header">
                    <h2>🧙 Choose Your Magical Path</h2>
                    <p>
                        Your path defines how you interact with the Weave – and what it costs you.
                        Each path offers a different experience, from the structured covenants of the
                        Runekeeper to the raw will of the Psion.
                    </p>
                    <p style="font-size:0.8rem;color:var(--text3);">
                        <strong>💡 Tip:</strong> You can still access Crafting (Hedge Gifts, Quick Workings, Rituals)
                        regardless of your path. Choose the path that feels right for your character's story.
                    </p>
                </div>

                <div class="path-finder-grid">
                    ${Object.entries(PATH_META)
                        .filter(([id]) => id !== 'none')
                        .map(([id, meta]) => {
                            const isActive = id === (char.magicPath || 'none');
                            return `
                                <div class="path-finder-card" style="${isActive ? 'border-color:var(--gold);background:var(--bg3);' : ''}" data-path="${id}">
                                    <div style="display:flex;align-items:center;gap:0.3rem;">
                                        <span class="path-icon">${escHtml(meta.icon)}</span>
                                        <span class="path-label" style="color:${meta.color};">${escHtml(meta.label)}</span>
                                        ${isActive ? '<span style="font-size:0.6rem;color:var(--gold);">✓ Active</span>' : ''}
                                    </div>
                                    <div class="path-brief">${escHtml(meta.description)}</div>
                                    ${meta.archetypes ? `
                                        <div class="path-archetypes">
                                            ${meta.archetypes.map(a => `<span>${escHtml(a)}</span>`).join('')}
                                        </div>
                                    ` : ''}
                                    ${meta.recommendations && meta.recommendations.length > 0 ? `
                                        <div class="path-rec">
                                            <strong>You might like this if:</strong>
                                            ${meta.recommendations.slice(0, 2).map(r => `<div style="padding-left:0.5rem;">• ${escHtml(r)}</div>`).join('')}
                                        </div>
                                    ` : ''}
                                    <button class="path-choose-btn" data-path="${id}">${isActive ? '✓ Selected' : 'Choose This Path'}</button>
                                </div>
                            `;
                        }).join('')}
                </div>

                <div style="padding:0.5rem;background:var(--bg2);border-radius:var(--radius);border-left:4px solid var(--gold);font-size:0.8rem;color:var(--text3);">
                    <strong>💡 Not sure?</strong>
                    Talk to your GM, or pick the path that sounds most fun.
                    You can always change your path later (though your GM may want a story reason).
                </div>

                <!-- ─── Tracks (minimal, since no path) ──────────── -->
                <div id="trackers-container" class="panel" style="padding:0.3rem 0.5rem;background:var(--bg2);border-radius:var(--radius);">
                    <div style="font-size:0.7rem;color:var(--text3);">No active tracks. Choose a path to begin.</div>
                </div>

                <!-- ─── Tabs (Crafting + Spellbook only) ─────────── -->
                <div class="spellcraft-tabs" style="display:flex;gap:0.2rem;border-bottom:1px solid var(--border);padding-bottom:0.1rem;flex-wrap:wrap;">
                    ${renderTabButtons(getAvailableTabs(char))}
                </div>

                <div id="spellcraft-content" class="spellcraft-content" style="min-height:200px;">
                    <div class="spellcraft-loading">Loading…</div>
                </div>

            </div>

            <!-- ─── Footer ──────────────────────────────────────── -->
            <div class="spellcraft-footer" style="display:grid;grid-template-columns:2fr 1fr;gap:0.5rem;border-top:1px solid var(--border);padding-top:0.5rem;font-size:0.7rem;color:var(--text3);">
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <span>📖 <strong>Path:</strong> ${escHtml(pathMeta.label)}</span>
                    ${patron ? `<span>🔮 <strong>Patron:</strong> ${escHtml(patron)}</span>` : ''}
                    <span>📊 <strong>Status:</strong> Choose a path to unlock full features</span>
                </div>
                <div style="text-align:right;font-style:italic;">
                    "The Weave remembers." – Lysandra
                </div>
            </div>

        </div>
    `;

    // Render the default tab content (crafting/spellbook)
    renderAll();
    attachEvents();

    // Add special event listeners for path selection buttons
    container.querySelectorAll('.path-choose-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pathId = btn.dataset.path;
            if (pathId) selectPathForCharacter(pathId);
        });
    });

    // Clicking the card itself also selects the path
    container.querySelectorAll('.path-finder-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if the click was on the button (it already handles it)
            if (e.target.closest('.path-choose-btn')) return;
            const pathId = card.dataset.path;
            if (pathId) selectPathForCharacter(pathId);
        });
    });
}

function selectPathForCharacter(pathId) {
    const char = getCharacterData();
    if (!char) return;

    if (pathId === char.magicPath) {
        showToast(`Already on the ${PATH_META[pathId]?.label || pathId} path.`, 'info');
        return;
    }

    const result = updateCharacter(char.id, { magicPath: pathId });
    if (result) {
        showToast(`✨ Path changed to ${PATH_META[pathId]?.label || pathId}`, 'success');
        // Re-render the full view with the new path
        render(container);
    } else {
        showToast('Failed to change path.', 'error');
    }
}

// ============================================================
// TAB SYSTEM
// ============================================================

function renderTabButtons(tabs) {
    return tabs.map(tab => `
        <button class="spellcraft-tab btn btn-sm${activeTab === tab.id ? ' active' : ''}" data-tab="${tab.id}">
            ${tab.icon} ${tab.label}
        </button>
    `).join('');
}

function getAvailableTabs(char) {
    const path = char.magicPath || 'none';
    const tabs = [];

    // ─── Always show Crafting (Hedge Gifts, Quick Workings, Rituals) ───
    tabs.push({ id: 'crafting', label: 'Crafting', icon: '🌿' });

    // ─── Always show Spellbook ──────────────────────────────────
    tabs.push({ id: 'spellbook', label: 'Spellbook', icon: '📚' });

    // ─── If no path, that's it (Path Finder handles the rest) ──
    if (path === 'none') return tabs;

    // ─── Path-specific tabs ─────────────────────────────────────
    if (path === 'free-caster') {
        tabs.push({ id: 'calculator', label: 'Calculator', icon: '🔮' });
    }

    // Runekeeper and Invoker share the Rites tab
    if (path === 'runekeeper' || path === 'invoker') {
        tabs.push({ id: 'rites', label: 'Rites', icon: '📜' });
    }

    // Cantor gets its own dedicated tab with corruption and songs
    if (path === 'cantor') {
        tabs.push({ id: 'cantor', label: 'Cantor', icon: '🎵' });
    }

    if (path === 'summoner') {
        tabs.push({ id: 'summoning', label: 'Summoning', icon: '👁️' });
    }

    // Monk is not a path gate on its own — it's available the moment a
    // character has committed to the monastic path (magicPath === 'monk'),
    // OR has already chosen a tradition. Either signal is enough to surface
    // the tab; the monks component itself gates further on learned talents.
    if (path === 'monk' || char.monasticTradition) {
        tabs.push({ id: 'monks', label: 'Monks', icon: '🧘' });
    }

    // Witchcraft tab for witches (shows their full tradition content)
    if (path === 'witch') {
        tabs.push({ id: 'witchcraft', label: 'Witchcraft', icon: '🧹' });
    }

    return tabs;
}

// Renders the active tab's content directly into the LIVE #spellcraft-content
// element (never a detached scratch node), and properly awaits async
// components (Calculator, Cantor, Summoning) before anything else touches
// the DOM. A render token guards against a slow render finishing after the
// user has already switched tabs or characters.
async function renderActiveTabContent() {
    const contentEl = document.getElementById('spellcraft-content');
    if (!contentEl) return;
    const char = getCharacterData();
    if (!char) return;

    const myToken = ++renderToken;
    contentEl.innerHTML = `<div class="spellcraft-loading">Loading…</div>`;

    const wrapper = document.createElement('div');
    wrapper.className = 'spellcraft-content-inner';

    try {
        switch (activeTab) {
            case 'crafting':
                renderWitchcraft(wrapper);
                break;
            case 'spellbook':
                renderSpellbook(wrapper);
                break;
            case 'calculator':
                await renderCalculator(wrapper);
                break;
            case 'rites':
                renderRites(wrapper);
                break;
            case 'cantor':
                await renderCantor(wrapper);
                break;
            case 'summoning':
                await renderSummoning(wrapper);
                break;
            case 'monks':
                renderMonks(wrapper);
                break;
            case 'witchcraft':
                renderWitchcraft(wrapper, { fullMode: true });
                break;
            default:
                wrapper.innerHTML = `<p style="color:var(--text3);">Select a tab to view its content.</p>`;
        }
    } catch (err) {
        console.error(`Spellcraft: error rendering tab "${activeTab}":`, err);
        wrapper.innerHTML = `<p style="color:var(--red);">Failed to load this tab. Check the console for details.</p>`;
    }

    // If the user switched tabs/characters while we were awaiting, drop
    // this result on the floor instead of overwriting whatever's current.
    if (myToken !== renderToken) return;

    contentEl.innerHTML = '';
    contentEl.appendChild(wrapper);
}

function renderAll() {
    const char = getCharacterData();
    if (!char) return;

    // If we're in path finder mode, tracks are minimal
    if (isPathFinder) {
        const trackersEl = document.getElementById('trackers-container');
        if (trackersEl) {
            trackersEl.innerHTML = `<div style="font-size:0.7rem;color:var(--text3);">No active tracks. Choose a path to begin.</div>`;
        }
        // Rebuild tabs
        const tabs = getAvailableTabs(char);
        const tabsContainer = document.querySelector('.spellcraft-tabs');
        if (tabsContainer) {
            tabsContainer.innerHTML = renderTabButtons(tabs);
        }
        renderActiveTabContent();
        return;
    }

    // Render trackers
    const trackersEl = document.getElementById('trackers-container');
    if (trackersEl) renderTrackers(trackersEl);

    // Rebuild the tab bar (in case path/tradition changed which tabs show)
    const tabs = getAvailableTabs(char);
    if (!tabs.some(t => t.id === activeTab)) {
        activeTab = 'crafting';
    }
    const tabsContainer = document.querySelector('.spellcraft-tabs');
    if (tabsContainer) {
        tabsContainer.innerHTML = renderTabButtons(tabs);
    }

    // Render the active tab's content (async-safe, into the live element)
    renderActiveTabContent();
}

function switchTab(tabId) {
    if (tabId === activeTab) return;
    activeTab = tabId;

    const tabsContainer = document.querySelector('.spellcraft-tabs');
    if (tabsContainer) {
        tabsContainer.querySelectorAll('.spellcraft-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === activeTab);
        });
    }

    renderActiveTabContent();
}

// ============================================================
// TRACK SUMMARY
// ============================================================

function getTrackSummary(char) {
    const path = char.magicPath || 'none';
    const parts = [];

    if (path === 'none') {
        return 'No path selected – choose one above to begin';
    }

    if (path === 'runekeeper' || path === 'invoker') {
        const obligation = char.obligation || 0;
        const maxObligation = (char.spirit || 1) + (char.presence || 1);
        parts.push(`Obligation ${obligation}/${maxObligation}`);
    }

    if (path === 'cantor') {
        const corruption = char.corruption || 0;
        const maxCorruption = char.corruptionMax || (char.spirit || 1);
        parts.push(`Corruption ${corruption}/${maxCorruption}`);
    }

    if (path === 'summoner') {
        const leash = char.leash || 0;
        const maxLeash = char.leashMax || 4;
        const spirits = (char.boundSpirits || []).length;
        parts.push(`Leash ${leash}/${maxLeash} · ${spirits} spirits`);
    }

    if (path === 'psion') {
        const strain = char.mentalStrain || 0;
        const maxStrain = char.mentalStrainMax || (char.spirit || 1);
        parts.push(`Mental Strain ${strain}/${maxStrain}`);
    }

    if (path === 'witch') {
        const shadow = char.witch?.prices?.shadow || 0;
        const shame = char.witch?.prices?.shame || 0;
        const idStrain = char.witch?.prices?.identityStrain || 0;
        parts.push(`Shadow ${shadow} · Shame ${shame} · Identity ${idStrain}`);
    }

    if (path === 'monk' || char.monasticTradition) {
        const breath = char.breathState || 'entering';
        const tier = char.monkCorruptionTier || 0;
        parts.push(`Breath: ${breath} · Corruption Tier ${tier}`);
    }

    return parts.join(' · ') || 'No active tracks';
}

// ============================================================
// EVENTS
// ============================================================

function attachEvents() {
    // Remove old listeners
    eventListeners.forEach(({ event, handler }) => {
        if (container) container.removeEventListener(event, handler);
    });
    eventListeners = [];

    const clickHandler = (e) => {
        const tabBtn = e.target.closest('.spellcraft-tab');
        if (tabBtn) {
            switchTab(tabBtn.dataset.tab);
            return;
        }

        const target = e.target.closest('button, [id]');
        if (!target) return;

        switch (target.id) {
            case 'go-to-vtt-btn':
                window.location.hash = 'vtt';
                break;
            case 'spellcraft-refresh':
                renderAll();
                showToast('🔄 Refreshed', 'info');
                break;
            case 'spellcraft-change-path':
                changeMagicPath();
                break;
        }
    };

    if (container) {
        container.addEventListener('click', clickHandler);
        eventListeners.push({ event: 'click', handler: clickHandler });
    }

    // Listen for character selection changes (from VTT)
    const selectionHandler = () => {
        if (container) render(container);
    };
    document.addEventListener('characterSelected', selectionHandler);
    eventListeners.push({ event: 'characterSelected', handler: selectionHandler });
}

// ============================================================
// ACTIONS
// ============================================================

function changeMagicPath() {
    const char = getCharacterData();
    if (!char) return;

    const paths = ['none', 'free-caster', 'runekeeper', 'invoker', 'cantor', 'witch', 'psion', 'summoner', 'monk'];
    const current = char.magicPath || 'none';
    const options = paths.map(p => {
        const meta = PATH_META[p];
        return `${p === current ? '▶ ' : '  '} ${p}: ${meta.label} – ${meta.description}`;
    }).join('\n');

    const choice = prompt(
        `Change magic path for ${char.name}:\n\n${options}\n\nEnter the new path (e.g., "witch" or "none"):`,
        current
    );

    if (!choice || choice === current) return;

    const trimmed = choice.trim().toLowerCase();
    if (!paths.includes(trimmed)) {
        showToast(`Invalid path. Choose from: ${paths.join(', ')}`, 'error');
        return;
    }

    const result = updateCharacter(char.id, { magicPath: trimmed });
    if (result) {
        activeTab = 'crafting';
        showToast(`⚙️ Magic path changed to ${PATH_META[trimmed].label}`, 'success');
        render(container);
    } else {
        showToast('Failed to update character.', 'error');
    }
}

// ============================================================
// DESTROY
// ============================================================

export function destroy() {
    if (container) {
        eventListeners.forEach(({ event, handler }) => {
            container.removeEventListener(event, handler);
        });
        eventListeners = [];
        container.innerHTML = '';
        container = null;
    }
}

// ============================================================
// EXPORTS
// ============================================================

export { saveCharacter };

export default {
    render,
    destroy,
};

export { render as renderSpellcraft, destroy as destroySpellcraft };