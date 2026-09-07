'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {legacyRoomId,newRoomId,UUID}=require('./room-identity');
class RoomDirectory {
 constructor(file=null){this.file=file;this.records=new Map();this.codes=new Map();this.revoked=new Set();if(file && fs.existsSync(file)){const data=JSON.parse(fs.readFileSync(file,'utf8'));for(const r of data.rooms)this.add(r);this.revoked=new Set(data.revoked||[]);}}
 add(record){this.records.set(record.room_id,record);if(record.room_code)this.codes.set(record.room_code,record.room_id);return record;}
 save(){if(!this.file)return;fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify({rooms:[...this.records.values()],revoked:[...this.revoked]}),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);}
 resolve(value){const key=String(value);if(UUID.test(key))return key.toLowerCase();const code=key.toUpperCase();if(this.revoked.has(code))throw Error('Room locator was rotated. Use the current code.');return this.codes.get(code)||legacyRoomId(code);}
 legacy(code){const key=String(code).toUpperCase();const id=this.resolve(key);if(this.records.has(id))return this.records.get(id);const r=this.add({room_id:id,room_code:UUID.test(key)?null:key,legacy_code:UUID.test(key)?null:key,parent_id:null});this.save();return r;}
 create({code=null,parentId=null}={}){if(code && (this.codes.has(code.toUpperCase()) || this.revoked.has(code.toUpperCase())))throw Error('Room code is unavailable');const r=this.add({room_id:newRoomId(),room_code:code?.toUpperCase()||null,parent_id:parentId});this.save();return r;}
 rotate(id,newCode){if(!/^[A-Z0-9]{4,10}$/.test(newCode))throw Error('Invalid room code');const r=this.records.get(this.resolve(id));if(!r)throw Error('Room not found');if(this.codes.has(newCode)||this.revoked.has(newCode))throw Error('Code unavailable');if(r.room_code){this.codes.delete(r.room_code);this.revoked.add(r.room_code);}r.room_code=newCode;this.codes.set(newCode,r.room_id);this.save();return r;}
}
module.exports={RoomDirectory};
