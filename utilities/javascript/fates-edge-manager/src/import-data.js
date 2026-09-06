import { randomUUID } from 'node:crypto';
import { uuid, text, roles, requireThat } from './security.js';

// Reviewed export only. Never reads or writes the live game database.
export async function importData(db,document) {
  requireThat(Array.isArray(document.accounts) && Array.isArray(document.rooms) && Array.isArray(document.memberships),400,'Expected accounts, rooms and memberships arrays');
  return db.transaction(async tx=>{
    for (const a of document.accounts) {
      const username=text(a.username,32);
      requireThat(/^[A-Za-z0-9_-]{3,32}$/.test(username),400,'Invalid imported username');
      requireThat(typeof a.password_hash==='string' && /^(\$argon2id\$|\$2[aby]\$)/.test(a.password_hash),400,'Import requires an Argon2id or bcrypt password hash');
      await tx.query('INSERT INTO accounts(id,username,password_hash) VALUES($1,$2,$3)',[uuid(a.id),username,a.password_hash]);
    }
    for (const r of document.rooms) {
      requireThat(/^[A-Z0-9]{4,10}$/.test(r.room_code),400,'Invalid room code');
      uuid(r.owner_account_id);
      await tx.query('INSERT INTO managed_rooms(id,room_code,name) VALUES($1,$2,$3)',[uuid(r.id),r.room_code,text(r.name)]);
      const roster=document.memberships.filter(m=>m.room_id===r.id);
      requireThat(roster.filter(m=>m.account_id===r.owner_account_id && (m.status || 'active')==='active').length===1,400,'Each room must designate exactly one active owner membership');
      for (const m of roster) {
        requireThat(roles.includes(m.role) && ['active','suspended','banned','left'].includes(m.status || 'active'),400,'Invalid imported role/status');
        await tx.query('INSERT INTO room_memberships(id,room_id,account_id,role,control_role,status) VALUES($1,$2,$3,$4,$5,$6)',
          [m.id?uuid(m.id):randomUUID(),r.id,uuid(m.account_id),m.role,m.account_id===r.owner_account_id?'owner':'member',m.status || 'active']);
      }
      await tx.query('INSERT INTO audit_events(id,room_id,action,request_id) VALUES($1,$2,$3,$4)',[randomUUID(),r.id,'room.imported',randomUUID()]);
    }
    requireThat(document.memberships.every(m=>document.rooms.some(r=>r.id===m.room_id)),400,'Membership references a room outside this import');
    return {accounts:document.accounts.length,rooms:document.rooms.length,memberships:document.memberships.length};
  });
}
