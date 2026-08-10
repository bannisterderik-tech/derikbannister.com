#!/usr/bin/env node
/* DB— post-build audit: internal links, JSON-LD, duplicate titles, meta lengths, H1s. */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { dirname, join as j } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.argv[2] || j(dirname(fileURLToPath(import.meta.url)), '..');
const pages = [];
(function walk(d){ for(const e of readdirSync(d)){ if(e==='.git'||e==='node_modules'||e==='world'||e==='gen'||e==='data'||e==='og'||e==='images') continue;
  const p=join(d,e); if(statSync(p).isDirectory()) walk(p); else if(e.endsWith('.html')) pages.push(p);} })(ROOT);
console.log('html files:', pages.length);

const links=new Map(), titles=new Map(), descs=new Map();
let ldErrors=0, longTitles=[], longDescs=[], noH1=[], multiH1=[];
for(const p of pages){
  const h=readFileSync(p,'utf8');
  const rel='/'+p.slice(ROOT.length+1).replace(/index\.html$/,'').replace(/\.html$/,'');
  // json-ld
  for(const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){
    try{ JSON.parse(m[1]); }catch(e){ ldErrors++; console.log('BAD LD', rel, e.message.slice(0,80)); }
  }
  const t=(h.match(/<title>([\s\S]*?)<\/title>/)||[])[1]||'';
  if(t){ titles.set(t,(titles.get(t)||0)+1); if(t.length>65) longTitles.push([rel,t.length]); }
  const d=(h.match(/<meta name="description" content="([^"]*)"/)||[])[1]||'';
  if(d){ descs.set(d,(descs.get(d)||0)+1); if(d.length>160) longDescs.push([rel,d.length]); }
  const h1s=[...h.matchAll(/<h1[ >]/g)].length;
  if(h1s===0) noH1.push(rel); if(h1s>1) multiH1.push(rel);
  for(const m of h.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href=m[1]; if(!links.has(href)) links.set(href,new Set()); links.get(href).add(rel);
  }
}
const exists = href => {
  if(href==='/') return existsSync(join(ROOT,'index.html'));
  const clean=href.replace(/\/$/,'');
  return existsSync(join(ROOT,clean.slice(1),'index.html')) || existsSync(join(ROOT,clean.slice(1))) || existsSync(join(ROOT,clean.slice(1)+'.html'));
};
const broken=[...links.keys()].filter(h=>!exists(h));
console.log('unique internal link targets:', links.size);
console.log('BROKEN LINKS:', broken.length);
broken.slice(0,25).forEach(b=>console.log('  ',b,'← e.g.',[...links.get(b)][0]));
console.log('JSON-LD parse errors:', ldErrors);
console.log('duplicate titles:', [...titles.values()].filter(v=>v>1).length, '| worst:', [...titles.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,c])=>`${c}× ${t.slice(0,50)}`));
console.log('duplicate descriptions:', [...descs.values()].filter(v=>v>1).length);
console.log('titles >65ch:', longTitles.length, longTitles.slice(0,5));
console.log('descs >160ch:', longDescs.length, longDescs.slice(0,3));
console.log('pages with no H1:', noH1.length, noH1.slice(0,5), '| multiple H1:', multiH1.length);
