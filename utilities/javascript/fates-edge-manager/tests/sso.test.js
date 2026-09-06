import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import argon2 from 'argon2';
import { createApp } from '../src/app.js';

test('OIDC uses PKCE, state, nonce, issuer and signature; linking never matches email',async t=>{
  const pg=new PGlite();await pg.exec(await readFile(new URL('../src/schema.sql',import.meta.url),'utf8'));
  const db={query:(...args)=>pg.query(...args),transaction:fn=>pg.transaction(fn)};
  const account=randomUUID();await db.query('INSERT INTO accounts(id,username,password_hash) VALUES($1,$2,$3)',[account,'alice',await argon2.hash('twelve-character-password')]);
  const signing=await generateKeyPair('RS256'),wrongSigning=await generateKeyPair('RS256');
  const jwk={...await exportJWK(signing.publicKey),kid:'sso-test',alg:'RS256',use:'sig'};
  let expectedNonce,expectedVerifier,variant='valid';
  const issuer='https://identity.example';
  const oidcFetch=async(url,options)=>{
    if(url.endsWith('/.well-known/openid-configuration'))return Response.json({issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],code_challenge_methods_supported:['S256']});
    if(url.endsWith('/jwks'))return Response.json({keys:[jwk]});
    assert.equal(url,issuer+'/token');
    const body=new URLSearchParams(options.body);assert.equal(body.get('code_verifier'),expectedVerifier);
    const token=await new SignJWT({nonce:variant==='nonce'?'wrong':expectedNonce,email:'alice@example.com',email_verified:true})
      .setProtectedHeader({alg:'RS256',kid:'sso-test'}).setIssuer(variant==='issuer'?'https://wrong.example':issuer)
      .setSubject(variant==='unlinked'?'other-person':'person-1').setAudience(variant==='audience'?'other-client':'manager-client')
      .setIssuedAt().setExpirationTime(variant==='expired'?Math.floor(Date.now()/1000)-10:'5m')
      .sign(variant==='signature'?wrongSigning.privateKey:signing.privateKey);
    return Response.json({access_token:'discard-this-provider-token',token_type:'Bearer',id_token:token});
  };
  const http=createServer();http.listen(0,'127.0.0.1');await once(http,'listening');const origin=`http://127.0.0.1:${http.address().port}`;
  http.on('request',createApp({db,tokens:{jwks:{keys:[]}},origin,pepper:'z'.repeat(48),providers:[{name:'test',issuer,client_id:'manager-client'}],oidcFetch}));
  t.after(async()=>{http.closeAllConnections();await new Promise(resolve=>http.close(resolve));await pg.close();});
  const login=await fetch(origin+'/v1/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'alice',password:'twelve-character-password'})});
  const cookie=login.headers.get('set-cookie').split(';')[0],csrf=(await login.json()).csrf;
  async function start(link=false){
    const response=await fetch(origin+(link?'/v1/me/identities/test/link':'/v1/auth/sso/test/start'),{method:link?'POST':'GET',redirect:'manual',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'},...(link?{body:'{}'}:{})});
    assert.ok([200,302].includes(response.status));
    const location=link?(await response.json()).authorization_url:response.headers.get('location');
    const url=new URL(location);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('code_challenge'));
    const transaction=(await pg.query('SELECT * FROM sso_transactions ORDER BY expires_at DESC LIMIT 1')).rows[0];
    expectedVerifier=transaction.verifier;expectedNonce=url.searchParams.get('nonce');
    return {state:url.searchParams.get('state'),cookie:response.headers.get('set-cookie').split(';')[0]};
  }
  async function callback(flow,state=flow.state){return fetch(`${origin}/v1/auth/sso/test/callback?code=test-code&state=${state}`,{redirect:'manual',headers:{Cookie:`${cookie}; ${flow.cookie}`}});}
  const linked=await callback(await start(true));assert.equal(linked.status,302);
  assert.equal((await pg.query('SELECT * FROM external_identities')).rows[0].account_id,account);
  assert.equal((await callback(await start())).status,302);
  const badState=await callback(await start(),'wrong-state');assert.notEqual(badState.status,302);
  for(const mode of ['nonce','signature','issuer','audience','expired','unlinked']){
    variant=mode;const result=await callback(await start());assert.notEqual(result.status,302,`${mode} must fail`);
  }
  assert.equal((await pg.query('SELECT * FROM accounts')).rows.length,1);
  const stored=JSON.stringify((await pg.query('SELECT * FROM external_identities')).rows);
  assert.equal(stored.includes('discard-this-provider-token'),false);assert.equal(stored.includes('alice@example.com'),false);
});
