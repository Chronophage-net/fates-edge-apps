// Helpers behind `npm run setup`, `npm start` and `npm run doctor`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readEnv, writeEnv, isPlaceholder, nodeVersionOk, secret } from '../tools/lib/toolkit.mjs';

const dir = () => mkdtempSync(join(tmpdir(), 'fe-toolkit-'));

test('writeEnv fills a new file from the template, keeping comments and order', () => {
  const d = dir();
  writeFileSync(join(d, 'example'), '# Essentials\nPORT=10000\n# admin key\nAPI_KEY=\nCORS_ORIGIN=*\n');
  writeEnv(join(d, '.env'), { API_KEY: 'abc', AUTH_JWT_SECRET: 'xyz' }, join(d, 'example'));
  const text = readFileSync(join(d, '.env'), 'utf8');
  assert.equal(text, '# Essentials\nPORT=10000\n# admin key\nAPI_KEY=abc\nCORS_ORIGIN=*\n\nAUTH_JWT_SECRET=xyz\n');
  assert.equal(statSync(join(d, '.env')).mode & 0o777, 0o600, 'secrets file is private');
});

test('writeEnv changes only the keys asked for and never duplicates them', () => {
  const d = dir(), file = join(d, '.env');
  writeFileSync(file, 'PORT=9000\nAPI_KEY=old # comment\n');
  writeEnv(file, { API_KEY: 'new' });
  assert.equal(readFileSync(file, 'utf8'), 'PORT=9000\nAPI_KEY=new\n');
  writeEnv(file, { API_KEY: 'newer' });
  assert.equal(readEnv(file).values.API_KEY, 'newer');
  assert.equal(readFileSync(file, 'utf8').match(/API_KEY=/g).length, 1);
});

test('writeEnv starts a brand-new file without a leading blank line', () => {
  const d = dir(), file = join(d, '.env');
  writeEnv(file, { A: '1', B: '2' });
  assert.equal(readFileSync(file, 'utf8'), 'A=1\nB=2\n');
});

test('readEnv understands quotes and trailing comments', () => {
  const d = dir(), file = join(d, '.env');
  writeFileSync(file, 'A="quoted value"\nB=plain # note\n# C=commented\n');
  assert.deepEqual(readEnv(file).values, { A: 'quoted value', B: 'plain' });
  assert.equal(readEnv(join(d, 'missing')).exists, false);
});

test('placeholders are recognised as unset', () => {
  for (const v of ['', undefined, 'change-me-to-a-real-secret', 'your-secret-key-here', '<key>', 'ThisIsATerribleAPIKeyDontUseItAtAll']) assert.ok(isPlaceholder(v), String(v));
  assert.ok(!isPlaceholder(secret()));
});

test('Node.js version check', () => {
  assert.ok(nodeVersionOk('22.12.0'));
  assert.ok(nodeVersionOk('24.1.0'));
  assert.ok(!nodeVersionOk('22.11.9'));
  assert.ok(!nodeVersionOk('20.18.0'));
});
