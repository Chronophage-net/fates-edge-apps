// Isolated local preview backed by an ephemeral PostgreSQL engine. Never used by start.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID, generateKeyPairSync, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { createApp } from './app.js';
import { tokenIssuer } from './security.js';

const pg=new PGlite();
await pg.exec(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
const db={query:(...args)=>pg.query(...args),transaction:fn=>pg.transaction(fn)};
const password=randomBytes(12).toString('base64url');
await db.query('INSERT INTO accounts(id,username,password_hash,operator) VALUES($1,$2,$3,true)',[randomUUID(),'operator',await argon2.hash(password)]);
const origin='http://127.0.0.1:3100';
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const tokens=await tokenIssuer(privateKey.export({format:'pem',type:'pkcs8'}),origin);
const app=createApp({db,tokens,origin,pepper:randomBytes(32).toString('hex')});
const server=app.listen(3100,'127.0.0.1',()=>{
  console.log(`Local preview: ${origin}\nUsername: operator\nPassword: ${password}\nAll preview data disappears when this process stops.`);
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await pg.close();process.exit(0);}));
