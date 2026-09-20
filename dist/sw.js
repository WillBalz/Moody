import {validateQuoteBank} from './quote-bank.js';

// The Pages workflow stamps a content hash here automatically on every release.
const RELEASE = '__RELEASE__';
const scope = new URL(self.registration.scope);
const prefix = `commonplace:${scope.href}:`;
const shellName = `${prefix}shell:${RELEASE}`;
const bankName = `${prefix}quotes`;
const bankURL = new URL('./quotes.json',scope).href;
const ASSETS = ['./','./index.html','./style.css','./app.js','./matcher.js','./quote-bank.js','./moods.json','./quote-tags.json','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];
const allowed = new Set(ASSETS.map(path=>new URL(path,scope).href));

async function freshBank() {
  const cache = await caches.open(bankName);
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),4000);
  try {
    const response = await fetch(bankURL,{cache:'no-store',signal:controller.signal});
    if (!response.ok) throw new Error('Quote bank unavailable');
    const shell = await caches.open(shellName);
    const tags = await shell.match(new URL('./quote-tags.json',scope).href);
    validateQuoteBank(await response.clone().json(),await tags.json());
    // Storage pressure must not prevent a valid online response.
    try { await cache.put(bankURL,response.clone()); } catch {}
    return response;
  } catch (error) {
    const previous = await cache.match(bankURL);
    if (previous) return previous;
    throw error;
  } finally { clearTimeout(timeout); }
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const shell = await caches.open(shellName);
    await shell.addAll(ASSETS);
    await freshBank();
  })());
});
self.addEventListener('activate',event=>{
  // GitHub Pages projects can share an origin: clean up only this app's shells.
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(`${prefix}shell:`)&&key!==shellName).map(key=>caches.delete(key)))));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  if(event.request.url===bankURL) {
    event.respondWith(freshBank());
  } else if(allowed.has(event.request.url)) {
    event.respondWith(caches.open(shellName).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
  }
});
