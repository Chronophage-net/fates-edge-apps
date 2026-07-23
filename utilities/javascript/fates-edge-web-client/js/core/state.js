/**
 * State management for Fate's Edge Toolkit
 * v3.2 – With full Spellcraft & Magic support
 * - Extended character schema for all magical paths
 * - Tracks: Obligation, Corruption, Leash, Mental Strain, Shadow, Shame, Identity Strain
 * - Spellbook, bound spirits, repertoire, symbols
 * - Helper functions for magic-related data
 */

import { generateId, getBaseUrl as utilsGetBaseUrl, getStorage, setStorage, removeStorage } from './utils.js';

// ============================================================
// CONSTANTS
// ============================================================

export const DEFAULT_ATTRIBUTES = { body: 3, mind: 3, soul: 3 };

export const DEFAULT_SKILLS = {
  stealth: 0,
  investigate: 0,
  perception: 0,
  athletics: 0,
  acrobatics: 0,
  persuasion: 0,
  deception: 0,
  insight: 0,
  survival: 0,
  medicine: 0,
  arcana: 0,
  history: 0,
  religion: 0,
  nature: 0,
  intimidation: 0,
  performance: 0,
  sleightOfHand: 0,
};

// Magic paths
export const MAGIC_PATHS = [
  'none',
  'runekeeper',
  'invoker',
  'cantor',
  'witch',
  'psion',
  'summoner',
  'free-caster'
];

// ============================================================
// STATE
// ============================================================

const DEFAULT_STATE = {
    passwordHash: '',
    theme: 'dark',
    characters: [],
    campaigns: [],
    settings: {},
    timers: [],
    encounters: [],
    wikiEntries: [],
    archives: [],
    diceHistory: [],
    npcs: [],
    chatMessages: [],
    baseUrl: '',
    _version: {},
    _lastSync: 0,
    campaign: {
        whiteboard: {
            notes: [],
            drawings: [],
            stickyNotes: [],
        },
        kanban: {
            columns: {
                todo: { title: '📋 To Do', items: [] },
                doing: { title: '🔄 Doing', items: [] },
                done: { title: '✅ Done', items: [] },
                blocked: { title: '🚫 Blocked', items: [] }
            }
        },
        state: {
            activeThreats: [],
            opportunities: [],
            campaignTimers: [],
            notes: '',
            sessionLog: [],
            sceneTags: [],
            vttEvents: []
        }
    }
};

let state = { ...DEFAULT_STATE };
let saveCallbacks = [];
const STORAGE_KEY = 'fates-edge-state';
let pendingConflicts = [];

// ============================================================
// STATE OPERATIONS
// ============================================================

export function loadState() {
    try {
        const saved = getStorage(STORAGE_KEY);
        if (saved) {
            state = deepMerge({ ...DEFAULT_STATE }, saved);
        } else {
            state = { ...DEFAULT_STATE };
        }
    } catch (e) {
        console.warn('Failed to load state:', e);
        state = { ...DEFAULT_STATE };
    }
    return state;
}

function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const [source, ...rest] = sources;
    
    if (source === null || typeof source !== 'object') {
        return deepMerge(target, ...rest);
    }
    
    const result = Array.isArray(target) ? [...target] : { ...target };
    
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return deepMerge(result, ...rest);
}

export function saveState() {
    try {
        setStorage(STORAGE_KEY, state);
        triggerSaveEvent('saved');
    } catch (e) {
        console.warn('Failed to save state:', e);
        triggerSaveEvent('error');
    }
}

export function forceSave() {
    return saveState();
}

export function getState() {
    return state;
}

export function updateState(updates) {
    state = { ...state, ...updates };
    saveState();
    return state;
}

export function clearState() {
    state = { ...DEFAULT_STATE };
    removeStorage(STORAGE_KEY);
    triggerSaveEvent('cleared');
    return state;
}

// ============================================================
// CHARACTER DEFAULTS (extended for Spellcraft)
// ============================================================

/**
 * Ensure a character object has all required fields.
 * Now includes magic tracks, spellbook, bound spirits, etc.
 */
