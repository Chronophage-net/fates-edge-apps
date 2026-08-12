#!/usr/bin/env node
/**
 * Fate's Edge - Server Entry Point
 *
 * This used to be a full duplicate of index.js (same ~160 lines,
 * copy-pasted) which meant every fix had to be applied twice and
 * routinely wasn't -- a real source of the "which file is the real one"
 * confusion flagged in the docs cleanup pass. index.js is now the one
 * canonical implementation; this file just re-exports it so
 * `server-start.js`'s `require('./server/server.js')` keeps working.
 */
module.exports = require('./index.js');
