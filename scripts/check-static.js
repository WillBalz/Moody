import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {validateQuoteBank} from '../dist/quote-bank.js';

const root=new URL('../dist/',import.meta.url);
validateQuoteBank(JSON.parse(fs.readFileSync(new URL('quotes.json',root))),JSON.parse(fs.readFileSync(new URL('quote-tags.json',root))));
const html=fs.readFileSync(new URL('index.html',root),'utf8');
for(const [,asset] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(!/^https?:/.test(asset),`Unexpected external dependency: ${asset}`);
  assert.ok(fs.existsSync(new URL(asset,root)),`Missing ${asset}`);
}
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicate HTML IDs');
const app=fs.readFileSync(new URL('app.js',root),'utf8');
for(const [,id] of app.matchAll(/el\('([^']+)'\)/g)) assert.ok(ids.includes(id),`Missing element ${id}`);
for(const asset of fs.readdirSync(root)) {
  if(asset.endsWith('.js')) execFileSync(process.execPath,['--check',path.join(root.pathname,asset)]);
  if(asset.endsWith('.json')) JSON.parse(fs.readFileSync(new URL(asset,root)));
}
const sw=fs.readFileSync(new URL('sw.js',root),'utf8');
for(const [,asset] of sw.matchAll(/'(\.\/[^']*)'/g)) assert.ok(fs.existsSync(new URL(asset,root)),`Missing offline asset ${asset}`);
assert.ok(!app.includes('localStorage')&&!app.includes('sessionStorage'));
assert.ok(!/word-vectors|tag-centroids/.test(app+sw));
console.log('Entrypoint, element references, local assets, offline asset list, JSON and JavaScript syntax pass.');
