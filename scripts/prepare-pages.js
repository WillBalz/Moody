// Stage a release without modifying the editable files in dist/.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const source = new URL('../dist/', import.meta.url);
const destination = new URL('../.pages/', import.meta.url);
const files = fs.readdirSync(source, {recursive:true}).filter(p=>fs.statSync(new URL(p,source)).isFile()).sort();
const hash = createHash('sha256');
for (const file of files) { hash.update(file); hash.update(fs.readFileSync(new URL(file,source))); }
const version = hash.digest('hex').slice(0,16);
// This ignored directory contains only generated publishing output.
fs.rmSync(destination,{recursive:true,force:true});
fs.mkdirSync(destination,{recursive:true});
fs.cpSync(source,destination,{recursive:true});
const worker = new URL('sw.js',destination);
const code = fs.readFileSync(worker,'utf8');
if (!code.includes('__RELEASE__')) throw new Error('Worker release marker missing');
fs.writeFileSync(worker,code.replace('__RELEASE__',version));
fs.writeFileSync(new URL('.nojekyll',destination),'');
console.log(`GitHub Pages release ${version}: ${fileURLToPath(destination)}`);
