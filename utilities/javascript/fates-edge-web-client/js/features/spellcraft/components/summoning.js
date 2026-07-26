/**
 * Summoning – Bound Spirits, Leash Management, and the Bestiary
 *
 * "The leash has two ends. I hold one. The wolf holds the other. We are both waiting."
 * – Borte, Wolf-Speaker of the Gray Fox Clan
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId, safeParseInt } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';
import { getState } from '../../../core/state.js';

// ============================================================
// CONSTANTS
// ============================================================

const BESTIARY_PATH = './data/bestiary.json';

// Spirit class colors (for visual identification)
const CLASS_COLORS = {
    'I': '#6baa7a',
    'II': '#d4af37',
    'III': '#d97a5a',
    'IV': '#c45a5a',
    'V': '#b84a8a'
};

const CLASS_LABELS = {
    'I': 'Echo / Wisp',
    'II': 'Anchor / Wight',
    'III': 'Poltergeist / Ravager',
    'IV': 'Demon / Possessor',
    'V': 'Archfae / Duke'
};

// Default leash lengths by spirit class
const LEASH_BY_CLASS = {
    'I': 3,
    'II': 4,
    'III': 5,
    'IV': 6,
    'V': 8
};

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
        if (val.summary) return safeString(val.summary);
        if (val.lore) return safeString(val.lore);
        try { return JSON.stringify(val); } catch (e) { return '[object]'; }
    }
    return String(val);
}

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

function getSpiritClass(spirit) {
    // Try to extract class from the spirit data
    if (spirit.class) return spirit.class;
    if (spirit.tier) return spirit.tier;
    // Fallback: check the name for class indicators
    const name = (spirit.name || '').toLowerCase();
    if (name.includes('echo') || name.includes('wisp')) return 'I';
    if (name.includes('anchor') || name.includes('wight') || name.includes('shade')) return 'II';
    if (name.includes('poltergeist') || name.includes('wraith') || name.includes('ghoul')) return 'III';
    if (name.includes('demon') || name.includes('possessor') || name.includes('fiend')) return 'IV';
    if (name.includes('archfae') || name.includes('duke') || name.includes('prince')) return 'V';
    return 'II'; // default
}

function getLeashMax(spirit) {
    const cls = getSpiritClass(spirit);
    return LEASH_BY_CLASS[cls] || 4;
}

function getSpiritIcon(spirit) {
    // Map common spirit types to emojis
    const name = (spirit.name || '').toLowerCase();
    if (name.includes('wolf') || name.includes('hound')) return '🐺';
    if (name.includes('raven') || name.includes('crow')) return '🐦‍⬛';
    if (name.includes('serpent') || name.includes('snake') || name.includes('worm')) return '🐍';
    if (name.includes('drake') || name.includes('wyrm')) return '🐉';
    if (name.includes('ghoul') || name.includes('wraith') || name.includes('shade')) return '👻';
    if (name.includes('demon') || name.includes('fiend') || name.includes('ravager')) return '👿';
    if (name.includes('fae') || name.includes('court') || name.includes('thorn')) return '🧚';
    if (name.includes('giant') || name.includes('ogre') || name.includes('troll')) return '🗿';
    if (name.includes('goblin') || name.includes('hobgoblin') || name.includes('bugbear')) return '👺';
    if (name.includes('vampire') || name.includes('draugr') || name.includes('candle')) return '🧛';
    if (name.includes('lycanthrope') || name.includes('sea-wolf') || name.includes('sky-hound')) return '🐾';
    if (name.includes('dryad') || name.includes('bramble')) return '🌿';
    if (name.includes('bell') || name.includes('wight')) return '🔔';
    if (name.includes('elemental') || name.includes('dust')) return '🌪️';
    if (name.includes('selkie') || name.includes('sea')) return '🦭';
    if (name.includes('ancestor') || name.includes('bone')) return '🦴';
    if (name.includes('hearth') || name.includes('home')) return '🏠';
    return '🌀';
}

// ============================================================
// BESTIARY LOADER
// ============================================================

let bestiaryCache = null;

async function loadBestiary() {
    if (bestiaryCache) return bestiaryCache;

    try {
        const response = await fetch(BESTIARY_PATH);
        if (response.ok) {
            const data = await response.json();
            // Normalize the data: handle both array and object formats
            if (Array.isArray(data)) {
                bestiaryCache = data;
            } else if (typeof data === 'object') {
                // Convert object with numeric keys to array
                bestiaryCache = Object.values(data);
            } else {
                bestiaryCache = [];
            }
            return bestiaryCache;
        }
    } catch (e) {
        console.warn('Could not load bestiary, using built-in spirit list.');
    }

    // Fallback: built-in spirits from the grimoire
    bestiaryCache = getBuiltInSpirits();
    return bestiaryCache;
}

// Built-in spirits (from the grimoire)
function getBuiltInSpirits() {
    return [
        {
            id: 'wolf-ancestor',
            name: 'Wolf-Ancestor',
            class: 'II',
            icon: '🐺',
            summary: 'Ancestral, protective, prideful. Values honesty and courage in battle.',
            services: ['Tracking', 'Guarding', 'Teaching battle-songs', 'Sensing oath-breakers'],
            price: 'Uphold the honor of the clan',
            nature: 'Ancestral',
            lore: 'A gray wolf the size of a pony, eyes reflecting scenes from the summoner\'s childhood.',
            connections: ['Ykrul Traditions']
        },
        {
            id: 'hearth-bound',
            name: 'Hearth-Bound',
            class: 'I',
            icon: '🏠',
            summary: 'Ancestral, domestic, protective. Finds joy in simple acts of care.',
            services: ['Protecting a household', 'Warding against nightmares', 'Finding lost objects'],
            price: 'A cup of milk left on the hearth each night',
            nature: 'Ancestral',
            lore: 'Faint figure in apron or smock, smelling of bread and woodsmoke.',
            connections: ['Aelaerem Traditions']
        },
        {
            id: 'vein-serpent',
            name: 'Vein-Serpent',
            class: 'II',
            icon: '🐍',
            summary: 'Indigenous, mineral, slow-witted. Speaks in rumbles through stone.',
            services: ['Locating ore', 'Stabilizing tunnels', 'Warning of earthquakes'],
            price: 'For every ounce of ore taken, an ounce of mortar laid',
            nature: 'Indigenous',
            lore: 'A serpent of polished copper and malachite, slithering through stone as if it were water.',
            connections: ['Aeler Traditions']
        },
        {
            id: 'dust-djanni',
            name: 'Dust-Djanni',
            class: 'II',
            icon: '🌪️',
            summary: 'Desert spirit, old as the erg. Patient but exacting.',
            services: ['Finding water', 'Hiding tracks', 'Creating sandstorms', 'Revealing oases'],
            price: 'A song sung at noon, with no audience but the sun',
            nature: 'Elemental',
            lore: 'A column of dust shaped like a robed figure, eyes of polished amber.',
            connections: ['Fhara Traditions']
        },
        {
            id: 'drowned-mutineer',
            name: 'Drowned Mutineer',
            class: 'III',
            icon: '🧛',
            summary: 'Vengeful dead, confused, bitter. Obsessed with punishing the betrayer\'s bloodline.',
            services: ['Sabotage of ships', 'Whispering secrets', 'Cursing cargo'],
            price: 'A promise of vengeance against the living',
            nature: 'Vengeful',
            lore: 'A bloated figure in rotting finery, surrounded by a halo of salt-crusted coins.',
            connections: ['Zakov Traditions']
        },
        {
            id: 'red-jester',
            name: 'Red Jester',
            class: 'II',
            icon: '🎭',
            summary: 'A hanged fool who laughs at oaths. Sees the tragedy in all solemn vows.',
            services: ['Causing distractions', 'Sabotaging contracts', 'Making guards forget orders'],
            price: 'A genuine laugh—not forced, not performative',
            nature: 'Fae',
            lore: 'A masked figure in motley, bells on every limb.',
            connections: ['Silkstrand Traditions']
        },
        {
            id: 'silent-step',
            name: 'Silent Step',
            class: 'III',
            icon: '🌑',
            summary: 'A shadow that learned to walk. Values secrecy and the power of the unseen.',
            services: ['Carrying whispers', 'Hiding objects', 'Walking through locked doors'],
            price: 'A secret you have never told anyone',
            nature: 'Shadow',
            lore: 'A patch of darkness that moves against the light. No features, no sound.',
            connections: ['Ikasha Traditions']
        },
        {
            id: 'bell-wight',
            name: 'Bell-Wight',
            class: 'I',
            icon: '🔔',
            summary: 'A miner who died counting breaths. Now counts everything with obsessive precision.',
            services: ['Counting inventory', 'Detecting structural flaws', 'Warning of bad air'],
            price: 'Never count to nine in its presence',
            nature: 'Indigenous',
            lore: 'A dwarven figure in miner\'s gear, carrying a bell that never rings.',
            connections: ['Aeler Traditions']
        },
        {
            id: 'lamp-wight',
            name: 'Lamp-Wight',
            class: 'II',
            icon: '🪔',
            summary: 'Tower ghost, bound to a lighthouse or beacon. Dutiful, lonely, precise.',
            services: ['Reading coded signals', 'Warning of incoming ships', 'Revealing lies'],
            price: 'Keep a lamp lit in its tower one night each year',
            nature: 'Anchor',
            lore: 'A translucent keeper\'s uniform, carrying a lantern that casts no light.',
            connections: ['Thepyrgos Traditions']
        }
    ];
}

// ============================================================
// SEARCH / FILTER HELPERS
// ============================================================

function searchSpirits(query, bestiary) {
    if (!query || query.trim() === '') return bestiary;
    const q = query.toLowerCase().trim();
    return bestiary.filter(spirit => {
        const name = safeString(spirit.name || '').toLowerCase();
        const summary = safeString(spirit.summary || '').toLowerCase();
        const lore = safeString(spirit.lore || '').toLowerCase();
        const connections = (spirit.connections || []).map(c => c.toLowerCase()).join(' ');
        const services = (spirit.services || []).map(s => s.toLowerCase()).join(' ');
        return name.includes(q) || summary.includes(q) || lore.includes(q) ||
               connections.includes(q) || services.includes(q);
    });
}

function filterByClass(spirits, classFilter) {
    if (!classFilter || classFilter === 'all') return spirits;
    return spirits.filter(s => getSpiritClass(s) === classFilter);
}

function filterByNature(spirits, natureFilter) {
    if (!natureFilter || natureFilter === 'all') return spirits;
    return spirits.filter(s => (s.nature || '').toLowerCase() === natureFilter.toLowerCase());
}

// ============================================================
// MAIN RENDER
// ============================================================

export async function renderSummoning(el) {
    const char = getCharacterData();
    if (!char || char.magicPath !== 'summoner') {
        el.innerHTML = `
            <div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">
                <div style="font-size:1.5rem;">👁️</div>
                <p>Summoning interface is only for Summoners.</p>
                <p style="font-size:0.85rem;">Select a character with the Summoner magic path.</p>
            </div>
        `;
        return;
    }

    const spirits = char.boundSpirits || [];
    const leashMax = char.leashMax || 4;
    const leash = char.leash || 0;

    // Load bestiary
    const bestiary = await loadBestiary();
    const searchQuery = sessionStorage.getItem('fates-edge-summoner-search') || '';
    const classFilter = sessionStorage.getItem('fates-edge-summoner-filter-class') || 'all';
    const natureFilter = sessionStorage.getItem('fates-edge-summoner-filter-nature') || 'all';

    const filtered = filterByNature(filterByClass(searchSpirits(searchQuery, bestiary), classFilter), natureFilter);

    // Extract unique natures for filter
    const natures = ['all', ...new Set(bestiary.map(s => s.nature || 'Unknown').filter(Boolean))];

    let html = `
        <div class="summoning-container" style="display:flex;flex-direction:column;gap:0.5rem;">
            <!-- Header -->
            <div class="summoning-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:1px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.2rem;">👁️</span>
                    <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Summoning</span>
                    <span style="font-size:0.7rem;color:var(--text3);">${spirits.length} bound spirits</span>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="window.summonerBindSpirit()">➕ Bind Spirit</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.summonerRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- Leash Track -->
            <div class="summoning-leash" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
                    <span style="color:var(--text3);">🔗 Leash</span>
                    <span>${leash}/${leashMax}</span>
                    <span style="display:flex;gap:0.2rem;">
                        <button class="btn btn-xs btn-secondary" onclick="window.summonerTickLeash(1)">+1</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.summonerTickLeash(-1)">−1</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.summonerClearLeash()" style="color:var(--red);">✕</button>
                    </span>
                </div>
                <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${Math.min(100, (leash / leashMax) * 100)}%;height:100%;background:${leash / leashMax > 0.8 ? 'var(--red)' : leash / leashMax > 0.5 ? 'var(--orange)' : 'var(--gold)'};border-radius:3px;transition:width 0.3s;"></div>
                </div>
                ${leash >= leashMax ? `<div style="color:var(--red);font-size:0.75rem;margin-top:0.1rem;">⚠️ Leash is full! The spirit will act on its nature!</div>` : ''}
            </div>

            <!-- Bestiary Browser -->
            <div class="summoning-bestiary" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">📖 Bestiary (${filtered.length})</span>
                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;font-size:0.7rem;">
                        <input type="text" id="summoner-search" placeholder="Search spirits..." value="${escHtml(searchQuery)}" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;width:120px;">
                        <select id="summoner-class-filter" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;">
                            <option value="all" ${classFilter === 'all' ? 'selected' : ''}>All Classes</option>
                            <option value="I" ${classFilter === 'I' ? 'selected' : ''}>Class I (Echo/Wisp)</option>
                            <option value="II" ${classFilter === 'II' ? 'selected' : ''}>Class II (Anchor/Wight)</option>
                            <option value="III" ${classFilter === 'III' ? 'selected' : ''}>Class III (Poltergeist)</option>
                            <option value="IV" ${classFilter === 'IV' ? 'selected' : ''}>Class IV (Demon)</option>
                            <option value="V" ${classFilter === 'V' ? 'selected' : ''}>Class V (Archfae)</option>
                        </select>
                        <select id="summoner-nature-filter" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;">
                            ${natures.map(n => `<option value="${escHtml(n)}" ${natureFilter === n ? 'selected' : ''}>${n === 'all' ? 'All Natures' : escHtml(n)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="bestiary-list" style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:0.2rem;">
                    ${filtered.length === 0 ? `
                        <div style="text-align:center;color:var(--text3);padding:0.5rem 0;font-size:0.8rem;">
                            No spirits found matching your criteria.
                        </div>
                    ` : filtered.map(spirit => renderBestiaryEntry(spirit, char)).join('')}
                </div>
            </div>

            <!-- Bound Spirits -->
            <div class="summoning-bound" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🔗 Bound Spirits (${spirits.length})</span>
                    <button class="btn btn-xs btn-ghost" onclick="window.summonerReleaseAll()" style="color:var(--red);">Release All</button>
                </div>
                ${spirits.length === 0 ? `
                    <div style="text-align:center;color:var(--text3);padding:0.3rem 0;font-size:0.8rem;">
                        No spirits bound. Browse the bestiary and click "Bind" to form a pact.
                    </div>
                ` : spirits.map(spirit => renderBoundSpirit(spirit, char)).join('')}
            </div>

            <!-- Quick Reference -->
            <div class="summoning-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.2rem;font-size:0.65rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.4rem;">
                <div>📞 <strong>Call:</strong> 1 action (Wits+Presence vs Resist)</div>
                <div>🔗 <strong>Bind:</strong> 1 Boon or 1 Fatigue</div>
                <div>⚡ <strong>Command:</strong> Free (within nature); +1 Leash (against nature)</div>
                <div>🧹 <strong>Release:</strong> Wits+Presence vs Resist (peaceful)</div>
            </div>
        </div>
    `;

    el.innerHTML = html;

    // Attach event listeners
    const searchInput = el.querySelector('#summoner-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            sessionStorage.setItem('fates-edge-summoner-search', e.target.value);
            renderSummoning(el);
        });
    }

    const classFilterEl = el.querySelector('#summoner-class-filter');
    if (classFilterEl) {
        classFilterEl.addEventListener('change', (e) => {
            sessionStorage.setItem('fates-edge-summoner-filter-class', e.target.value);
            renderSummoning(el);
        });
    }

    const natureFilterEl = el.querySelector('#summoner-nature-filter');
    if (natureFilterEl) {
        natureFilterEl.addEventListener('change', (e) => {
            sessionStorage.setItem('fates-edge-summoner-filter-nature', e.target.value);
            renderSummoning(el);
        });
    }
}

// ============================================================
// RENDER BESTIARY ENTRY
// ============================================================

function renderBestiaryEntry(spirit, char) {
    const id = spirit.id || 'spirit-' + generateId('spirit_');
    const name = safeString(spirit.name || 'Unnamed Spirit');
    const cls = getSpiritClass(spirit);
    const icon = spirit.icon || getSpiritIcon(spirit);
    const summary = safeString(spirit.summary || '');
    const services = (spirit.services || []).slice(0, 3).join(', ');
    const price = safeString(spirit.price || 'Unknown');
    const color = CLASS_COLORS[cls] || 'var(--text3)';
    const label = CLASS_LABELS[cls] || `Class ${cls}`;

    // Check if already bound
    const isBound = (char.boundSpirits || []).some(s => s.bestiaryId === id);

    return `
        <div class="bestiary-entry" style="display:flex;align-items:center;gap:0.3rem;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);border-left:3px solid ${color};background:var(--bg3);border-radius:3px;">
            <span style="font-size:1.1rem;">${escHtml(icon)}</span>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:0.2rem;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:0.8rem;">${escHtml(name)}</span>
                    <span style="font-size:0.55rem;color:${color};font-weight:600;">${escHtml(label)}</span>
                    <span style="font-size:0.55rem;color:var(--text3);">Leash ${LEASH_BY_CLASS[cls] || 4}</span>
                </div>
                ${summary ? `<div style="font-size:0.65rem;color:var(--text2);line-height:1.3;">${escHtml(summary)}</div>` : ''}
                <div style="font-size:0.6rem;color:var(--text3);">
                    ${services ? `🛠️ ${escHtml(services)}` : ''}
                    ${price ? ` · 💰 ${escHtml(price)}` : ''}
                </div>
            </div>
            <div style="display:flex;gap:0.2rem;flex-shrink:0;">
                <button class="btn btn-xs ${isBound ? 'btn-secondary' : 'btn-primary'}" onclick="window.summonerBindFromBestiary('${escHtml(id)}')" ${isBound ? 'disabled' : ''}>
                    ${isBound ? '🔗 Bound' : '🔗 Bind'}
                </button>
                <button class="btn btn-xs btn-ghost" onclick="window.summonerViewSpirit('${escHtml(id)}')" title="View details">📖</button>
            </div>
        </div>
    `;
}

// ============================================================
// RENDER BOUND SPIRIT
// ============================================================

function renderBoundSpirit(spirit, char) {
    const id = spirit.id;
    const name = safeString(spirit.name || 'Unnamed Spirit');
    const icon = spirit.icon || getSpiritIcon(spirit);
    const cls = getSpiritClass(spirit);
    const color = CLASS_COLORS[cls] || 'var(--text3)';
    const currentLeash = spirit.currentLeash || 0;
    const leashMax = spirit.leashMax || LEASH_BY_CLASS[cls] || 4;
    const pct = Math.min(100, (currentLeash / leashMax) * 100);
    const services = (spirit.services || []).join(', ');
    const price = safeString(spirit.price || 'None');
    const nature = safeString(spirit.nature || 'Unknown');

    return `
        <div class="bound-spirit" style="display:flex;align-items:center;gap:0.3rem;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);border-left:3px solid ${color};background:var(--bg3);border-radius:3px;">
            <span style="font-size:1.1rem;">${escHtml(icon)}</span>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:0.2rem;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:0.8rem;">${escHtml(name)}</span>
                    <span style="font-size:0.55rem;color:${color};">${escHtml(nature)}</span>
                </div>
                <div style="font-size:0.6rem;color:var(--text3);">
                    ${services ? `🛠️ ${escHtml(services)}` : ''}
                    ${price ? ` · 💰 ${escHtml(price)}` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:0.2rem;margin-top:0.05rem;">
                    <div style="width:60px;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
                        <div style="width:${pct}%;height:100%;background:${pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--orange)' : 'var(--gold)'};border-radius:2px;"></div>
                    </div>
                    <span style="font-size:0.55rem;color:var(--text3);">${currentLeash}/${leashMax}</span>
                </div>
            </div>
            <div style="display:flex;gap:0.2rem;flex-shrink:0;">
                <button class="btn btn-xs btn-ghost" onclick="window.summonerTickSpiritLeash('${escHtml(id)}', 1)" title="Tick Leash">+</button>
                <button class="btn btn-xs btn-ghost" onclick="window.summonerTickSpiritLeash('${escHtml(id)}', -1)" title="Reduce Leash">−</button>
                <button class="btn btn-xs btn-secondary" onclick="window.summonerCommandSpirit('${escHtml(id)}')" title="Command">⚡</button>
                <button class="btn btn-xs btn-danger" onclick="window.summonerReleaseSpirit('${escHtml(id)}')" title="Release">✕</button>
            </div>
        </div>
    `;
}

// ============================================================
// GLOBAL FUNCTIONS (onclick handlers)
// ============================================================

// ─── Bind from Bestiary ──────────────────────────────────────

window.summonerBindFromBestiary = async function(bestiaryId) {
    const char = getCharacterData();
    if (!char) return;

    const bestiary = await loadBestiary();
    const spiritData = bestiary.find(s => (s.id || s.name) === bestiaryId);
    if (!spiritData) {
        showToast('Spirit not found in bestiary.', 'error');
        return;
    }

    const name = spiritData.name || 'Unnamed Spirit';
    const cls = getSpiritClass(spiritData);
    const leashMax = LEASH_BY_CLASS[cls] || 4;

    // Check if already bound
    if ((char.boundSpirits || []).some(s => s.bestiaryId === bestiaryId || s.name === name)) {
        showToast(`"${name}" is already bound.`, 'warning');
        return;
    }

    // Confirm binding cost
    const cost = prompt(`Bind "${name}"? (Cost: 1 Boon or 1 Fatigue)\nEnter "boon" or "fatigue":`);
    if (!cost) return;
    const costLower = cost.toLowerCase();
    if (costLower !== 'boon' && costLower !== 'fatigue') {
        showToast('Invalid cost. Enter "boon" or "fatigue".', 'error');
        return;
    }

    // Deduct cost (simplified – we're not tracking Boons/Fatigue in state yet)
    showToast(`Binding "${name}"... (cost: ${costLower})`, 'info');

    const newSpirit = {
        id: generateId('spirit_'),
        bestiaryId: bestiaryId,
        name: name,
        icon: spiritData.icon || getSpiritIcon(spiritData),
        class: cls,
        nature: spiritData.nature || 'Unknown',
        services: spiritData.services || [],
        price: spiritData.price || 'None',
        lore: spiritData.lore || '',
        leashMax: leashMax,
        currentLeash: 0,
        boundAt: Date.now()
    };

    if (!char.boundSpirits) char.boundSpirits = [];
    char.boundSpirits.push(newSpirit);
    saveCharacter({ boundSpirits: char.boundSpirits });
    showToast(`🔗 Bound "${name}"! The leash is set.`, 'success');
    renderSummoning(document.getElementById('summoning-container'));
};

// ─── Bind Custom Spirit ──────────────────────────────────────

window.summonerBindSpirit = function() {
    const char = getCharacterData();
    if (!char) return;

    const name = prompt('Spirit name:');
    if (!name) return;
    const nature = prompt('Nature (e.g., Ancestral, Indigenous, Shadow):') || 'Unknown';
    const servicesInput = prompt('Services (comma-separated):') || '';
    const services = servicesInput.split(',').map(s => s.trim()).filter(Boolean);
    const price = prompt('Price (what you pay):') || 'None';
    const classInput = prompt('Class (I-V, or leave blank for II):') || 'II';
    const cls = classInput.toUpperCase();
    const leashMax = LEASH_BY_CLASS[cls] || 4;

    const newSpirit = {
        id: generateId('spirit_'),
        name: name,
        icon: '🌀',
        class: cls,
        nature: nature,
        services: services,
        price: price,
        leashMax: leashMax,
        currentLeash: 0,
        boundAt: Date.now(),
        custom: true
    };

    if (!char.boundSpirits) char.boundSpirits = [];
    char.boundSpirits.push(newSpirit);
    saveCharacter({ boundSpirits: char.boundSpirits });
    showToast(`🔗 Bound "${name}"`, 'success');
    renderSummoning(document.getElementById('summoning-container'));
};

// ─── Leash Management ───────────────────────────────────────

window.summonerTickLeash = function(amount = 1) {
    const char = getCharacterData();
    if (!char) return;
    const leash = (char.leash || 0) + amount;
    char.leash = Math.max(0, leash);
    saveCharacter({ leash: char.leash });

    if (char.leash >= (char.leashMax || 4)) {
        showToast('⚠️ Leash is full! The spirit will act on its nature!', 'warning');
    }
    renderSummoning(document.getElementById('summoning-container'));
};

window.summonerClearLeash = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!confirm('Clear all leash tension? (This may have consequences)')) return;
    char.leash = 0;
    saveCharacter({ leash: char.leash });
    showToast('Leash cleared.', 'info');
    renderSummoning(document.getElementById('summoning-container'));
};

window.summonerTickSpiritLeash = function(spiritId, amount = 1) {
    const char = getCharacterData();
    if (!char) return;
    const spirit = char.boundSpirits.find(s => s.id === spiritId);
    if (!spirit) return showToast('Spirit not found.', 'error');
    spirit.currentLeash = Math.max(0, (spirit.currentLeash || 0) + amount);
    if (spirit.currentLeash >= spirit.leashMax) {
        showToast(`⚠️ "${spirit.name}"'s leash is full! It will act on its nature!`, 'warning');
    }
    saveCharacter({ boundSpirits: char.boundSpirits });
    renderSummoning(document.getElementById('summoning-container'));
};

// ─── Command Spirit ──────────────────────────────────────────

window.summonerCommandSpirit = function(spiritId) {
    const char = getCharacterData();
    if (!char) return;
    const spirit = char.boundSpirits.find(s => s.id === spiritId);
    if (!spirit) return showToast('Spirit not found.', 'error');

    const command = prompt(`Command "${spirit.name}":\n(Within nature = free; Against nature = +1 Leash)`, 'Scout ahead');
    if (!command) return;

    const againstNature = confirm(`Is this command AGAINST "${spirit.nature}" nature?`);
    if (againstNature) {
        spirit.currentLeash = (spirit.currentLeash || 0) + 1;
        showToast(`⚡ Command issued against nature. Leash +1.`, 'warning');
        if (spirit.currentLeash >= spirit.leashMax) {
            showToast(`⚠️ "${spirit.name}"'s leash is full! It will act on its nature!`, 'warning');
        }
    } else {
        showToast(`✅ "${spirit.name}" follows your command.`, 'success');
    }

    // Record the command
    if (!spirit.commands) spirit.commands = [];
    spirit.commands.push({ command: command, timestamp: Date.now(), againstNature: againstNature });
    saveCharacter({ boundSpirits: char.boundSpirits });
    renderSummoning(document.getElementById('summoning-container'));
};

// ─── Release Spirit ──────────────────────────────────────────

window.summonerReleaseSpirit = function(spiritId) {
    const char = getCharacterData();
    if (!char) return;
    const spirit = char.boundSpirits.find(s => s.id === spiritId);
    if (!spirit) return;
    if (!confirm(`Release "${spirit.name}"? (This may have consequences if the leash was tight.)`)) return;

    char.boundSpirits = char.boundSpirits.filter(s => s.id !== spiritId);
    saveCharacter({ boundSpirits: char.boundSpirits });
    showToast(`🌀 "${spirit.name}" released.`, 'info');
    renderSummoning(document.getElementById('summoning-container'));
};

window.summonerReleaseAll = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!char.boundSpirits || char.boundSpirits.length === 0) {
        showToast('No spirits to release.', 'info');
        return;
    }
    if (!confirm('Release ALL bound spirits? This will break all pacts.')) return;
    char.boundSpirits = [];
    saveCharacter({ boundSpirits: char.boundSpirits });
    showToast('All spirits released.', 'info');
    renderSummoning(document.getElementById('summoning-container'));
};

// ─── View Spirit Details ─────────────────────────────────────

window.summonerViewSpirit = async function(bestiaryId) {
    const bestiary = await loadBestiary();
    const spirit = bestiary.find(s => (s.id || s.name) === bestiaryId);
    if (!spirit) {
        showToast('Spirit not found.', 'error');
        return;
    }

    const name = safeString(spirit.name || 'Unnamed Spirit');
    const cls = getSpiritClass(spirit);
    const icon = spirit.icon || getSpiritIcon(spirit);
    const summary = safeString(spirit.summary || '');
    const lore = safeString(spirit.lore || '');
    const services = (spirit.services || []).join(', ');
    const price = safeString(spirit.price || 'Unknown');
    const nature = safeString(spirit.nature || 'Unknown');
    const connections = (spirit.connections || []).join(', ');

    showToastWithHTML(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <span style="font-size:2rem;">${escHtml(icon)}</span>
                <div>
                    <div style="font-weight:600;font-size:1.1rem;">${escHtml(name)}</div>
                    <div style="font-size:0.8rem;color:var(--text3);">${escHtml(nature)} · Class ${escHtml(cls)}</div>
                </div>
            </div>
            ${summary ? `<div style="font-size:0.9rem;color:var(--text2);">${escHtml(summary)}</div>` : ''}
            ${lore ? `<div style="font-size:0.8rem;color:var(--text3);line-height:1.4;">${escHtml(lore)}</div>` : ''}
            ${services ? `<div style="font-size:0.8rem;"><strong>Services:</strong> ${escHtml(services)}</div>` : ''}
            ${price ? `<div style="font-size:0.8rem;"><strong>Price:</strong> ${escHtml(price)}</div>` : ''}
            ${connections ? `<div style="font-size:0.7rem;color:var(--text3);"><strong>Connections:</strong> ${escHtml(connections)}</div>` : ''}
            <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">Leash length: ${LEASH_BY_CLASS[cls] || 4}</div>
        </div>
    `, 'info');
};

// ─── Refresh ──────────────────────────────────────────────────

window.summonerRefresh = function() {
    const el = document.getElementById('summoning-container');
    if (el) renderSummoning(el);
    showToast('🔄 Summoning refreshed.', 'info');
};

// ============================================================
// TOAST WITH HTML (shared with spellbook)
// ============================================================

function showToastWithHTML(html, type = 'info') {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.5rem; border-radius: var(--radius);
        max-width: 450px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 80vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-sm btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);
    // Auto-close after 10 seconds
    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 10000);
}

// ============================================================
// EXPORT
// ============================================================

export default { renderSummoning };