export function ensureCharacterDefaults(char) {
    if (!char) return null;

    // ---- Attributes ----
    if (!char.attributes || typeof char.attributes !== 'object') {
        char.attributes = { ...DEFAULT_ATTRIBUTES };
    } else {
        for (const [key, val] of Object.entries(DEFAULT_ATTRIBUTES)) {
            if (char.attributes[key] === undefined) {
                char.attributes[key] = val;
            }
        }
    }

    // ---- Skills ----
    if (!char.skills || typeof char.skills !== 'object') {
        char.skills = { ...DEFAULT_SKILLS };
    } else {
        for (const [key, val] of Object.entries(DEFAULT_SKILLS)) {
            if (char.skills[key] === undefined) {
                char.skills[key] = val;
            }
        }
    }

    // ---- Magic Path & Patron ----
    if (char.magicPath === undefined) char.magicPath = 'none';
    if (char.patron === undefined) char.patron = null;

    // ---- Tracks ----
    // Obligation (Runekeeper / Invoker)
    if (char.obligation === undefined) char.obligation = 0;
    // Corruption (Cantor)
    if (char.corruption === undefined) char.corruption = 0;
    if (char.corruptionMax === undefined) {
        // default to spirit, but we'll recompute on the fly if needed
        char.corruptionMax = char.attributes?.spirit || 3;
    }
    // Leash (Summoner)
    if (char.leash === undefined) char.leash = 0;
    if (char.leashMax === undefined) char.leashMax = 4;
    // Mental Strain (Psion)
    if (char.mentalStrain === undefined) char.mentalStrain = 0;
    if (char.mentalStrainMax === undefined) {
        char.mentalStrainMax = char.attributes?.spirit || 3;
    }
    // Witch tracks
    if (char.shadow === undefined) char.shadow = 0;
    if (char.shame === undefined) char.shame = 0;
    if (char.identityStrain === undefined) char.identityStrain = 0;

    // ---- Spellbook ----
    if (char.spellbook === undefined) char.spellbook = [];
    // ---- Bound Spirits ----
    if (char.boundSpirits === undefined) char.boundSpirits = [];
    // ---- Repertoire (Cantor songs) ----
    if (char.repertoire === undefined) char.repertoire = [];
    // ---- Symbols (Invoker) ----
    if (char.symbols === undefined) char.symbols = [];

    return char;
}

// ============================================================
// MERGE (with defaults)
// ============================================================

