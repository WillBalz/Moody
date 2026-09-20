import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateQuoteBank,createBankRefresher} from '../dist/quote-bank.js';
const labels=JSON.parse(fs.readFileSync(new URL('../dist/quote-tags.json',import.meta.url)));
const bank=JSON.parse(fs.readFileSync(new URL('../dist/quotes.json',import.meta.url)));
const added={id:'custom-001',text:'A new line.',book:'Another book',author:'An author',tags:['funny']};

test('editable quote bank validates; adding a minimal new quote requires no import metadata',()=>{
  assert.equal(validateQuoteBank(bank,labels),bank);
  assert.equal(validateQuoteBank([...bank,added],labels).length,bank.length+1);
  assert.equal(validateQuoteBank([added],labels).length,1);
});
test('publishing rejects invalid banks with actionable errors',()=>{
  for(const [data,message] of [
    [[],/nonempty array/],[[added,added],/Duplicate quote id/],
    [[{...added,tags:['typo']}],/tags from quote-tags/],
    [[{...added,text:''}],/nonempty text/],[[{...added,author:undefined}],/nonempty author/],
    [[{...added,weight:0}],/positive number/],[[{...added,tags:[]}],/tags from/]
  ]) assert.throws(()=>validateQuoteBank(data,labels),message);
});
test('simultaneous foreground events share one refresh; invalid refresh preserves previous bank',async()=>{
  let calls=0,current=bank,remote=[...bank,added];
  const refresh=createBankRefresher({load:async()=>{calls++;return remote;},validate:b=>validateQuoteBank(b,labels),apply:b=>{current=b;}});
  await Promise.all([refresh(),refresh(),refresh()]);
  assert.equal(calls,1);assert.equal(current.length,bank.length+1);
  remote=[{...added,tags:['typo']}];
  await assert.rejects(refresh());
  assert.equal(current.length,bank.length+1);
  remote=bank;await refresh();assert.equal(current,bank);
});

// Exercise the actual worker's event handlers using the platform Request/Response
// types and a small in-memory CacheStorage. No browser or network dependency.
function workerHarness() {
  const scope='https://example.github.io/commonplace/';
  const storage=new Map(),handlers={};
  let remote=bank,offline=false,cacheWriteFails=false;
  const key=x=>typeof x==='string'?new URL(x,scope).href:x.url;
  const caches={
    open:async name=>{
      if(!storage.has(name)) storage.set(name,new Map());
      const cache=storage.get(name);
      return {
        match:async request=>cache.get(key(request))?.clone(),
        put:async(request,response)=>{if(cacheWriteFails)throw new Error('Quota');cache.set(key(request),response.clone());},
        addAll:async paths=>{for(const path of paths)cache.set(key(path),await fetcher(key(path)));}
      };
    },keys:async()=>[...storage.keys()],delete:async name=>storage.delete(name)
  };
  async function fetcher(request,options={}) {
    if(offline)throw new Error('Offline');
    const url=key(request);
    if(url.endsWith('/quotes.json')) {
      assert.equal(options.cache,'no-store');
      return remote instanceof Response?remote.clone():Response.json(remote);
    }
    if(url.endsWith('/quote-tags.json'))return Response.json(labels);
    return new Response('static asset');
  }
  const source=fs.readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8').replace(/^import .*;\n/,'');
  vm.runInNewContext(source,{self:{registration:{scope},addEventListener:(event,handler)=>{handlers[event]=handler;}},caches,fetch:fetcher,URL,AbortController,setTimeout,clearTimeout,validateQuoteBank});
  return {
    storage, scope,
    setRemote:value=>{remote=value;},setOffline:value=>{offline=value;},failWrites:()=>{cacheWriteFails=true;},
    lifecycle:async event=>{let pending;handlers[event]({waitUntil:p=>{pending=p;}});await pending;},
    request:async (path,method='GET')=>{let response;handlers.fetch({request:new Request(new URL(path,scope),{method}),respondWith:p=>{response=p;}});return response;}
  };
}
test('installed app gets a JSON-only update and retains it offline',async()=>{
  const w=workerHarness();await w.lifecycle('install');
  w.setRemote([...bank,added]);
  assert.equal((await (await w.request('quotes.json')).json()).length,bank.length+1);
  w.setOffline(true);
  assert.equal((await (await w.request('quotes.json')).json()).length,bank.length+1);
  assert.equal(await (await w.request('index.html')).text(),'static asset');
});
test('malformed JSON, missing fields and server errors do not poison the offline copy',async()=>{
  const w=workerHarness();await w.lifecycle('install');
  for(const invalid of [new Response('broken json'),new Response('not found',{status:404}),[{id:'bad'}]]) {
    w.setRemote(invalid);
    assert.equal((await (await w.request('quotes.json')).json()).length,bank.length);
  }
  w.setOffline(true);assert.equal((await (await w.request('quotes.json')).json()).length,bank.length);
});
test('storage quota failure still returns fresh valid data',async()=>{
  const w=workerHarness();await w.lifecycle('install');w.failWrites();w.setRemote([...bank,added]);
  assert.equal((await (await w.request('quotes.json')).json()).length,bank.length+1);
});
test('worker scope and cleanup cannot affect another GitHub Pages app',async()=>{
  const w=workerHarness();await w.lifecycle('install');
  const ownOld=`commonplace:${w.scope}:shell:old`;
  const other='commonplace:https://example.github.io/todolist/:shell:old';
  w.storage.set(ownOld,new Map());w.storage.set(other,new Map());
  await w.lifecycle('activate');
  assert.ok(!w.storage.has(ownOld));assert.ok(w.storage.has(other));
  assert.ok(w.storage.has(`commonplace:${w.scope}:quotes`));
  assert.equal(await w.request('../todolist/index.html'),undefined);
  assert.equal(await w.request('quotes.json','POST'),undefined);
});
