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

// ─── Stopwords ────────────────────────────────────────────────────
// BUGFIX: parseQuery() used to keep every token of length > 0, including
// single letters like "i" and "a". Those then went into getArchetypeTags(),
// whose `key.includes(token) || token.includes(key)` check has no length
// floor — "a" or "i" fuzzy-matches nearly every archetype key (almost all
// of them contain the letter 'a' or 'i' somewhere). Running the module's
// own docstring example, "I want to be a Druid", through the original
// code pulled in 123 unrelated tags (combat, healing, stealth, everything)
// from "i"/"a"/"to"/"be"/"want" alone, completely burying the one real
// signal ("druid"). Filtering stopwords and requiring length > 2 fixes
// this at the source, so every downstream function benefits.
const STOPWORDS = new Set([
  'i', 'a', 'an', 'the', 'to', 'be', 'is', 'of', 'in', 'on', 'for', 'and',
  'or', 'my', 'me', 'you', 'your', 'it', 'that', 'this', 'with', 'as',
  'at', 'by', 'so', 'am', 'are', 'was', 'were', 'want', 'wanna', 'like',
  'play', 'playing', 'character', 'build', 'looking', 'find', 'need',
]);

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
    .filter(word => word.length > 2 && !STOPWORDS.has(word));
}

/**
 * Get all tag sets that match the given tokens (via archetype mapping).
 * Returns an array of tag strings (de‑duplicated).
 */
export function getArchetypeTags(tokens) {
  const matched = new Set();
  for (const token of tokens) {
    for (const [key, tags] of Object.entries(ARCHETYPE_MAP)) {
      // BUGFIX: this used to be `key.includes(token) || token.includes(key)`
      // with no length floor, so any short token fuzzy-matched almost every
      // key. Exact match is always fine; fuzzy containment now only counts
      // when the shorter side is at least 4 characters, so "war" doesn't
      // spuriously match "warlock" off a 3-letter fragment of an unrelated
      // word, but "warlock"/"lock" or "healer"/"healers" still work.
      const isMatch = token === key
        || (token.length >= 4 && key.includes(token))
        || (key.length >= 4 && token.includes(key));
      if (isMatch) {
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

  // Score each source.
  // BUGFIX: the original had a third `else if (term.length > 2 &&
  // item.length > 2 && (item.includes(term) || term.includes(item)))`
  // branch that could never execute — the preceding `else if
  // (item.includes(term) || term.includes(item))` already catches every
  // case that condition checks for, so it was dead code. Replaced with a
  // single partial-match branch that requires both sides to be at least
  // 4 characters (consistent with getArchetypeTags' fix above), so short
  // words can't rack up cheap partial-match points against everything.
  // Also dedupes identical (source, term, matched-word) hits so the same
  // word appearing twice in one list doesn't double-count.
  const seenHits = new Set();
  for (const term of searchTerms) {
    for (const source of sources) {
      for (const item of source.items) {
        if (!item) continue;
        const hitKey = `${source.type}:${term}:${item}`;
        if (seenHits.has(hitKey)) continue;

        let weight = 0;
        if (item === term) {
          weight = 3;
        } else if (term.length >= 4 && item.length >= 4 && (item.includes(term) || term.includes(item))) {
          weight = 1.5;
        }

        if (weight > 0) {
          score += weight;
          matchedTags.push({ source: source.type, term, match: item });
          seenHits.add(hitKey);
        }
      }
    }
  }

  return { score, matchedTags };
}