export function mergeState(remoteState, version) {
    const conflicts = [];

    if (remoteState.characters) {
        state.characters = state.characters || [];
        remoteState.characters.forEach(remoteChar => {
            const localChar = state.characters.find(c => c.id === remoteChar.id);
            if (localChar) {
                if ((localChar._syncVersion || 0) > (remoteChar._syncVersion || 0)) {
                    conflicts.push({
                        type: 'character',
                        id: remoteChar.id,
                        local: localChar,
                        remote: remoteChar,
                        resolution: 'pending'
                    });
                } else {
                    const mergedChar = { ...localChar, ...remoteChar };
                    ensureCharacterDefaults(mergedChar);
                    const idx = state.characters.indexOf(localChar);
                    state.characters[idx] = mergedChar;
                }
            } else {
                ensureCharacterDefaults(remoteChar);
                state.characters.push(remoteChar);
            }
        });
    }

    // Other merges (timers, wiki, chat, campaign) unchanged...
    if (remoteState.timers) {
        state.timers = state.timers || [];
        remoteState.timers.forEach(remoteTimer => {
            const localTimer = state.timers.find(t => t.id === remoteTimer.id);
            if (localTimer) {
                if ((remoteTimer.lastTick || 0) > (localTimer.lastTick || 0)) {
                    const idx = state.timers.indexOf(localTimer);
                    state.timers[idx] = remoteTimer;
                }
            } else {
                state.timers.push(remoteTimer);
            }
        });
    }

    if (remoteState.wikiEntries) {
        state.wikiEntries = state.wikiEntries || [];
        remoteState.wikiEntries.forEach(remoteEntry => {
            const localEntry = state.wikiEntries.find(w => w.id === remoteEntry.id);
            if (localEntry) {
                if ((remoteEntry.lastEdited || 0) > (localEntry.lastEdited || 0)) {
                    const idx = state.wikiEntries.indexOf(localEntry);
                    state.wikiEntries[idx] = remoteEntry;
                }
            } else {
                state.wikiEntries.push(remoteEntry);
            }
        });
    }

    if (remoteState.chatMessages) {
        state.chatMessages = state.chatMessages || [];
        const localIds = new Set(state.chatMessages.map(m => m.id));
        remoteState.chatMessages.forEach(msg => {
            if (!localIds.has(msg.id)) {
                state.chatMessages.push(msg);
            }
        });
        if (state.chatMessages.length > 200) {
            state.chatMessages = state.chatMessages.slice(-200);
        }
    }

    if (remoteState.campaign && remoteState.campaign.state) {
        const remoteCampaignState = remoteState.campaign.state;
        const localCampaignState = state.campaign ? state.campaign.state : {};
        
        if (remoteCampaignState.sessionLog && Array.isArray(remoteCampaignState.sessionLog)) {
            const localLog = localCampaignState.sessionLog || [];
            const localTimestamps = new Set(localLog.map(e => e.timestamp));
            remoteCampaignState.sessionLog.forEach(entry => {
                if (!localTimestamps.has(entry.timestamp)) {
                    localLog.push(entry);
                }
            });
            localLog.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            if (localLog.length > 500) {
                localCampaignState.sessionLog = localLog.slice(-500);
            } else {
                localCampaignState.sessionLog = localLog;
            }
        }
        
        if (remoteCampaignState.sceneTags && Array.isArray(remoteCampaignState.sceneTags)) {
            const localTags = localCampaignState.sceneTags || [];
            const tagSet = new Set(localTags);
            remoteCampaignState.sceneTags.forEach(tag => tagSet.add(tag));
            localCampaignState.sceneTags = Array.from(tagSet);
        }
        
        if (remoteCampaignState.vttEvents && Array.isArray(remoteCampaignState.vttEvents)) {
            const localEvents = localCampaignState.vttEvents || [];
            const localIds = new Set(localEvents.map(e => e.id));
            remoteCampaignState.vttEvents.forEach(event => {
                if (!localIds.has(event.id)) {
                    localEvents.push(event);
                }
            });
            if (localEvents.length > 200) {
                localCampaignState.vttEvents = localEvents.slice(-200);
            } else {
                localCampaignState.vttEvents = localEvents;
            }
        }
        
        if (remoteCampaignState.activeThreats && Array.isArray(remoteCampaignState.activeThreats)) {
            const localThreats = localCampaignState.activeThreats || [];
            const localIds = new Set(localThreats.map(t => t.id));
            remoteCampaignState.activeThreats.forEach(threat => {
                if (!localIds.has(threat.id)) {
                    localThreats.push(threat);
                }
            });
            localCampaignState.activeThreats = localThreats;
        }
        
        if (remoteCampaignState.opportunities && Array.isArray(remoteCampaignState.opportunities)) {
            const localOpps = localCampaignState.opportunities || [];
            const localIds = new Set(localOpps.map(o => o.id));
            remoteCampaignState.opportunities.forEach(opp => {
                if (!localIds.has(opp.id)) {
                    localOpps.push(opp);
                }
            });
            localCampaignState.opportunities = localOpps;
        }
        
        if (remoteCampaignState.campaignTimers && Array.isArray(remoteCampaignState.campaignTimers)) {
            const localTimers = localCampaignState.campaignTimers || [];
            const remoteMap = new Map(remoteCampaignState.campaignTimers.map(t => [t.id, t]));
            const merged = localTimers.map(t => remoteMap.get(t.id) || t);
            remoteCampaignState.campaignTimers.forEach(t => {
                if (!merged.some(m => m.id === t.id)) {
                    merged.push(t);
                }
            });
            localCampaignState.campaignTimers = merged;
        }
        
        if (remoteCampaignState.notes && localCampaignState.notes !== remoteCampaignState.notes) {
            localCampaignState.notes = remoteCampaignState.notes + (localCampaignState.notes ? '\n\n--- Remote Sync ---\n' + localCampaignState.notes : '');
        }
        
        if (!state.campaign) state.campaign = { ...DEFAULT_STATE.campaign };
        state.campaign.state = localCampaignState;
    }

    if (conflicts.length > 0) {
        pendingConflicts = [...pendingConflicts, ...conflicts];
        document.dispatchEvent(new CustomEvent('syncConflict', {
            detail: { conflicts }
        }));
    }

    state._version = version;
    state._lastSync = Date.now();
    saveState();
}

export function getPendingConflicts() {
    return pendingConflicts;
}

