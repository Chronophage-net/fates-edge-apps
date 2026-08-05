/**
 * Fate's Edge - TURN Credential Minting
 *
 * Implements the coturn REST API credential convention (same scheme used
 * by Twilio/Xirsys and coturn's own `use-auth-secret` mode) so browser
 * clients get short-lived, per-connection TURN credentials instead of a
 * single long-lived static username/password baked into the client
 * bundle. A static credential shipped to every browser is effectively
 * public -- anyone could scrape it out of the JS and relay unlimited
 * traffic through your TURN server. Time-limited credentials close that
 * hole: they expire (default 24h) and are bound to a label (the
 * connection's clientId) for auditing.
 *
 * Scheme (must match coturn's turnserver.conf `static-auth-secret`):
 *   username   = "<expiryUnixSeconds>:<label>"
 *   credential = base64( HMAC-SHA1(secret, username) )
 */

const crypto = require('crypto');

/**
 * Mint a set of short-lived TURN credentials plus the STUN/TURN URLs to
 * pair with them.
 *
 * @param {object} config - the loaded server config (see config.js)
 * @param {string} [label] - identifies who the credential was issued to
 *   (e.g. a WS clientId), embedded in the username for auditing/expiry.
 * @returns {{ iceServers: Array<object>, ttl: number } | null} null when
 *   no TURN server is configured (TURN_SECRET unset) -- callers should
 *   treat that as "TURN unavailable, STUN-only" rather than an error.
 */
function mintCredentials(config, label = 'anon') {
    if (!config || !config.turnSecret || !config.turnUrls || config.turnUrls.length === 0) {
        return null;
    }

    const ttl = config.turnCredentialTtl || 86400;
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    // Strip characters that could break the "expiry:label" parsing on the
    // coturn side (colons in particular) -- labels are informational only.
    const safeLabel = String(label).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'anon';
    const username = `${expiry}:${safeLabel}`;
    const credential = crypto
        .createHmac('sha1', config.turnSecret)
        .update(username)
        .digest('base64');

    return {
        iceServers: config.turnUrls.map(url => ({ urls: url, username, credential })),
        ttl
    };
}

module.exports = { mintCredentials };
