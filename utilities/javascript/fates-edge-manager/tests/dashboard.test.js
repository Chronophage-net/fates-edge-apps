import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function dashboard() {
  const elements=new Map(), requests=[];
  const element=selector=>{
    if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(){},querySelectorAll(){return [];},close(){},replaceChildren(){this.innerHTML='';}});
    return elements.get(selector);
  };
  const context=vm.createContext({document:{querySelector:element,addEventListener(){}},window:{addEventListener(){}},location:{hash:'#rooms'},crypto:{randomUUID:()=> 'test'},fetch:url=>new Promise(resolve=>requests.push({url,resolve})),console});
  vm.runInContext(await readFile(new URL('../public/app.js',import.meta.url),'utf8'),context);
  // Leave initial session discovery pending; set a synthetic signed-in view.
  vm.runInContext("me={username:'Reviewer',operator:true,csrf:'test'}",context);
  return {context,element,requests,respond(url,data,status=200){const index=requests.findIndex(r=>r.url===url);assert(index>=0,url);requests.splice(index,1)[0].resolve({ok:status<400,status,json:async()=>data});}};
}

test('a slow previous page cannot overwrite the current navigation',async()=>{
  const ui=await dashboard();
  const old=vm.runInContext('render()',ui.context);
  const current=vm.runInContext("location.hash='#nodes';render()",ui.context);
  ui.respond('/v1/nodes',[]);await current;
  assert.match(ui.element('#content').innerHTML,/Waiting for your first node/);
  ui.respond('/v1/me/rooms',[{id:'old',name:'Obsolete room',status:'active',role:'gm',control_role:'owner'}]);await old;
  assert.doesNotMatch(ui.element('#content').innerHTML,/Obsolete room/);
  assert.equal(ui.element('#content').attrs['aria-busy'],'false');
});

test('failed pages offer retry and sign-in clears stale busy state',async()=>{
  const ui=await dashboard();
  const render=vm.runInContext('render()',ui.context);
  ui.respond('/v1/me/rooms',{error:'Temporarily unavailable'},503);await render;
  assert.match(ui.element('#content').innerHTML,/Try again/);
  await vm.runInContext('login()',ui.context);
  assert.equal(ui.element('#content').attrs['aria-busy'],'false');
  assert.match(ui.element('#content').innerHTML,/Sign in/);
});
