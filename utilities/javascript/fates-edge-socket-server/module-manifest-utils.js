/**
 * Fate's Edge - Module Manifest Utilities
 *
 * Shared logic for deriving a manifest.json from an adventure's own
 * content (title/description/author/tier), used by BOTH:
 *   - POST /api/modules (api.js) -- installing a module via the API
 *   - generate-manifest.js -- a CLI script for adventure.json files
 *     dropped directly into server/modules/<id>/ by hand
 *
 * Kept in one place so the two paths can never drift into disagreeing
 * about what a manifest should look like.
 */

function deriveManifestFromContent(content, overrides = {}) {
    return {
        name: overrides.name || content.title || 'Untitled Adventure',
        version: overrides.version || '1.0.0',
        description: overrides.description || content.description || '',
        author: overrides.author || content.author || 'Unknown',
        type: 'adventure',
        icon: overrides.icon || '📜',
        tierRange: overrides.tierRange || content.tierRange || content.tier || 'I',
    };
}

module.exports = { deriveManifestFromContent };
