/**
 * Spellcraft & Magic – Unified interface for all magical traditions
 *
 * "The coin that never spends is the one you don't remember taking."
 * – Serafine of the Velvet Touch
 *
 * Features:
 * - Character tracks (Obligation, Corruption, Leash, Mental Strain, Shadow/Shame/Identity)
 * - Path-specific components: Rites, Spellbook, Witchcraft, Calculator, Summoning, Monks, Cantor, Psionics
 * - Witchcraft (Hedge Gifts, Quick Workings, Full Rituals) is available to the Witch path AND
 *   anyone with the "Craft of the Hedge" talent — not gated on magicPath alone
 * - The ingredient/recipe Crafting Bench and item Codex live outside Spellcraft entirely now
 *   (sidebar → Crafting), open to every character regardless of path
 * - TAGS Calculator for Free Casters (and as a learning tool for others)
 * - Unified character selection via VTT
 * - Default "Path Finder" view helps players choose their magical tradition
 * - Path selection is now an inline dropdown in the header (no modal)
 * - NEW: Magic Paths Tour – a full-screen slide-show introduction to each tradition
 */

import { t as i18nText } from '@core/i18n.js';
import { vttStore } from '@core/vtt-store.js';
import { getState, getCharacter, updateCharacter, addCharacter, saveState } from '@core/state.js';
import { showToast } from '@components/Toast.js';
import { escHtml, generateId, safeParseInt } from '@core/utils.js';

// ─── Import sub‑components ──────────────────────────────────
import { renderRites } from './components/rites.js';
import { renderSpellbook } from './components/spellbook.js';
import { renderCalculator } from './components/calculator.js';
import { renderTrackers } from './components/trackers.js';
import { renderSummoning } from './components/summoning.js';
import { renderWitchcraft } from './components/witchcraft.js';
import { renderMonks } from './components/monks.js';
import { renderCantor } from './components/cantor.js';
import { renderPsion } from './components/psionics.js';

// ============================================================
// CONSTANTS – Path metadata for the UI
// ============================================================

