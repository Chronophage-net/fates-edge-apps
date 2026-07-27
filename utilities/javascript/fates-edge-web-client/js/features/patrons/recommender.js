/**
 * Patron Recommender – helps players find a patron based on archetypes, roles, or free‑text.
 *
 * Works entirely off the `tags` array in each patron (plus `domain_focus` and title/subtitle).
 * No hardcoded patron names – adapts to whatever data is loaded.
 *
 * Exports:
 *   - recommendPatrons(query, patrons): returns sorted array of { patron, score, matchedTags }
 *   - getArchetypeTags(): returns the mapping from archetype keywords to tag sets
 *   - parseQuery(query): normalises and tokenises the input
 */

// ─── Archetype → Tag Mapping ─────────────────────────────────────
// These are the "classic" TTRPG roles and concepts.
// You can extend this list as needed – it's the only place that references external concepts.
const ARCHETYPE_MAP = {
  // Nature / Primal
  druid:      ['nature', 'wild', 'primal', 'animals', 'shapeshift', 'seasons', 'survival', 'beast', 'forest'],
  ranger:     ['nature', 'track', 'hunt', 'survival', 'predator', 'stealth', 'ranged'],
  shaman:     ['spirit', 'ancestor', 'totem', 'nature', 'ritual', 'trance', 'medicine'],
  // Dark / Occult
  warlock:    ['pact', 'demon', 'eldritch', 'dark', 'forbidden', 'patron', 'curse', 'infernal', 'abyss'],
  sorcerer:   ['blood', 'inheritance', 'chaos', 'magic', 'innate', 'power'],
  witch:      ['curse', 'hex', 'cauldron', 'familiar', 'ritual', 'herb', 'bargain'],
  // Rogues / Deception
  rogue:      ['stealth', 'deception', 'thievery', 'luck', 'subterfuge', 'shadow', 'sneak'],
  spy:        ['secret', 'information', 'disguise', 'infiltration', 'witness'],
  trickster:  ['luck', 'trick', 'mischief', 'glamour', 'deception', 'jest'],
  // Warrior / Combat
  fighter:    ['combat', 'weapon', 'strength', 'endurance', 'strike', 'battle', 'blade'],
  barbarian:  ['rage', 'fury', 'primal', 'strength', 'reckless', 'berserk'],
  paladin:    ['vow', 'oath', 'justice', 'protection', 'holy', 'zeal', 'crusader'],
  tank:       ['protection', 'defense', 'ward', 'guard', 'endurance', 'armor', 'shield'],
  striker:    ['damage', 'combat', 'strike', 'aggression', 'offense', 'deadly'],
  // Support / Healing
  support:    ['heal', 'buff', 'aid', 'protection', 'comfort', 'resilience', 'restore'],
  healer:     ['heal', 'mercy', 'comfort', 'restore', 'cleanse', 'life'],
  guardian:   ['protect', 'guard', 'defend', 'ward', 'shelter', 'security'],
  // Social / Face
  face:       ['persuade', 'charm', 'social', 'command', 'performance', 'diplomacy', 'intrigue'],
  diplomat:   ['negotiation', 'treaty', 'court', 'speech', 'persuasion'],
  performer:  ['performance', 'song', 'dance', 'entertain', 'audience', 'rapture'],
  // Mage / Scholar
  mage:       ['arcane', 'magic', 'ritual', 'spell', 'knowledge', 'study'],
  scholar:    ['knowledge', 'lore', 'research', 'archive', 'history', 'investigation'],
  artisan:    ['craft', 'creation', 'forge', 'make', 'invent', 'design'],
  // Stealth / Night
  sneaky:     ['stealth', 'deception', 'shadow', 'subtle', 'silent', 'unseen'],
  night:      ['moon', 'shadow', 'darkness', 'silence', 'dream', 'threshold'],
  // Other
  leader:     ['command', 'lead', 'inspire', 'authority', 'presence', 'revolt'],
  survivor:   ['endure', 'persist', 'adapt', 'scavenge', 'survival'],
  explorer:   ['travel', 'road', 'journey', 'way', 'navigation', 'discovery'],
};

