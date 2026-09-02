/**
 * Event permissions — who may send what.
 *
 * The bug this locks down: every deck and adventure socket event was
 * open to any connected client, on BOTH transports. The web client hides
 * the Decks and GM Tools tabs from non-GMs, and that was mistaken for a
 * permission boundary. It is a localStorage role string deciding whether
 * to render a button; it never reached the wire. A player who knew the
 * event name could draw the Deck of Consequences (an SB spend, authoring
 * a complication against their own table), shuffle it out from under the
 * GM, wipe its history, reveal knowledge the GM was holding back, or
 * reset the adventure outright.
 *
 * The table lives in security.js so the two transports gate on the same
 * data. These tests assert the table, and — more importantly — assert
 * that no deck or adventure event is missing from it, so adding a new
 * one without a decision fails here rather than in someone's game.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-for-unit-tests';

const fs = require('fs');
const path = require('path');
const security = require('../server/security.js');

const { checkEventPermission, permissionDeniedMessage, GM_GATED_EVENTS, STORY_AUTHORITY_EVENTS } = security;

const ALLOWED = null;
const allowed = (event, role) => checkEventPermission(event, role) === ALLOWED;

describe('SB draws are not available to players', () => {
    for (const event of ['deck-draw', 'crown-spread', 'deck-shuffle']) {
        test(`${event} is refused to a player`, () => {
            const denied = checkEventPermission(event, 'player');
            assert.ok(denied, `${event} must not be open to a player`);
            assert.equal(denied.requires, 'story-authority');
        });

        test(`${event} is refused to a spectator`, () => {
            assert.ok(checkEventPermission(event, 'spectator'));
        });

        test(`${event} is refused when the role is unknown or absent`, () => {
            assert.ok(checkEventPermission(event, undefined));
            assert.ok(checkEventPermission(event, ''));
            assert.ok(checkEventPermission(event, 'not-a-role'));
        });

        test(`${event} is allowed to the GM and to a Co-GM`, () => {
            assert.ok(allowed(event, 'gm'));
            assert.ok(allowed(event, 'co-gm'));
        });
    }

    test('the AI GM Bot can still seed a campaign with a Crown Spread', () => {
        // ai-gm-bot.js's seedCampaign() sends 'crown-spread', and the bot
        // may be holding 'assistant-gm' when it does. Gating draws on
        // isGmLike alone would have broken the bot without securing
        // anything a player could reach.
        assert.ok(allowed('crown-spread', 'assistant-gm'));
    });
});

describe('the shared record is GM and Co-GM only', () => {
    const recordEvents = [
        'adventure-load', 'adventure-reset', 'adventure-scene',
        'adventure-knowledge-reveal', 'adventure-knowledge-hide',
        'adhoc-timer-create', 'adhoc-timer-tick', 'adhoc-timer-remove',
        'deck-history-clear', 'set-region',
    ];

    for (const event of recordEvents) {
        test(`${event} is refused to a player`, () => {
            const denied = checkEventPermission(event, 'player');
            assert.ok(denied, `${event} must not be open to a player`);
            assert.equal(denied.requires, 'gm');
        });
    }

    test('the Assistant GM narrates but does not keep the record', () => {
        // The bot is a narrator. It gets story authority and no more:
        // it must not be able to reset an adventure or reveal knowledge
        // the human GM is deliberately sitting on.
        assert.ok(allowed('tts-audio', 'assistant-gm'));
        assert.ok(checkEventPermission('adventure-reset', 'assistant-gm'));
        assert.ok(checkEventPermission('adventure-knowledge-reveal', 'assistant-gm'));
    });
});

describe('ordinary play is untouched', () => {
    // A permission table is only as good as what it leaves alone. If
    // gating ever creeps onto these, players stop being able to play.
    const openEvents = [
        'ping', 'handshake', 'roll-dice', 'roll-result', 'chat-message',
        'claim-character', 'release-character', 'character-select',
        'voice-offer', 'voice-answer', 'voice-ice-candidate', 'voice-status',
        'deck-history', 'get-clients', 'sync-request', 'presence',
        'adventure-state-request', 'adhoc-timer-request', 'module-list',
    ];
    for (const event of openEvents) {
        test(`${event} stays open to a player`, () => {
            assert.ok(allowed(event, 'player'), `${event} must stay open to players`);
        });
    }

    test('reading deck history is open even though clearing it is not', () => {
        assert.ok(allowed('deck-history', 'player'));
        assert.ok(checkEventPermission('deck-history-clear', 'player'));
    });
});

describe('the table and the handlers agree', () => {
    // Coverage guard. Both transports consult one table, but nothing
    // stops someone adding a new deck-* or adventure-* handler and
    // forgetting to classify it — which is exactly how the original hole
    // was dug. Any such event that is in neither set fails here.
    const read = f => fs.readFileSync(path.join(__dirname, '..', 'server', f), 'utf8');

    function handledEvents() {
        const found = new Set();
        const io = read('socketio-handlers.js');
        for (const m of io.matchAll(/socket\.on\('([^']+)'/g)) found.add(m[1]);
        const ws = read('ws-handlers.js');
        for (const m of ws.matchAll(/case '([^']+)':/g)) found.add(m[1]);
        return found;
    }

    // Events that LOOK like authority but are reads or client-side
    // requests, listed explicitly so the exemption is a decision on the
    // record rather than a silent gap.
    const READ_ONLY = new Set([
        'deck-history',            // seeing past draws; the draws were broadcast anyway
        'adventure-state',         // "send me the current state"
        'adventure-state-request',
        'adventure-reference',
        'adventure-reference-request',
        'adhoc-timer-request',
    ]);

    test('every deck-* and adventure-* handler is classified', () => {
        const unclassified = [...handledEvents()].filter(e =>
            /^(deck-|crown-|adventure-|adhoc-timer-)/.test(e) &&
            !READ_ONLY.has(e) &&
            !GM_GATED_EVENTS.has(e) &&
            !STORY_AUTHORITY_EVENTS.has(e)
        );
        assert.deepEqual(unclassified, [],
            `unclassified authority events: ${unclassified.join(', ')}`);
    });

    test('both transports import the gate', () => {
        for (const f of ['socketio-handlers.js', 'ws-handlers.js']) {
            assert.match(read(f), /checkEventPermission/,
                `${f} must consult security.js's permission table`);
        }
    });
});

describe('refusals explain themselves', () => {
    test('the message names the event and the role it wanted', () => {
        const denied = checkEventPermission('deck-draw', 'player');
        const msg = permissionDeniedMessage(denied);
        assert.match(msg, /deck-draw/);
        assert.match(msg, /Assistant GM/);

        const gmOnly = permissionDeniedMessage(checkEventPermission('adventure-reset', 'player'));
        assert.match(gmOnly, /adventure-reset/);
        assert.match(gmOnly, /Co-GM/);
    });

    test('an allowed event produces no message', () => {
        assert.equal(permissionDeniedMessage(checkEventPermission('roll-dice', 'player')), '');
    });
});