export function resolveConflict(conflictId, choice) {
    const conflict = pendingConflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    switch (choice) {
        case 'local':
            break;
        case 'remote':
            const idx = state.characters.indexOf(conflict.local);
            if (idx !== -1) state.characters[idx] = conflict.remote;
            break;
        case 'merge':
            const merged = { ...conflict.local, ...conflict.remote };
            merged._syncVersion = Math.max(
                conflict.local._syncVersion || 0,
                conflict.remote._syncVersion || 0
            ) + 1;
            const mergeIdx = state.characters.indexOf(conflict.local);
            if (mergeIdx !== -1) state.characters[mergeIdx] = merged;
            break;
    }

    pendingConflicts = pendingConflicts.filter(c => c.id !== conflictId);
    saveState();
}

export function getStateValue(path, defaultValue = null) {
    const parts = path.split('.');
    let current = state;
    for (const part of parts) {
        if (current === undefined || current === null) {
            return defaultValue;
        }
        current = current[part];
    }
    return current !== undefined ? current : defaultValue;
}

export function setStateValue(path, value) {
    const parts = path.split('.');
    let current = state;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined || current[part] === null || typeof current[part] !== 'object') {
            current[part] = {};
        }
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
    saveState();
    return state;
}

export function getBaseUrl() {
    return utilsGetBaseUrl(state);
}

export function setBaseUrl(url) {
    state.baseUrl = url;
    saveState();
    return state;
}

export function setPasswordHash(hash) {
    state.passwordHash = hash;
    saveState();
    return state;
}

// ============================================================
// CAMPAIGN STATE OPERATIONS
// ============================================================

export function getCampaignState() {
    if (!state.campaign) {
        state.campaign = { ...DEFAULT_STATE.campaign };
        saveState();
    }
    if (!state.campaign.state) {
        state.campaign.state = { ...DEFAULT_STATE.campaign.state };
        saveState();
    }
    return state.campaign.state;
}

export function updateCampaignState(updates) {
    const campaignState = getCampaignState();
    Object.assign(campaignState, updates);
    saveState();
    return campaignState;
}

export function addSessionLogEntry(message, type = 'info') {
    const campaignState = getCampaignState();
    if (!campaignState.sessionLog) {
        campaignState.sessionLog = [];
    }
    const entry = {
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString(),
        message: message,
        type: type
    };
    campaignState.sessionLog.push(entry);
    if (campaignState.sessionLog.length > 500) {
        campaignState.sessionLog = campaignState.sessionLog.slice(-500);
    }
    saveState();
    return entry;
}

export function getSessionLog() {
    const campaignState = getCampaignState();
    return campaignState.sessionLog || [];
}

export function clearSessionLog() {
    const campaignState = getCampaignState();
    campaignState.sessionLog = [];
    saveState();
    return true;
}

export function getSceneTags() {
    const campaignState = getCampaignState();
    return campaignState.sceneTags || [];
}

export function addSceneTag(tag) {
    const campaignState = getCampaignState();
    if (!campaignState.sceneTags) {
        campaignState.sceneTags = [];
    }
    const normalizedTag = tag.toUpperCase().trim();
    if (!normalizedTag) return false;
    if (campaignState.sceneTags.includes(normalizedTag)) return false;
    campaignState.sceneTags.push(normalizedTag);
    saveState();
    return true;
}

export function removeSceneTag(tag) {
    const campaignState = getCampaignState();
    if (!campaignState.sceneTags) return false;
    const normalizedTag = tag.toUpperCase().trim();
    const index = campaignState.sceneTags.indexOf(normalizedTag);
    if (index === -1) return false;
    campaignState.sceneTags.splice(index, 1);
    saveState();
    return true;
}

export function clearSceneTags() {
    const campaignState = getCampaignState();
    campaignState.sceneTags = [];
    saveState();
    return true;
}

// ============================================================
// VTT EVENT OPERATIONS
// ============================================================

export function addVTTEvent(event) {
    const campaignState = getCampaignState();
    if (!campaignState.vttEvents) {
        campaignState.vttEvents = [];
    }
    if (!event.id) {
        event.id = generateId(8);
    }
    if (!event.timestamp) {
        event.timestamp = new Date().toISOString();
    }
    campaignState.vttEvents.push(event);
    if (campaignState.vttEvents.length > 200) {
        campaignState.vttEvents = campaignState.vttEvents.slice(-200);
    }
    saveState();
    return event;
}