// ─── Public API ──────────────────────────────────────────────────

/**
 * Recommend patrons based on a query.
 * @param {string} query – user input (e.g., "I want to be a Druid")
 * @param {Array} patrons – array of patron objects (must have `tags`, `domain_focus`, etc.)
 * @param {Object} options – { useDomain: true, useLore: false, ... }
 * @returns {Array} sorted array of { patron, score, matchedTags }
 */
export function recommendPatrons(query, patrons, options = {}) {
  if (!query || !patrons || patrons.length === 0) return [];

  const tokens = parseQuery(query);
  if (tokens.length === 0) return [];

  // 1. Detect if the query matches any known archetype
  const archetypeTags = getArchetypeTags(tokens);
  const tagsToMatch = archetypeTags.length > 0 ? archetypeTags : tokens;

  // 2. Score each patron
  const scored = patrons.map(patron => {
    const matches = matchPatron(patron, tagsToMatch, options);
    return {
      patron,
      score: matches.score,
      matchedTags: matches.matchedTags,
    };
  });

  // 3. Filter out patrons with zero score, sort descending
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Parse and normalise a query string into an array of lower‑case tokens.
 */
export function parseQuery(query) {
  if (!query) return [];
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')   // remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Get all tag sets that match the given tokens (via archetype mapping).
 * Returns an array of tag strings (de‑duplicated).
 */
export function getArchetypeTags(tokens) {
  const matched = new Set();
  for (const token of tokens) {
    // Check if token (or a variant) exists as a key in the map
    for (const [key, tags] of Object.entries(ARCHETYPE_MAP)) {
      if (key.includes(token) || token.includes(key)) {
        for (const tag of tags) matched.add(tag);
      }
    }
  }
  return Array.from(matched);
}

// ─── Internal Scoring ───────────────────────────────────────────

function matchPatron(patron, searchTerms, options) {
  let score = 0;
  const matchedTags = [];

  // Sources to search
  const sources = [];

  // Tags (primary)
  if (patron.tags && Array.isArray(patron.tags)) {
    sources.push({ type: 'tag', items: patron.tags.map(t => t.toLowerCase()) });
  }

  // Domain focus (if enabled)
  if (options.useDomain !== false && patron.domain_focus && Array.isArray(patron.domain_focus)) {
    sources.push({ type: 'domain', items: patron.domain_focus.map(d => d.toLowerCase()) });
  }

  // Title and subtitle (if enabled)
  if (options.useTitle !== false) {
    const titleWords = (patron.title || patron.name || '').toLowerCase().split(/\s+/);
    const subtitleWords = (patron.subtitle || '').toLowerCase().split(/\s+/);
    sources.push({ type: 'title', items: [...titleWords, ...subtitleWords] });
  }

  // Description (if enabled)
  if (options.useDescription) {
    const desc = patron.lore?.description || patron.description || '';
    const descWords = desc.toLowerCase().split(/\s+/);
    sources.push({ type: 'description', items: descWords });
  }

  // Score each source
  for (const term of searchTerms) {
    for (const source of sources) {
      for (const item of source.items) {
        // Exact match or contains?
        if (item === term) {
          score += 3;
          matchedTags.push({ source: source.type, term, match: item });
        } else if (item.includes(term) || term.includes(item)) {
          score += 1.5;
          matchedTags.push({ source: source.type, term, match: item });
        }
        // Also check if the term is a substring of the item or vice‑versa (partial)
        else if (term.length > 2 && item.length > 2 &&
                 (item.includes(term) || term.includes(item))) {
          score += 0.5;
          matchedTags.push({ source: source.type, term, match: item });
        }
      }
    }
  }

  // Normalise score (optional) – but we keep raw.

  return { score, matchedTags };
}
