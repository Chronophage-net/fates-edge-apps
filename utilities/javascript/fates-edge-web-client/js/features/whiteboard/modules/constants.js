// modules/constants.js
export const GRID_TYPES = {
    SQUARE: 'square',
    HEX: 'hex',
    ISOMETRIC: 'isometric'
};

export const GRID_COLORS = {
    SQUARE: 'rgba(212, 175, 55, 0.08)',
    HEX: 'rgba(212, 175, 55, 0.08)',
    ISOMETRIC: 'rgba(212, 175, 55, 0.08)'
};

export const DEFAULT_LAYER_DEFS = [
    { id: 'background', name: 'Background', isGM: false },
    { id: 'drawing', name: 'Drawing', isGM: false },
    { id: 'tokens', name: 'Tokens & Grid', isGM: false },
    { id: 'notes', name: 'Notes', isGM: false },
    { id: 'characters', name: 'Character Tokens', isGM: false },
    { id: 'gm', name: 'GM Layer', isGM: true },
];

export const MAX_UNDO_HISTORY = 50;

// Tools that are shape-based (two-point drag)
export const SHAPE_TOOLS = new Set(['line', 'rectangle', 'circle', 'arrow', 'polygon']);

// Fog-related tools (require GM permission)
export const FOG_TOOLS = new Set(['fog-reveal', 'fog-hide', 'fog-wall', 'fog-light']);