export function getVTTEvents() {
    const campaignState = getCampaignState();
    return campaignState.vttEvents || [];
}

export function clearVTTEvents() {
    const campaignState = getCampaignState();
    campaignState.vttEvents = [];
    saveState();
    return true;
}

// ============================================================
// CHARACTER OPERATIONS (extended)
// ============================================================

export function getCharacters() {
    if (state.characters) {
        state.characters = state.characters.map(c => ensureCharacterDefaults(c));
    }
    return state.characters || [];
}

export function getCharacter(id) {
    const characters = state.characters || [];
    const char = characters.find(c => c.id === id) || null;
    return char ? ensureCharacterDefaults(char) : null;
}

export function addCharacter(character) {
    if (!character.id) {
        character.id = generateId(8);
    }
    if (!character.createdAt) {
        character.createdAt = new Date().toISOString();
    }
    ensureCharacterDefaults(character);
    character._syncVersion = Date.now();
    state.characters = [...(state.characters || []), character];
    saveState();
    return character;
}

export function updateCharacter(id, updates) {
    const characters = state.characters || [];
    const index = characters.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    const existing = characters[index];
    const updated = { 
        ...existing, 
        ...updates, 
        updatedAt: new Date().toISOString(),
        _syncVersion: Date.now()
    };
    ensureCharacterDefaults(updated);
    state.characters = [...characters.slice(0, index), updated, ...characters.slice(index + 1)];
    saveState();
    return updated;
}

export function deleteCharacter(id) {
    state.characters = (state.characters || []).filter(c => c.id !== id);
    saveState();
    return true;
}

// ---- Attribute & Skill helpers ----
export function getCharacterAttribute(charId, attrName) {
    const char = getCharacter(charId);
    if (!char) return null;
    return char.attributes?.[attrName] ?? null;
}

export function getCharacterSkill(charId, skillName) {
    const char = getCharacter(charId);
    if (!char) return null;
    return char.skills?.[skillName] ?? null;
}

// ---- Magic helpers (new) ----
export function getCharacterMagicPath(charId) {
    const char = getCharacter(charId);
    return char ? char.magicPath || 'none' : 'none';
}

export function getCharacterPatron(charId) {
    const char = getCharacter(charId);
    return char ? char.patron || null : null;
}

export function getCharacterTrack(charId, trackName) {
    const char = getCharacter(charId);
    if (!char) return null;
    const validTracks = ['obligation', 'corruption', 'corruptionMax', 'leash', 'leashMax',
                         'mentalStrain', 'mentalStrainMax', 'shadow', 'shame', 'identityStrain'];
    if (validTracks.includes(trackName)) {
        return char[trackName] ?? 0;
    }
    return null;
}

export function updateCharacterTrack(charId, trackName, value) {
    const char = getCharacter(charId);
    if (!char) return null;
    const validTracks = ['obligation', 'corruption', 'corruptionMax', 'leash', 'leashMax',
                         'mentalStrain', 'mentalStrainMax', 'shadow', 'shame', 'identityStrain'];
    if (!validTracks.includes(trackName)) return null;
    const updates = { [trackName]: Math.max(0, value) };
    return updateCharacter(charId, updates);
}

// Spellbook helpers
export function getCharacterSpellbook(charId) {
    const char = getCharacter(charId);
    return char ? char.spellbook || [] : [];
}

export function addSpellToCharacter(charId, spell) {
    const char = getCharacter(charId);
    if (!char) return null;
    if (!spell.id) spell.id = generateId('spell_');
    if (!char.spellbook) char.spellbook = [];
    char.spellbook.push(spell);
    return updateCharacter(charId, { spellbook: char.spellbook });
}

export function removeSpellFromCharacter(charId, spellId) {
    const char = getCharacter(charId);
    if (!char) return null;
    if (!char.spellbook) return null;
    char.spellbook = char.spellbook.filter(s => s.id !== spellId);
    return updateCharacter(charId, { spellbook: char.spellbook });
}

// Bound spirits helpers
export function getCharacterSpirits(charId) {
    const char = getCharacter(charId);
    return char ? char.boundSpirits || [] : [];
}

