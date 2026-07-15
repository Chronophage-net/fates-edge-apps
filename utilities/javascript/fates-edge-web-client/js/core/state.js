/**
 * State management for Fate's Edge Toolkit
 */

import { generateId, getBaseUrl as utilsGetBaseUrl, getStorage, setStorage, removeStorage } from './utils.js';

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
};

let state = { ...DEFAULT_STATE };
let saveCallbacks = [];
const STORAGE_KEY = 'fates-edge-state';

// ============================================================
// STATE OPERATIONS
// ============================================================

export function loadState() {
    try {
        const saved = getStorage(STORAGE_KEY);
        if (saved) {
            state = { ...DEFAULT_STATE, ...saved };
        } else {
            state = { ...DEFAULT_STATE };
        }
    } catch (e) {
        console.warn('Failed to load state:', e);
        state = { ...DEFAULT_STATE };
    }
    return state;
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

export function mergeState(updates) {
    return updateState(updates);
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

/**
 * Get base URL - uses utils implementation
 * @returns {string} Base URL
 */
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
// CHARACTER OPERATIONS
// ============================================================

export function getCharacters() {
    return state.characters || [];
}

export function getCharacter(id) {
    const characters = state.characters || [];
    return characters.find(c => c.id === id) || null;
}

export function addCharacter(character) {
    if (!character.id) {
        character.id = generateId('char_');
    }
    if (!character.createdAt) {
        character.createdAt = new Date().toISOString();
    }
    state.characters = [...(state.characters || []), character];
    saveState();
    return character;
}

export function updateCharacter(id, updates) {
    const characters = state.characters || [];
    const index = characters.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    const updated = { ...characters[index], ...updates, updatedAt: new Date().toISOString() };
    state.characters = [...characters.slice(0, index), updated, ...characters.slice(index + 1)];
    saveState();
    return updated;
}

export function deleteCharacter(id) {
    state.characters = (state.characters || []).filter(c => c.id !== id);
    saveState();
    return true;
}

// ============================================================
// NPC OPERATIONS
// ============================================================

export function addNPC(npc) {
    if (!npc.id) {
        npc.id = generateId('npc_');
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
// CAMPAIGN OPERATIONS
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
        campaign.id = generateId('camp_');
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
// TIMER OPERATIONS
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
        timer.id = generateId('timer_');
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
// ENCOUNTER OPERATIONS
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
        encounter.id = generateId('enc_');
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
// WIKI OPERATIONS
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
        entry.id = generateId('wiki_');
    }
    if (!entry.createdAt) {
        entry.createdAt = new Date().toISOString();
    }
    state.wikiEntries = [...(state.wikiEntries || []), entry];
    saveState();
    return entry;
}

export function updateWikiEntry(id, updates) {
    const wikiEntries = state.wikiEntries || [];
    const index = wikiEntries.findIndex(w => w.id === id);
    if (index === -1) return null;
    
    const updated = { ...wikiEntries[index], ...updates, updatedAt: new Date().toISOString() };
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
// ARCHIVE OPERATIONS
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
        archive.id = generateId('arch_');
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
// DICE OPERATIONS
// ============================================================

export function getDiceHistory() {
    return state.diceHistory || [];
}

export function addDiceRoll(roll) {
    if (!roll.id) {
        roll.id = generateId('roll_');
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
// CHAT OPERATIONS
// ============================================================

export function addChatMessage(message) {
    if (!message.id) {
        message.id = generateId('chat_');
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
// DATA IMPORT/EXPORT
// ============================================================

export function importData(data) {
    try {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
        }
        
        const merged = { ...DEFAULT_STATE, ...state, ...data };
        
        for (const key of Object.keys(DEFAULT_STATE)) {
            if (!(key in merged)) {
                merged[key] = DEFAULT_STATE[key];
            }
        }
        
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
    // State operations
    loadState,
    saveState,
    forceSave,
    getState,
    updateState,
    clearState,
    mergeState,
    getStateValue,
    setStateValue,
    getBaseUrl,
    setBaseUrl,
    setPasswordHash,
    
    // Character operations
    getCharacters,
    getCharacter,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    
    // NPC operations
    addNPC,
    getNPCs,
    getNPC,
    getCharacterNPCs,
    
    // Campaign operations
    getCampaigns,
    getCampaign,
    addCampaign,
    updateCampaign,
    deleteCampaign,
    
    // Timer operations
    getTimers,
    getTimer,
    addTimer,
    updateTimer,
    deleteTimer,
    
    // Encounter operations
    getEncounters,
    getEncounter,
    addEncounter,
    updateEncounter,
    deleteEncounter,
    
    // Wiki operations
    getWikiEntries,
    getWikiEntry,
    addWikiEntry,
    updateWikiEntry,
    deleteWikiEntry,
    
    // Archive operations
    getArchives,
    getArchive,
    addArchive,
    updateArchive,
    deleteArchive,
    
    // Dice operations
    getDiceHistory,
    addDiceRoll,
    addRoll,
    clearDiceHistory,
    clearRollHistory,
    
    // Chat operations
    addChatMessage,
    getChatMessages,
    clearChatHistory,
    
    // Data import/export
    importData,
    exportData,
    clearAllData,
    
    // Save status
    onSave,
    offSave,
};