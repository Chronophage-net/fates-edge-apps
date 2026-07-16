/**
 * State management for Fate's Edge Toolkit
 * v3.0 - With Real-Time Sync Merging
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

// Track pending sync conflicts
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

/**
 * Deep merge helper for nested objects (supports multiple sources)
 */
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

/**
 * Merge remote state with local state, detecting conflicts
 * @param {object} remoteState - State from server
 * @param {object} version - Version vector
 */
export function mergeState(remoteState, version) {
    const conflicts = [];

    // 1. Merge characters
    if (remoteState.characters) {
        state.characters = state.characters || [];
        remoteState.characters.forEach(remoteChar => {
            const localChar = state.characters.find(c => c.id === remoteChar.id);
            if (localChar) {
                // Check if local version is newer
                if ((localChar._syncVersion || 0) > (remoteChar._syncVersion || 0)) {
                    conflicts.push({
                        type: 'character',
                        id: remoteChar.id,
                        local: localChar,
                        remote: remoteChar,
                        resolution: 'pending'
                    });
                } else {
                    // Remote is newer or same version
                    const idx = state.characters.indexOf(localChar);
                    state.characters[idx] = remoteChar;
                }
            } else {
                // New character from remote
                state.characters.push(remoteChar);
            }
        });
    }

    // 2. Merge timers
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

    // 3. Merge wiki entries
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

    // 4. Merge chat (append-only)
    if (remoteState.chatMessages) {
        state.chatMessages = state.chatMessages || [];
        const localIds = new Set(state.chatMessages.map(m => m.id));
        remoteState.chatMessages.forEach(msg => {
            if (!localIds.has(msg.id)) {
                state.chatMessages.push(msg);
            }
        });
        // Keep chat history under limit
        if (state.chatMessages.length > 200) {
            state.chatMessages = state.chatMessages.slice(-200);
        }
    }

    // 5. Handle conflicts (show to user for resolution)
    if (conflicts.length > 0) {
        pendingConflicts = [...pendingConflicts, ...conflicts];
        document.dispatchEvent(new CustomEvent('syncConflict', {
            detail: { conflicts }
        }));
    }

    // 6. Update version
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
            // Keep local version, do nothing to state
            break;
        case 'remote':
            // Use remote version
            const idx = state.characters.indexOf(conflict.local);
            if (idx !== -1) state.characters[idx] = conflict.remote;
            break;
        case 'merge':
            // Deep merge
            const merged = { ...conflict.local, ...conflict.remote };
            merged._syncVersion = Math.max(
                conflict.local._syncVersion || 0,
                conflict.remote._syncVersion || 0
            ) + 1;
            const mergeIdx = state.characters.indexOf(conflict.local);
            if (mergeIdx !== -1) state.characters[mergeIdx] = merged;
            break;
    }

    // Remove resolved conflict
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
        character.id = generateId(8);
    }
    if (!character.createdAt) {
        character.createdAt = new Date().toISOString();
    }
    character._syncVersion = Date.now();
    state.characters = [...(state.characters || []), character];
    saveState();
    return character;
}

export function updateCharacter(id, updates) {
    const characters = state.characters || [];
    const index = characters.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    const updated = { 
        ...characters[index], 
        ...updates, 
        updatedAt: new Date().toISOString(),
        _syncVersion: Date.now()
    };
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
// DICE OPERATIONS
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
// CHAT OPERATIONS
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
// DATA IMPORT/EXPORT
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
    getCharacters,
    getCharacter,
    addCharacter,
    updateCharacter,
    deleteCharacter,
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