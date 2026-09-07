'use strict';
function metadata(data = {}, apiKey) {
 if (!apiKey || data.botKey !== apiKey) return {};
 // Presenting the API key and then a malformed seat is a misconfiguration, not an
 // anonymous join. Say so instead of silently degrading to a seatless client.
 if (!['gm','player','passive'].includes(data.botMode) || !Number.isInteger(data.botSeat) || data.botSeat<0 || data.botSeat>99)
  return { botSeatRejected:'botMode must be gm|player|passive and botSeat an integer 0-99' };
 return { botMode:data.botMode,botSeat:data.botSeat,botCharacter:'',botBusy:false };
}
function update(room, client, data = {}) {
 if (!client?.botMode) return;
 const name=typeof data.character==='string'?data.character.slice(0,80):'';
 // Seat metadata is routing information, never authorization. Roles are assigned separately.
 client.botCharacter=name;client.botBusy=data.busy===true;
 if(name && client.botMode==='player') client.name=name;
}
module.exports={metadata,update};

// Commands that can contain a secret never enter room chat history or public broadcast.
const RESERVATION_MS = 120000;
/** True for any message that may carry a private GM brief. Callers MUST fail closed on it. */
function isPrivateCommand(chat) { return /^!gm\s+player\b/i.test(chat?.text || ''); }
function privateCommand(roomState, actor, chat) {
 if (!isPrivateCommand(chat)) return false;
 const room = require('./room');
 const allowed = ['gm','co-gm','assistant-gm'].includes(actor?.role);
 const reply = text => room.deliverWhisper(roomState.room_id,'chat-message',{message:{sender:'Server',text,whisper:true,privateOnly:true,recipient:actor.id}},null,actor.id);
 if(!allowed) {reply('Only the GM or Assistant GM can manage bot-player seats.');return true;}
 const verb=chat.text.trim().split(/\s+/)[2]?.toLowerCase();
 if(verb==='new' && !chat.text.trim().split(/\s+/).slice(3).join(' ')){reply('Usage: !gm player new <brief>');return true;}
 if(actor.role==='assistant-gm' && !['dossier','list','seats'].includes(verb)){reply('Only the GM can direct a player seat.');return true;}
 const seats=[...roomState.clients.values()].filter(c=>c.botMode).sort((a,b)=>a.botSeat-b.botSeat || a.id.localeCompare(b.id));
 let target;
 const stale=c=>c.botBusy && !(Date.now()-(c.botBusyAt||0) < RESERVATION_MS);
 if(verb==='new') target=seats.find(c=>c.botMode==='player'&&!c.botCharacter&&(!c.botBusy||stale(c)));
 else if(['seats','list'].includes(verb)) target=seats.find(c=>c.botMode==='gm')||seats[0];
 else {
  const name=chat.text.trim().split(/\s+/).slice(3).join(' ').replaceAll('"','').toLowerCase();
  target=seats.filter(c=>c.botCharacter && (name===c.botCharacter.toLowerCase()||name.startsWith(c.botCharacter.toLowerCase()+' '))).sort((a,b)=>b.botCharacter.length-a.botCharacter.length)[0];
 }
 if(!target){reply(verb==='new'?'No idle player seat. Add a player entry to bots.json.':'No player seat owns that character.');return true;}
 // Server reservation prevents a second request racing the first generation.
 if(verb==='new') {target.botBusy=true;target.botBusyAt=Date.now();}
 const message={...chat,whisper:true,privateOnly:true,recipient:target.id,senderClientId:actor.id,senderRole:actor.role,senderUserId:actor.userId};
 room.deliverWhisper(roomState.room_id,'chat-message',{message},null,target.id);
 return true;
}
module.exports.privateCommand=privateCommand;
module.exports.isPrivateCommand=isPrivateCommand;
module.exports.RESERVATION_MS=RESERVATION_MS;