const PATH_META = {
    'none': {
        label: 'No Path',
        icon: '👤',
        color: 'var(--text3)',
        description: 'No magical path chosen. The Crafting Bench (sidebar) is still available.',
        longDescription: 'You have not yet chosen a magical tradition. Explore the paths below to find the one that calls to you.',
        recommendations: []
    },
    'free-caster': {
        label: 'Free Caster',
        icon: '🔮',
        color: '#8e44ad',
        description: 'Combine TAGS into spells without a Patron. Every mistake is yours.',
        longDescription: 'Free Casters reach directly into the Weave, shaping reality through will, word, and gesture. No Patron, no Codex, no Symbol – just you and the raw stuff of creation. The power is intoxicating, but the Backlash is entirely your own.',
        recommendations: [
            'I want to improvise and invent my own spells',
            'I love the idea of raw, untamed magic',
            'I want to be self-reliant and answer to no Patron'
        ],
        archetypes: ['Sorcerer', 'Wild Mage', 'Improviser'],
        tourDescription: `<p>Free Casters reach directly into the Weave, shaping reality through will, word, and gesture. No Patron, no Codex, no Symbol – just you and the raw stuff of creation.</p>
<p>The power is intoxicating, but the Backlash is entirely your own. You pay in Fatigue, in scars, in moments of reality slipping sideways. The <strong>TAGS</strong> system is your grammar – verbs and nouns of the Weave that let you improvise anything from a spark to a gate.</p>
<p>You are the uncontrolled, the unpredictable, the one who makes the Synod nervous. But you are also free – answerable to no covenant, bound by no oath. The Weave is patient, but it expects precision.</p>
<p><em>"I do not borrow. I speak. And the Weave listens."</em></p>`
    },
    'runekeeper': {
        label: 'Runekeeper',
        icon: '📜',
        color: '#d4af37',
        description: 'Serve one Patron through Rites kept in a Codex. A Thiasos travels beside you and witnesses that service.',
        longDescription: 'Runekeepers are the agents of the great powers – Paladins of Mykkiel, Druids of Grimmir, Artificers of the Clockwork Monad. You serve one Patron, and in return you wield structured, reliable power. Your Codex is your covenant; your Thiasos is your witness.',
        recommendations: [
            'I want clear, structured power with defined costs',
            'I like the idea of being a paladin, druid, or artificer',
            'I want a deep, committed relationship with a single Patron'
        ],
        archetypes: ['Paladin', 'Druid', 'Artificer', 'Inquisitor', 'Templar'],
        tourDescription: `<p>Runekeepers are the agents of the great powers – the ones who speak with authority because they have been granted it. You serve a single Patron, and in return you wield structured, reliable power that is the envy of less disciplined mages.</p>
<p>Your <strong>Codex</strong> is not merely a book – it is a covenant made visible, a record of your service and your Patron's expectations. Your <strong>Thiasos</strong> is a fragment of the Patron's attention, a witness to your deeds.</p>
<p>A Runekeeper of Mykkiel is a Paladin of law. A Runekeeper of Grimmir is a Druid of the wild. A Runekeeper of the Clockwork Monad is an Artificer of impossible geometries. The Patron supplies the theme; the Rites supply the mechanics.</p>
<p><em>"I do not beg. I record. And in the recording, I become the hand that writes the law."</em></p>`
    },
    'invoker': {
        label: 'Invoker',
        icon: '🎴',
        color: '#e67e22',
        description: 'Carry Symbols from several Patrons. Each grants a Rite and carries its own Obligation.',
        longDescription: 'Invokers are gamblers who carry Symbols – physical anchors to Patrons they have never fully sworn to. They diversify their portfolio of power, juggling obligations like a merchant hedging against ruin. The power is versatile, but the interest is always compounding.',
        recommendations: [
            'I want flexibility and versatility',
            'I love risk/reward mechanics',
            'I want to be clever and find loopholes'
        ],
        archetypes: ['Warlock', 'Gambler', 'Occultist', 'Hedge-Mage'],
        tourDescription: `<p>Invokers are the gamblers of the magical world – the ones who carry <strong>Symbols</strong> from multiple Patrons, borrowing power without committing their soul to any one master. They are the ultimate pragmatists.</p>
<p>Each Symbol is a contract made tangible: a ring, a seal, a blackened coin. The Invoker does not ask what a Patron wants; they determine what a Patron lacks. They trade in obligations, juggling debts with the precision of a merchant.</p>
<p>When the knife is at the throat, the Invoker <strong>Cracks the Seal</strong> – invoking a Rite instantly, calling in the weight as an emergency loan. The price is never small, but the power is undeniable.</p>
<p><em>"I do not kneel. I sign. I do not pray. I calculate."</em></p>`
    },
    'cantor': {
        label: 'Cantor',
        icon: '🎵',
        color: '#6b4c9a',
        description: 'Old songs invite a Patron to echo through the singer. The voice changes first.',
        longDescription: 'Cantors are the wild singers, the mad pipers, the hymn-leaders who become the altar. They do not swear to Patrons – they echo them. Their power is intimacy, unmediated and deeply dangerous. The voice that sings too often to the storm begins to carry thunder in its timbre.',
        recommendations: [
            'I love social/performance scenes',
            'I enjoy tragic corruption arcs',
            'I want power that is literally part of my body'
        ],
        archetypes: ['Bard', 'Siren', 'Storm-Singer', 'Prophet'],
        tourDescription: `<p>Cantors are the wild singers, the mad pipers, the hymn-leaders who become the altar. They do not swear to Patrons – they <strong>echo</strong> them. Their power is intimacy, unmediated and deeply dangerous.</p>
<p>They require no focus but their own bodies. A Cantor without a voice can tap rhythm on their ribs. One without hands can whistle through their teeth. The body remembers the song even when the mind has forgotten it.</p>
<p><strong>Corruption</strong> for a Cantor is not a debt – it is a transformation undergone. The voice develops harmonics that should not exist. The breath carries scents from places not on any map. Some grow feathers in their hair; others find their shadows lagging half a step behind.</p>
<p><em>"You think you need a lute? My larynx is older than any tree. Hum, and the world will listen. Scream, and it might answer back."</em></p>`
    },
    'witch': {
        label: 'Witch',
        icon: '🧹',
        color: '#27ae60',
        description: 'Work with names, thresholds, and household rites. The magic is quiet; its failures are not.',
        longDescription: 'Witches practice the systemic magic that maintains the world – the quiet, overlooked power that is at once invisible and essential. They work with knots, thresholds, and the accumulated weight of stories. Their magic is intimate, corrupting in the old sense: not rotten, but changed.',
        recommendations: [
            'I like subtlety and preparation over flashy magic',
            'I enjoy folk horror and domestic magic',
            'I want to be underestimated and overlooked'
        ],
        archetypes: ['Hedge-Witch', 'Hearth-Mother', 'Knot-Weaver', 'Threshold-Keeper'],
        tourDescription: `<p>Witches practice the systemic magic that maintains the world – the quiet, overlooked power that is at once invisible and essential. They are the ones who know that a threshold must be swept three times counter-timerwise to keep the Hollow from noticing it.</p>
<p>Their magic is organic, grown from relationships with places and spirits that have no names in any grimoire. They work with the Ninth, with thresholds, with the accumulated weight of stories.</p>
<p>Every culture has Witches, though they call them different things – Hedge-Mothers, Breath-Wardens, Map-Adjusters, Cistern-Keepers. They are the ones who remember that magic is not merely for throwing fireballs but for ensuring that the fire does not burn down the village.</p>
<p><em>"The hedge is what keeps the wolves from the flock. I am the one who tends the hedge."</em></p>`
    },
    'psion': {
        label: 'Psion',
        icon: '🧠',
        color: '#2980b9',
        description: 'Turn discipline inward and work without a visible focus. Mental Strain records what the effort does to you.',
        longDescription: 'Psions look only to the self – the disciplined, trained, dangerous self. They carry no outward signs of their power. No glowing staff, no familiar, no song to warn you. They are accountable only to themselves, and in a world built on bonds and covenants, this makes them suspect. The mind is a fortress with no gates – safe until it isn\'t.',
        recommendations: [
            'I prefer internal struggle over external debts',
            'I like mind games and subtlety',
            'I dislike carrying obvious magical gear'
        ],
        archetypes: ['Mind-Mage', 'Telepath', 'Psychic', 'Monk'],
        tourDescription: `<p>Psions are the isolated ones, the untrusted, the inward-turned. Where other paths borrow from outside powers, the Psion looks only to the self – the disciplined, trained, dangerous self. They carry no outward signs of their power.</p>
<p>Their power is attrition. They pay not in Obligation but in themselves – every thought bent, every future glimpsed, every object moved by will alone leaves a hairline crack in the vessel. <strong>Mental Strain</strong> is the ledger of this cost.</p>
<p>They are hunted by the Chain-Lanterns of Ecktoria, licensed by the Synod of Thepyrgos, sealed in vaults by the Aeler, and shunned by the hearth-keepers of Aelaerem. They carry no outward sign. They are accountable only to themselves – and to the Mind's Ledger, which never forgets a weight.</p>
<p><em>"I carry no Symbol. I keep no Codex. My power has no scent, no sound, no outward sign. And that is why they fear me most of all."</em></p>`
    },
    'summoner': {
        label: 'Summoner',
        icon: '👁️',
        color: '#c0392b',
        description: 'Call a spirit into the world, agree on terms, and keep the Leash from tightening.',
        longDescription: 'Summoners are the diplomats of the damned and the blessed alike – the ones who open doors and hope to close them before something follows through. The dead, the fey, the demons, the angels – they are all spirits, and they all speak the language of contract. The Leash is a courtesy extended by the spirit while it finds your measure.',
        recommendations: [
            'I like tactical "pet" management and action economy',
            'I enjoy contracts, diplomacy, and bargaining with monsters',
            'I want a "friend" that might eat me'
        ],
        archetypes: ['Necromancer', 'Demonologist', 'Spirit-Binder', 'Shaman'],
        tourDescription: `<p>Summoners are the diplomats of the damned and the blessed alike – the ones who open doors and hope to close them before something follows through. The dead who cling to memory are spirits. The fey who trade in stolen time are spirits. The angels that guard thresholds, and the demons that wait hungry at the edge of sin – they are all spirits, and they all speak the language of contract.</p>
<p>The difference between a Summoner who treats with spirits as guests and one who treats them as slaves is the difference between a partnership that lasts decades and a rebellion that ends in blood. The <strong>Leash</strong> is the spiritual strain of keeping an Outsider in the world – a courtesy extended by the spirit while it finds your measure.</p>
<p><em>"I do not command the dead. I ask. I pay the price. And sometimes, when the contract is fair, they answer."</em></p>`
    },
    'monk': {
        label: 'Monk',
        icon: '🧘',
        color: '#f39c12',
        description: 'Train breath and body into a discipline that can answer steel or sorcery.',
        longDescription: 'Monks of the Unbroken Way walk the path of discipline and balance. They do not bargain with Patrons – they master themselves. Their power is not in what they can do, but in what they can choose not to do. The body is a temple; the breath is a weapon; stillness is the greatest disguise.',
        recommendations: [
            'I want discipline and balance over raw power',
            'I enjoy martial arts and meditation',
            'I want to serve the balance itself'
        ],
        archetypes: ['Martial Artist', 'Monk', 'Ascetic', 'Guardian'],
        tourDescription: `<p>Monks of the Unbroken Way walk the path of discipline and balance. They do not bargain with Patrons – they master themselves. Their power is not in what they can do, but in what they can choose not to do.</p>
<p>The body is a temple; the breath is a weapon; stillness is the greatest disguise. Monks channel power through breath, through the alignment of spirit and flesh, through the patient accumulation of inner strength. They are feared because they have no obvious weakness – only a discipline that seems to transcend the ordinary limits of mortality.</p>
<p>They serve the balance itself, intervening only when the scales tip too far. They are the quiet guardians, the ones who stand at the edge of the storm and wait for the right moment to act.</p>
<p><em>"I do not pray. I breathe. And in the breathing, the world listens."</em></p>`
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
        .path-finder-card .path-archetypes,
        .path-info-card .path-archetypes {
            display: flex;
            flex-wrap: wrap;
            gap: 0.2rem;
            margin-top: 0.1rem;
        }
        .path-finder-card .path-archetypes span,
        .path-info-card .path-archetypes span {
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
            border-inline-start: 4px solid var(--gold);
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

        /* ─── Path Info Cards (non-interactive reference) ────── */
        .path-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.6rem;
        }
        .path-info-card {
            background: var(--bg2);
            border-radius: var(--radius);
            padding: 0.6rem 0.8rem;
            border: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 0.2rem;
            text-align: start;
        }

        /* ─── Path dropdown styling ───────────────────────────── */
        .spellcraft-path-select {
            background: var(--bg3);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 0.15rem 0.4rem;
            font-size: 0.75rem;
            min-width: 140px;
            cursor: pointer;
        }
        .spellcraft-path-select:hover {
            border-color: var(--gold);
        }
        .spellcraft-path-select option {
            background: var(--bg1);
            color: var(--text);
        }

        /* ─── Magic Paths Tour (inline screen, not a pop-up) ──────── */
        .magic-tour-overlay {
            display: flex; align-items: center; justify-content: center;
            animation: magicTourFadeIn 0.4s ease;
            padding: 1rem 0;
            width: 100%;
        }
        @keyframes magicTourFadeIn {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
        }
        .magic-tour-card {
            background: var(--bg1); color: var(--text);
            max-width: 740px; width: 100%; max-height: 90vh;
            padding: 2rem; border-radius: 16px;
            border: 1px solid var(--border);
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 0.8rem;
        }
        .magic-tour-card .tour-header {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            flex-wrap: wrap;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.4rem;
        }
        .magic-tour-card .tour-header .tour-icon {
            font-size: 2.4rem;
        }
        .magic-tour-card .tour-header .tour-title {
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--text);
        }
        .magic-tour-card .tour-header .tour-count {
            margin-inline-start: auto;
            font-size: 0.8rem;
            color: var(--text3);
            background: var(--bg3);
            padding: 0.1rem 0.6rem;
            border-radius: 12px;
        }
        .magic-tour-card .tour-tagline {
            font-size: 1rem;
            color: var(--text2);
            font-style: italic;
            margin-top: -0.2rem;
        }
        .magic-tour-card .tour-description {
            font-size: 0.95rem;
            line-height: 1.7;
            color: var(--text);
            background: var(--bg2);
            padding: 0.8rem 1rem;
            border-radius: 8px;
            border-inline-start: 3px solid var(--gold);
            max-height: 260px;
            overflow-y: auto;
        }
        .magic-tour-card .tour-description p {
            margin: 0.5rem 0;
        }
        .magic-tour-card .tour-description em {
            color: var(--gold);
        }
        .magic-tour-card .tour-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            align-items: center;
            font-size: 0.8rem;
        }
        .magic-tour-card .tour-meta .tour-archetypes {
            display: flex;
            flex-wrap: wrap;
            gap: 0.3rem;
        }
        .magic-tour-card .tour-meta .tour-archetypes span {
            background: var(--bg3);
            padding: 0.05rem 0.5rem;
            border-radius: 10px;
            border: 1px solid var(--border);
            font-size: 0.7rem;
            color: var(--text2);
        }
        .magic-tour-card .tour-meta .tour-rec {
            font-size: 0.75rem;
            color: var(--text3);
            font-style: italic;
            margin-top: 0.1rem;
            flex-basis: 100%;
        }
        .magic-tour-card .tour-nav {
            display: flex;
            gap: 0.6rem;
            flex-wrap: wrap;
            align-items: center;
            border-top: 1px solid var(--border);
            padding-top: 0.6rem;
            margin-top: 0.2rem;
        }
        .magic-tour-card .tour-nav .btn {
            padding: 0.4rem 1rem;
            font-size: 0.85rem;
        }
        .magic-tour-card .tour-nav .tour-choose {
            background: var(--gold);
            color: #1a1400;
            font-weight: 700;
            border: none;
            border-radius: var(--radius);
            cursor: pointer;
        }
        .magic-tour-card .tour-nav .tour-choose:hover {
            background: var(--gold-hover);
        }
        .magic-tour-card .tour-nav .tour-skip {
            color: var(--text3);
            background: transparent;
            border: none;
            font-size: 0.8rem;
            cursor: pointer;
            text-decoration: underline;
        }
        .magic-tour-card .tour-nav .tour-skip:hover {
            color: var(--text);
        }
    `;
    document.head.appendChild(style);
}

// ============================================================
// STATE
// ============================================================

let container = null;
let eventListeners = [];
let activeTab = 'spellbook';
let renderToken = 0;
let isPathFinder = false;

// ─── Tour state ──────────────────────────────────────────────
let tourActive = false;
let tourSlideIndex = 0;
const TOUR_PATH_IDS = ['free-caster', 'runekeeper', 'invoker', 'cantor', 'witch', 'psion', 'summoner', 'monk'];

// ============================================================
// HELPERS (exported for sub‑components)
// ============================================================

export function getCharacterData(options = {}) {
    const { silent = false } = options;
    const id = vttStore.getSelectedCharacterId();
    if (!id) {
        if (!silent) showToast(i18nText("feature.spellcraft.selectACharacterFirst", null, "Select a character first."), 'error');
        return null;
    }
    const char = getCharacter(id);
    if (!char) {
        if (!silent) showToast(i18nText("feature.spellcraft.characterNotFound", null, "Character not found."), 'error');
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
    return [];
}

function getPatronIdsForRites(char) {
    if (!char) return [];
    if (char.magicPath === 'invoker') {
        return (char.symbols || [])
            .map(s => (typeof s === 'string' ? s : s?.patronId || s?.patron || s?.id))
            .filter(Boolean);
    }
    return char.patron ? [char.patron] : [];
}

function buildPathSelectOptions(currentPath) {
    return Object.entries(PATH_META)
        .map(([id, meta]) => {
            const selected = id === currentPath ? 'selected' : '';
            return `<option value="${id}" ${selected}>${meta.icon} ${meta.label}</option>`;
        })
        .join('');
}

// ============================================================
// MAGIC PATHS TOUR
// ============================================================

function getMagicTourSeen() {
    const state = getState();
    return state.app?.magicTourSeen || false;
}

function setMagicTourSeen(seen = true) {
    const state = getState();
    if (!state.app) state.app = {};
    state.app.magicTourSeen = seen;
    saveState();
}

export function showMagicTour() {
    if (tourActive) return;
    const char = getCharacterData({ silent: true });
    if (!char) {
        showToast(i18nText("feature.spellcraft.selectACharacterToExploreMagicPaths", null, "Select a character to explore magic paths."), 'info');
        return;
    }

    tourActive = true;
    tourSlideIndex = 0;
    renderTourSlide(char);
}

let tourHiddenSiblings = null;

function closeTour() {
    tourActive = false;
    const overlay = document.getElementById('magic-tour-overlay');
    if (overlay) overlay.remove();
    if (tourHiddenSiblings) {
        tourHiddenSiblings.forEach(ch => { ch.style.display = ''; });
        tourHiddenSiblings = null;
    }
    // Refocus on the main spellcraft container
    if (container) render(container);
}

function renderTourSlide(char) {
    let overlay = document.getElementById('magic-tour-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'magic-tour-overlay';
        overlay.className = 'magic-tour-overlay';
        const hostContainer = document.getElementById('app-content') || document.body;
        tourHiddenSiblings = Array.from(hostContainer.children);
        tourHiddenSiblings.forEach(ch => { ch.style.display = 'none'; });
        hostContainer.appendChild(overlay);
        window.scrollTo({ top: 0 });
    }

    const pathId = TOUR_PATH_IDS[tourSlideIndex];
    const meta = PATH_META[pathId];
    if (!meta) {
        closeTour();
        return;
    }

    const total = TOUR_PATH_IDS.length;
    const currentPath = char.magicPath || 'none';
    const isActive = currentPath === pathId;

    overlay.innerHTML = `
        <div class="magic-tour-card">
            <div class="tour-header">
                <span class="tour-icon">${meta.icon}</span>
                <span class="tour-title" style="color:${meta.color};">${meta.label}</span>
                <span class="tour-count">${tourSlideIndex + 1} / ${total}</span>
            </div>
            <div class="tour-tagline">${meta.description}</div>
            <div class="tour-description">${meta.tourDescription || meta.longDescription || meta.description}</div>
            <div class="tour-meta">
                ${meta.archetypes && meta.archetypes.length ? `
                    <div class="tour-archetypes">
                        <strong style="font-size:0.7rem;color:var(--text3);">Archetypes:</strong>
                        ${meta.archetypes.map(a => `<span>${escHtml(a)}</span>`).join('')}
                    </div>
                ` : ''}
                ${meta.recommendations && meta.recommendations.length ? `
                    <div class="tour-rec">
                        <strong>You might like this if:</strong>
                        ${meta.recommendations.map(r => `<div style="padding-inline-start:0.5rem;">• ${escHtml(r)}</div>`).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="tour-nav">
                <button class="btn btn-secondary" id="tour-prev" ${tourSlideIndex === 0 ? 'disabled' : ''}>← Previous</button>
                <button class="btn tour-choose" id="tour-choose" data-i18n="feature.spellcraft.chooseThisPath">✨ Choose This Path</button>
                <button class="btn btn-secondary" id="tour-next">${tourSlideIndex === total - 1 ? 'Finish Tour →' : 'Next →'}</button>
                <button class="tour-skip" id="tour-skip" data-i18n="feature.spellcraft.skipTour">Skip Tour</button>
            </div>
        </div>
    `;

    // Attach events
    overlay.querySelector('#tour-prev')?.addEventListener('click', () => {
        if (tourSlideIndex > 0) {
            tourSlideIndex--;
            renderTourSlide(char);
        }
    });

    overlay.querySelector('#tour-next')?.addEventListener('click', () => {
        if (tourSlideIndex < total - 1) {
            tourSlideIndex++;
            renderTourSlide(char);
        } else {
            // End of tour – mark seen and close
            setMagicTourSeen(true);
            closeTour();
        }
    });

    overlay.querySelector('#tour-choose')?.addEventListener('click', () => {
        if (pathId === currentPath) {
            showToast(i18nText("feature.spellcraft.alreadyOnTheValuePath", { value0: meta.label }, "Already on the {{value0}} path."), 'info');
            setMagicTourSeen(true);
            closeTour();
            return;
        }
        const result = updateCharacter(char.id, { magicPath: pathId });
        if (result) {
            showToast(i18nText("feature.spellcraft.chosenValue", { value0: meta.label }, "✨ Chosen: {{value0}}"), 'success');
            setMagicTourSeen(true);
            closeTour();
            // Re-render the main view
            if (container) render(container);
        } else {
            showToast(i18nText("feature.spellcraft.failedToUpdateCharacter", null, "Failed to update character."), 'error');
        }
    });

    overlay.querySelector('#tour-skip')?.addEventListener('click', () => {
        setMagicTourSeen(true);
        closeTour();
    });
}

