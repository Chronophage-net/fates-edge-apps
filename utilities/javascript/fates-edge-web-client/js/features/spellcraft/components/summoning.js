/**
 * Summoning – The Art of the Opened Door
 *
 * "The leash has two ends. I hold one. The wolf holds the other. We are both waiting.
 *  But the wolf is patient. And the wolf remembers every slight."
 * – Borte, Wolf-Speaker of the Gray Fox Clan
 *
 * Features:
 * - Bestiary browser with spirits from /data/bestiary.json
 * - Ritual Binding with cost negotiation (Boon, Fatigue, or Memory)
 * - Spirit mood tracking (Calm → Restless → Strained → Rebellious)
 * - Command history per spirit
 * - Leash tension with visual feedback and critical warnings
 * - Spirit details modal with lore, signs, and regional connections
 * - Filter by class, nature, region, and search
 * - Custom spirit binding for unique entities
 * - Release with consequences (narrative prompt)
 * - Quick reference for summoning mechanics
 *
 * All selection modals (choose cost, offer) have been replaced with inline dropdowns.
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId, safeParseInt } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';
import { getState } from '../../../core/state.js';

// ============================================================
// CONSTANTS
// ============================================================

const BESTIARY_PATH = './data/bestiary.json';

// ─── Spirit Class Metadata ───────────────────────────────────

const CLASS_META = {
    'I': {
        label: 'Echo / Wisp',
        color: '#6baa7a',
        leash: 3,
        description: 'Faint spirits, recent memories, the barely-there. Low risk, low reward.',
        icon: '🌫️'
    },
    'II': {
        label: 'Anchor / Wight',
        color: '#d4af37',
        leash: 4,
        description: 'Bound to a place or object. Reliable, but territorial.',
        icon: '🔗'
    },
    'III': {
        label: 'Poltergeist / Ravager',
        color: '#d97a5a',
        leash: 5,
        description: 'Restless and hungry. Powerful, but the leash is short.',
        icon: '💥'
    },
    'IV': {
        label: 'Demon / Possessor',
        color: '#c45a5a',
        leash: 6,
        description: 'Ancient and malevolent. They always have an angle.',
        icon: '👿'
    },
    'V': {
        label: 'Archfae / Duke',
        color: '#b84a8a',
        leash: 8,
        description: 'Princes of the Gloaming. The leash is a courtesy they extend.',
        icon: '👑'
    }
};

// ─── Spirit Moods ────────────────────────────────────────────

const MOODS = {
    CALM: { label: 'Calm', color: 'var(--green)', emoji: '😌', threshold: 0 },
    CONTENT: { label: 'Content', color: '#8bc34a', emoji: '🙂', threshold: 0.25 },
    RESTLESS: { label: 'Restless', color: 'var(--orange)', emoji: '😐', threshold: 0.5 },
    STRAINED: { label: 'Strained', color: '#e67e22', emoji: '😰', threshold: 0.7 },
    REBELLIOUS: { label: 'Rebellious', color: 'var(--red)', emoji: '😤', threshold: 0.85 },
    BREAKING: { label: 'Breaking Free', color: '#8b0000', emoji: '💥', threshold: 1.0 }
};

function getMood(leash, max) {
    if (max <= 0) return MOODS.CALM;
    const ratio = leash / max;
    if (ratio >= 1.0) return MOODS.BREAKING;
    if (ratio >= 0.85) return MOODS.REBELLIOUS;
    if (ratio >= 0.7) return MOODS.STRAINED;
    if (ratio >= 0.5) return MOODS.RESTLESS;
    if (ratio >= 0.25) return MOODS.CONTENT;
    return MOODS.CALM;
}

// ─── Default Leash by Class ──────────────────────────────────

const LEASH_BY_CLASS = Object.fromEntries(
    Object.entries(CLASS_META).map(([key, meta]) => [key, meta.leash])
);

// ─── Cost options for binding ──────────────────────────────

const BIND_COST_OPTIONS = [
    { value: 'boon', label: '1 Boon' },
    { value: 'fatigue', label: '1 Fatigue' },
    { value: 'memory', label: 'Memory' }
];

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
    if (spirit.class) return spirit.class;
    if (spirit.tier) return spirit.tier;
    const name = (spirit.name || '').toLowerCase();
    if (name.includes('echo') || name.includes('wisp')) return 'I';
    if (name.includes('anchor') || name.includes('wight') || name.includes('shade')) return 'II';
    if (name.includes('poltergeist') || name.includes('wraith') || name.includes('ghoul')) return 'III';
    if (name.includes('demon') || name.includes('possessor') || name.includes('fiend')) return 'IV';
    if (name.includes('archfae') || name.includes('duke') || name.includes('prince')) return 'V';
    return 'II';
}

function getLeashMax(spirit) {
    const cls = getSpiritClass(spirit);
    return LEASH_BY_CLASS[cls] || 4;
}

function getSpiritIcon(spirit) {
    const name = (spirit.name || '').toLowerCase();
    if (spirit.icon) return spirit.icon;
    if (name.includes('wolf') || name.includes('hound')) return '🐺';
    if (name.includes('raven') || name.includes('crow')) return '🐦‍⬛';
    if (name.includes('serpent') || name.includes('snake') || name.includes('worm')) return '🐍';
    if (name.includes('drake') || name.includes('wyrm')) return '🐉';
    if (name.includes('ghoul') || name.includes('wraith') || name.includes('shade')) return '👻';
    if (name.includes('demon') || name.includes('fiend') || name.includes('ravager')) return '👿';
    if (name.includes('fae') || name.includes('court') || name.includes('thorn')) return '🧚';
    if (name.includes('giant') || name.includes('ogre') || name.includes('troll')) return '🗿';
    if (name.includes('goblin') || name.includes('hobgoblin') || name.includes('bugbear')) return '👺';
    if (name.includes('vampire') || name.includes('draugr')) return '🧛';
    if (name.includes('lycanthrope') || name.includes('sea-wolf') || name.includes('sky-hound')) return '🐾';
    if (name.includes('dryad') || name.includes('bramble')) return '🌿';
    if (name.includes('bell') || name.includes('wight')) return '🔔';
    if (name.includes('elemental') || name.includes('dust')) return '🌪️';
    if (name.includes('selkie') || name.includes('sea')) return '🦭';
    if (name.includes('ancestor') || name.includes('bone')) return '🦴';
    if (name.includes('hearth') || name.includes('home')) return '🏠';
    if (name.includes('lamp') || name.includes('light') || name.includes('beacon')) return '🪔';
    return '🌀';
}

function getNatureIcon(nature) {
    const icons = {
        'Ancestral': '🦴',
        'Indigenous': '🌍',
        'Elemental': '🌪️',
        'Vengeful': '⚡',
        'Fae': '🧚',
        'Shadow': '🌑',
        'Anchor': '🔗',
        'Demon': '👿',
        'Archfae': '👑'
    };
    return icons[nature] || '🌀';
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
            if (Array.isArray(data)) {
                bestiaryCache = data;
            } else if (typeof data === 'object') {
                bestiaryCache = Object.values(data);
            } else {
                bestiaryCache = [];
            }
            return bestiaryCache;
        }
    } catch (e) {
        console.warn('Could not load bestiary, using built-in spirits.');
    }

    bestiaryCache = getBuiltInSpirits();
    return bestiaryCache;
}

// ─── Built-in Spirits ────────────────────────────────────────

function getBuiltInSpirits() {
    return [
        {
            id: 'wolf-ancestor',
            name: 'Wolf-Ancestor',
            class: 'II',
            icon: '🐺',
            nature: 'Ancestral',
            summary: 'Ancestral, protective, prideful. Values honesty and courage in battle.',
            lore: 'A gray wolf the size of a pony, with eyes that reflect scenes from the summoner\'s childhood. It speaks in growls that form words and judges your worth by your pack.',
            services: ['Tracking across any terrain', 'Guarding camps', 'Teaching forgotten battle-songs', 'Sensing oath-breakers'],
            price: 'Uphold the honor of the clan. Any cowardice breaks the bond.',
            connections: ['Ykrul', 'Violet Steppe'],
            signs: ['Wolf tracks that circle three times', 'Howls at the edge of camp', 'Eyes glowing in the dark']
        },
        {
            id: 'hearth-bound',
            name: 'Hearth-Bound',
            class: 'I',
            icon: '🏠',
            nature: 'Ancestral',
            summary: 'Ancestral, domestic, protective. Finds joy in simple acts of care.',
            lore: 'A faint figure in apron or smock, smelling of bread and woodsmoke. It moves between the walls and remembers every meal cooked in its home.',
            services: ['Protecting a household', 'Warding against nightmares', 'Finding lost objects', 'Warning of illness'],
            price: 'A cup of milk left on the hearth each night, and a kind word spoken at dusk.',
            connections: ['Aelaerem', 'Hearth-Mothers'],
            signs: ['Warmth without fire', 'The smell of fresh bread', 'A child\'s toy moved to a safer place']
        },
        {
            id: 'vein-serpent',
            name: 'Vein-Serpent',
            class: 'II',
            icon: '🐍',
            nature: 'Indigenous',
            summary: 'Indigenous, mineral, slow-witted. Speaks in rumbles through stone.',
            lore: 'A serpent of polished copper and malachite, slithering through stone as if it were water. Its presence is a low vibration felt in the bones.',
            services: ['Locating veins of ore', 'Stabilizing tunnels', 'Collapsing enemy fortifications', 'Warning of earthquakes'],
            price: 'For every ounce of ore taken, an ounce of mortar laid. The debt is tracked in stone.',
            connections: ['Aeler', 'Deep Vaults'],
            signs: ['A warm stone in a cold tunnel', 'The taste of copper in the air', 'A rumbling that speaks your name']
        },
        {
            id: 'dust-djanni',
            name: 'Dust-Djanni',
            class: 'II',
            icon: '🌪️',
            nature: 'Elemental',
            summary: 'Desert spirit, old as the erg. Patient but exacting.',
            lore: 'A column of dust shaped like a robed figure, eyes of polished amber. It speaks in the whisper of wind over sand and knows every dune by name.',
            services: ['Finding water', 'Hiding tracks', 'Creating sandstorms', 'Revealing oases'],
            price: 'A song sung at noon, with no audience but the sun. The song must be true.',
            connections: ['Fhara', 'Ashaan', 'Kuvani'],
            signs: ['Dust that moves against the wind', 'A sudden coolness in the heat', 'A face in the sand']
        },
        {
            id: 'drowned-mutineer',
            name: 'Drowned Mutineer',
            class: 'III',
            icon: '🧛',
            nature: 'Vengeful',
            summary: 'Vengeful dead, confused, bitter. Obsessed with punishing the betrayer\'s bloodline.',
            lore: 'A bloated figure in rotting finery, surrounded by a halo of salt-crusted coins. Its voice is the gurgle of seawater and the creak of a sinking hull.',
            services: ['Sabotage of ships', 'Whispering secrets into sleeping ears', 'Cursing cargo to spoil', 'Finding hidden treasure'],
            price: 'A promise of vengeance against the living. The summoner must carry the mutineer\'s grudge.',
            connections: ['Zakov', 'Brass Coast'],
            signs: ['Salt water in a sealed room', 'A coin that tastes of brine', 'The creak of a ship on land']
        },
        {
            id: 'red-jester',
            name: 'Red Jester',
            class: 'II',
            icon: '🎭',
            nature: 'Fae',
            summary: 'A hanged fool who laughs at oaths. Sees the tragedy in all solemn vows.',
            lore: 'A masked figure in motley, bells on every limb. Its face is a painted smile that never reaches its eyes. It speaks in riddles and puns.',
            services: ['Causing distractions', 'Sabotaging contracts', 'Making guards forget orders', 'Revealing hidden truths'],
            price: 'A genuine laugh—not forced, not performative. It will know if you fake it.',
            connections: ['Silkstrand', 'Court of Whispers'],
            signs: ['A bell that rings for no reason', 'A card found in your pocket', 'A shadow that bows']
        },
        {
            id: 'silent-step',
            name: 'Silent Step',
            class: 'III',
            icon: '🌑',
            nature: 'Shadow',
            summary: 'A shadow that learned to walk. Values secrecy and the power of the unseen.',
            lore: 'A patch of darkness that moves against the light. No features, no sound, no scent. It is the absence that fills a room.',
            services: ['Carrying whispered messages', 'Hiding objects from sight', 'Walking through locked doors', 'Eavesdropping'],
            price: 'A secret you have never told anyone. It will know if you lie.',
            connections: ['Ikasha', 'Zakov'],
            signs: ['A shadow that moves too fast', 'A room that feels emptier than it should', 'The sound of a footstep where no one walks']
        },
        {
            id: 'bell-wight',
            name: 'Bell-Wight',
            class: 'I',
            icon: '🔔',
            nature: 'Indigenous',
            summary: 'A miner who died counting breaths. Now counts everything with obsessive precision.',
            lore: 'A dwarven figure in miner\'s gear, carrying a bell that never rings. It counts the way a drowning man counts his last breaths.',
            services: ['Counting inventory', 'Detecting structural flaws', 'Warning of bad air', 'Measuring time'],
            price: 'Never count to nine in its presence. It will know, and it will be offended.',
            connections: ['Aeler', 'Deep Vaults'],
            signs: ['A bell that rings nine times', 'A count that is exactly wrong', 'A miner\'s pick that glows']
        },
        {
            id: 'lamp-wight',
            name: 'Lamp-Wight',
            class: 'II',
            icon: '🪔',
            nature: 'Anchor',
            summary: 'Tower ghost, bound to a lighthouse or beacon. Dutiful, lonely, precise.',
            lore: 'A translucent keeper\'s uniform, carrying a lantern that casts no light. It has not missed a single watch in three centuries.',
            services: ['Reading coded signals', 'Warning of incoming ships', 'Revealing lies', 'Guiding the lost'],
            price: 'Keep a lamp lit in its tower one night each year, and speak its name.',
            connections: ['Thepyrgos', 'Linn'],
            signs: ['A light that moves without a flame', 'A fog that parts', 'A voice in the bellows']
        },
        {
            id: 'bramble-soul',
            name: 'Bramble-Soul',
            class: 'II',
            icon: '🌿',
            nature: 'Fae',
            summary: 'A hedge-spirit that guards the boundary between field and forest. Old, patient, sharp.',
            lore: 'A figure woven from thorns and hawthorn, with eyes like blackberries. It speaks in the rustle of leaves and the scratch of branches.',
            services: ['Guarding boundaries', 'Cursing trespassers', 'Finding herbs', 'Speeding or stalling growth'],
            price: 'A red thread tied to a thorn bush on the equinox. It must be tied by your own hand.',
            connections: ['Aelaerem', 'Valewood'],
            signs: ['Thorns that grow in a circle', 'A rabbit that does not flee', 'A door that opens to the wrong garden']
        },
        {
            id: 'deep-watcher',
            name: 'Deep-Watcher',
            class: 'III',
            icon: '👁️',
            nature: 'Indigenous',
            summary: 'An eye that has seen too much. It hungers for new visions.',
            lore: 'A sphere of polished obsidian that floats at eye level, with a pupil that dilates and contracts. It does not blink.',
            services: ['Scrying into the past', 'Seeing through glamours', 'Watching for hidden threats', 'Finding the lost'],
            price: 'A memory of a moment of true beauty. It will take it and keep it.',
            connections: ['The Ninth', 'Aelinnel'],
            signs: ['A reflection that moves when you do not', 'An eye that watches from the dark', 'A dream you cannot remember']
        },
        {
            id: 'thunder-hoof',
            name: 'Thunder-Hoof',
            class: 'II',
            icon: '🐴',
            nature: 'Elemental',
            summary: 'A storm-spirit that takes the shape of a horse. Untamed, proud, wild.',
            lore: 'A horse of lightning and shadow, with hooves that strike sparks. It is not a beast to be ridden—it is a force to be channeled.',
            services: ['Moving faster than wind', 'Carrying a message in a storm', 'Breaking a line of soldiers', 'Calling lightning'],
            price: 'A race with no finish line. You must run until it acknowledges your stamina.',
            connections: ['Ykrul', 'Linn'],
            signs: ['A hoofprint that smokes', 'The smell of ozone', 'A horse that disappears over the horizon']
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

function filterByRegion(spirits, regionFilter) {
    if (!regionFilter || regionFilter === 'all') return spirits;
    return spirits.filter(s => (s.connections || []).some(c => c.toLowerCase().includes(regionFilter.toLowerCase())));
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
    const leash = char.leash || 0;
    const leashMax = char.leashMax || 4;

    // Load bestiary
    const bestiary = await loadBestiary();
    const searchQuery = sessionStorage.getItem('fates-edge-summoner-search') || '';
    const classFilter = sessionStorage.getItem('fates-edge-summoner-filter-class') || 'all';
    const natureFilter = sessionStorage.getItem('fates-edge-summoner-filter-nature') || 'all';
    const regionFilter = sessionStorage.getItem('fates-edge-summoner-filter-region') || 'all';

    let filtered = searchSpirits(searchQuery, bestiary);
    filtered = filterByClass(filtered, classFilter);
    filtered = filterByNature(filtered, natureFilter);
    filtered = filterByRegion(filtered, regionFilter);

    // Extract unique natures, regions for filters
    const natures = ['all', ...new Set(bestiary.map(s => s.nature || 'Unknown').filter(Boolean))];
    const regions = ['all', ...new Set(bestiary.flatMap(s => s.connections || []).filter(Boolean))];

    // Get global mood
    const mood = getMood(leash, leashMax);

    // Bind cost options for dropdowns
    const costOptionsHtml = BIND_COST_OPTIONS.map(opt =>
        `<option value="${opt.value}">${opt.label}</option>`
    ).join('');

    let html = `
        <div class="summoning-container" style="display:flex;flex-direction:column;gap:0.5rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="summoning-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;background:linear-gradient(135deg, var(--bg2) 0%, var(--bg1) 100%);border-radius:var(--radius) var(--radius) 0 0;padding:0.3rem 0.8rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">👁️</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">The Opened Door</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.3rem;">${spirits.length} bound</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <select id="summoner-bind-cost-select" style="font-size:0.65rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;">
                        ${costOptionsHtml}
                    </select>
                    <button class="btn btn-sm btn-gold" onclick="window.summonerBindRitualFromSelect()">🔮 Bind Spirit</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.summonerRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Leash Track ────────────────────────────────── -->
            <div class="summoning-leash" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid ${mood.color};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;font-size:0.8rem;">
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:1.2rem;">${mood.emoji}</span>
                        <span style="color:${mood.color};font-weight:600;">${mood.label}</span>
                        <span style="color:var(--text3);">🔗 ${leash}/${leashMax}</span>
                    </div>
                    <div style="display:flex;gap:0.2rem;align-items:center;">
                        <button class="btn btn-xs btn-secondary" onclick="window.summonerTickLeash(1)">+1</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.summonerTickLeash(-1)">−1</button>
                        <select id="summoner-negotiate-offer-select" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.2rem;">
                            ${costOptionsHtml}
                        </select>
                        <button class="btn btn-xs btn-gold" onclick="window.summonerNegotiateFromSelect()" style="font-size:0.6rem;">🤝 Negotiate</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.summonerClearLeash()" style="color:var(--red);">✕</button>
                    </div>
                </div>
                <div style="width:100%;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-top:0.1rem;">
                    <div style="width:${Math.min(100, (leash / leashMax) * 100)}%;height:100%;background:${mood.color};border-radius:4px;transition:width 0.3s ease;"></div>
                </div>
                ${leash >= leashMax ? `
                    <div style="color:var(--red);font-size:0.75rem;margin-top:0.1rem;font-weight:600;animation:pulse 1s infinite;">
                        ⚠️ THE LEASH IS BROKEN! The spirit will act on its nature!
                    </div>
                ` : leash >= leashMax * 0.8 ? `
                    <div style="color:var(--orange);font-size:0.7rem;margin-top:0.1rem;">
                        ⚠️ The leash is straining. The spirit grows restless.
                    </div>
                ` : ''}
            </div>

            <!-- ─── Bestiary Browser ───────────────────────────── -->
            <div class="summoning-bestiary" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">📖 Bestiary (${filtered.length})</span>
                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;font-size:0.65rem;">
                        <input type="text" id="summoner-search" placeholder="Search..." value="${escHtml(searchQuery)}" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;width:100px;" />
                        <select id="summoner-class-filter" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;">
                            <option value="all" ${classFilter === 'all' ? 'selected' : ''}>All Classes</option>
                            ${Object.entries(CLASS_META).map(([key, meta]) => 
                                `<option value="${key}" ${classFilter === key ? 'selected' : ''}>${meta.icon} ${meta.label}</option>`
                            ).join('')}
                        </select>
                        <select id="summoner-nature-filter" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;max-width:100px;">
                            ${natures.map(n => `<option value="${escHtml(n)}" ${natureFilter === n ? 'selected' : ''}>${n === 'all' ? 'All Natures' : escHtml(n)}</option>`).join('')}
                        </select>
                        <select id="summoner-region-filter" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;max-width:100px;">
                            ${regions.map(r => `<option value="${escHtml(r)}" ${regionFilter === r ? 'selected' : ''}>${r === 'all' ? 'All Regions' : escHtml(r)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="bestiary-list" style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:0.2rem;">
                    ${filtered.length === 0 ? `
                        <div style="text-align:center;color:var(--text3);padding:0.5rem 0;font-size:0.8rem;">
                            No spirits found matching your criteria.
                        </div>
                    ` : filtered.map(spirit => renderBestiaryEntry(spirit, char)).join('')}
                </div>
            </div>

            <!-- ─── Bound Spirits ───────────────────────────────── -->
            <div class="summoning-bound" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🔗 Bound Spirits (${spirits.length})</span>
                    <div style="display:flex;gap:0.2rem;">
                        <button class="btn btn-xs btn-secondary" onclick="window.summonerReleaseAll()" style="color:var(--red);">Release All</button>
                    </div>
                </div>
                ${spirits.length === 0 ? `
                    <div style="text-align:center;color:var(--text3);padding:0.5rem 0;font-size:0.8rem;">
                        No spirits bound. Browse the bestiary and click "Bind" to form a pact.
                    </div>
                ` : spirits.map(spirit => renderBoundSpirit(spirit, char)).join('')}
            </div>

            <!-- ─── Quick Reference ────────────────────────────── -->
            <div class="summoning-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.1rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.15rem 0.3rem;border:1px solid var(--border);">
                <div>🔮 <strong>Call:</strong> 1 action (Wits+Presence vs Resist)</div>
                <div>🔗 <strong>Bind:</strong> 1 Boon or 1 Fatigue</div>
                <div>⚡ <strong>Command:</strong> Free (within nature); +1 Leash (against)</div>
                <div>🤝 <strong>Negotiate:</strong> Reduce Leash with offering</div>
                <div>🧹 <strong>Release:</strong> Wits+Presence vs Resist (peaceful)</div>
            </div>

        </div>
    `;

    el.innerHTML = html;

    // Attach event listeners
    attachSummoningEvents(el);
}

// ============================================================
// RENDER BESTIARY ENTRY (with dropdown for cost)
// ============================================================

function renderBestiaryEntry(spirit, char) {
    const id = spirit.id || 'spirit-' + generateId('spirit_');
    const name = safeString(spirit.name || 'Unnamed Spirit');
    const cls = getSpiritClass(spirit);
    const meta = CLASS_META[cls] || CLASS_META['II'];
    const icon = spirit.icon || getSpiritIcon(spirit);
    const summary = safeString(spirit.summary || '');
    const services = (spirit.services || []).slice(0, 3).join(', ');
    const price = safeString(spirit.price || 'Unknown');
    const nature = safeString(spirit.nature || 'Unknown');

    // Check if already bound
    const isBound = (char.boundSpirits || []).some(s => s.bestiaryId === id);

    // Cost dropdown
    const costOptions = BIND_COST_OPTIONS.map(opt =>
        `<option value="${opt.value}">${opt.label}</option>`
    ).join('');

    return `
        <div class="bestiary-entry" style="display:flex;align-items:center;gap:0.3rem;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);border-left:3px solid ${meta.color};background:var(--bg3);border-radius:3px;">
            <span style="font-size:1.1rem;">${escHtml(icon)}</span>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:0.2rem;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:0.8rem;">${escHtml(name)}</span>
                    <span style="font-size:0.5rem;color:${meta.color};font-weight:600;padding:0.05rem 0.3rem;border-radius:6px;background:${meta.color}22;">${meta.icon} ${meta.label}</span>
                    <span style="font-size:0.5rem;color:var(--text3);">🔗 ${meta.leash}</span>
                </div>
                ${summary ? `<div style="font-size:0.6rem;color:var(--text2);line-height:1.3;">${escHtml(summary)}</div>` : ''}
                <div style="font-size:0.55rem;color:var(--text3);">
                    ${services ? `🛠️ ${escHtml(services)}` : ''}
                    ${price ? ` · 💰 ${escHtml(price)}` : ''}
                    ${nature ? ` · ${getNatureIcon(nature)} ${escHtml(nature)}` : ''}
                </div>
            </div>
            <div style="display:flex;gap:0.2rem;flex-shrink:0;align-items:center;">
                <select class="bind-cost-select" style="font-size:0.55rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.2rem;">
                    ${costOptions}
                </select>
                <button class="btn btn-xs ${isBound ? 'btn-secondary' : 'btn-gold'} bind-btn" data-bestiary-id="${escHtml(id)}" ${isBound ? 'disabled' : ''}>
                    ${isBound ? '🔗 Bound' : '🔗 Bind'}
                </button>
                <button class="btn btn-xs btn-ghost" onclick="window.summonerViewSpirit('${escHtml(id)}')" title="View details" style="font-size:0.6rem;">📖</button>
            </div>
        </div>
    `;
}

// ============================================================
// RENDER BOUND SPIRIT (unchanged)
// ============================================================

function renderBoundSpirit(spirit, char) {
    const id = spirit.id;
    const name = safeString(spirit.name || 'Unnamed Spirit');
    const icon = spirit.icon || getSpiritIcon(spirit);
    const cls = getSpiritClass(spirit);
    const meta = CLASS_META[cls] || CLASS_META['II'];
    const currentLeash = spirit.currentLeash || 0;
    const leashMax = spirit.leashMax || meta.leash || 4;
    const mood = getMood(currentLeash, leashMax);
    const services = (spirit.services || []).slice(0, 2).join(', ');
    const commandCount = (spirit.commands || []).length;

    return `
        <div class="bound-spirit" style="display:flex;align-items:center;gap:0.3rem;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);border-left:3px solid ${mood.color};background:var(--bg3);border-radius:3px;">
            <span style="font-size:1.1rem;">${escHtml(icon)}</span>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:0.2rem;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:0.8rem;">${escHtml(name)}</span>
                    <span style="font-size:0.5rem;color:${mood.color};">${mood.emoji} ${mood.label}</span>
                    <span style="font-size:0.5rem;color:var(--text3);">🔗 ${currentLeash}/${leashMax}</span>
                </div>
                <div style="display:flex;align-items:center;gap:0.2rem;margin-top:0.05rem;">
                    <div style="width:60px;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
                        <div style="width:${Math.min(100, (currentLeash / leashMax) * 100)}%;height:100%;background:${mood.color};border-radius:2px;"></div>
                    </div>
                    ${services ? `<span style="font-size:0.5rem;color:var(--text3);">🛠️ ${escHtml(services)}</span>` : ''}
                    ${commandCount > 0 ? `<span style="font-size:0.5rem;color:var(--text3);">📋 ${commandCount} cmds</span>` : ''}
                </div>
            </div>
            <div style="display:flex;gap:0.15rem;flex-shrink:0;">
                <button class="btn btn-xs btn-ghost" onclick="window.summonerTickSpiritLeash('${escHtml(id)}', 1)" title="Tick Leash" style="font-size:0.6rem;">+</button>
                <button class="btn btn-xs btn-ghost" onclick="window.summonerTickSpiritLeash('${escHtml(id)}', -1)" title="Reduce Leash" style="font-size:0.6rem;">−</button>
                <button class="btn btn-xs btn-secondary" onclick="window.summonerCommandSpirit('${escHtml(id)}')" title="Command" style="font-size:0.6rem;">⚡</button>
                <button class="btn btn-xs btn-ghost" onclick="window.summonerViewBoundSpirit('${escHtml(id)}')" title="Details" style="font-size:0.6rem;">📖</button>
                <button class="btn btn-xs btn-danger" onclick="window.summonerReleaseSpirit('${escHtml(id)}')" title="Release" style="font-size:0.6rem;">✕</button>
            </div>
        </div>
    `;
}

// ============================================================
// EVENTS
// ============================================================

function attachSummoningEvents(el) {
    const searchInput = el.querySelector('#summoner-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            sessionStorage.setItem('fates-edge-summoner-search', e.target.value);
            renderSummoning(el);
        });
    }

    const classFilter = el.querySelector('#summoner-class-filter');
    if (classFilter) {
        classFilter.addEventListener('change', (e) => {
            sessionStorage.setItem('fates-edge-summoner-filter-class', e.target.value);
            renderSummoning(el);
        });
    }

    const natureFilter = el.querySelector('#summoner-nature-filter');
    if (natureFilter) {
        natureFilter.addEventListener('change', (e) => {
            sessionStorage.setItem('fates-edge-summoner-filter-nature', e.target.value);
            renderSummoning(el);
        });
    }

    const regionFilter = el.querySelector('#summoner-region-filter');
    if (regionFilter) {
        regionFilter.addEventListener('change', (e) => {
            sessionStorage.setItem('fates-edge-summoner-filter-region', e.target.value);
            renderSummoning(el);
        });
    }

    // Bind buttons: use the cost from the sibling select
    el.querySelectorAll('.bind-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const bestiaryId = btn.dataset.bestiaryId;
            const entry = btn.closest('.bestiary-entry');
            const costSelect = entry.querySelector('.bind-cost-select');
            const cost = costSelect ? costSelect.value : 'boon';
            window.summonerBindFromBestiaryWithCost(bestiaryId, cost);
        });
    });
}

// ============================================================
// GLOBAL FUNCTIONS (exposed to onclick)
// ============================================================

// ─── Bind from Bestiary with cost (dropdown) ──────────────────

window.summonerBindFromBestiaryWithCost = async function(bestiaryId, cost) {
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
    const meta = CLASS_META[cls] || CLASS_META['II'];

    if ((char.boundSpirits || []).some(s => s.bestiaryId === bestiaryId || s.name === name)) {
        showToast(`"${name}" is already bound.`, 'warning');
        return;
    }

    // Validate cost
    if (!['boon', 'fatigue', 'memory'].includes(cost)) {
        showToast('Invalid cost. Choose boon, fatigue, or memory.', 'error');
        return;
    }

    // Deduct cost
    if (cost === 'boon') {
        const boons = char.boons || 0;
        if (boons < 1) {
            showToast('Not enough Boons! You need 1 Boon.', 'error');
            return;
        }
        char.boons = boons - 1;
    } else if (cost === 'fatigue') {
        const fatigue = char.fatigue || 0;
        const maxFatigue = char.body || 1;
        if (fatigue >= maxFatigue) {
            showToast('Fatigue track is full!', 'error');
            return;
        }
        char.fatigue = fatigue + 1;
    }
    // Memory: no mechanical cost, but narrative

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
        leashMax: meta.leash || 4,
        currentLeash: 0,
        boundAt: Date.now(),
        commands: []
    };

    if (!char.boundSpirits) char.boundSpirits = [];
    char.boundSpirits.push(newSpirit);
    saveCharacter({ boundSpirits: char.boundSpirits, boons: char.boons, fatigue: char.fatigue });

    showToast(`🔮 Bound "${name}"! The leash is set. (Paid with ${cost})`, 'success');
    renderSummoning(document.getElementById('summoning-container'));
};

// ─── Ritual Binding with cost dropdown ──────────────────────

window.summonerBindRitualFromSelect = function() {
    const char = getCharacterData();
    if (!char) return;

    const costSelect = document.getElementById('summoner-bind-cost-select');
    const cost = costSelect ? costSelect.value : 'boon';

    // All other details still use prompts (name, nature, services, price, class)
    const name = prompt('🔮 Spirit name:');
    if (!name) return;

    const nature = prompt('Nature (Ancestral/Indigenous/Elemental/Vengeful/Fae/Shadow/Anchor):') || 'Unknown';
    const servicesInput = prompt('Services (comma-separated):') || '';
    const services = servicesInput.split(',').map(s => s.trim()).filter(Boolean);
    const price = prompt('Price (what you pay):') || 'None';
    const classInput = prompt('Class (I-V, or leave blank for II):') || 'II';
    const cls = classInput.toUpperCase();
    const meta = CLASS_META[cls] || CLASS_META['II'];

    if (!['boon', 'fatigue', 'memory'].includes(cost)) {
        showToast('Invalid cost. Choose boon, fatigue, or memory.', 'error');
        return;
    }

    if (cost === 'boon') {
        const boons = char.boons || 0;
        if (boons < 1) { showToast('Not enough Boons!', 'error'); return; }
        char.boons = boons - 1;
    } else if (cost === 'fatigue') {
        const fatigue = char.fatigue || 0;
        const maxFatigue = char.body || 1;
        if (fatigue >= maxFatigue) { showToast('Fatigue track full!', 'error'); return; }
        char.fatigue = fatigue + 1;
    }

    const newSpirit = {
        id: generateId('spirit_'),
        name: name,
        icon: '🌀',
        class: cls,
        nature: nature,
        services: services,
        price: price,
        leashMax: meta.leash || 4,
        currentLeash: 0,
        boundAt: Date.now(),
        commands: [],
        custom: true
    };

    if (!char.boundSpirits) char.boundSpirits = [];
    char.boundSpirits.push(newSpirit);
    saveCharacter({ boundSpirits: char.boundSpirits, boons: char.boons, fatigue: char.fatigue });

    showToast(`🔮 Bound "${name}" (${meta.label})`, 'success');
    renderSummoning(document.getElementById('summoning-container'));
};

// ─── Leash Management ───────────────────────────────────────

window.summonerTickLeash = function(amount = 1) {
    const char = getCharacterData();
    if (!char) return;
    const leash = (char.leash || 0) + amount;
    char.leash = Math.max(0, leash);
    saveCharacter({ leash: char.leash });

    const max = char.leashMax || 4;
    if (char.leash >= max) {
        showToast('💥 LEASH BROKEN! The spirit acts on its nature!', 'warning');
    } else if (char.leash >= max * 0.8) {
        showToast('⚠️ Leash is straining! The spirit grows restless.', 'warning');
    }
    renderSummoning(document.getElementById('summoning-container'));
};

window.summonerNegotiateFromSelect = function() {
    const char = getCharacterData();
    if (!char) return;

    const select = document.getElementById('summoner-negotiate-offer-select');
    if (!select) return;
    const offer = select.value;

    if (!['boon', 'fatigue', 'memory'].includes(offer)) {
        showToast('Invalid offer. Choose boon, fatigue, or memory.', 'error');
        return;
    }

    let accepted = false;
    if (offer === 'boon') {
        const boons = char.boons || 0;
        if (boons < 1) { showToast('Not enough Boons!', 'error'); return; }
        char.boons = boons - 1;
        accepted = true;
    } else if (offer === 'fatigue') {
        const fatigue = char.fatigue || 0;
        const maxFatigue = char.body || 1;
        if (fatigue >= maxFatigue) { showToast('Fatigue track full!', 'error'); return; }
        char.fatigue = fatigue + 1;
        accepted = true;
    } else {
        // Memory: always accepted but has narrative cost
        accepted = true;
        showToast('🧠 The spirit accepts your memory. It will carry it into the dark.', 'info');
    }

    if (!accepted) return;

    const current = char.leash || 0;
    char.leash = Math.max(0, Math.floor(current / 2));
    saveCharacter({ leash: char.leash, boons: char.boons, fatigue: char.fatigue });
    showToast(`🤝 Leash reduced to ${char.leash}/${char.leashMax || 4}.`, 'success');
    renderSummoning(document.getElementById('summoning-container'));
};

window.summonerClearLeash = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!confirm('Clear all leash tension? This may anger the spirit.')) return;
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
    const max = spirit.leashMax || 4;
    if (spirit.currentLeash >= max) {
        showToast(`💥 "${spirit.name}" breaks the leash! It acts on its nature!`, 'warning');
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

    const services = (spirit.services || []).join('\n• ');
    const command = prompt(
        `⚡ Command "${spirit.name}" (${spirit.nature || 'Unknown'})\n\n` +
        `Services:\n• ${services || 'None listed'}\n\n` +
        `Enter your command:`,
        'Scout ahead'
    );
    if (!command) return;

    const againstNature = confirm(`Is this command AGAINST "${spirit.nature}" nature? (Click Yes if it goes against their nature)`);
    if (againstNature) {
        spirit.currentLeash = (spirit.currentLeash || 0) + 1;
        showToast(`⚡ Command issued against nature. Leash +1.`, 'warning');
        if (spirit.currentLeash >= (spirit.leashMax || 4)) {
            showToast(`💥 "${spirit.name}" breaks the leash!`, 'warning');
        }
    } else {
        showToast(`✅ "${spirit.name}" follows your command.`, 'success');
    }

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

    const mood = getMood(spirit.currentLeash || 0, spirit.leashMax || 4);
    const warning = mood === MOODS.BREAKING || mood === MOODS.REBELLIOUS ?
        `⚠️ WARNING: This spirit is ${mood.label.toLowerCase()}! Releasing it may have consequences.` :
        `The spirit is ${mood.label.toLowerCase()}. It will depart peacefully.`;

    if (!confirm(`Release "${spirit.name}"?\n\n${warning}`)) return;

    char.boundSpirits = char.boundSpirits.filter(s => s.id !== spiritId);
    saveCharacter({ boundSpirits: char.boundSpirits });

    if (mood === MOODS.BREAKING || mood === MOODS.REBELLIOUS) {
        showToast(`💥 "${spirit.name}" is released in anger! The spirit will remember this.`, 'error');
    } else {
        showToast(`🌀 "${spirit.name}" is released peacefully.`, 'info');
    }
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

// ─── View Spirit Details ────────────────────────────────────

window.summonerViewSpirit = async function(bestiaryId) {
    const bestiary = await loadBestiary();
    const spirit = bestiary.find(s => (s.id || s.name) === bestiaryId);
    if (!spirit) {
        showToast('Spirit not found.', 'error');
        return;
    }

    const name = safeString(spirit.name || 'Unnamed Spirit');
    const cls = getSpiritClass(spirit);
    const meta = CLASS_META[cls] || CLASS_META['II'];
    const icon = spirit.icon || getSpiritIcon(spirit);
    const summary = safeString(spirit.summary || '');
    const lore = safeString(spirit.lore || '');
    const services = (spirit.services || []).join(', ');
    const price = safeString(spirit.price || 'Unknown');
    const nature = safeString(spirit.nature || 'Unknown');
    const connections = (spirit.connections || []).join(', ');
    const signs = (spirit.signs || []).join(', ');

    showToastWithHTML(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <span style="font-size:2rem;">${escHtml(icon)}</span>
                <div>
                    <div style="font-weight:600;font-size:1.1rem;">${escHtml(name)}</div>
                    <div style="font-size:0.8rem;color:var(--text3);">${getNatureIcon(nature)} ${escHtml(nature)} · ${meta.icon} ${meta.label}</div>
                    <div style="font-size:0.7rem;color:var(--text3);">🔗 Leash ${meta.leash}</div>
                </div>
            </div>
            ${summary ? `<div style="font-size:0.9rem;color:var(--text2);">${escHtml(summary)}</div>` : ''}
            ${lore ? `<div style="font-size:0.8rem;color:var(--text3);line-height:1.4;background:var(--bg3);padding:0.3rem;border-radius:4px;border-left:2px solid ${meta.color};">${escHtml(lore)}</div>` : ''}
            ${services ? `<div style="font-size:0.8rem;"><strong>🛠️ Services:</strong> ${escHtml(services)}</div>` : ''}
            ${price ? `<div style="font-size:0.8rem;"><strong>💰 Price:</strong> ${escHtml(price)}</div>` : ''}
            ${signs ? `<div style="font-size:0.75rem;color:var(--text3);"><strong>👁️ Signs:</strong> ${escHtml(signs)}</div>` : ''}
            ${connections ? `<div style="font-size:0.7rem;color:var(--text3);"><strong>🌍 Connections:</strong> ${escHtml(connections)}</div>` : ''}
            <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;border-top:1px solid var(--border);padding-top:0.2rem;">
                "The spirit remembers every slight."
            </div>
        </div>
    `, 'info');
};

window.summonerViewBoundSpirit = function(spiritId) {
    const char = getCharacterData();
    if (!char) return;
    const spirit = char.boundSpirits.find(s => s.id === spiritId);
    if (!spirit) return showToast('Spirit not found.', 'error');

    const cls = getSpiritClass(spirit);
    const meta = CLASS_META[cls] || CLASS_META['II'];
    const mood = getMood(spirit.currentLeash || 0, spirit.leashMax || 4);
    const commandCount = (spirit.commands || []).length;
    const lastCommand = spirit.commands?.[spirit.commands.length - 1];

    showToastWithHTML(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <span style="font-size:2rem;">${escHtml(spirit.icon || '🌀')}</span>
                <div>
                    <div style="font-weight:600;font-size:1.1rem;">${escHtml(spirit.name)}</div>
                    <div style="font-size:0.8rem;color:var(--text3);">${escHtml(spirit.nature || 'Unknown')} · ${meta.icon} ${meta.label}</div>
                </div>
            </div>
            <div style="display:flex;gap:0.5rem;font-size:0.8rem;">
                <span>🔗 ${spirit.currentLeash || 0}/${spirit.leashMax || 4}</span>
                <span style="color:${mood.color};">${mood.emoji} ${mood.label}</span>
                <span>📋 ${commandCount} commands</span>
            </div>
            ${spirit.services && spirit.services.length > 0 ? `<div style="font-size:0.8rem;"><strong>🛠️ Services:</strong> ${escHtml(spirit.services.join(', '))}</div>` : ''}
            ${spirit.price ? `<div style="font-size:0.8rem;"><strong>💰 Price:</strong> ${escHtml(spirit.price)}</div>` : ''}
            ${lastCommand ? `<div style="font-size:0.7rem;color:var(--text3);">📋 Last command: "${escHtml(lastCommand.command)}" ${lastCommand.againstNature ? '⚠️ against nature' : '✅ within nature'}</div>` : ''}
            <div style="font-size:0.7rem;color:var(--text3);border-top:1px solid var(--border);padding-top:0.2rem;">
                Bound since ${new Date(spirit.boundAt).toLocaleDateString()}
            </div>
        </div>
    `, 'info');
};

// ─── Refresh ──────────────────────────────────────────────────

window.summonerRefresh = function() {
    const el = document.getElementById('summoning-container');
    if (el) renderSummoning(el);
    showToast('🔄 Summoning refreshed.', 'info');
};

// ─── Backward Compatibility (redirect old functions) ──────

// Keep the old function names but redirect to the new ones with a default cost
window.summonerBindFromBestiary = async function(bestiaryId) {
    // Default to 'boon' but warn the user
    showToast('Please use the dropdown to select a cost.', 'info');
    // We could also fallback to prompt, but we want to eliminate modals.
    // Instead, we'll just show a message.
    // Better: we can automatically use 'boon' but that's not ideal.
    // We'll remove this function and rely on the new button.
    // But to avoid breakage, we'll redirect to the new function with 'boon'.
    await window.summonerBindFromBestiaryWithCost(bestiaryId, 'boon');
};

// Legacy function for ritual binding without dropdown – we keep it but it uses prompt,
// which we are deprecating. We'll redirect to the new function with a default cost.
window.summonerBindRitual = function() {
    // Use the dropdown if present, else fallback to prompt.
    const select = document.getElementById('summoner-bind-cost-select');
    if (select) {
        window.summonerBindRitualFromSelect();
    } else {
        showToast('Please refresh the panel to use the dropdown.', 'info');
    }
};

// Legacy negotiate – redirect to new function
window.summonerNegotiateLeash = function() {
    const select = document.getElementById('summoner-negotiate-offer-select');
    if (select) {
        window.summonerNegotiateFromSelect();
    } else {
        showToast('Please refresh the panel to use the dropdown.', 'info');
    }
};

// ============================================================
// TOAST WITH HTML
// ============================================================

function showToastWithHTML(html, type = 'info') {
    const existing = document.querySelector('.custom-toast-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'custom-toast-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.5rem; border-radius: var(--radius);
        max-width: 420px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 80vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-sm btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>`;
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

export default { renderSummoning };