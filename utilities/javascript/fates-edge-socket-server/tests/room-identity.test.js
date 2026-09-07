const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {legacyRoomId,newRoomId}=require('../server/room-identity');
const {RoomDirectory}=require('../server/room-directory');
const room=require('../server/room');
const seats=require('../server/seat-presence');
test('UUID v5 backfill is stable and v7 creation is time ordered',()=>{
 assert.equal(legacyRoomId('AC12'),legacyRoomId('ac12'));assert.match(legacyRoomId('AC12'),/^[a-f0-9-]{14}5/);
 assert.ok(newRoomId(1000)<newRoomId(1001));assert.equal(legacyRoomId(legacyRoomId('AC12')),legacyRoomId('AC12'));
});
test('rotation preserves UUID, rejects old locator, persists across restart',()=>{
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'room-dir-')),'rooms.json');const d=new RoomDirectory(file);const r=d.legacy('ABCD');
 d.rotate(r.room_id,'WXYZ');const reloaded=new RoomDirectory(file);assert.equal(reloaded.resolve('WXYZ'),r.room_id);assert.throws(()=>reloaded.resolve('ABCD'),/rotated/);
 const child=d.create({parentId:r.room_id});assert.equal(child.room_code,null);assert.equal(child.parent_id,r.room_id);
});
test('live room and relay remain identical across locator rotation',()=>{
 const r=room.createRoom('ROTA');const published=[];room.setScaling({enabled:true,publish:(...args)=>published.push(args)});
 room.broadcastToRoom('ROTA','test',{});room.rotateRoomCode(r.room_id,'ROTB');room.broadcastToRoom('ROTB','test',{});
 assert.equal(room.getRoom('ROTB'),r);assert.equal(room.getRoom(r.room_id),r);assert.throws(()=>room.getRoom('ROTA'));
 assert.ok(published.every(([id])=>id===r.room_id));room.setScaling(null);room.rooms.clear();
});
test('whispers and private player commands never enter public history',()=>{
 const r=room.createRoom('PRIV');for(const m of [{text:'SECRET',whisper:true},{text:'SECRET',recipient:'gm'},{text:'!gm player new SECRET'}])room.recordChatMessage(r,m,100);
 assert.equal(r.chatHistory.length,0);room.recordChatMessage(r,{text:'Public',recipient:'all'},100);assert.equal(r.chatHistory.length,1);room.rooms.clear();
});
test('seat registration requires server credential; metadata is not role authority',()=>{
 assert.deepEqual(seats.metadata({botMode:'gm',botSeat:0}),{});
 assert.deepEqual(seats.metadata({botMode:'gm',botSeat:0,botKey:'bad'},'key'),{});
 const metadata=seats.metadata({botMode:'player',botSeat:1,botKey:'key'},'key');assert.equal(metadata.botMode,'player');assert.equal(metadata.role,undefined);
});
test('private creation reaches only lowest idle player seat, never observers or history',()=>{
 const r=room.createRoom('PCMD');const got=[];
 for(const c of [{id:'human',role:'gm'},{id:'player',role:'player'},{id:'p1',role:'player',botMode:'player',botSeat:1},{id:'p2',role:'player',botMode:'player',botSeat:2}])r.clients.set(c.id,{...c,type:'ws',ws:{readyState:1,send:raw=>got.push({to:c.id,...JSON.parse(raw)})}});
 seats.privateCommand(r,r.clients.get('human'),{text:'!gm player new SECRET'});assert.deepEqual(got.map(m=>m.to),['p1']);assert.equal(got[0].message.whisper,true);assert.equal(r.clients.get('p1').botBusy,true);
 got.length=0;seats.privateCommand(r,r.clients.get('player'),{text:'!gm player dossier Vessa'});assert.deepEqual(got.map(m=>m.to),['player']);assert.ok(!JSON.stringify(got).includes('SECRET'));room.rooms.clear();
});
