import { readFile } from 'node:fs/promises';
import { database, migrate } from './db.js';
import { tokenIssuer } from './security.js';
import { createApp } from './app.js';

const origin=process.env.MANAGER_ORIGIN || 'http://localhost:3100';
const db=await database(process.env.MANAGER_DATABASE_URL);
await migrate(db);
if (!process.env.MANAGER_SIGNING_KEY_FILE) throw new Error('MANAGER_SIGNING_KEY_FILE is required');
const tokens=await tokenIssuer(await readFile(process.env.MANAGER_SIGNING_KEY_FILE,'utf8'),origin);
const app=createApp({db,tokens,origin,pepper:process.env.MANAGER_PEPPER,
  nodeCredentials:JSON.parse(process.env.MANAGER_NODE_CREDENTIALS || '{}'),
  providers:JSON.parse(process.env.MANAGER_OIDC_PROVIDERS || '[]')});
const server=app.listen(Number(process.env.PORT || 3100),process.env.HOST || '127.0.0.1',()=>console.log(`Fate’s Edge Manager: ${origin}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0);}));
