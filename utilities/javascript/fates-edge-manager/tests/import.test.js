import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';
import {importData} from '../src/import-data.js';
import {verifyPassword} from '../src/passwords.js';

test('explicit import preserves identity and bcrypt credentials and rolls back invalid ownership',async()=>{
  const pg=new PGlite();await pg.exec(await readFile(new URL('../src/schema.sql',import.meta.url),'utf8'));
  const db={transaction:fn=>pg.transaction(fn)};
  try {
    const id=randomUUID(),room=randomUUID(),hash=await bcrypt.hash('existing-password',10);
    const doc={accounts:[{id,username:'existing',password_hash:hash}],rooms:[{id:room,name:'Imported table',room_code:'IMPORT01',owner_account_id:id}],memberships:[]};
    await assert.rejects(importData(db,doc));assert.equal((await pg.query('SELECT * FROM accounts')).rows.length,0);
    doc.memberships.push({account_id:id,room_id:room,role:'player'});
    assert.deepEqual(await importData(db,doc),{accounts:1,rooms:1,memberships:1});
    const membership=(await pg.query('SELECT * FROM room_memberships')).rows[0];assert.equal(membership.role,'player');assert.equal(membership.control_role,'owner');
    assert.equal(await verifyPassword(hash,'existing-password'),true);assert.equal(await verifyPassword(hash,'wrong'),false);
    await assert.rejects(importData(db,doc));assert.equal((await pg.query('SELECT * FROM managed_rooms')).rows.length,1);
  }finally{await pg.close();}
});