export function addSpiritToCharacter(charId, spirit) {
    const char = getCharacter(charId);
    if (!char) return null;
    if (!spirit.id) spirit.id = generateId('spirit_');
    if (!char.boundSpirits) char.boundSpirits = [];
    char.boundSpirits.push(spirit);
    return updateCharacter(charId, { boundSpirits: char.boundSpirits });
}

export function removeSpiritFromCharacter(charId, spiritId) {
    const char = getCharacter(charId);
    if (!char) return null;
    if (!char.boundSpirits) return null;
    char.boundSpirits = char.boundSpirits.filter(s => s.id !== spiritId);
    return updateCharacter(charId, { boundSpirits: char.boundSpirits });
}

// Repertoire helpers (Cantor)
export function getCharacterRepertoire(charId) {
    const char = getCharacter(charId);
    return char ? char.repertoire || [] : [];
}

export function addSongToRepertoire(charId, songName) {
    const char = getCharacter(charId);
    if (!char) return null;
    if (!char.repertoire) char.repertoire = [];
    if (!char.repertoire.includes(songName)) {
        char.repertoire.push(songName);
        return updateCharacter(charId, { repertoire: char.repertoire });
    }
    return char;
}

export function removeSongFromRepertoire(charId, songName) {
    const char = getCharacter(charId);
    if (!char) return null;
    if (!char.repertoire) return null;
    char.repertoire = char.repertoire.filter(s => s !== songName);
    return updateCharacter(charId, { repertoire: char.repertoire });
}

// Symbols helpers (Invoker)
export function getCharacterSymbols(charId) {
    const char = getCharacter(charId);
    return char ? char.symbols || [] : [];
}

export function addSymbolToCharacter(charId, symbol) {
    const char = getCharacter(charId);
    if (!char) return null;
    if (!symbol.id) symbol.id = generateId('sym_');
    if (!char.symbols) char.symbols = [];
    char.symbols.push(symbol);
    return updateCharacter(charId, { symbols: char.symbols });
}

export function removeSymbolFromCharacter(charId, symbolId) {
    const char = getCharacter(charId);
    if (!char) return null;
    if (!char.symbols) return null;
    char.symbols = char.symbols.filter(s => s.id !== symbolId);
    return updateCharacter(charId, { symbols: char.symbols });
}

// ============================================================
// NPC OPERATIONS (unchanged)
// ============================================================

export function addNPC(npc) {
    if (!npc.id) {
        npc.id = generateId(8);
    }
    if (!npc.createdAt) {
        npc.createdAt = new Date().toISOString();
    }
    if (npc.characterId) {
        const character = getCharacter(npc.characterId);
        if (character) {
            if (!character.npcs) {
                character.npcs = [];
            }
            character.npcs.push(npc);
            updateCharacter(npc.characterId, character);
            return npc;
        }
    }
    if (!state.npcs) {
        state.npcs = [];
    }
    state.npcs.push(npc);
    saveState();
    return npc;
}

export function getNPCs() {
    return state.npcs || [];
}

export function getNPC(id) {
    const npcs = state.npcs || [];
    return npcs.find(n => n.id === id) || null;
}

export function getCharacterNPCs(characterId) {
    const character = getCharacter(characterId);
    if (character) {
        return character.npcs || [];
    }
    return [];
}

// ============================================================
// CAMPAIGN OPERATIONS (unchanged)
// ============================================================

export function getCampaigns() {
    return state.campaigns || [];
}

export function getCampaign(id) {
    const campaigns = state.campaigns || [];
    return campaigns.find(c => c.id === id) || null;
}

export function addCampaign(campaign) {
    if (!campaign.id) {
        campaign.id = generateId(8);
    }
    if (!campaign.createdAt) {
        campaign.createdAt = new Date().toISOString();
    }
    state.campaigns = [...(state.campaigns || []), campaign];
    saveState();
    return campaign;
}

export function updateCampaign(id, updates) {
    const campaigns = state.campaigns || [];
    const index = campaigns.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    const updated = { ...campaigns[index], ...updates, updatedAt: new Date().toISOString() };
    state.campaigns = [...campaigns.slice(0, index), updated, ...campaigns.slice(index + 1)];
    saveState();
    return updated;
}

export function deleteCampaign(id) {
    state.campaigns = (state.campaigns || []).filter(c => c.id !== id);
    saveState();
    return true;
}

// ============================================================
// TIMER OPERATIONS (unchanged)
// ============================================================

export function getTimers() {
    return state.timers || [];
}

