const content=document.querySelector('#content'), notice=document.querySelector('#notice'), dialog=document.querySelector('#dialog');
let me, providers=[], currentRoom, keyMembers=[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleString():'Never';
const badge=v=>`<span class="badge ${esc(v)}">${esc(v)}</span>`;
const button=(action,label,id='',kind='secondary')=>`<button class="${kind}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
const heading=(title,description,action='')=>`<div class="heading"><div><div class="eyebrow">THE PEOPLE BEHIND THE GAME</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action}</div>`;
const empty=(title,message,action='')=>`<div class="empty"><div class="sigil">✧</div><h2>${title}</h2><p>${message}</p>${action}</div>`;
const roleOptions=(selected='player')=>['gm','co-gm','assistant-gm','player','spectator'].map(r=>`<option ${r===selected?'selected':''}>${r}</option>`).join('');
function tell(message){notice.textContent=message;}
async function api(path,method='GET',body){
  const response=await fetch(`/v1${path}`,{method,headers:{'Content-Type':'application/json',...(me?{'X-CSRF-Token':me.csrf}:{}),...(method!=='GET'?{'Idempotency-Key':crypto.randomUUID()}: {})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok){if(response.status===401 && me){me=null;dialog.close();await login();}throw new Error(data.error || 'Request failed');} return data;
}
function modal(html){document.querySelector('#dialog-content').innerHTML=html;if(!dialog.open)dialog.showModal();}
function reveal(title,value,description){modal(`<h2>${esc(title)}</h2><p>${esc(description)}</p><pre class="secret" id="one-time-secret"></pre><div class="actions">${button('copy-secret','Copy')}${button('download-secret','Download')}</div>`);document.querySelector('#one-time-secret').textContent=value;}
dialog.addEventListener('close',()=>{document.querySelector('#dialog-content').replaceChildren();dialog.querySelectorAll('[role=alert]').forEach(el=>el.remove());keyMembers=[];});
function renderNav(){
  const view=location.hash.slice(1).split('/')[0]||'rooms';
  document.querySelector('#navigation').innerHTML=me?[['rooms','Rooms'],['keys','API keys'],['account','Account'],...(me.operator?[['nodes','Socket nodes']]:[])].map(([id,label])=>`<a href="#${id}" class="${view===id?'active':''}">${label}</a>`).join(''):'';
  document.querySelector('#account-label').textContent=me?me.username:'';
  document.querySelector('#breadcrumb').textContent=`MANAGEMENT / ${view.toUpperCase()}`;
}
async function login(){
  me=null;renderNav();content.innerHTML=`<div class="login"><div class="eyebrow">WELCOME BACK</div><h1>A place for every table.</h1><p>Manage your rooms, people, and the keys that connect them.</p><form data-form="login"><label>Username<input name="username" autocomplete="username" required maxlength="32"></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button>Sign in</button></form><div class="stack">${providers.map(p=>`<p><a class="button secondary" href="/v1/auth/sso/${encodeURIComponent(p.name)}/start">Continue with ${esc(p.display_name)}</a></p>`).join('')}</div><p class="subtle">Your operator can create an account for you.</p></div>`;
}
async function render(){
  if(!me)return login();
  renderNav();content.setAttribute('aria-busy','true');
  const [view='rooms',id]=location.hash.slice(1).split('/');
  try{
    if(view==='rooms' && id){await roomView(id);}
    else if(view==='rooms'){
      const rooms=await api('/me/rooms');
      content.innerHTML=heading('Your rooms','Every table has a place. Make room for the next story.',button('create-room','+ Create a room','','primary'))+
        `<div class="stats"><div class="stat"><span>YOUR ROOMS</span><strong>${rooms.length}</strong></div><div class="stat"><span>ACTIVE</span><strong>${rooms.filter(r=>r.status==='active').length}</strong></div><div class="stat"><span>YOU MANAGE</span><strong>${rooms.filter(r=>r.control_role!=='member').length}</strong></div></div><div class="heading"><h2>The gathering places</h2>${button('accept-invite','Accept an invitation')}</div>`+
        (rooms.length?`<div class="grid">${rooms.map(r=>`<article class="card room-card">${badge(r.status)}<h3>${esc(r.name)}</h3><p class="subtle">${esc(r.role)} · ${esc(r.control_role)}</p><div class="card-bottom"><code>${esc(r.room_code)}</code><a class="button secondary" href="#rooms/${r.id}">Open room →</a></div></article>`).join('')}</div>`:empty('Your next story starts here.','Create a room to invite your group and manage its access.',button('create-room','Create your first room','','primary')));
    }else if(view==='keys'){
      const rooms=await api('/me/rooms'),groups=await Promise.all(rooms.map(async r=>({room:r,keys:await api(`/rooms/${r.id}/keys`)})));
      content.innerHTML=heading('API keys','A dedicated key for each room and integration.')+(groups.length?groups.map(({room:r,keys})=>`<article class="card"><div class="heading"><h2>${esc(r.name)}</h2>${r.status==='active'?button('create-key','+ Create key',r.id,'primary'):badge(r.status)}</div>${keyTable(keys)}</article>`).join('<br>'):empty('No rooms, no keys yet.','Create a room first. Its keys will appear here.','<a class="button" href="#rooms">Go to rooms</a>'));
    }else if(view==='account'){
      me=await api('/me');const events=await api('/me/audit');
      content.innerHTML=heading('Your account',`Signed in as ${me.username}`,`<div class="actions">${button('password','Change password')}${button('logout','Sign out')}</div>`)+`<div class="split"><div class="stack"><article class="card"><h2>Sign-in methods</h2><p>Link a provider after signing in within the last five minutes.</p>${me.identities.map(i=>`<div class="log"><span>${esc(i.issuer)}</span>${button('unlink','Unlink',i.id)}</div>`).join('')}${providers.map(p=>button('link',`Link ${esc(p.display_name)}`,p.name)).join(' ')}</article><article class="card"><h2>Active sessions</h2>${me.sessions.map(s=>`<div class="log"><span>${s.current?'This session':'Another session'}</span><time>${date(s.created_at)}</time></div>`).join('')}<p>${button('revoke-sessions','Sign out other sessions')}</p></article></div><article class="card"><h2>Security history</h2>${logs(events)}</article></div>`;
    }else if(view==='nodes' && me.operator){
      const nodes=await api('/nodes');
      content.innerHTML=heading('Socket nodes','Health and capacity across your cluster.',button('create-account','+ Create account'))+(nodes.length?`<div class="grid">${nodes.map(n=>`<article class="card">${badge(n.healthy?n.status:'offline')}<h3>${esc(n.name)}</h3><p>${esc(n.region)}</p><code>${esc(n.public_url)}</code><p>${n.assigned_rooms} / ${n.capacity_rooms} rooms assigned</p><p class="subtle">Heartbeat: ${date(n.last_heartbeat_at)}</p><div class="actions">${button('node-rooms','Assigned rooms',n.server_id)}${button('node-state',n.status==='draining'?'Resume placements':'Drain node',`${n.server_id}|${n.status==='draining'?'ready':'draining'}`)}</div></article>`).join('')}</div>`:empty('Waiting for your first node.','Register a socket node with its service credential to make room placement available.'));
    }else{location.hash='rooms';}
  }catch(e){tell(e.message);}finally{content.setAttribute('aria-busy','false');}
}
function keyTable(keys){return keys.length?`<div class="table-wrap"><table><thead><tr><th>INTEGRATION</th><th>ACCESS</th><th>STATUS / EXPIRY</th><th>ACTIONS</th></tr></thead><tbody>${keys.map(k=>`<tr><td>${esc(k.label)}<p class="subtle">${esc(k.username)} · ${esc(k.role)}</p><p><code>${esc(k.display_prefix)}</code></p><span class="subtle">Last used: ${date(k.last_used_at)}</span></td><td>${k.scopes.map(esc).join('<br>')}</td><td>${badge(new Date(k.expires_at)<new Date()?'expired':k.status)}<p class="subtle">${date(k.expires_at)}</p></td><td><div class="actions">${k.status==='active'?button('rotate-key','Rotate',k.id):''}${k.status!=='revoked'?button('revoke-key','Revoke',k.id,'danger'):''}</div></td></tr>`).join('')}</tbody></table></div>`:'<p>No keys issued. Create one when a bot or integration needs access.</p>';}
function logs(events){return events.length?events.map(e=>`<div class="log"><span>${esc(e.action.replaceAll('.',' · '))}</span><time>${date(e.occurred_at)}</time></div>`).join(''):'<p>No security events yet.</p>';}
async function roomView(id){
  currentRoom=await api(`/rooms/${id}`);const r=currentRoom,admin=['owner','administrator'].includes(r.control_role);
  const events=admin?await api(`/rooms/${id}/audit`):[];
  content.innerHTML=heading(r.name,`${r.role} · ${r.control_role}`,`<a class="button secondary" href="#rooms">← All rooms</a>`)+
    `<div class="card heading"><div>${badge(r.room_status)} <code>${esc(r.room_code)}</code><p class="subtle">Room code is a locator. Membership grants access.</p></div><div class="actions">${r.room_status==='active'?button('connect','Get connection',id,'primary'):''}${r.control_role==='owner'?button('room-state',r.room_status==='active'?'Suspend room':'Reactivate room',`${id}|${r.room_status==='active'?'suspended':'active'}`)+(r.room_status!=='archived'?button('room-state','Archive room',`${id}|archived`,'danger'):''):''}</div></div><div class="split"><div class="stack"><article class="card"><div class="heading"><h2>People at the table</h2>${admin && r.room_status==='active'?button('invite','+ Invite',id):''}</div>${admin?`<div class="table-wrap"><table><thead><tr><th>PERSON</th><th>GAME ROLE</th><th>STATUS</th><th></th></tr></thead><tbody>${r.roster.map(m=>`<tr><td>${esc(m.username)}<p class="subtle">${r.control_role==='owner' && m.control_role!=='owner' && m.status==='active'?`<select aria-label="Administration for ${esc(m.username)}" data-control-member="${m.account_id}"><option value="member" ${m.control_role==='member'?'selected':''}>Member</option><option value="administrator" ${m.control_role==='administrator'?'selected':''}>Administrator</option></select>`:esc(m.control_role)}</p></td><td>${(m.control_role==='owner' && r.control_role!=='owner')||m.status==='invited'?esc(m.role):`<select aria-label="Role for ${esc(m.username)}" data-member="${m.account_id}">${roleOptions(m.role)}</select>`}</td><td>${badge(m.status)}</td><td>${m.control_role!=='owner' && (r.control_role==='owner'||m.control_role==='member')?`${m.status!=='invited'&&m.status!=='left'?button('ban-member',m.status==='banned'?'Restore':'Ban',`${m.account_id}|${m.status==='banned'?'active':'banned'}`,'danger'):''}${m.status!=='left'?button('remove-member',m.status==='invited'?'Cancel invitation':'Remove member',m.account_id,'danger'):''}`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p>Your room administrator manages invitations and membership.</p>'}</article><article class="card"><h2>Integrations</h2><p>Give each bot its own room key. You can rotate or revoke access at any time.</p>${r.room_status==='active'?button('create-key','Create a key',id):''} <a class="button secondary" href="#keys">View your keys</a></article></div>${admin?`<article class="card"><h2>Recent security events</h2>${logs(events)}</article>`:''}</div>`;
}
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el)return;
  const action=el.dataset.action,id=el.dataset.id;el.disabled=true;
  try{
    if(action==='create-room')modal('<h2>Create a room</h2><p>You will be its owner and GM. Your game role can be separate from administration.</p><form data-form="room"><label>Room name<input name="name" required maxlength="100" placeholder="Your campaign name"></label><button>Create room</button></form>');
    else if(action==='accept-invite')modal('<h2>Accept an invitation</h2><form data-form="accept"><label>Invitation token<input name="token" required autocomplete="off"></label><button>Join room</button></form>');
    else if(action==='invite')modal(`<h2>Invite a player</h2><p>They need an existing manager account. Share the invitation token with them.</p><form data-form="invite" data-id="${id}"><label>Username<input name="username" required maxlength="32"></label><label>Game role<select name="role">${roleOptions()}</select></label><button>Create invitation</button></form>`);
    else if(action==='create-account')modal('<h2>Create an account</h2><form data-form="account"><label>Username<input name="username" required pattern="[A-Za-z0-9_-]{3,32}" maxlength="32" autocomplete="off"></label><label>Initial password<input name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password"></label><button>Create account</button></form>');
    else if(action==='create-key'){
      const room=await api(`/rooms/${id}`);
      keyMembers=room.control_role==='owner'?room.roster.filter(m=>m.status==='active'):[{account_id:me.id,username:me.username,scopes:room.scopes}];
      modal(`<h2>Connect an integration</h2><p>This key opens ${esc(room.name)} with your ${esc(room.role)} permissions.</p><form data-form="key" data-id="${id}">${room.control_role==='owner'?`<label>Access belongs to<select name="account_id" data-key-account>${keyMembers.map(m=>`<option value="${m.account_id}" ${m.account_id===me.id?'selected':''}>${esc(m.username)} · ${esc(m.role)}</option>`).join('')}</select></label><p>Issuing a key for another member is recorded in the security history. Its permissions remain limited to that member.</p>`:''}<label>Integration name<input name="label" required maxlength="100" placeholder="GM bot"></label><label>Expires in days<input type="number" name="days" min="1" max="365" value="90" required></label><p>Allowed actions</p><div id="key-scopes">${room.scopes.map(s=>`<label class="check"><input type="checkbox" name="scopes" value="${s}" ${['room:read','room:connect'].includes(s)?'checked':''}>${s}</label>`).join('')}</div><button>Create key</button></form>`);
    }else if(action==='copy-secret'){await navigator.clipboard.writeText(document.querySelector('#one-time-secret').textContent);el.textContent='Copied';}
    else if(action==='download-secret'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([document.querySelector('#one-time-secret').textContent],{type:'text/plain'}));a.download='fates-edge-credential.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
    else if(action==='password')modal('<h2>Change password</h2><form data-form="password"><label>Current password<input type="password" name="current_password" required autocomplete="current-password"></label><label>New password<input type="password" name="password" required minlength="12" maxlength="256" autocomplete="new-password"></label><button>Change password</button></form>');
    else if(action==='logout'){await api('/auth/logout','POST');me=null;await login();}
    else if(action==='link'){const response=await api(`/me/identities/${encodeURIComponent(id)}/link`,'POST');location.assign(response.authorization_url);}
    else if(action==='unlink'){if(confirm('Remove this sign-in method?')){await api(`/me/identities/${id}`,'DELETE');await render();}}
    else if(action==='revoke-sessions'){await api('/me/sessions/revoke-others','POST');await render();tell('Other sessions signed out.');}
    else if(action==='node-rooms'){const rooms=await api(`/nodes/${id}/rooms`);modal(`<h2>Assigned rooms</h2>${rooms.length?rooms.map(r=>`<div class="log"><span>${esc(r.name)} · ${esc(r.room_code)}</span>${badge(r.status)}<span>Placement ${r.placement_version}</span></div>`).join(''):'<p>No rooms assigned.</p>'}`);}
    else if(action==='remove-member'){if(confirm('Remove this member or cancel their invitation? Their room keys will be revoked.')){await api(`/rooms/${currentRoom.room_id}/members/${id}`,'DELETE');await render();tell('Membership ended and its keys revoked.');}}
    else if(action==='connect'){const result=await api(`/rooms/${id}/connect`);reveal('Room connection',JSON.stringify(result,null,2),'Copy this connection, then open Settings → Managed room in the web client. It expires in ten minutes. Keep it private.');}
    else if(action==='rotate-key'){if(confirm('Rotate this key? The existing key will expire within five minutes.')){const key=await api(`/keys/${id}/rotate`,'POST');await render();reveal('Replacement key',key.secret,'Save this key now. It will not be shown again. Update your integration within five minutes.');}}
    else if(action==='revoke-key'){if(confirm('Revoke this integration’s room key? It will stop receiving new connection tokens immediately.')){await api(`/keys/${id}`,'DELETE');await render();tell('Key revoked. Previously issued room tokens expire within ten minutes.');}}
    else if(action==='room-state'){const [room,status]=id.split('|');if(confirm(`Set this room to ${status}?`)){await api(`/rooms/${room}`,'PATCH',{status});await render();}}
    else if(action==='node-state'){const [node,status]=id.split('|');await api(`/nodes/${node}`,'PATCH',{status});await render();tell(status==='draining'?'New placements stopped. Existing rooms stay on this node.':'Node accepts new placements.');}
    else if(action==='ban-member'){const [account,status]=id.split('|');if(confirm(`${status==='banned'?'Ban':'Restore'} this member? Existing keys will be revoked.`)){await api(`/rooms/${currentRoom.room_id}/members/${account}`,'PATCH',{status});await render();}}
  }catch(e){tell(e.message);if(dialog.open){let error=dialog.querySelector('[role=alert]');if(!error){error=document.createElement('p');error.setAttribute('role','alert');dialog.append(error);}error.textContent=e.message;}}finally{el.disabled=false;}
});
document.addEventListener('change',async event=>{
  const el=event.target;
  if(el.hasAttribute('data-key-account')){const member=keyMembers.find(m=>m.account_id===el.value);document.querySelector('#key-scopes').innerHTML=(member?.scopes||[]).map(s=>`<label class="check"><input type="checkbox" name="scopes" value="${esc(s)}" ${['room:read','room:connect'].includes(s)?'checked':''}>${esc(s)}</label>`).join('');return;}
  if(el.dataset.controlMember){try{await api(`/rooms/${currentRoom.room_id}/members/${el.dataset.controlMember}`,'PATCH',{control_role:el.value});await render();tell('Administration role updated. Previous keys revoked.');}catch(e){tell(e.message);await render();}return;}
  if(!el.dataset.member)return;
  try{await api(`/rooms/${currentRoom.room_id}/members/${el.dataset.member}`,'PATCH',{role:el.value});await render();tell('Role updated. Previous keys revoked.');}catch(e){tell(e.message);await render();}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.dataset.form)return;event.preventDefault();const data=new FormData(form),values=Object.fromEntries(data),submit=form.querySelector('button');submit.disabled=true;
  try{
    switch(form.dataset.form){
      case 'login':await api('/auth/login','POST',values);me=await api('/me');tell('');await render();return;
      case 'room':{const room=await api('/rooms','POST',values);dialog.close();location.hash=`rooms/${room.id}`;break;}
      case 'invite':{const result=await api(`/rooms/${form.dataset.id}/invitations`,'POST',values);dialog.close();await render();reveal('Invitation ready',result.invitation,`Share this with ${result.username}. It expires in seven days and only their account can accept it.`);break;}
      case 'accept':await api(`/invitations/${encodeURIComponent(values.token)}/accept`,'POST');dialog.close();await render();tell('Invitation accepted.');break;
      case 'account':await api('/operator/accounts','POST',values);dialog.close();tell('Account created. Share its initial credentials securely.');break;
      case 'password':await api('/me/password','POST',values);dialog.close();tell('Password changed. Other sessions signed out.');break;
      case 'key':{const key=await api(`/rooms/${form.dataset.id}/keys`,'POST',{...values,days:Number(values.days),scopes:data.getAll('scopes')});dialog.close();await render();reveal('Save your key',key.secret,'This is the only time you can view this key. Keep it private and store it with your integration.');break;}
    }
  }catch(e){let error=form.querySelector('[role=alert]');if(!error){error=document.createElement('p');error.setAttribute('role','alert');form.append(error);}error.textContent=e.message;}finally{submit.disabled=false;}
});
window.addEventListener('hashchange',()=>{tell('');render();});
(async()=>{try{providers=await api('/auth/providers');me=await api('/me');}catch{}await render();content.setAttribute('aria-busy','false');})();
