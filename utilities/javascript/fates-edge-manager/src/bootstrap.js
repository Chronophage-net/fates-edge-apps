import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { database, migrate } from './db.js';

const username=process.env.MANAGER_BOOTSTRAP_USERNAME;
const password=process.env.MANAGER_BOOTSTRAP_PASSWORD;
if (!/^[A-Za-z0-9_-]{3,32}$/.test(username || '') || !password || password.length<12) throw new Error('Set bootstrap username and a password of at least 12 characters');
const db=await database(process.env.MANAGER_DATABASE_URL);
try {
  await migrate(db);
  await db.transaction(async tx=>{
    if ((await tx.query('SELECT id FROM accounts LIMIT 1')).rows.length) throw new Error('Bootstrap is only allowed on an empty manager database');
    await tx.query('INSERT INTO accounts(id,username,password_hash,operator) VALUES($1,$2,$3,true)',[randomUUID(),username,await argon2.hash(password)]);
  });
  console.log('Operator created. Remove bootstrap credentials from your environment.');
} finally {await db.close();}
