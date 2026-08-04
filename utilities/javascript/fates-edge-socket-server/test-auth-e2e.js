/**
 * End-to-end smoke test for optional accounts / room membership / the
 * account-owned character library. Exercises register/login, the
 * previously-dead room-password path (see room.js's setRoomPassword
 * comment), known-member password skip, persistent (by-account) bans
 * surviving a reconnect with a brand new socket id, the 5-character cap,
 * and confirms the fully anonymous flow is untouched.
 *
 * Usage:
 *   PORT=10123 AUTH_JWT_SECRET=<any-string> API_KEY=test-admin-key node server-start.js &
 *   node test-auth-e2e.js
 *
 * Or: npm run test:auth (starts + stops the server for you, see package.json).
 * Uses whatever DATABASE_TYPE/DATABASE_URL the server was started with --
 * point DATABASE_URL at a scratch file if you don't want to touch your
 * real campaigns.db.
 */
const WebSocket = require('ws');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:10123';
const API_KEY = process.env.API_KEY || 'test-admin-key';
const ROOM = 'TESTROOM';

let failures = 0;
function assert(cond, msg) {
    if (cond) {
        console.log(`  ✅ ${msg}`);
    } else {
        console.log(`  ❌ ${msg}`);
        failures++;
    }
}

async function api(method, urlPath, body, headers = {}) {
    const res = await fetch(`${BASE}${urlPath}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* ignore */ }
    return { status: res.status, body: json };
}

const WS_BASE = BASE.replace(/^http/, 'ws');

function wsConnect({ room = ROOM, password, authToken, clientName = 'Tester' } = {}) {
    return new Promise((resolve) => {
        const ws = new WebSocket(`${WS_BASE}?room=${room}`);
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };
        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'handshake', password, authToken, clientName }));
        });
        ws.on('message', (raw) => {
            const msg = JSON.parse(raw);
            if (msg.type === 'handshake_ack') {
                finish({ ok: true, ws, clientId: msg.clientId, role: msg.clientRole });
            } else if (msg.type === 'error' && !settled) {
                // Might close right after; give it a tick.
                setTimeout(() => finish({ ok: false, error: msg.message, ws }), 50);
            }
        });
        ws.on('close', (code, reasonBuf) => {
            const reason = reasonBuf ? reasonBuf.toString() : '';
            finish({ ok: false, error: reason || `closed (${code})`, code, ws: null });
        });
        ws.on('error', () => {});
        setTimeout(() => finish({ ok: false, error: 'timeout', ws: null }), 3000);
    });
}

async function main() {
    console.log('\n== 1. Register two accounts ==');
    const reg1 = await api('POST', '/api/auth/register', { username: 'alice_test', password: 'correcthorsebattery' });
    assert(reg1.status === 201 && reg1.body.token, `register alice -> 201 + token (got ${reg1.status})`);
    const aliceToken = reg1.body && reg1.body.token;
    const aliceId = reg1.body && reg1.body.user && reg1.body.user.id;

    const reg2 = await api('POST', '/api/auth/register', { username: 'bob_test', password: 'correcthorsebattery' });
    assert(reg2.status === 201 && reg2.body.token, `register bob -> 201 + token (got ${reg2.status})`);

    const dupe = await api('POST', '/api/auth/register', { username: 'alice_test', password: 'anotherpassword1' });
    assert(dupe.status === 409, `duplicate username rejected (got ${dupe.status})`);

    console.log('\n== 2. Login ==');
    const login = await api('POST', '/api/auth/login', { username: 'alice_test', password: 'correcthorsebattery' });
    assert(login.status === 200 && login.body.token, `login alice -> 200 + token (got ${login.status})`);

    const badLogin = await api('POST', '/api/auth/login', { username: 'alice_test', password: 'wrongpassword' });
    assert(badLogin.status === 401, `wrong password rejected (got ${badLogin.status})`);

    const me = await api('GET', '/api/auth/me', undefined, { Authorization: `Bearer ${aliceToken}` });
    assert(me.status === 200 && me.body.username === 'alice_test', `GET /api/auth/me returns alice_test (got ${JSON.stringify(me.body)})`);

    console.log('\n== 3. Room creation + password gate (previously unreachable dead code!) ==');
    const createJoin = await wsConnect({ clientName: 'RoomCreator' });
    assert(createJoin.ok, `anonymous join with no password set succeeds (room auto-created)`);
    if (createJoin.ws) createJoin.ws.close();

    const setPw = await api('POST', `/api/rooms/${ROOM}/password`, { password: 'roomsecret' }, { 'x-api-key': API_KEY });
    assert(setPw.status === 200 && setPw.body.passwordSet === true, `admin sets room password (got ${setPw.status} ${JSON.stringify(setPw.body)})`);

    const noPw = await wsConnect({ clientName: 'NoPassword' });
    assert(!noPw.ok, `anonymous join with WRONG/no password is rejected (got ok=${noPw.ok})`);

    const rightPw = await wsConnect({ password: 'roomsecret', clientName: 'HasPassword' });
    assert(rightPw.ok, `anonymous join with correct password succeeds`);
    if (rightPw.ws) rightPw.ws.close();

    console.log('\n== 4. Authenticated join + persistent membership (skip password on rejoin) ==');
    const aliceFirstJoin = await wsConnect({ password: 'roomsecret', authToken: aliceToken, clientName: 'Alice' });
    assert(aliceFirstJoin.ok, `alice's FIRST join needs the correct password too (got ok=${aliceFirstJoin.ok}, err=${aliceFirstJoin.error})`);
    if (aliceFirstJoin.ws) aliceFirstJoin.ws.close();
    await new Promise(r => setTimeout(r, 150));

    const aliceRejoinNoPw = await wsConnect({ authToken: aliceToken, clientName: 'Alice' }); // no password supplied
    assert(aliceRejoinNoPw.ok, `alice's SECOND join (known member) skips the password entirely (got ok=${aliceRejoinNoPw.ok}, err=${aliceRejoinNoPw.error})`);
    if (aliceRejoinNoPw.ws) aliceRejoinNoPw.ws.close();
    await new Promise(r => setTimeout(r, 150));

    const strangerNoPw = await wsConnect({ clientName: 'Stranger' }); // anonymous, no password
    assert(!strangerNoPw.ok, `an anonymous client still needs the password even after alice is a known member (got ok=${strangerNoPw.ok})`);

    console.log('\n== 5. Persistent ban (by account, survives reconnect w/ new socket id) ==');
    const banRes = await api('POST', `/api/rooms/${ROOM}/members/${aliceId}/ban`, {}, { 'x-api-key': API_KEY });
    assert(banRes.status === 200, `admin bans alice by userId (got ${banRes.status})`);

    const aliceBannedJoin = await wsConnect({ authToken: aliceToken, password: 'roomsecret', clientName: 'Alice' });
    assert(!aliceBannedJoin.ok && /banned/i.test(aliceBannedJoin.error || ''), `alice's reconnect (BRAND NEW socket id) is still rejected as banned (got ok=${aliceBannedJoin.ok}, err=${aliceBannedJoin.error})`);

    const unbanRes = await api('POST', `/api/rooms/${ROOM}/members/${aliceId}/unban`, {}, { 'x-api-key': API_KEY });
    assert(unbanRes.status === 200, `admin unbans alice (got ${unbanRes.status})`);

    const aliceAfterUnban = await wsConnect({ authToken: aliceToken, clientName: 'Alice' });
    assert(aliceAfterUnban.ok, `alice can rejoin after unban, still without needing the password (known member) (got ok=${aliceAfterUnban.ok}, err=${aliceAfterUnban.error})`);
    if (aliceAfterUnban.ws) aliceAfterUnban.ws.close();

    console.log('\n== 6. Character library (5-cap) ==');
    const headers = { Authorization: `Bearer ${aliceToken}` };
    for (let i = 1; i <= 5; i++) {
        const r = await api('POST', '/api/account/characters', { name: `Char${i}`, data: { attributes: { Body: 2 } } }, headers);
        assert(r.status === 201, `create character ${i}/5 -> 201 (got ${r.status})`);
    }
    const sixth = await api('POST', '/api/account/characters', { name: 'Char6' }, headers);
    assert(sixth.status === 409, `6th character rejected with 409 (got ${sixth.status} ${JSON.stringify(sixth.body)})`);

    const list = await api('GET', '/api/account/characters', undefined, headers);
    assert(list.status === 200 && list.body.count === 5 && list.body.limit === 5, `list shows exactly 5 characters, limit=5 (got ${JSON.stringify(list.body && { count: list.body.count, limit: list.body.limit })})`);

    const toDelete = list.body.characters[0].id;
    const del = await api('DELETE', `/api/account/characters/${toDelete}`, undefined, headers);
    assert(del.status === 200, `delete a character -> 200 (got ${del.status})`);

    const afterDelete = await api('POST', '/api/account/characters', { name: 'Char7' }, headers);
    assert(afterDelete.status === 201, `after freeing a slot, a new character can be created (got ${afterDelete.status})`);

    console.log('\n== 7. Anonymous flow completely unaffected (no token at all) ==');
    const anonRoom = 'ANONROOM';
    const anonJoin = await wsConnect({ room: anonRoom, clientName: 'PlainAnon' });
    assert(anonJoin.ok, `a totally fresh room with no password, no token, works exactly as before (got ok=${anonJoin.ok})`);
    if (anonJoin.ws) anonJoin.ws.close();

    console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}\n`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('Test script crashed:', e); process.exit(1); });
