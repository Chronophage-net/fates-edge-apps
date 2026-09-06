import { randomBytes, randomUUID, generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';

// Exclusive creation is deliberate: rerunning setup must never rotate live
// peppers, node credentials, database passwords, or signing keys implicitly.
try { await access('.env'); throw new Error('.env already exists; setup will not overwrite it'); }
catch(error) { if(error.code!=='ENOENT')throw error; }
const random=()=>randomBytes(32).toString('hex');
const databasePassword=random(),password=random(),nodeId=randomUUID(),credential=random();
await mkdir('secrets',{recursive:true,mode:0o700});
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:3072});
await writeFile('secrets/signing.pem',privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});
await writeFile('.env',[
  'MANAGER_ORIGIN=http://localhost:3100','HOST=127.0.0.1','PORT=3100',
  `MANAGER_DATABASE_URL=postgresql://manager:${databasePassword}@127.0.0.1:15432/fates_edge_manager`,
  `MANAGER_DB_PASSWORD=${databasePassword}`,`MANAGER_PEPPER=${random()}`,'MANAGER_SIGNING_KEY_FILE=secrets/signing.pem',
  `MANAGER_NODE_CREDENTIALS=${JSON.stringify({[nodeId]:credential})}`,'MANAGER_OIDC_PROVIDERS=[]',
  'MANAGER_BOOTSTRAP_USERNAME=operator',`MANAGER_BOOTSTRAP_PASSWORD=${password}`,''
].join('\n'),{flag:'wx',mode:0o600});
await writeFile('secrets/socket-node.env',[
  'MANAGER_URL=http://localhost:3100',`MANAGER_SERVER_ID=${nodeId}`,`MANAGER_NODE_CREDENTIAL=${credential}`,
  'MANAGER_PUBLIC_URL=ws://localhost:3200','MANAGER_NODE_NAME=local-node','MANAGER_CAPACITY_ROOMS=100',
  'PORT=3200','HOST=127.0.0.1','REDIS_URL=','CLUSTER_WORKERS=0',''
].join('\n'),{flag:'wx',mode:0o600});
console.log('Created private .env and secrets files. Start PostgreSQL, run npm run bootstrap, then npm start.');
console.log('Initial operator password is MANAGER_BOOTSTRAP_PASSWORD in .env. Socket-node settings are in secrets/socket-node.env.');
