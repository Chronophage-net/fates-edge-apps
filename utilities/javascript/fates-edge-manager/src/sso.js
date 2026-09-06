import * as oidc from 'openid-client';
import { randomUUID } from 'node:crypto';
import { requireThat, secret, uuid } from './security.js';

export function installSSO({app,providers,origin,hash,cookie,cookieOptions,session,issueSession,audit,route,oidcFetch}) {
  const configurations = new Map();
  const providerFor = name => {
    const provider=providers.find(p=>p.name===name && p.enabled!==false);
    requireThat(provider && /^[a-z0-9-]+$/.test(provider.name),404,'Identity provider unavailable'); return provider;
  };
  async function configFor(provider) {
    if (!configurations.has(provider.name)) {
      requireThat(new URL(provider.issuer).protocol==='https:',500,'OIDC issuer must use HTTPS');
      const config=await oidc.discovery(new URL(provider.issuer),provider.client_id,
        provider.client_secret_env ? process.env[provider.client_secret_env] : undefined,undefined,
        {timeout:10,...(oidcFetch?{[oidc.customFetch]:oidcFetch}:{})});
      oidc.enableNonRepudiationChecks(config);
      configurations.set(provider.name,config);
    }
    return configurations.get(provider.name);
  }
  app.get('/v1/auth/providers',(req,res)=>res.json(providers.filter(p=>p.enabled!==false).map(p=>({name:p.name,display_name:p.display_name || p.name}))));
  async function begin(tx,req,res,link=false) {
    const provider=providerFor(req.params.provider), config=await configFor(provider);
    if (link) requireThat(Date.now()-new Date(req.account.created_at).getTime()<300000,403,'Sign in again before linking an identity');
    const raw=secret(), verifier=oidc.randomPKCECodeVerifier(), state=oidc.randomState(), nonce=oidc.randomNonce();
    await tx.query('INSERT INTO sso_transactions(digest,provider,verifier,state,nonce,link_account_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [hash(raw),provider.name,verifier,state,nonce,link?req.account.id:null,new Date(Date.now()+300000)]);
    res.cookie('fe_sso',raw,{...cookieOptions,maxAge:300000});
    const redirect=oidc.buildAuthorizationUrl(config,{redirect_uri:`${origin}/v1/auth/sso/${provider.name}/callback`,
      scope:'openid profile email',state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'}).href;
    return link ? {authorization_url:redirect} : {redirect};
  }
  route('get','/v1/auth/sso/:provider/start','public',(tx,req,res)=>begin(tx,req,res));
  route('post','/v1/me/identities/:provider/link','human',(tx,req,res)=>begin(tx,req,res,true));
  route('get','/v1/auth/sso/:provider/callback','public',async(tx,req,res)=>{
    const provider=providerFor(req.params.provider);
    const transaction=(await tx.query('DELETE FROM sso_transactions WHERE digest=$1 AND provider=$2 AND expires_at>now() RETURNING *',
      [hash(cookie(req,'fe_sso') || ''),provider.name])).rows[0];
    requireThat(transaction,400,'Sign-in transaction expired. Start again.');
    if (transaction.link_account_id) {
      await session(tx,req);
      requireThat(req.account.id===transaction.link_account_id,403,'Sign in to the original account');
    }
    let result;
    try {
      result=await oidc.authorizationCodeGrant(await configFor(provider),new URL(req.originalUrl,origin),{
        pkceCodeVerifier:transaction.verifier,expectedState:transaction.state,expectedNonce:transaction.nonce,idTokenExpected:true
      });
    } catch { requireThat(false,401,'Identity response rejected. Start sign-in again.'); }
    const claims=result.claims();
    requireThat(claims?.sub && Number.isFinite(claims.exp) && claims.exp>Date.now()/1000,401,'Provider identity is missing or expired');
    let identity=(await tx.query('SELECT * FROM external_identities WHERE issuer=$1 AND subject=$2',[provider.issuer,claims.sub])).rows[0];
    if (transaction.link_account_id) {
      requireThat(!identity || identity.account_id===transaction.link_account_id,409,'Identity is already linked to another account');
      if (!identity) {
        identity={account_id:transaction.link_account_id};
        await tx.query('INSERT INTO external_identities(id,account_id,issuer,subject) VALUES($1,$2,$3,$4)',[randomUUID(),identity.account_id,provider.issuer,claims.sub]);
      }
      await audit(tx,req,'identity.linked');
    }
    // Deliberately no email matching or implicit account creation.
    requireThat(identity,403,'Sign in locally and link this provider in Account first');
    const account=(await tx.query("SELECT * FROM accounts WHERE id=$1 AND status='active'",[identity.account_id])).rows[0];
    requireThat(account,403,'Account unavailable'); req.account=account;
    await issueSession(tx,req,res,account.id); await audit(tx,req,'session.sso');
    res.clearCookie('fe_sso',cookieOptions); return {redirect:'/'};
  });
  route('delete','/v1/me/identities/:identityId','human',async(tx,req)=>{
    requireThat(Date.now()-new Date(req.account.created_at).getTime()<300000,403,'Sign in again before unlinking');
    const account=(await tx.query('SELECT password_hash FROM accounts WHERE id=$1',[req.account.id])).rows[0];
    const identities=(await tx.query('SELECT id FROM external_identities WHERE account_id=$1',[req.account.id])).rows;
    requireThat(account.password_hash || identities.length>1,409,'Keep at least one sign-in method');
    const row=await tx.query('DELETE FROM external_identities WHERE id=$1 AND account_id=$2 RETURNING id',[uuid(req.params.identityId),req.account.id]);
    requireThat(row.rows.length,404,'Identity not found'); await audit(tx,req,'identity.unlinked');
  });
}
