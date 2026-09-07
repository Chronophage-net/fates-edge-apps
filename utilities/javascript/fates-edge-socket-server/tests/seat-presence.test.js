'use strict';
// Regression tests for the read-only review findings on seat presence and room identity.
const test = require('node:test');
const assert = require('node:assert');
const room = require('../server/room');
const seats = require('../server/seat-presence');

test('P3: a room resolves by join code, room_id or room_code', () => {
  const r = room.createRoom('ZQ71');
  r.room_id = '01923f10-aaaa-7bbb-8ccc-ddddeeeeffff';
  r.room_code = 'ZQ71';
  for (const key of ['ZQ71', 'zq71', r.room_id, r.room_id.toUpperCase(), r.code]) {
    assert.strictEqual(room.resolveRoom(key), r, `expected ${key} to resolve`);
  }
  assert.strictEqual(room.resolveRoom('NOSUCH'), null);
  assert.strictEqual(room.resolveRoom(r), r, 'a room object passes through');
});

test('P3: a rotated room_code does not orphan whisper delivery', () => {
  const r = room.createRoom('ZQ72');
  r.room_id = '01923f10-1111-7222-8333-444455556666';
  r.room_code = 'ROTATED1';
  r.code = 'ROTATED1';
  assert.strictEqual(room.resolveRoom('ROTATED1'), r, 'the new code resolves');
  assert.strictEqual(room.resolveRoom(r.room_id), r, 'the stable id still resolves');
});

test('P4: any !gm player message is recognised as private before it can be broadcast', () => {
  for (const text of ['!gm player new a treacherous rogue', '!GM  player dossier', '!gm player seats']) {
    assert.strictEqual(seats.isPrivateCommand({ text }), true, text);
  }
  for (const text of ['!gm look armor', 'the player rolls', '!gm players', '']) {
    assert.strictEqual(seats.isPrivateCommand({ text }), false, JSON.stringify(text));
  }
  assert.strictEqual(seats.isPrivateCommand(undefined), false);
});

test('a key-authenticated handshake with a malformed seat is rejected, not downgraded', () => {
  const ok = seats.metadata({ botKey: 'k', botMode: 'player', botSeat: 2 }, 'k');
  assert.deepStrictEqual(ok, { botMode: 'player', botSeat: 2, botCharacter: '', botBusy: false });

  for (const bad of [{ botMode: 'overlord', botSeat: 0 }, { botMode: 'gm', botSeat: -1 },
                     { botMode: 'gm', botSeat: 100 }, { botMode: 'gm', botSeat: '0' }]) {
    const result = seats.metadata({ botKey: 'k', ...bad }, 'k');
    assert.ok(result.botSeatRejected, `expected rejection for ${JSON.stringify(bad)}`);
    assert.strictEqual(result.botMode, undefined, 'a rejected seat never gains routing metadata');
  }
  assert.deepStrictEqual(seats.metadata({ botMode: 'gm', botSeat: 0 }, 'k'), {}, 'no key is an ordinary client');
  assert.deepStrictEqual(seats.metadata({ botKey: 'wrong', botMode: 'gm', botSeat: 0 }, 'k'), {});
});

test('P1: a stale seat reservation is reclaimed instead of stranding the seat', () => {
  const r = room.createRoom('ZQ73');
  const replies = [];
  const idle = { id: 'bot-a', role: 'player', botMode: 'player', botSeat: 0,
                 botCharacter: '', botBusy: true, botBusyAt: Date.now() - (seats.RESERVATION_MS + 1000) };
  r.clients.set('bot-a', idle);
  const gm = { id: 'gm-1', role: 'gm', userId: 'u9' };
  r.clients.set('gm-1', gm);

  const original = room.deliverWhisper;
  room.deliverWhisper = (_room, _event, payload) => { replies.push(payload.message); return true; };
  try {
    const handled = seats.privateCommand(r, gm, { text: '!gm player new a treacherous rogue' });
    assert.strictEqual(handled, true);
  } finally { room.deliverWhisper = original; }

  assert.ok(!replies.some(m => /No idle player seat/.test(m.text || '')),
    'an expired reservation must not permanently consume the seat');
  assert.strictEqual(idle.botBusy, true, 'the seat is re-reserved for this request');
  assert.ok(idle.botBusyAt > Date.now() - 5000, 'the reservation clock is restarted');
});

test('P1: a live reservation is still respected', () => {
  const r = room.createRoom('ZQ74');
  const replies = [];
  r.clients.set('bot-b', { id: 'bot-b', botMode: 'player', botSeat: 0, botCharacter: '', botBusy: true, botBusyAt: Date.now() });
  const gm = { id: 'gm-2', role: 'gm', userId: 'u8' };
  r.clients.set('gm-2', gm);

  const original = room.deliverWhisper;
  room.deliverWhisper = (_room, _event, payload) => { replies.push(payload.message); return true; };
  try { seats.privateCommand(r, gm, { text: '!gm player new another rogue' }); }
  finally { room.deliverWhisper = original; }

  assert.ok(replies.some(m => /No idle player seat/.test(m.text || '')),
    'a seat mid-generation is not handed a second brief');
});

test('a non-GM cannot direct a bot-player seat', () => {
  const r = room.createRoom('ZQ75');
  const replies = [];
  const player = { id: 'p-1', role: 'player', userId: 'u7' };
  r.clients.set('p-1', player);
  const original = room.deliverWhisper;
  room.deliverWhisper = (_room, _event, payload) => { replies.push(payload.message); return true; };
  try {
    assert.strictEqual(seats.privateCommand(r, player, { text: '!gm player new a rogue' }), true,
      'still handled -- so the brief is never broadcast');
  } finally { room.deliverWhisper = original; }
  assert.ok(replies.some(m => /Only the GM or Assistant GM/.test(m.text || '')));
});

test('an assistant GM may read a dossier but not direct the seat', () => {
  const r = room.createRoom('ZQ76');
  const replies = [];
  const agm = { id: 'a-1', role: 'assistant-gm', userId: 'u6' };
  r.clients.set('a-1', agm);
  r.clients.set('bot-c', { id: 'bot-c', botMode: 'player', botSeat: 0, botCharacter: 'Vessa', botBusy: false });
  const original = room.deliverWhisper;
  room.deliverWhisper = (_room, _event, payload) => { replies.push(payload.message); return true; };
  try {
    seats.privateCommand(r, agm, { text: '!gm player new a rogue' });
    seats.privateCommand(r, agm, { text: '!gm player dossier Vessa' });
  } finally { room.deliverWhisper = original; }
  assert.ok(replies.some(m => /Only the GM can direct a player seat/.test(m.text || '')));
  assert.ok(replies.some(m => /^!gm player dossier/i.test(m.text || '')), 'the dossier request reaches the seat');
});
