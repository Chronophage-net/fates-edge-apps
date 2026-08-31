/**
 * ESM resolve hook mirroring the `resolve.alias` map in vite.config.js.
 *
 * Vite rewrites "@core/state.js" at bundle time, but Node's own ESM loader
 * knows nothing about it, so `node tests/runner.js` died on the first
 * aliased import with ERR_MODULE_NOT_FOUND. Node's package.json "imports"
 * field can't express these because it only accepts keys beginning with
 * "#", so the aliases are re-declared here instead.
 *
 * KEEP IN SYNC with vite.config.js — if an alias is added there and not
 * here, the build keeps working and only the tests break, which is a
 * confusing failure to debug.
 */
const ROOT = new URL('../../', import.meta.url);

const ALIASES = [
    ['@components/', 'js/components/'],
    ['@features/', 'js/features/'],
    ['@core/', 'js/core/'],
    ['@tools/', 'js/tools/'],
    ['@data/', 'data/'],
    ['@js/', 'js/'],
    ['@/', ''],
].sort((a, b) => b[0].length - a[0].length); // longest prefix wins

export async function resolve(specifier, context, nextResolve) {
    for (const [prefix, target] of ALIASES) {
        if (specifier.startsWith(prefix)) {
            const resolved = new URL(target + specifier.slice(prefix.length), ROOT);
            return nextResolve(resolved.href, context);
        }
    }
    return nextResolve(specifier, context);
}
