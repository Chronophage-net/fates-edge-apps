/** Opt-in, dedicated managed-node adapter. Local deployments never instantiate it. */
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { STORY_AUTHORITY_EVENTS, GM_GATED_EVENTS, SPECTATOR_READ_EVENTS, checkEventPermission } = require('./security.js');

const participantEvents = new Set(['chat-message','roll','dice-roll','character-select','claim-character','release-character','character-update','character-create','character-delete','character-sync','whiteboard-update','whiteboard-clear','player-update','webrtc-offer','webrtc-answer','webrtc-ice-candidate','voice-state']);

function createManagerNode({ origin, serverId, credential, publicUrl, name, capacity = 100, region = 'default', fetcher = fetch }) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Manager URL requires HTTPS');
    if (!serverId || !credential || !publicUrl) throw new Error('Managed nodes require ID, service credential, and public URL');
    let placements = new Map(), jwks = [], refreshed = 0, inFlight, registered = false;
    const connections = new Set();
    async function request(path, body) {
        const response = await fetcher(`${origin}${path}`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${credential}`},body:JSON.stringify(body),signal:AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error('Manager node request failed');
        return response.json();
    }
    function assertClaims(claims, code, scope='room:connect') {
        const placement=placements.get(String(code).toUpperCase());
        if (!placement || placement.status!=='assigned' || placement.room_status!=='active' ||
            claims.room_id!==placement.room_id || claims.room_code!==placement.room_code || claims.server_id!==serverId ||
            claims.placement_version!==placement.placement_version || claims.authz_version!==placement.authz_version ||
            !Array.isArray(claims.scope) || !claims.scope.includes(scope) || !Number.isFinite(claims.exp) || claims.exp<=Date.now()/1000) {
            throw new Error('Managed room access rejected');
        }
    }
    async function refresh() {
        if (inFlight) return inFlight;
        inFlight=(async()=>{
            if (!registered) {
                await request('/v1/internal/nodes/register',{server_id:serverId,name,public_url:publicUrl,capacity_rooms:capacity,region});
                registered=true;
            }
            const rows=await request(`/v1/internal/nodes/${serverId}/heartbeat`,{});
            const response=await fetcher(`${origin}/.well-known/jwks.json`,{signal:AbortSignal.timeout(5000)});
            if (!response.ok) throw new Error('Manager signing keys unavailable');
            const keys=await response.json();
            if (!Array.isArray(keys.keys)) throw new Error('Invalid manager signing keys');
            placements=new Map(rows.map(p=>[p.room_code,p]));jwks=keys.keys;refreshed=Date.now();
            for (const entry of connections) {
                try { assertClaims(entry.claims,entry.claims.room_code); } catch { entry.close();connections.delete(entry); }
            }
        })().finally(()=>{inFlight=null;});
        return inFlight;
    }
    async function verify(token, code, scope='room:connect') {
        if (typeof token!=='string' || token.length>8192) throw new Error('Room token required');
        // New joins fail closed when the manager cannot confirm routing. Existing
        // authenticated connections retain only their already-issued token life.
        if (Date.now()-refreshed>15000 || !placements.has(String(code).toUpperCase())) await refresh();
        const decoded=jwt.decode(token,{complete:true});
        const jwk=jwks.find(k=>k.kid===decoded?.header?.kid && k.alg==='RS256' && k.kty==='RSA');
        if (!jwk) throw new Error('Unknown manager signing key');
        const claims=jwt.verify(token,crypto.createPublicKey({key:jwk,format:'jwk'}),{
            algorithms:['RS256'],issuer:origin,audience:'fates-edge-room',maxAge:'10m'
        });
        if (!claims.sub || !claims.membership_id || !['gm','co-gm','assistant-gm','player','spectator'].includes(claims.role)) throw new Error('Invalid room principal');
        assertClaims(claims,code,scope);return claims;
    }
    function permit(claims,event,code) {
        // Membership and seat changes have exactly one writer: the manager.
        let scope;
        if (['handshake','join-room','leave-room','ping'].includes(event)) scope='room:connect';
        else if (SPECTATOR_READ_EVENTS.has(event)) scope='room:read';
        else if (STORY_AUTHORITY_EVENTS.has(event)) scope='session:run';
        else if (GM_GATED_EVENTS.has(event)) scope='campaign:write';
        else if (participantEvents.has(event)) scope='character:write';
        else throw new Error('This event is not enabled for managed rooms');
        assertClaims(claims,code,scope);
        // Handshake assigns the verified role; spectator query checks start after it.
        if (event!=='handshake' && checkEventPermission(event,claims.role)) throw new Error('Role does not allow this event');
    }
    function track(claims,close) {
        const entry={claims,close};connections.add(entry);
        const timer=setTimeout(()=>{close();connections.delete(entry);},Math.max(0,claims.exp*1000-Date.now()));timer.unref?.();
        return ()=>{clearTimeout(timer);connections.delete(entry);};
    }
    function httpGate(req,res,next) {
        if (['/healthz','/api/healthz'].includes(req.path)) return res.json({status:'ok',mode:'managed'});
        const match=req.path.match(/^\/api\/rooms\/([A-Za-z0-9_-]+)\/(deck(?:\/(?:draw|shuffle|crown|history))?|clients|characters)$/);
        if (!match || req.query.apiKey || req.query.token || req.headers['x-api-key']) return res.status(403).json({error:'Use a managed room endpoint and a room bearer token'});
        const endpoint=match[2];
        const isRead=req.method==='GET';
        const writeEvent={'deck/draw':'deck-draw','deck/shuffle':'deck-shuffle','deck/crown':'crown-spread'}[endpoint];
        if (!isRead && (req.method!=='POST' || !writeEvent)) return res.status(403).json({error:'Endpoint is not enabled for managed rooms'});
        const scope=isRead?'room:read':'session:run';
        verify((req.headers.authorization || '').replace(/^Bearer /,''),match[1].toUpperCase(),scope).then(claims=>{
            if (writeEvent && checkEventPermission(writeEvent,claims.role)) throw new Error('Role denied');
            req.managerClaims=claims;next();
        }).catch(()=>res.status(403).json({error:'Managed room access rejected'}));
    }
    const timer=setInterval(()=>refresh().catch(()=>{}),15000);timer.unref?.();
    return {verify,permit,track,refresh,httpGate,close:()=>{clearInterval(timer);for(const c of connections)c.close();connections.clear();},serverId};
}
function fromEnvironment(env=process.env) {
    if (!env.MANAGER_URL) return null;
    if (env.REDIS_URL || Number(env.CLUSTER_WORKERS)>1 || env.CLUSTER_WORKERS==='auto') throw new Error('Managed nodes require one process per stable server ID; disable Redis relay and cluster workers');
    return createManagerNode({origin:env.MANAGER_URL,serverId:env.MANAGER_SERVER_ID,credential:env.MANAGER_NODE_CREDENTIAL,
        publicUrl:env.MANAGER_PUBLIC_URL,name:env.MANAGER_NODE_NAME || env.MANAGER_SERVER_ID,capacity:Number(env.MANAGER_CAPACITY_ROOMS || 100),region:env.MANAGER_REGION || 'default'});
}
module.exports={createManagerNode,fromEnvironment};
