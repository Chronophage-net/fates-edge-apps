/**
 * Registers the vite-alias resolve hook. Used via:
 *   node --import ./tests/support/register-aliases.mjs tests/runner.js
 * It must run through --import (not a plain import inside the runner) so the
 * hook is installed before the runner's own module graph is linked.
 */
import { register } from 'node:module';
register('./alias-hooks.mjs', import.meta.url);