export function getTimer(id) {
    const timers = state.timers || [];
    return timers.find(t => t.id === id) || null;
}

export function addTimer(timer) {
    if (!timer.id) {
        timer.id = generateId(8);
    }
    if (!timer.createdAt) {
        timer.createdAt = new Date().toISOString();
    }
    state.timers = [...(state.timers || []), timer];
    saveState();
    return timer;
}

export function updateTimer(id, updates) {
    const timers = state.timers || [];
    const index = timers.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    const updated = { ...timers[index], ...updates, updatedAt: new Date().toISOString() };
    state.timers = [...timers.slice(0, index), updated, ...timers.slice(index + 1)];
    saveState();
    return updated;
}

export function deleteTimer(id) {
    state.timers = (state.timers || []).filter(t => t.id !== id);
    saveState();
    return true;
}

// ============================================================
// ENCOUNTER OPERATIONS (unchanged)
// ============================================================

export function getEncounters() {
    return state.encounters || [];
}

export function getEncounter(id) {
    const encounters = state.encounters || [];
    return encounters.find(e => e.id === id) || null;
}

export function addEncounter(encounter) {
    if (!encounter.id) {
        encounter.id = generateId(8);
    }
    if (!encounter.createdAt) {
        encounter.createdAt = new Date().toISOString();
    }
    state.encounters = [...(state.encounters || []), encounter];
    saveState();
    return encounter;
}

export function updateEncounter(id, updates) {
    const encounters = state.encounters || [];
    const index = encounters.findIndex(e => e.id === id);
    if (index === -1) return null;
    
    const updated = { ...encounters[index], ...updates, updatedAt: new Date().toISOString() };
    state.encounters = [...encounters.slice(0, index), updated, ...encounters.slice(index + 1)];
    saveState();
    return updated;
}

export function deleteEncounter(id) {
    state.encounters = (state.encounters || []).filter(e => e.id !== id);
    saveState();
    return true;
}

// ============================================================
// WIKI OPERATIONS (unchanged)
// ============================================================

export function getWikiEntries() {
    return state.wikiEntries || [];
}

export function getWikiEntry(id) {
    const wikiEntries = state.wikiEntries || [];
    return wikiEntries.find(w => w.id === id) || null;
}

export function addWikiEntry(entry) {
    if (!entry.id) {
        entry.id = generateId(8);
    }
    if (!entry.createdAt) {
        entry.createdAt = new Date().toISOString();
    }
    entry.lastEdited = Date.now();
    state.wikiEntries = [...(state.wikiEntries || []), entry];
    saveState();
    return entry;
}

export function updateWikiEntry(id, updates) {
    const wikiEntries = state.wikiEntries || [];
    const index = wikiEntries.findIndex(w => w.id === id);
    if (index === -1) return null;
    
    const updated = { ...wikiEntries[index], ...updates, updatedAt: new Date().toISOString(), lastEdited: Date.now() };
    state.wikiEntries = [...wikiEntries.slice(0, index), updated, ...wikiEntries.slice(index + 1)];
    saveState();
    return updated;
}

export function deleteWikiEntry(id) {
    state.wikiEntries = (state.wikiEntries || []).filter(w => w.id !== id);
    saveState();
    return true;
}

// ============================================================
// ARCHIVE OPERATIONS (unchanged)
// ============================================================

export function getArchives() {
    return state.archives || [];
}

export function getArchive(id) {
    const archives = state.archives || [];
    return archives.find(a => a.id === id) || null;
}

export function addArchive(archive) {
    if (!archive.id) {
        archive.id = generateId(8);
    }
    if (!archive.createdAt) {
        archive.createdAt = new Date().toISOString();
    }
    state.archives = [...(state.archives || []), archive];
    saveState();
    return archive;
}

export function updateArchive(id, updates) {
    const archives = state.archives || [];
    const index = archives.findIndex(a => a.id === id);
    if (index === -1) return null;
    
    const updated = { ...archives[index], ...updates, updatedAt: new Date().toISOString() };
    state.archives = [...archives.slice(0, index), updated, ...archives.slice(index + 1)];
    saveState();
    return updated;
}

export function deleteArchive(id) {
    state.archives = (state.archives || []).filter(a => a.id !== id);
    saveState();
    return true;
}

// ============================================================
// DICE OPERATIONS (unchanged)
// ============================================================