function checkMagicTour() {
    const char = getCharacterData({ silent: true });
    if (!char) return;
    // Only show if not seen and character has no path or is on 'none'
    if (!getMagicTourSeen() && (char.magicPath === 'none' || !char.magicPath)) {
        // Small delay to let the UI render first
        setTimeout(() => showMagicTour(), 400);
    }
}

// ============================================================
// RENDER – No Character Selected
// ============================================================

function renderNoCharacterView() {
    const characters = getState().characters || [];

    return `
        <div class="spellcraft-empty" style="padding:1.5rem 1.5rem 2rem;text-align:center;color:var(--text3);background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border);">
            <h2 style="margin:0.5rem 0;color:var(--text);" data-i18n="feature.spellcraft.selectACharacter">Select a Character</h2>
            <p style="margin:0 0 0.8rem;">${characters.length > 0
                ? 'Choose one below, or select a character card in the VTT.'
                : 'Magic here belongs to a character. Make one first.'}</p>

            <div style="display:flex;gap:0.4rem;justify-content:center;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
                ${characters.length > 0 ? `
                    <select id="spellcraft-char-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.35rem 0.6rem;font-size:0.85rem;min-width:220px;">
                        <option value="" data-i18n="feature.spellcraft.chooseACharacter">— Choose a character —</option>
                        ${characters.map(c => {
                            const pathLabel = c.magicPath && c.magicPath !== 'none'
                                ? (PATH_META[c.magicPath]?.label || c.magicPath)
                                : null;
                            return `<option value="${escHtml(c.id)}">${escHtml(c.name || 'Unnamed')}${pathLabel ? ` — ${escHtml(pathLabel)}` : ''}</option>`;
                        }).join('')}
                    </select>
                ` : ''}
                ${characters.length > 0
                    ? '<button class="btn btn-gold" id="go-to-vtt-btn">Go to VTT</button>'
                    : '<button class="btn btn-gold" id="go-to-characters-btn">Create a character</button>'}
            </div>

            <div style="text-align: start;max-width:960px;margin:0 auto;">
                <div style="font-weight:600;color:var(--gold);margin-bottom:0.5rem;text-align:center;">Magic paths at a glance</div>
                <div class="path-info-grid">
                    ${Object.entries(PATH_META)
                        .filter(([id]) => id !== 'none')
                        .map(([id, meta]) => `
                            <div class="path-info-card">
                                <div style="display:flex;align-items:center;gap:0.3rem;">
                                    <span class="path-icon">${escHtml(meta.icon)}</span>
                                    <span class="path-label" style="color:${meta.color};">${escHtml(meta.label)}</span>
                                </div>
                                <div class="path-brief">${escHtml(meta.description)}</div>
                                ${meta.archetypes ? `
                                    <div class="path-archetypes">
                                        ${meta.archetypes.map(a => `<span>${escHtml(a)}</span>`).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                </div>
                <div style="margin-top:0.6rem;font-size:0.75rem;color:var(--text3);text-align:center;">
                    Every character may use the Spellbook. <strong>Craft of the Hedge</strong> opens Witchcraft without the Witch path. Ingredients, recipes, and the item Codex are under <strong>Crafting</strong>.
                </div>
            </div>
        </div>
    `;
}

function attachNoCharacterEvents() {
    const select = document.getElementById('spellcraft-char-select');
    if (select) {
        select.addEventListener('change', () => {
            const id = select.value;
            if (!id) return;
            vttStore.updateCharacters(getState().characters || []);
            vttStore.selectCharacter(id);
        });
    }
}

// ============================================================
// RENDER – Main
// ============================================================

export function render(el) {
    container = el;
    if (!container) return;

    ensureStyles();

    const char = getCharacterData({ silent: true });
    if (!char) {
        container.innerHTML = renderNoCharacterView();
        attachEvents();
        attachNoCharacterEvents();
        return;
    }

    const path = char.magicPath || 'none';
    const pathMeta = PATH_META[path] || PATH_META['none'];
    const patron = char.patron || null;
    const name = char.name || 'Unnamed Character';

    // If no path is selected, show the Path Finder view
    if (path === 'none') {
        isPathFinder = true;
        activeTab = 'spellbook';
        renderPathFinder(char, name, pathMeta, patron);
        attachEvents();
        // Check if we should show the magic tour
        checkMagicTour();
        return;
    }

    isPathFinder = false;
    const tabs = getAvailableTabs(char);
    if (!tabs.some(t => t.id === activeTab)) {
        activeTab = 'spellbook';
    }

    const pathOptionsHtml = buildPathSelectOptions(path);

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
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <select id="spellcraft-path-select" class="spellcraft-path-select" title="Change magic path" data-i18n-attr="title:feature.spellcraft.changeMagicPath">
                        ${pathOptionsHtml}
                    </select>
                    <button class="btn btn-sm btn-secondary" id="spellcraft-set-path" title="Set magic path" data-i18n-attr="title:feature.spellcraft.setMagicPath" data-i18n="feature.spellcraft.setPath">Set Path</button>
                    <button class="btn btn-sm btn-ghost" id="spellcraft-refresh" title="Refresh" data-i18n-attr="title:feature.spellcraft.refresh">↻</button>
                    <button class="btn btn-sm btn-secondary" id="show-magic-tour-btn" title="Magic Paths Tour" data-i18n-attr="title:feature.spellcraft.magicPathsTour" data-i18n="feature.spellcraft.tour">🎭 Tour</button>
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

            <!-- ─── Footer ────────────────────────────────────── -->
            <div class="spellcraft-footer" style="display:grid;grid-template-columns:2fr 1fr;gap:0.5rem;border-top:1px solid var(--border);padding-top:0.5rem;font-size:0.7rem;color:var(--text3);">
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <span>📖 <strong>Path:</strong> ${escHtml(pathMeta.label)}</span>
                    ${patron ? `<span>🔮 <strong>Patron:</strong> ${escHtml(patron)}</span>` : ''}
                    <span>📊 <strong>Tracks:</strong> ${escHtml(getTrackSummary(char))}</span>
                </div>
                <div style="text-align: end;font-style:italic;">
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
    const pathOptionsHtml = buildPathSelectOptions('none');

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
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <select id="spellcraft-path-select" class="spellcraft-path-select" title="Change magic path" data-i18n-attr="title:feature.spellcraft.changeMagicPath">
                        ${pathOptionsHtml}
                    </select>
                    <button class="btn btn-sm btn-secondary" id="spellcraft-set-path" title="Set magic path" data-i18n-attr="title:feature.spellcraft.setMagicPath" data-i18n="feature.spellcraft.setPath">Set Path</button>
                    <button class="btn btn-sm btn-ghost" id="spellcraft-refresh" title="Refresh" data-i18n-attr="title:feature.spellcraft.refresh">↻</button>
                    <button class="btn btn-sm btn-secondary" id="show-magic-tour-btn" title="Magic Paths Tour" data-i18n-attr="title:feature.spellcraft.magicPathsTour" data-i18n="feature.spellcraft.tour">🎭 Tour</button>
                </div>
            </header>

            <!-- ─── Path Finder Body ───────────────────────────── -->
            <div class="path-finder-body" style="display:flex;flex-direction:column;gap:0.8rem;">

                <div class="path-finder-header">
                    <h2 data-i18n="feature.spellcraft.chooseYourMagicalPath">🧙 Choose Your Magical Path</h2>
                    <p>
                        Your path defines how you interact with the Weave – and what it costs you.
                        Each path offers a different experience, from the structured covenants of the
                        Runekeeper to the raw will of the Psion.
                    </p>
                    <p style="font-size:0.8rem;color:var(--text3);">
                        <strong>💡 Tip:</strong> The Crafting page (sidebar) works regardless of your path, and
                        "Craft of the Hedge" unlocks Witchcraft's Hedge Gifts without committing to the Witch path.
                        Choose the path that feels right for your character's story.
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
                                            ${meta.recommendations.slice(0, 2).map(r => `<div style="padding-inline-start:0.5rem;">• ${escHtml(r)}</div>`).join('')}
                                        </div>
                                    ` : ''}
                                    <button class="path-choose-btn" data-path="${id}">${isActive ? '✓ Selected' : 'Choose This Path'}</button>
                                </div>
                            `;
                        }).join('')}
                </div>

                <div style="padding:0.5rem;background:var(--bg2);border-radius:var(--radius);border-inline-start:4px solid var(--gold);font-size:0.8rem;color:var(--text3);">
                    <strong>💡 Not sure?</strong> Take the <button class="btn btn-sm btn-secondary" id="show-magic-tour-btn-inline" style="font-size:0.7rem;padding:0.05rem 0.5rem;" data-i18n="feature.spellcraft.magicPathsTour_poyxc">🎭 Magic Paths Tour</button> to explore each tradition in depth.
                </div>

                <!-- ─── Tracks (minimal) ──────────────────────────── -->
                <div id="trackers-container" class="panel" style="padding:0.3rem 0.5rem;background:var(--bg2);border-radius:var(--radius);">
                    <div style="font-size:0.7rem;color:var(--text3);">No active tracks. Choose a path to begin.</div>
                </div>

                <!-- ─── Tabs (Spellbook, + Witchcraft if hedge-gifted) ─────────── -->
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
                <div style="text-align: end;font-style:italic;">
                    "The Weave remembers." – Lysandra
                </div>
            </div>

        </div>
    `;

    renderAll();
    attachEvents();

    // Path selection from cards
    container.querySelectorAll('.path-choose-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pathId = btn.dataset.path;
            if (pathId) selectPathForCharacter(pathId);
        });
    });

    container.querySelectorAll('.path-finder-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.path-choose-btn')) return;
            const pathId = card.dataset.path;
            if (pathId) selectPathForCharacter(pathId);
        });
    });

    // Inline tour button
    const inlineTourBtn = container.querySelector('#show-magic-tour-btn-inline');
    if (inlineTourBtn) {
        inlineTourBtn.addEventListener('click', () => showMagicTour());
    }

    // Check if we should show the magic tour
    checkMagicTour();
}

function selectPathForCharacter(pathId) {
    const char = getCharacterData();
    if (!char) return;

    if (pathId === char.magicPath) {
        showToast(i18nText("feature.spellcraft.alreadyOnTheValuePath", { value0: PATH_META[pathId]?.label || pathId }, "Already on the {{value0}} path."), 'info');
        return;
    }

    const result = updateCharacter(char.id, { magicPath: pathId });
    if (result) {
        showToast(i18nText("feature.spellcraft.pathChangedToValue", { value0: PATH_META[pathId]?.label || pathId }, "✨ Path changed to {{value0}}"), 'success');
        setMagicTourSeen(true);
        render(container);
    } else {
        showToast(i18nText("feature.spellcraft.failedToChangePath", null, "Failed to change path."), 'error');
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

function hasHedgeAccess(char) {
    const hasCraftOfTheHedge = (char.talents || []).some(t =>
        t.name === 'Craft of the Hedge' || t.id === 'craft-of-the-hedge'
    );
    return char.magicPath === 'witch' || hasCraftOfTheHedge
        || (char.hedgeGifts || []).length > 0
        || (char.witch?.hedgeGifts || []).length > 0;
}

function getAvailableTabs(char) {
    const path = char.magicPath || 'none';
    const tabs = [];

    tabs.push({ id: 'spellbook', label: 'Spellbook', icon: '📚' });

    // Hedge magic (Hedge Gifts, Quick Workings, Full Rituals, price
    // tracks) is available to the Witch path AND to anyone who's picked
    // up the "Craft of the Hedge" talent — not gated on magicPath alone.
    // The ingredient/recipe Crafting Bench itself lives outside Spellcraft
    // entirely now (sidebar → Crafting), open to every character.
    if (hasHedgeAccess(char)) {
        tabs.push({ id: 'witchcraft', label: 'Witchcraft', icon: '🧹' });
    }

    if (path === 'none') return tabs;

    if (path === 'free-caster') {
        tabs.push({ id: 'calculator', label: 'Calculator', icon: '🔮' });
    }

    if (path === 'runekeeper' || path === 'invoker') {
        tabs.push({ id: 'rites', label: 'Rites', icon: '📜' });
    }

    if (path === 'cantor') {
        tabs.push({ id: 'cantor', label: 'Cantor', icon: '🎵' });
    }

    if (path === 'psion') {
        tabs.push({ id: 'psionics', label: 'Psionics', icon: '🧠' });
    }

    if (path === 'summoner') {
        tabs.push({ id: 'summoning', label: 'Summoning', icon: '👁️' });
    }

    if (path === 'monk' || char.monasticTradition) {
        tabs.push({ id: 'monks', label: 'Monks', icon: '🧘' });
    }

    return tabs;
}

export async function renderActiveTabContent() {
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
            case 'spellbook':
                renderSpellbook(wrapper);
                break;
            case 'calculator':
                await renderCalculator(wrapper);
                break;
            case 'rites': {
                const patronIds = getPatronIdsForRites(char);
                await renderRites(wrapper, patronIds, char.id, {
                    path: char.magicPath === 'invoker' ? 'invoker' : 'runekeeper',
                    characterName: char.name
                });
                break;
            }
            case 'cantor':
                await renderCantor(wrapper);
                break;
            case 'psionics':
                await renderPsion(wrapper);
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

    if (myToken !== renderToken) return;

    contentEl.innerHTML = '';
    contentEl.appendChild(wrapper);
}

function renderAll() {
    const char = getCharacterData();
    if (!char) return;

    if (isPathFinder) {
        const trackersEl = document.getElementById('trackers-container');
        if (trackersEl) {
            trackersEl.innerHTML = `<div style="font-size:0.7rem;color:var(--text3);">No active tracks. Choose a path to begin.</div>`;
        }
        const tabs = getAvailableTabs(char);
        const tabsContainer = document.querySelector('.spellcraft-tabs');
        if (tabsContainer) {
            tabsContainer.innerHTML = renderTabButtons(tabs);
        }
        renderActiveTabContent();
        return;
    }

    const trackersEl = document.getElementById('trackers-container');
    if (trackersEl) renderTrackers(trackersEl);

    const tabs = getAvailableTabs(char);
    if (!tabs.some(t => t.id === activeTab)) {
        activeTab = 'spellbook';
    }
    const tabsContainer = document.querySelector('.spellcraft-tabs');
    if (tabsContainer) {
        tabsContainer.innerHTML = renderTabButtons(tabs);
    }

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
    eventListeners.forEach(({ target, event, handler }) => {
        (target || container)?.removeEventListener(event, handler);
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
            case 'go-to-characters-btn':
                window.location.hash = 'characters';
                break;
            case 'spellcraft-refresh':
                renderAll();
                showToast(i18nText("feature.spellcraft.refreshed", null, "🔄 Refreshed"), 'info');
                break;
            case 'spellcraft-set-path':
                setPathFromSelect();
                break;
            case 'show-magic-tour-btn':
                showMagicTour();
                break;
        }
    };

    if (container) {
        container.addEventListener('click', clickHandler);
        eventListeners.push({ target: container, event: 'click', handler: clickHandler });
    }

    // Handle path selection from dropdown (via the Set Path button)
    const setPathBtn = document.getElementById('spellcraft-set-path');
    if (setPathBtn) {
        const pathSelect = document.getElementById('spellcraft-path-select');
        if (pathSelect) {
            pathSelect.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    setPathFromSelect();
                }
            });
        }
    }

    // Listen for character selection changes
    const selectionHandler = () => {
        if (container) render(container);
    };
    document.addEventListener('characterSelected', selectionHandler);
    eventListeners.push({ target: document, event: 'characterSelected', handler: selectionHandler });
}

// ============================================================
// ACTIONS
// ============================================================

function setPathFromSelect() {
    const select = document.getElementById('spellcraft-path-select');
    if (!select) return;
    const pathId = select.value;
    if (!pathId) return;

    const char = getCharacterData();
    if (!char) return;

    if (pathId === char.magicPath) {
        showToast(i18nText("feature.spellcraft.alreadyOnTheValuePath", { value0: PATH_META[pathId]?.label || pathId }, "Already on the {{value0}} path."), 'info');
        return;
    }

    const result = updateCharacter(char.id, { magicPath: pathId });
    if (result) {
        activeTab = 'spellbook';
        setMagicTourSeen(true);
        showToast(i18nText("feature.spellcraft.magicPathChangedToValue", { value0: PATH_META[pathId]?.label || pathId }, "⚙️ Magic path changed to {{value0}}"), 'success');
        render(container);
    } else {
        showToast(i18nText("feature.spellcraft.failedToUpdateCharacter", null, "Failed to update character."), 'error');
    }
}

// Legacy function – kept for backward compatibility
function changeMagicPath() {
    const select = document.getElementById('spellcraft-path-select');
    if (select) {
        select.focus();
        showToast(i18nText("feature.spellcraft.selectAPathFromTheDropdownAnd", null, "Select a path from the dropdown and click \"Set Path\"."), 'info');
    } else {
        showToast(i18nText("feature.spellcraft.pleaseRefreshThePanelToUseThe", null, "Please refresh the panel to use the dropdown."), 'info');
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
    // Close tour if open
    const overlay = document.getElementById('magic-tour-overlay');
    if (overlay) overlay.remove();
    tourActive = false;
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
