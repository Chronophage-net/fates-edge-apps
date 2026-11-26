import { readFile } from 'node:fs/promises';
import { database, migrate } from './db.js';
import { tokenIssuer } from './security.js';
import { createApp } from './app.js';
import { createLogger } from './log.js';

const log=createLogger();
const origin=process.env.MANAGER_ORIGIN || 'http://localhost:3100';
const db=await database(process.env.MANAGER_DATABASE_URL);
await migrate(db);
if (!process.env.MANAGER_SIGNING_KEY_FILE) throw new Error('MANAGER_SIGNING_KEY_FILE is required');
const tokens=await tokenIssuer(await readFile(process.env.MANAGER_SIGNING_KEY_FILE,'utf8'),origin);
const nodeCredentials=JSON.parse(process.env.MANAGER_NODE_CREDENTIALS || '{}');
const providers=JSON.parse(process.env.MANAGER_OIDC_PROVIDERS || '[]');
const app=createApp({db,tokens,origin,pepper:process.env.MANAGER_PEPPER,nodeCredentials,providers,log});
const host=process.env.HOST || '127.0.0.1', port=Number(process.env.PORT || 3100);

// Where the database is, without its credentials.
function databaseLabel(url) {
  try { const u=new URL(url); return `${u.protocol.replace(':','')}://${u.hostname}${u.port?':'+u.port:''}${u.pathname}`; } catch { return 'configured'; }
}

const server=app.listen(port,host,async()=>{
  const nodes=(await db.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status<>'offline' AND last_heartbeat_at>now()-interval '60 seconds')::int AS online FROM socket_nodes`)).rows[0];
  const line='='.repeat(70);
  console.log(`${line}\n🧭 Fate’s Edge Manager\n${line}`);
  console.log(`🌐 Dashboard: ${origin}   (listening on ${host}:${port})`);
  console.log(`💾 Database: ${databaseLabel(process.env.MANAGER_DATABASE_URL)}`);
  console.log(`🖧  Game servers: ${Object.keys(nodeCredentials).length} credentialed, ${nodes.online} of ${nodes.total} registered online`);
  console.log(`🔐 Single sign-on: ${providers.length ? providers.map(p=>p.display_name || p.name).join(', ') : 'off (password sign-in only)'}`);
  if (!Object.keys(nodeCredentials).length) console.log('⚠️  No game server credentials (MANAGER_NODE_CREDENTIALS): rooms cannot be opened until a node is added.');
  if (process.env.MANAGER_BOOTSTRAP_PASSWORD) console.log('⚠️  MANAGER_BOOTSTRAP_PASSWORD is still set: remove it from .env now that bootstrap is done.');
  console.log(`${line}\n✅ Ready\n`);
});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{ log.info(`Received ${signal}; shutting down`); server.close(async()=>{await db.close();process.exit(0);}); });
