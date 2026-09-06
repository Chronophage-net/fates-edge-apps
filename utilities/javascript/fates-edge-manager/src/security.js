import { randomBytes, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { SignJWT, importPKCS8, exportJWK, createLocalJWKSet, jwtVerify } from 'jose';

export const roles = ['gm', 'co-gm', 'assistant-gm', 'player', 'spectator'];
const read = ['room:read', 'room:connect', 'character:read', 'campaign:read'];
export function scopesFor(member) {
  const scopes = [...read];
  if (member.role !== 'spectator') scopes.push('character:write');
  if (['gm','co-gm','assistant-gm'].includes(member.role)) scopes.push('session:run');
  if (['gm','co-gm'].includes(member.role)) scopes.push('campaign:write');
  if (['owner','administrator'].includes(member.control_role)) scopes.push('roster:read','roster:write','key:manage');
  return scopes;
}
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireThat(condition, status, message) { if (!condition) throw new HttpError(status, message); }
export const secret = () => randomBytes(32).toString('base64url');
export const digest = (value, pepper) => createHmac('sha256', pepper).update(value).digest('hex');
export function equal(a, b) {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
}
export function text(value, max = 100) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 400, 'Invalid text');
  return value.trim();
}
export function uuid(value) {
  requireThat(typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value), 404, 'Not found');
  return value;
}
export async function tokenIssuer(pem, issuer) {
  const key = await importPKCS8(pem, 'RS256', { extractable: true });
  const { d, p, q, dp, dq, qi, ...publicKey } = await exportJWK(key);
  publicKey.kid = digest(JSON.stringify(publicKey), 'fates-edge-jwks').slice(0, 16);
  publicKey.alg = 'RS256'; publicKey.use = 'sig';
  return {
    jwks: { keys: [publicKey] },
    sign: claims => new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: publicKey.kid })
      .setIssuer(issuer).setAudience('fates-edge-room').setIssuedAt().setExpirationTime('10m')
      .setJti(randomUUID()).sign(key)
  };
}
// Also usable by a socket-node adapter. Routing values must come from trusted
// node/placement configuration, never from the token itself.
export async function verifyRoomToken(token, { jwks, issuer, serverId, roomId, roomCode, placementVersion, authzVersion, scope }) {
  const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
    issuer, audience: 'fates-edge-room', algorithms: ['RS256'], maxTokenAge: '10m'
  });
  requireThat(payload.server_id === serverId && payload.room_id === roomId && payload.room_code === roomCode &&
    payload.placement_version === placementVersion && payload.authz_version === authzVersion &&
    roles.includes(payload.role) && Array.isArray(payload.scope) && payload.scope.includes(scope) &&
    typeof payload.sub === 'string' && typeof payload.membership_id === 'string', 403, 'Room token rejected');
  return payload;
}
