import express from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { fileURLToPath } from 'node:url';
import { digest, equal, secret, text, uuid, requireThat, roles, scopesFor } from './security.js';
import { installSSO } from './sso.js';
import { verifyPassword } from './passwords.js';

const one = async (db, sql, values = []) => (await db.query(sql, values)).rows[0];
const many = async (db, sql, values = []) => (await db.query(sql, values)).rows;
const expires = seconds => new Date(Date.now() + seconds * 1000);
const safeKeyFields = 'id, membership_id, display_prefix, label, scopes, status, expires_at, last_used_at, created_at';

export function createApp({ db, tokens, origin, pepper, nodeCredentials = {}, providers = [], oidcFetch }) {
  requireThat(pepper?.length >= 32, 500, 'Manager pepper must contain at least 32 characters');
  const app = express();
  app.disable('x-powered-by');
  const secure = new URL(origin).protocol === 'https:';
  requireThat(secure || ['localhost','127.0.0.1'].includes(new URL(origin).hostname), 500, 'HTTPS is required');
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
  const hash = value => digest(value, pepper);
  const dummyPasswordHash = argon2.hash(secret());
  const cookie = (req, name) => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1);
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set({ 'X-Request-ID': req.requestId, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  async function audit(tx, req, action, roomId = null, target = null) {
    await tx.query('INSERT INTO audit_events(id,actor_account_id,room_id,action,target_id,request_id) VALUES($1,$2,$3,$4,$5,$6)',
      [randomUUID(), req.account?.id || null, roomId, action, target, req.requestId]);
  }
  async function session(tx, req) {
    const row = await one(tx, `SELECT a.id,a.username,a.operator,s.csrf,s.digest,s.created_at FROM sessions s
      JOIN accounts a ON a.id=s.account_id WHERE s.digest=$1 AND s.expires_at>now() AND a.status='active'`, [hash(cookie(req, 'fe_session') || '')]);
    requireThat(row, 401, 'Please sign in');
    req.account = row;
    return row;
  }
  async function issueSession(tx, req, res, accountId) {
    const raw = secret(), csrf = secret();
    await tx.query('INSERT INTO sessions(digest,account_id,csrf,expires_at) VALUES($1,$2,$3,$4)', [hash(raw), accountId, csrf, expires(43200)]);
    res.cookie('fe_session', raw, { ...cookieOptions, maxAge: 43200000 });
    return { csrf };
  }
  async function rate(req, label, limit) {
    const key = hash(`${label}:${req.socket.remoteAddress}`);
    const row = await one(db, `INSERT INTO rate_limits(bucket,hits,resets_at) VALUES($1,1,now()+interval '1 minute')
      ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN rate_limits.resets_at<now() THEN 1 ELSE rate_limits.hits+1 END,
      resets_at=CASE WHEN rate_limits.resets_at<now() THEN now()+interval '1 minute' ELSE rate_limits.resets_at END RETURNING hits`, [key]);
    requireThat(row.hits <= limit, 429, 'Too many attempts. Try again in a minute.');
  }
  function route(method, path, mode, fn) {
    app[method](path, async (req, res, next) => {
      try {
        if (mode === 'public' || mode === 'key') await rate(req, path, mode === 'key' ? 60 : 10);
        const result = await db.transaction(async tx => {
          if (mode === 'human' || mode === 'operator') {
            await session(tx, req);
            if (mode === 'operator') requireThat(req.account.operator, 403, 'Operator access required');
          }
          if (!['get','head'].includes(method) && mode !== 'service' && mode !== 'key') {
            requireThat(req.headers.origin === origin, 403, 'Request origin rejected');
            if (req.account) requireThat(equal(req.headers['x-csrf-token'], req.account.csrf), 403, 'Refresh the page and try again');
          }
          if (mode === 'service') {
            const nodeId = uuid(req.params.serverId || req.body.server_id);
            const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
            requireThat(nodeCredentials[nodeId] && equal(bearer, nodeCredentials[nodeId]), 401, 'Invalid node credential');
            req.serverId = nodeId;
          }
          if (req.account && method !== 'get' && req.headers['idempotency-key']) {
            const key = text(req.headers['idempotency-key'], 100);
            const fingerprint = hash(`${method}:${req.path}:${JSON.stringify(req.body)}`);
            const prior = await one(tx, 'SELECT fingerprint FROM idempotency WHERE account_id=$1 AND key=$2', [req.account.id, key]);
            requireThat(!prior, 409, 'This operation already completed. Refresh to see the result; secrets are shown only once.');
            await tx.query('INSERT INTO idempotency(account_id,key,fingerprint) VALUES($1,$2,$3)', [req.account.id, key, fingerprint]);
          }
          return fn(tx, req, res);
        });
        if (!res.headersSent) {
          if (result?.redirect) res.redirect(result.redirect);
          else res.json(result ?? { ok: true });
        }
      } catch (error) {
        if ([401,403,404].includes(error.status)) {
          // Record failures outside the rolled-back authorization transaction.
          // Route templates contain no invitation tokens or bearer credentials.
          try { await audit(db,req,`access.denied:${method}:${path}`); } catch { /* Preserve the original denial. */ }
        }
        next(error);
      }
    });
  }
  async function context(tx, req, roomId, control = false, allowInactiveRoom = false) {
    uuid(roomId);
    const row = await one(tx, `SELECT m.*,r.name,r.room_code,r.status AS room_status,r.authz_version FROM room_memberships m
      JOIN managed_rooms r ON r.id=m.room_id WHERE m.room_id=$1 AND m.account_id=$2 AND m.status='active'`, [roomId, req.account.id]);
    requireThat(row, 404, 'Room not found');
    requireThat(allowInactiveRoom || row.room_status === 'active', 409, 'Room is not active');
    if (control) requireThat(['owner','administrator'].includes(row.control_role), 403, 'Room administration required');
    return row;
  }
  async function issueKey(tx, req, member, body) {
    const scopes = body.scopes;
    requireThat(Array.isArray(scopes) && scopes.length > 0 && scopes.length <= 12 && scopes.every(s => scopesFor(member).includes(s)), 400, 'Scopes exceed this membership’s authority');
    const id = randomUUID(), raw = `fe_live_${id}_${secret()}`;
    const days = Number(body.days ?? 90);
    requireThat(Number.isInteger(days) && days >= 1 && days <= 365, 400, 'Expiry must be 1–365 days');
    const key = await one(tx, `INSERT INTO api_keys(id,membership_id,secret_digest,display_prefix,label,scopes,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${safeKeyFields}`,
      [id, member.id, hash(raw), `fe_live_${id.slice(0,8)}…`, text(body.label), [...new Set(scopes)], expires(days * 86400)]);
    await audit(tx, req, 'key.created', member.room_id, id);
    return { ...key, secret: raw };
  }
  async function connection(tx, member, scopes, keyId) {
    let placement = await one(tx, 'SELECT * FROM room_placements WHERE room_id=$1', [member.room_id]);
    if (!placement) {
      const node = await one(tx, `SELECT n.server_id FROM socket_nodes n LEFT JOIN room_placements p ON p.server_id=n.server_id
        WHERE n.status='ready' AND n.last_heartbeat_at>now()-interval '60 seconds'
        GROUP BY n.server_id HAVING count(p.room_id)<n.capacity_rooms ORDER BY count(p.room_id),n.server_id LIMIT 1`);
      requireThat(node, 503, 'No healthy socket node has capacity');
      placement = await one(tx, 'INSERT INTO room_placements(room_id,server_id) VALUES($1,$2) RETURNING *', [member.room_id, node.server_id]);
    }
    const node = await one(tx, `SELECT * FROM socket_nodes WHERE server_id=$1 AND status IN ('ready','draining')
      AND last_heartbeat_at>now()-interval '60 seconds'`, [placement.server_id]);
    requireThat(node && placement.status === 'assigned', 503, 'The assigned node is unavailable. An operator must restore it.');
    const claims = { sub: member.account_id, room_id: member.room_id, room_code: member.room_code,
      membership_id: member.id, role: member.role, scope: scopes, authz_version: member.authz_version,
      server_id: node.server_id, placement_version: placement.placement_version, ...(keyId ? { key_id: keyId } : {}) };
    return { room_id: member.room_id, room_code: member.room_code, expires_in: 600, server_id: node.server_id, placement_version: placement.placement_version,
      socket_url: node.public_url, room_token: await tokens.sign(claims) };
  }

  route('get', '/health', 'none', async tx => { await tx.query('SELECT 1'); return { status: 'ok' }; });
  app.get('/.well-known/jwks.json', (req,res) => res.json(tokens.jwks));
  route('post', '/v1/auth/login', 'public', async (tx,req,res) => {
    const name = text(req.body.username, 32), password = text(req.body.password, 256);
    const account = await one(tx, "SELECT * FROM accounts WHERE lower(username)=lower($1) AND status='active'", [name]);
    const valid = await verifyPassword(account?.password_hash || await dummyPasswordHash, password);
    requireThat(account?.password_hash && valid, 401, 'Invalid username or password');
    req.account = account;
    if (account.password_hash.startsWith('$2')) await tx.query('UPDATE accounts SET password_hash=$2 WHERE id=$1',[account.id,await argon2.hash(password)]);
    await audit(tx,req,'session.created');
    return issueSession(tx,req,res,account.id);
  });
  route('post', '/v1/auth/logout', 'human', async (tx,req,res) => {
    await tx.query('DELETE FROM sessions WHERE digest=$1', [req.account.digest]);
    res.clearCookie('fe_session', cookieOptions);
    await audit(tx,req,'session.revoked');
  });
  route('get', '/v1/me', 'human', async (tx,req) => ({ id:req.account.id, username:req.account.username, operator:req.account.operator, csrf:req.account.csrf,
    identities:await many(tx,'SELECT id,issuer FROM external_identities WHERE account_id=$1',[req.account.id]),
    sessions:await many(tx,'SELECT created_at,expires_at,(digest=$2) AS current FROM sessions WHERE account_id=$1 AND expires_at>now()',[req.account.id,req.account.digest]) }));
  route('post', '/v1/me/sessions/revoke-others', 'human', async (tx,req) => {
    await tx.query('DELETE FROM sessions WHERE account_id=$1 AND digest<>$2',[req.account.id,req.account.digest]);
    await audit(tx,req,'sessions.revoked');
  });
  route('post', '/v1/me/password', 'human', async (tx,req) => {
    const account=await one(tx,'SELECT password_hash FROM accounts WHERE id=$1',[req.account.id]);
    requireThat(account.password_hash && await verifyPassword(account.password_hash,text(req.body.current_password,256)),403,'Current password is incorrect');
    const password=text(req.body.password,256);requireThat(password.length>=12,400,'Use at least 12 characters');
    await tx.query('UPDATE accounts SET password_hash=$2 WHERE id=$1',[req.account.id,await argon2.hash(password)]);
    await tx.query('DELETE FROM sessions WHERE account_id=$1 AND digest<>$2',[req.account.id,req.account.digest]);
    await audit(tx,req,'password.changed');
  });
  route('post', '/v1/operator/accounts', 'operator', async (tx,req) => {
    const username = text(req.body.username,32), password=text(req.body.password,256);
    requireThat(/^[a-zA-Z0-9_-]{3,32}$/.test(username) && password.length >= 12,400,'Use a 3–32 character username and a password of at least 12 characters');
    const account = await one(tx,'INSERT INTO accounts(id,username,password_hash) VALUES($1,$2,$3) RETURNING id,username', [randomUUID(),username,await argon2.hash(password)]);
    await audit(tx,req,'account.created',null,account.id); return account;
  });
  route('get', '/v1/me/rooms', 'human', (tx,req) => many(tx, `SELECT r.*,m.role,m.control_role FROM managed_rooms r
    JOIN room_memberships m ON m.room_id=r.id WHERE m.account_id=$1 AND m.status='active' ORDER BY r.created_at DESC`,[req.account.id]));
  route('post', '/v1/rooms', 'human', async (tx,req) => {
    const room = await one(tx,'INSERT INTO managed_rooms(id,room_code,name) VALUES($1,$2,$3) RETURNING *',
      [randomUUID(),randomBytes(5).toString('hex').toUpperCase(),text(req.body.name)]);
    await tx.query("INSERT INTO room_memberships(id,room_id,account_id,role,control_role) VALUES($1,$2,$3,'gm','owner')",[randomUUID(),room.id,req.account.id]);
    await audit(tx,req,'room.created',room.id); return room;
  });
  route('get', '/v1/rooms/:roomId', 'human', async (tx,req) => {
    const member = await context(tx,req,req.params.roomId,false,true);
    const roster = ['owner','administrator'].includes(member.control_role) ? await many(tx, `SELECT m.account_id,a.username,m.role,m.control_role,m.status
      FROM room_memberships m JOIN accounts a ON a.id=m.account_id WHERE m.room_id=$1 ORDER BY a.username`,[member.room_id]) : [];
    return { ...member, scopes:scopesFor(member), roster:roster.map(m=>({...m,scopes:scopesFor(m)})) };
  });
  route('patch', '/v1/rooms/:roomId', 'human', async (tx,req) => {
    const member=await context(tx,req,req.params.roomId,true,true);
    requireThat(['active','suspended','archived'].includes(req.body.status),400,'Invalid room status');
    requireThat(member.control_role==='owner',403,'Only the owner may change room status');
    await tx.query('UPDATE managed_rooms SET status=$2,authz_version=authz_version+1 WHERE id=$1',[member.room_id,req.body.status]);
    await audit(tx,req,`room.${req.body.status}`,member.room_id);
  });
  route('get', '/v1/rooms/:roomId/connect', 'human', async (tx,req) => {
    const member = await context(tx,req,req.params.roomId);
    return connection(tx,member,scopesFor(member));
  });
  route('post', '/v1/rooms/:roomId/invitations', 'human', async (tx,req) => {
    const member=await context(tx,req,req.params.roomId,true);
    requireThat(roles.includes(req.body.role),400,'Invalid role');
    const account=await one(tx,"SELECT id FROM accounts WHERE lower(username)=lower($1) AND status='active'",[text(req.body.username,32)]);
    requireThat(account,400,'An active account with that username is required');
    const membership=await one(tx,'SELECT id,status FROM room_memberships WHERE room_id=$1 AND account_id=$2',[member.room_id,account.id]);
    requireThat(!membership || ['invited','left'].includes(membership.status),409,'This account already has a membership; update it from the roster');
    const id=membership?.id || randomUUID(), raw=secret();
    if (membership) {
      await tx.query("UPDATE room_memberships SET role=$2,status='invited',control_role='member' WHERE id=$1",[id,req.body.role]);
      await tx.query('DELETE FROM invitations WHERE membership_id=$1',[id]);
    } else await tx.query("INSERT INTO room_memberships(id,room_id,account_id,role,status) VALUES($1,$2,$3,$4,'invited')",[id,member.room_id,account.id,req.body.role]);
    await tx.query('INSERT INTO invitations(digest,membership_id,expires_at) VALUES($1,$2,$3)',[hash(raw),id,expires(604800)]);
    await audit(tx,req,'membership.invited',member.room_id,account.id); return { invitation:raw, username:req.body.username };
  });
  route('post', '/v1/invitations/:token/accept', 'human', async (tx,req) => {
    const invite=await one(tx,`SELECT m.* FROM invitations i JOIN room_memberships m ON m.id=i.membership_id
      JOIN managed_rooms r ON r.id=m.room_id WHERE i.digest=$1 AND i.expires_at>now() AND m.account_id=$2 AND m.status='invited' AND r.status='active'`,[hash(req.params.token),req.account.id]);
    requireThat(invite,404,'Invitation not found or expired');
    await tx.query("UPDATE room_memberships SET status='active' WHERE id=$1",[invite.id]);
    await tx.query('DELETE FROM invitations WHERE membership_id=$1',[invite.id]);
    await tx.query('UPDATE managed_rooms SET authz_version=authz_version+1 WHERE id=$1',[invite.room_id]);
    await audit(tx,req,'membership.accepted',invite.room_id,invite.account_id);
  });
  async function updateMember(tx,req,remove=false) {
    const actor=await context(tx,req,req.params.roomId,true);
    const target=await one(tx,'SELECT * FROM room_memberships WHERE room_id=$1 AND account_id=$2',[actor.room_id,uuid(req.params.accountId)]);
    requireThat(target,404,'Member not found');
    const role=req.body.role ?? target.role, status=remove ? 'left' : (req.body.status ?? target.status);
    const controlRole=req.body.control_role ?? target.control_role;
    requireThat(actor.control_role==='owner' || (target.control_role==='member' && controlRole==='member'),403,'Owner authority required');
    requireThat(target.control_role==='owner' ? (actor.id===target.id && status==='active' && controlRole==='owner') : ['member','administrator'].includes(controlRole),403,'The owner membership must remain active');
    requireThat(roles.includes(role) && ['active','suspended','banned','left'].includes(status),400,'Invalid membership');
    requireThat(target.status!=='invited' || remove,409,'The recipient must accept their invitation first');
    await tx.query('UPDATE room_memberships SET role=$2,status=$3,control_role=$4 WHERE id=$1',[target.id,role,status,controlRole]);
    if (remove) await tx.query('DELETE FROM invitations WHERE membership_id=$1',[target.id]);
    // Reissue keys after role changes: existing grants never silently widen or survive a downgrade.
    await tx.query("UPDATE api_keys SET status='revoked' WHERE membership_id=$1",[target.id]);
    await tx.query('UPDATE managed_rooms SET authz_version=authz_version+1 WHERE id=$1',[actor.room_id]);
    await audit(tx,req,'membership.updated',actor.room_id,target.account_id);
  }
  route('patch','/v1/rooms/:roomId/members/:accountId','human',(tx,req)=>updateMember(tx,req));
  route('delete','/v1/rooms/:roomId/members/:accountId','human',(tx,req)=>updateMember(tx,req,true));
  route('get','/v1/rooms/:roomId/keys','human',async(tx,req)=>{
    const m=await context(tx,req,req.params.roomId,false,true);
    return many(tx,`SELECT ${safeKeyFields.split(', ').map(f => `k.${f}`).join(', ')},a.username,m.role,m.account_id
      FROM api_keys k JOIN room_memberships m ON m.id=k.membership_id JOIN accounts a ON a.id=m.account_id
      WHERE m.room_id=$1 AND ($2 OR m.account_id=$3) ORDER BY k.created_at DESC`,[m.room_id,m.control_role==='owner',req.account.id]);
  });
  route('post','/v1/rooms/:roomId/keys','human',async(tx,req)=>{
    const actor=await context(tx,req,req.params.roomId);
    let member=actor;
    if(req.body.account_id && req.body.account_id!==req.account.id){
      requireThat(actor.control_role==='owner' && scopesFor(actor).includes('key:manage'),403,'Only the owner may issue another member’s key');
      member=await one(tx,`SELECT m.* FROM room_memberships m JOIN accounts a ON a.id=m.account_id
        WHERE m.room_id=$1 AND m.account_id=$2 AND m.status='active' AND a.status='active'`,[actor.room_id,uuid(req.body.account_id)]);
      requireThat(member,404,'Active member not found');
      await audit(tx,req,'key.issued-for-member',actor.room_id,member.account_id);
    }
    return issueKey(tx,req,member,req.body);
  });
  async function ownedKey(tx,req) {
    const key=await one(tx,'SELECT * FROM api_keys WHERE id=$1',[uuid(req.params.keyId)]);
    requireThat(key,404,'Key not found');
    const member=await one(tx,`SELECT m.*,r.room_code,r.authz_version,r.status AS room_status,a.status AS account_status FROM room_memberships m
      JOIN managed_rooms r ON r.id=m.room_id JOIN accounts a ON a.id=m.account_id WHERE m.id=$1`,[key.membership_id]);
    requireThat(member,404,'Key not found');
    const actor=await context(tx,req,member.room_id,false,true);
    requireThat(actor.account_id===member.account_id || actor.control_role==='owner',404,'Key not found');
    return {key,member};
  }
  route('delete','/v1/keys/:keyId','human',async(tx,req)=>{
    const {key,member}=await ownedKey(tx,req);
    await tx.query("UPDATE api_keys SET status='revoked' WHERE id=$1",[key.id]); await audit(tx,req,'key.revoked',member.room_id,key.id);
  });
  route('post','/v1/keys/:keyId/rotate','human',async(tx,req)=>{
    const {key,member}=await ownedKey(tx,req);
    requireThat(member.status==='active' && member.account_status==='active' && member.room_status==='active' && key.status==='active' && new Date(key.expires_at)>new Date(),409,'Key is not active');
    const replacement=await issueKey(tx,req,member,{label:key.label,scopes:key.scopes});
    await tx.query("UPDATE api_keys SET status='rotating',expires_at=LEAST(expires_at,$2) WHERE id=$1",[key.id,expires(300)]);
    await audit(tx,req,'key.rotated',member.room_id,key.id); return {...replacement,overlap_seconds:300};
  });
  route('post','/v1/auth/exchange','key',async(tx,req)=>{
    const raw=(req.headers.authorization || '').replace(/^Bearer /,'');
    requireThat(/^fe_live_[0-9a-f-]{36}_[A-Za-z0-9_-]{43}$/.test(raw),401,'Invalid API key');
    const key=await one(tx,"SELECT * FROM api_keys WHERE id=$1 AND status IN ('active','rotating') AND expires_at>now()",[uuid(raw.slice(8,44))]);
    requireThat(key && equal(key.secret_digest,hash(raw)),401,'Invalid API key');
    const member=await one(tx,`SELECT m.*,r.room_code,r.authz_version FROM room_memberships m JOIN managed_rooms r ON r.id=m.room_id
      JOIN accounts a ON a.id=m.account_id WHERE m.id=$1 AND m.status='active' AND r.status='active' AND a.status='active'`,[key.membership_id]);
    requireThat(member && key.scopes.every(s=>scopesFor(member).includes(s)) && key.scopes.includes('room:connect'),403,'Membership no longer permits this key');
    requireThat(!req.body.room_id || req.body.room_id===member.room_id,404,'Room not found');
    requireThat(!req.body.room_code || req.body.room_code===member.room_code,404,'Room not found');
    const result=await connection(tx,member,key.scopes,key.id);
    await tx.query("UPDATE api_keys SET last_used_at=now() WHERE id=$1 AND (last_used_at IS NULL OR last_used_at<now()-interval '1 minute')",[key.id]);
    return result;
  });
  route('get','/v1/rooms/:roomId/audit','human',async(tx,req)=>{
    const m=await context(tx,req,req.params.roomId,true,true);
    return many(tx,'SELECT action,target_id,occurred_at,request_id FROM audit_events WHERE room_id=$1 ORDER BY occurred_at DESC LIMIT 100',[m.room_id]);
  });
  route('get','/v1/me/audit','human',(tx,req)=>many(tx,'SELECT action,occurred_at,request_id FROM audit_events WHERE actor_account_id=$1 ORDER BY occurred_at DESC LIMIT 100',[req.account.id]));
  route('get','/v1/nodes','operator',tx=>many(tx,`SELECT n.*,count(p.room_id)::int AS assigned_rooms,
    (n.last_heartbeat_at>now()-interval '60 seconds') AS healthy FROM socket_nodes n LEFT JOIN room_placements p ON p.server_id=n.server_id GROUP BY n.server_id ORDER BY n.name`));
  route('get','/v1/nodes/:serverId/rooms','operator',async(tx,req)=>{
    const id=uuid(req.params.serverId);
    requireThat(await one(tx,'SELECT server_id FROM socket_nodes WHERE server_id=$1',[id]),404,'Node not found');
    return many(tx,`SELECT r.id,r.name,r.room_code,r.status,p.placement_version,p.status AS placement_status
      FROM room_placements p JOIN managed_rooms r ON r.id=p.room_id WHERE p.server_id=$1 ORDER BY r.name`,[id]);
  });
  route('patch','/v1/nodes/:serverId','operator',async(tx,req)=>{
    requireThat(['ready','draining','offline'].includes(req.body.status),400,'Invalid node status');
    const row=await one(tx,'UPDATE socket_nodes SET status=$2 WHERE server_id=$1 RETURNING server_id',[uuid(req.params.serverId),req.body.status]);
    requireThat(row,404,'Node not found'); await audit(tx,req,`node.${req.body.status}`,null,row.server_id);
  });
  route('post','/v1/internal/nodes/register','service',async(tx,req)=>{
    const url=new URL(text(req.body.public_url,500));
    requireThat(!url.username && !url.password && !url.search && !url.hash && (url.protocol==='wss:' || (!secure && url.protocol==='ws:' && ['localhost','127.0.0.1'].includes(url.hostname))),400,'Use a secure socket URL');
    requireThat(Number.isInteger(req.body.capacity_rooms) && req.body.capacity_rooms>0 && req.body.capacity_rooms<=10000,400,'Invalid node capacity');
    await tx.query(`INSERT INTO socket_nodes(server_id,name,public_url,capacity_rooms,region) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(server_id) DO UPDATE SET last_heartbeat_at=now()`,[req.serverId,text(req.body.name),url.toString(),req.body.capacity_rooms,text(req.body.region || 'default')]);
    await audit(tx,req,'node.registered',null,req.serverId);
  });
  route('post','/v1/internal/nodes/:serverId/heartbeat','service',async(tx,req)=>{
    const node=await one(tx,'UPDATE socket_nodes SET last_heartbeat_at=now() WHERE server_id=$1 RETURNING server_id',[req.serverId]);
    requireThat(node,404,'Register the node first');
    return many(tx,`SELECT p.*,r.room_code,r.authz_version,CASE WHEN n.status='offline' THEN 'suspended' ELSE r.status END AS room_status
      FROM room_placements p JOIN managed_rooms r ON r.id=p.room_id JOIN socket_nodes n ON n.server_id=p.server_id WHERE p.server_id=$1`,[req.serverId]);
  });
  installSSO({app,db,providers,origin,hash,cookie,cookieOptions,session,issueSession,audit,route,oidcFetch});
  app.use(express.static(fileURLToPath(new URL('../public',import.meta.url)),{etag:false}));
  app.use((req,res)=>res.status(404).json({error:'Not found',request_id:req.requestId}));
  app.use((error,req,res,next)=>{
    const status=error.status || (error.code==='23505'?409:500);
    res.status(status).json({error:status===500?'Request failed':error.code==='23505'?'That record already exists':error.message,request_id:req.requestId});
  });
  return app;
}