export function getDiceHistory() {
    return state.diceHistory || [];
}

export function addDiceRoll(roll) {
    if (!roll.id) {
        roll.id = generateId(8);
    }
    if (!roll.timestamp) {
        roll.timestamp = new Date().toISOString();
    }
    state.diceHistory = [roll, ...(state.diceHistory || [])].slice(0, 100);
    saveState();
    return roll;
}

export function addRoll(roll) {
    return addDiceRoll(roll);
}

export function clearDiceHistory() {
    state.diceHistory = [];
    saveState();
    return true;
}

export function clearRollHistory() {
    return clearDiceHistory();
}

// ============================================================
// CHAT OPERATIONS (unchanged)
// ============================================================

export function addChatMessage(message) {
    if (!message.id) {
        message.id = generateId(8);
    }
    if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
    }
    if (!state.chatMessages) {
        state.chatMessages = [];
    }
    state.chatMessages = [message, ...state.chatMessages].slice(0, 100);
    saveState();
    return message;
}

export function getChatMessages() {
    return state.chatMessages || [];
}

export function clearChatHistory() {
    state.chatMessages = [];
    saveState();
    return true;
}

// ============================================================
// DATA IMPORT/EXPORT (unchanged)
// ============================================================

export function importData(data) {
    try {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
        }
        const merged = deepMerge({ ...DEFAULT_STATE }, state, data);
        state = merged;
        saveState();
        return { success: true };
    } catch (e) {
        console.error('Failed to import data:', e);
        return { success: false, error: e.message };
    }
}

export function exportData() {
    return {
        ...state,
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
}

export function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        clearState();
        return true;
    }
    return false;
}

// ============================================================
// SAVE STATUS
// ============================================================

export function onSave(callback) {
    if (typeof callback === 'function') {
        saveCallbacks.push(callback);
        callback('saved');
    }
}

export function offSave(callback) {
    const index = saveCallbacks.indexOf(callback);
    if (index > -1) {
        saveCallbacks.splice(index, 1);
    }
}

function triggerSaveEvent(status) {
    saveCallbacks.forEach(cb => {
        try { 
            cb(status); 
        } catch (e) {
            console.warn('Save callback error:', e);
        }
    });
}

// ============================================================
// EXPORT DEFAULT
// ============================================================

export default {
    loadState,
    saveState,
    forceSave,
    getState,
    updateState,
    clearState,
    mergeState,
    getPendingConflicts,
    resolveConflict,
    getStateValue,
    setStateValue,
    getBaseUrl,
    setBaseUrl,
    setPasswordHash,
    getCampaignState,
    updateCampaignState,
    addSessionLogEntry,
    getSessionLog,
    clearSessionLog,
    getSceneTags,
    addSceneTag,
    removeSceneTag,
    clearSceneTags,
    addVTTEvent,
    getVTTEvents,
    clearVTTEvents,
    getCharacters,
    getCharacter,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    getCharacterAttribute,
    getCharacterSkill,
    getCharacterMagicPath,
    getCharacterPatron,
    getCharacterTrack,
    updateCharacterTrack,
    getCharacterSpellbook,
    addSpellToCharacter,
    removeSpellFromCharacter,
    getCharacterSpirits,
    addSpiritToCharacter,
    removeSpiritFromCharacter,
    getCharacterRepertoire,
    addSongToRepertoire,
    removeSongFromRepertoire,
    getCharacterSymbols,
    addSymbolToCharacter,
    removeSymbolFromCharacter,
    ensureCharacterDefaults,
    addNPC,
    getNPCs,
    getNPC,
    getCharacterNPCs,
    getCampaigns,
    getCampaign,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    getTimers,
    getTimer,
    addTimer,
    updateTimer,
    deleteTimer,
    getEncounters,
    getEncounter,
    addEncounter,
    updateEncounter,
    deleteEncounter,
    getWikiEntries,
    getWikiEntry,
    addWikiEntry,
    updateWikiEntry,
    deleteWikiEntry,
    getArchives,
    getArchive,
    addArchive,
    updateArchive,
    deleteArchive,
    getDiceHistory,
    addDiceRoll,
    addRoll,
    clearDiceHistory,
    clearRollHistory,
    addChatMessage,
    getChatMessages,
    clearChatHistory,
    importData,
    exportData,
    clearAllData,
    onSave,
    offSave,
};