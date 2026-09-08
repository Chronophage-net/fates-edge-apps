import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import argon2 from 'argon2';
import { io as ioClient } from 'socket.io-client';
import express from 'express';
import { createApp } from '../src/app.js';
import { tokenIssuer, verifyRoomToken, scopesFor } from '../src/security.js';

const require=createRequire(import.meta.url);
process.env.DATABASE_URL=':memory:';
process.env.LOG_LEVEL='ERROR';
const {createManagerNode}=require('../../fates-edge-socket-server/server/manager.js');
let pg,db,server,base,tokens,alice,bob,roomA,roomB,nodeId,nodeKey='n'.repeat(48),key,memberKey,node;
const ids={alice:randomUUID(),bob:randomUUID()};
async function request(path,method='GET',body,user,headers={}) {
  const response=await fetch(base+path,{method,headers:{Origin:base,'Content-Type':'application/json',...(user?{Cookie:user.cookie,'X-CSRF-Token':user.csrf}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
before(async()=>{
  pg=new PGlite();await pg.exec(await readFile(new URL('../src/schema.sql',import.meta.url),'utf8'));
  db={query:(...args)=>pg.query(...args),transaction:fn=>pg.transaction(fn)};
  const password=await argon2.hash('correct-horse-battery');
  await db.query('INSERT INTO accounts(id,username,password_hash,operator) VALUES($1,$2,$3,true),($4,$5,$3,false)',[ids.alice,'alice',password,ids.bob,'bob']);
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  // Allocate an OS-selected port before constructing issuer-bound services.
  const {createServer}=await import('node:http');
  server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  base=`http://127.0.0.1:${server.address().port}`;
  tokens=await tokenIssuer(privateKey.export({type:'pkcs8',format:'pem'}),base);
  nodeId=randomUUID();
  server.on('request',createApp({db,tokens,origin:base,pepper:'p'.repeat(48),nodeCredentials:{[nodeId]:nodeKey}}));
  for(const username of ['alice','bob']){
    const login=await request('/v1/auth/login','POST',{username,password:'correct-horse-battery'});
    assert.equal(login.status,200);const user={cookie:login.cookie,csrf:login.data.csrf};
    if(username==='alice')alice=user;else bob=user;
  }
});
after(async()=>{node?.close();server?.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pg.close();});

test('sessions reject anonymous access, wrong origin and missing CSRF',async()=>{
  assert.equal((await request('/v1/me')).status,401);
  assert.equal((await request('/v1/rooms','POST',{name:'No'},alice,{Origin:'https://attacker.example'})).status,403);
  assert.equal((await request('/v1/rooms','POST',{name:'No'},alice,{'X-CSRF-Token':''})).status,403);
  assert.equal((await request('/v1/nodes','GET',null,bob)).status,403);
});
test('room and exactly one owner are created atomically; duplicate operations do not create another room',async()=>{
  const headers={'Idempotency-Key':'create-first-room'};
  const created=await request('/v1/rooms','POST',{name:'Mothlight Chronicle'},alice,headers);
  assert.equal(created.status,200);roomA=created.data;
  assert.equal((await request('/v1/rooms','POST',{name:'Mothlight Chronicle'},alice,headers)).status,409);
  const owners=await db.query("SELECT * FROM room_memberships WHERE room_id=$1 AND control_role='owner'",[roomA.id]);
  assert.equal(owners.rows.length,1);assert.equal(owners.rows[0].account_id,ids.alice);
  roomB=(await request('/v1/rooms','POST',{name:'The Long Road'},bob)).data;
  assert.equal((await request(`/v1/rooms/${roomA.id}`,'GET',null,bob)).status,404);
  assert.equal((await request(`/v1/rooms/${roomA.id}/connect`,'GET',null,alice)).status,503);
});
test('node service authentication is separate; placement is sticky and tokens are node-bound',async()=>{
  assert.equal((await request('/v1/internal/nodes/register','POST',{server_id:nodeId},alice)).status,401);
  node=createManagerNode({origin:base,serverId:nodeId,credential:nodeKey,publicUrl:'ws://127.0.0.1:3200',name:'Test node',capacity:2});
  await node.refresh();
  const first=await request(`/v1/rooms/${roomA.id}/connect`,'GET',null,alice);
  assert.equal(first.status,200);
  const again=await request(`/v1/rooms/${roomA.id}/connect`,'GET',null,alice);
  assert.equal(first.data.server_id,again.data.server_id);assert.equal(first.data.placement_version,again.data.placement_version);
  const claims=await node.verify(first.data.room_token,roomA.room_code);
  assert.equal(claims.sub,ids.alice);
  await assert.rejects(node.verify(first.data.room_token,roomB.room_code));
  const expected={jwks:tokens.jwks,issuer:base,serverId:nodeId,roomId:roomA.id,roomCode:roomA.room_code,placementVersion:1,authzVersion:1,scope:'room:connect'};
  assert.equal((await verifyRoomToken(first.data.room_token,expected)).sub,ids.alice);
  await assert.rejects(verifyRoomToken(first.data.room_token,{...expected,serverId:randomUUID()}));
  await assert.rejects(verifyRoomToken(first.data.room_token,{...expected,placementVersion:2}));
});
test('keys are shown once, digested at rest and cannot exchange for another room',async()=>{
  const created=await request(`/v1/rooms/${roomA.id}/keys`,'POST',{label:'Narrator',scopes:['room:connect','room:read','session:run']},alice);
  assert.equal(created.status,200);key=created.data;
  assert.match(key.secret,/^fe_live_/);
  const list=await request(`/v1/rooms/${roomA.id}/keys`,'GET',null,alice);
  assert.equal(JSON.stringify(list.data).includes(key.secret),false);assert.equal('secret_digest' in list.data[0],false);
  const stored=await db.query('SELECT * FROM api_keys WHERE id=$1',[key.id]);assert.equal(JSON.stringify(stored.rows).includes(key.secret),false);
  const grant=await request('/v1/auth/exchange','POST',{},null,{Authorization:`Bearer ${key.secret}`});assert.equal(grant.status,200);
  assert.equal((await request('/v1/auth/exchange','POST',{room_id:roomB.id},null,{Authorization:`Bearer ${key.secret}`})).status,404);
  const claims=await node.verify(grant.data.room_token,roomA.room_code);
  node.permit(claims,'deck-draw',roomA.room_code);
  assert.throws(()=>node.permit(claims,'role_change_request',roomA.room_code));
  assert.throws(()=>node.permit(claims,'character-update',roomA.room_code));
});
test('invitations bind to the intended account; players cannot mint GM scopes',async()=>{
  const invite=await request(`/v1/rooms/${roomA.id}/invitations`,'POST',{username:'bob',role:'player'},alice);
  assert.equal(invite.status,200);
  assert.equal((await request(`/v1/invitations/${invite.data.invitation}/accept`,'POST',{},alice)).status,404);
  assert.equal((await request(`/v1/invitations/${invite.data.invitation}/accept`,'POST',{},bob)).status,200);
  assert.equal((await request(`/v1/invitations/${invite.data.invitation}/accept`,'POST',{},bob)).status,404);
  assert.equal((await request(`/v1/rooms/${roomA.id}/keys`,'POST',{label:'Escalate',scopes:['session:run']},bob)).status,400);
  const created=await request(`/v1/rooms/${roomA.id}/keys`,'POST',{label:'Player client',scopes:['room:connect','room:read']},bob);
  assert.equal(created.status,200);memberKey=created.data;
  assert.equal((await request(`/v1/rooms/${roomA.id}/members/${ids.alice}`,'PATCH',{status:'banned'},bob)).status,403);
});
test('banning a member revokes all its keys in the same transaction',async()=>{
  const ban=await request(`/v1/rooms/${roomA.id}/members/${ids.bob}`,'PATCH',{status:'banned'},alice);assert.equal(ban.status,200);
  assert.equal((await request('/v1/auth/exchange','POST',{},null,{Authorization:`Bearer ${memberKey.secret}`})).status,401);
  const stored=await db.query('SELECT status FROM api_keys WHERE id=$1',[memberKey.id]);assert.equal(stored.rows[0].status,'revoked');
  assert.equal((await request(`/v1/rooms/${roomA.id}`,'GET',null,bob)).status,404);
});
test('rotation has bounded overlap; explicit revocation ends new exchanges',async()=>{
  const rotated=await request(`/v1/keys/${key.id}/rotate`,'POST',{},alice);assert.equal(rotated.status,200);
  const old=await db.query('SELECT * FROM api_keys WHERE id=$1',[key.id]);assert.equal(old.rows[0].status,'rotating');
  assert.ok(new Date(old.rows[0].expires_at).getTime()<=Date.now()+300000);
  assert.equal((await request('/v1/auth/exchange','POST',{},null,{Authorization:`Bearer ${key.secret}`})).status,200);
  await request(`/v1/keys/${key.id}`,'DELETE',null,alice);
  assert.equal((await request('/v1/auth/exchange','POST',{},null,{Authorization:`Bearer ${key.secret}`})).status,401);
  key=rotated.data;
});
test('suspension invalidates cached node authorization and draining blocks new placements',async()=>{
  const grant=await request('/v1/auth/exchange','POST',{},null,{Authorization:`Bearer ${key.secret}`});assert.equal(grant.status,200);
  await node.refresh();const claims=await node.verify(grant.data.room_token,roomA.room_code);let closed=false;
  const untrack=node.track(claims,()=>{closed=true;});
  await request(`/v1/rooms/${roomA.id}`,'PATCH',{status:'suspended'},alice);await node.refresh();assert.equal(closed,true);untrack();
  await assert.rejects(node.verify(grant.data.room_token,roomA.room_code));
  assert.equal((await request('/v1/auth/exchange','POST',{},null,{Authorization:`Bearer ${key.secret}`})).status,403);
  await request(`/v1/nodes/${nodeId}`,'PATCH',{status:'draining'},alice);
  assert.equal((await request(`/v1/rooms/${roomB.id}/connect`,'GET',null,bob)).status,503);
});
test('all security mutations are audited without credentials',async()=>{
  const events=await db.query('SELECT * FROM audit_events');assert.ok(events.rows.length>=10);
  assert.equal(JSON.stringify(events.rows).includes('fe_live_'),false);
  assert.ok(events.rows.some(e=>e.action==='membership.updated'));
});
test('scopes never give spectators write access or assistant GMs campaign writes',()=>{
  assert.equal(scopesFor({role:'spectator',control_role:'member'}).some(s=>s.endsWith(':write')),false);
  assert.equal(scopesFor({role:'assistant-gm',control_role:'member'}).includes('campaign:write'),false);
});

test('real Socket.IO, plain WebSocket and REST enforce manager claims',async t=>{
  await request(`/v1/nodes/${nodeId}`,'PATCH',{status:'ready'},alice);
  await request(`/v1/rooms/${roomA.id}`,'PATCH',{status:'active'},alice);
  const grant=await request('/v1/auth/exchange','POST',{},null,{Authorization:`Bearer ${key.secret}`});assert.equal(grant.status,200);
  await node.refresh();
  const {createServer}=await import('node:http');
  const {Server}=require('../../fates-edge-socket-server/node_modules/socket.io');
  const WS=require('../../fates-edge-socket-server/node_modules/ws');
  const room=require('../../fates-edge-socket-server/server/room.js');
  const app=express();app.use(express.json());app.use(node.httpGate);
  const config={manager:node,healthEndpoint:'/health',wsMessageRateMax:0,maxClientsPerRoom:100};
  app.use(require('../../fates-edge-socket-server/server/api.js').createApiRouter(config));
  const http=createServer(app),io=new Server(http,{transports:['websocket']});room.setIo(io);
  require('../../fates-edge-socket-server/server/socketio-handlers.js').setupSocketIO(io,config);
  const wss=new WS.Server({noServer:true});
  http.on('upgrade',(req,socket,head)=>{if(new URL(req.url,'http://localhost').pathname==='/')wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
  require('../../fates-edge-socket-server/server/ws-handlers.js').setupWSS(wss,config);
  http.listen(0,'127.0.0.1');await once(http,'listening');const port=http.address().port;
  const clients=[];
  t.after(async()=>{for(const client of clients){client.disconnect?.();client.terminate?.();}await new Promise(resolve=>io.close(resolve));wss.close();http.closeAllConnections();http.close();});
  function event(client,name){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Timed out waiting for ${name}`)),5000);client.once(name,data=>{clearTimeout(timer);resolve(data);});});}
  const sio=ioClient(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false});clients.push(sio);await event(sio,'connect');
  const joined=event(sio,'room-joined');sio.emit('join-room',{roomCode:roomA.room_code,roomToken:grant.data.room_token,playerRole:'spectator',playerName:'Alice'});
  const ack=await joined;assert.equal(ack.clientRole,'gm');assert.equal(ack.serverId,nodeId);assert.equal(ack.placementVersion,1);
  const denied=event(sio,'permission-denied');sio.emit('role_change_request',{targetId:sio.id,role:'co-gm'});assert.equal((await denied).event,'role_change_request');
  const invalid=ioClient(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false});clients.push(invalid);await event(invalid,'connect');
  const rejection=event(invalid,'error');invalid.emit('join-room',{roomCode:roomB.room_code,roomToken:grant.data.room_token});assert.match((await rejection).message,/rejected/);
  const ws=new WS(`ws://127.0.0.1:${port}/?room=${roomA.room_code}`);clients.push(ws);
  const messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));
  const challenge=JSON.parse(await event(ws,'message'));assert.equal(challenge.type,'auth-required');assert.equal(messages.some(m=>m.type==='room-state'),false);
  const handshake=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No managed handshake')),5000);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='handshake_ack'){clearTimeout(timer);resolve(m);}});});
  ws.send(JSON.stringify({type:'handshake',roomToken:grant.data.room_token,clientName:'Second GM',role:'spectator'}));
  const wsAck=await handshake;assert.equal(wsAck.serverId,nodeId);assert.equal(wsAck.placementVersion,1);
  const url=`http://127.0.0.1:${port}/api/rooms/${roomA.room_code}/deck`;
  assert.equal((await fetch(url)).status,403);
  assert.equal((await fetch(url,{headers:{Authorization:`Bearer ${grant.data.room_token}`}})).status,200);
  assert.equal((await fetch(url.replace(roomA.room_code,roomB.room_code),{headers:{Authorization:`Bearer ${grant.data.room_token}`}})).status,403);
  assert.equal((await fetch(`${url}?apiKey=legacy`,{headers:{Authorization:`Bearer ${grant.data.room_token}`}})).status,403);
});

test('owners manage integration keys for active members without widening their scopes',async()=>{
  const room=(await request('/v1/rooms','POST',{name:'Delegated integrations'},alice)).data;
  const invite=await request(`/v1/rooms/${room.id}/invitations`,'POST',{username:'bob',role:'spectator'},alice);
  await request(`/v1/invitations/${invite.data.invitation}/accept`,'POST',{},bob);
  const body={account_id:ids.bob,label:'Bob reader',scopes:['room:connect','room:read']};
  assert.equal((await request(`/v1/rooms/${room.id}/keys`,'POST',{...body,scopes:['campaign:write']},alice)).status,400);
  assert.equal((await request(`/v1/rooms/${room.id}/keys`,'POST',{...body,account_id:ids.alice},bob)).status,403);
  const created=await request(`/v1/rooms/${room.id}/keys`,'POST',body,alice);
  assert.equal(created.status,200);
  const visible=await request(`/v1/rooms/${room.id}/keys`,'GET',null,alice);
  assert.equal(visible.data[0].username,'bob');assert.equal(visible.data[0].role,'spectator');
  assert.equal(visible.data[0].secret,undefined);
  assert.equal((await request(`/v1/rooms/${room.id}/keys`,'GET',null,bob)).data.length,1);
  assert.equal((await request(`/v1/keys/${created.data.id}/rotate`,'POST',{},alice)).status,200);
  assert.equal((await request(`/v1/keys/${created.data.id}`,'DELETE',null,alice)).status,200);
  const log=await request(`/v1/rooms/${room.id}/audit`,'GET',null,alice);
  assert.ok(log.data.some(e=>e.action==='key.issued-for-member' && e.target_id===ids.bob));
  await request(`/v1/rooms/${room.id}/members/${ids.bob}`,'DELETE',null,alice);
  assert.equal((await request(`/v1/rooms/${room.id}/keys`,'POST',body,alice)).status,404);
});

test('operators can inspect node placements; cancelled invites and archived rooms cannot grant access',async()=>{
  const placements=await request(`/v1/nodes/${nodeId}/rooms`,'GET',null,alice);
  assert.equal(placements.status,200);assert.ok(placements.data.some(r=>r.id===roomA.id));
  assert.equal((await request(`/v1/nodes/${nodeId}/rooms`,'GET',null,bob)).status,403);
  const room=(await request('/v1/rooms','POST',{name:'Closed table'},alice)).data;
  const invite=await request(`/v1/rooms/${room.id}/invitations`,'POST',{username:'bob',role:'player'},alice);
  assert.equal((await request(`/v1/rooms/${room.id}/members/${ids.bob}`,'DELETE',null,alice)).status,200);
  assert.equal((await request(`/v1/invitations/${invite.data.invitation}/accept`,'POST',{},bob)).status,404);
  assert.equal((await request(`/v1/rooms/${room.id}`,'PATCH',{status:'archived'},alice)).status,200);
  assert.equal((await request(`/v1/rooms/${room.id}/connect`,'GET',null,alice)).status,409);
  assert.equal((await request(`/v1/rooms/${room.id}/keys`,'POST',{label:'No',scopes:['room:connect']},alice)).status,409);
});
