#!/usr/bin/env node
/* DB— programmatic SEO builder, v2 (post adversarial review).
   Reads data/*.json, emits static pages + sitemap + robots + llms.txt.
   Deterministic; sitemap lastmod is honest (content-hash manifest). */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://derikbannister.com';
const BRAND = 'Derik Bannister';
const EMAIL = 'bannisterderik@gmail.com';
const PHONE = '530-736-7085';
const PHONE_TEL = '+15307367085';
const BUSINESS_ID = `${SITE}/#business`;
const PAGE_MIN = 250; /* the page count the build agreement commits to */

const load = f => JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));
const trades = load('trades.json');
const services = load('services.json');
const locations = load('locations.json');
const answers = load('answers.json');
const taxonomy = load('taxonomy.json');
const { serviceGroups, tradeCategories, answerCategories, states: STATE_NAME } = taxonomy;
const core = services.filter(s => s.core);
/* tier-2 markets get the four services that carry the most weight for a small operation */
const CORE_T2 = ['web-design', 'seo', 'aeo', 'google-ads'];
const coreT2 = core.filter(s => CORE_T2.includes(s.slug));
const servicesFor = loc => loc.tier === 1 ? core : coreT2;
const STATES = Object.keys(STATE_NAME).map(code => ({
  code, name: STATE_NAME[code], slug: STATE_NAME[code].toLowerCase().replace(/\s+/g, '-'),
  cities: locations.filter(l => l.state === code),
})).filter(s => s.cities.length);
const stateOf = code => STATES.find(s => s.code === code);

const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const pick = (arr, key) => arr[hash(key) % arr.length];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* lowercase that never mangles acronyms/proper nouns (HVAC, SEO, Google Ads…) */
const lc = s => s.split(' ').map(w => (w === w.toUpperCase() && w.length > 1) || /[A-Z].*[A-Z]/.test(w) ? w : w.toLowerCase()).join(' ');
const tradeLc = t => t.name === t.name.toUpperCase() ? t.name : t.name.toLowerCase();
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);

/* neighbours → honest "other markets" links (no fake geography):
   same region first, then same county, then same state. Never cross-state filler. */
const clusterMates = (loc, n = 4) => {
  const not = l => l.slug !== loc.slug;
  const out = [];
  const add = list => { for (const l of list) if (!out.includes(l) && out.length < n) out.push(l); };
  add(locations.filter(l => not(l) && l.state === loc.state && l.region === loc.region));
  add(locations.filter(l => not(l) && l.state === loc.state && l.county === loc.county));
  add(locations.filter(l => not(l) && l.state === loc.state && l.tier === 1));
  add(locations.filter(l => not(l) && l.state === loc.state));
  return out.slice(0, n);
};
/* the markets a hub grid should advertise: every tier-1 anchor, capped per state */
const anchorCities = locations.filter(l => l.tier === 1);

/* ---------- shared shell ---------- */
const CSS = `
:root{--ink:#0a0a0a;--ink2:#101012;--paper:#f4f4f6;--silver:#c7c7cf;--silver-hi:#f2f2f6;--silver-lo:#77777f;--text:#ededf0;--muted:#8f8f97;--faint:#55555b;--hair:rgba(255,255,255,.08);--hair2:rgba(255,255,255,.16);--disp:'Syne',sans-serif;--body:'Archivo',sans-serif;--mono:'IBM Plex Mono',monospace;--gutter:clamp(20px,5vw,64px)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--ink);color:var(--text);font-family:var(--body);font-size:16px;line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:1080px;margin:0 auto;padding:0 var(--gutter)}
h1,h2,h3{font-family:var(--disp);line-height:1.1;font-weight:800;letter-spacing:-.01em}
.chrome{background:linear-gradient(105deg,#5c5c64,#e9e9f0 25%,#8a8a92 48%,#fff 65%,#c7c7cf);-webkit-background-clip:text;background-clip:text;color:transparent}
.mono{font-family:var(--mono);text-transform:uppercase;letter-spacing:.14em;font-size:.68rem;color:var(--muted)}
.mono b{color:var(--silver-hi);font-weight:500}
.top{border-bottom:1px solid var(--hair);background:rgba(10,10,10,.9)}
.top .wrap{display:flex;justify-content:space-between;align-items:center;height:60px}
.logo{font-family:var(--disp);font-weight:800;font-size:.95rem}
.top nav{display:flex;gap:22px}
.top nav a{font-family:var(--mono);font-size:.64rem;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
.top nav a:hover{color:var(--silver-hi)}
.crumbs{padding:18px 0;font-family:var(--mono);font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.crumbs a{color:var(--muted)}
.crumbs a:hover{color:var(--silver-hi)}
.hero{padding:clamp(40px,7vw,90px) 0 clamp(30px,5vw,60px)}
.hero h1{font-size:clamp(1.9rem,5vw,3.4rem);text-transform:uppercase;max-width:22ch;text-wrap:balance}
.hero .lede{color:var(--muted);max-width:65ch;margin-top:22px;font-size:1.05rem}
.hero .lede b{color:var(--text)}
.cta-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:30px}
.btn{display:inline-flex;align-items:center;gap:.6em;font-family:var(--mono);font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.14em;color:var(--ink);background:linear-gradient(120deg,#d8d8de,#fff 50%,#b9b9c2);padding:.9em 1.6em;border-radius:2px}
.btn.ghost{background:transparent;color:var(--text);border:1px solid var(--hair2)}
.btn.ghost:hover{border-color:var(--silver-hi);color:var(--silver-hi)}
section{padding:clamp(34px,5vw,60px) 0;border-top:1px solid var(--hair)}
section h2{font-size:clamp(1.3rem,2.8vw,1.9rem);text-transform:uppercase;margin-bottom:22px}
p+p{margin-top:1em}
.body-copy{color:var(--muted);max-width:70ch}
.body-copy b{color:var(--text)}
ul.feat{list-style:none;display:grid;gap:12px;max-width:70ch}
ul.feat li{padding:14px 18px;border:1px solid var(--hair);border-left:2px solid var(--silver);color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.grid a{border:1px solid var(--hair);padding:13px 16px;font-size:.86rem;color:var(--muted);transition:border-color .2s,color .2s}
.grid a:hover{border-color:var(--silver);color:var(--silver-hi)}
.grid a b{display:block;color:var(--text);font-weight:600;font-size:.92rem}
.citylinks{columns:3;gap:26px;max-width:900px}
@media(max-width:760px){.citylinks{columns:2}}
@media(max-width:480px){.citylinks{columns:1}}
.citylinks a{display:block;color:var(--muted);font-size:.82rem;padding:3px 0;break-inside:avoid}
.citylinks a:hover{color:var(--silver-hi)}
.faq details{border-bottom:1px solid var(--hair);padding:16px 0}
.faq summary{cursor:pointer;font-weight:600;color:var(--text)}
.faq p{color:var(--muted);margin-top:10px;max-width:70ch}
.contact-band{background:var(--ink2);border:1px solid var(--hair);padding:clamp(26px,4vw,44px);margin-top:20px}
.contact-band h2{margin-bottom:10px}
.contact-band p{color:var(--muted);max-width:60ch}
footer{border-top:1px solid var(--hair);padding:40px 0;background:var(--ink2);margin-top:60px}
.fcols{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:26px}
.fcols h3{font-family:var(--mono);font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-bottom:12px;font-weight:500}
.fcols a{display:block;color:var(--muted);font-size:.82rem;padding:3px 0}
.fcols a:hover{color:var(--silver-hi)}
.legal{margin-top:30px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
/* ideas board */
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.chips .lab{font-family:var(--mono);font-size:.62rem;letter-spacing:.16em;color:var(--faint);text-transform:uppercase;width:100%;margin-bottom:2px}
.chip{font-family:var(--mono);font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);border:1px solid var(--hair);background:transparent;padding:.55em 1em;cursor:pointer;transition:border-color .25s,color .25s,background .25s}
.chip:hover{border-color:var(--silver);color:var(--silver-hi)}
.chip.on{background:var(--silver-hi);color:var(--ink);border-color:var(--silver-hi)}
.idea-count{font-family:var(--mono);font-size:.66rem;letter-spacing:.16em;color:var(--faint);text-transform:uppercase;margin:18px 0 22px}
.idea-count b{color:var(--silver-hi);font-weight:500}
.ideas{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--hair)}
@media(max-width:1000px){.ideas{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.ideas{grid-template-columns:1fr}}
.idea{background:var(--ink);padding:26px 24px;display:grid;gap:10px;align-content:start;transition:background .3s;position:relative;overflow:hidden}
.idea::after{content:"";position:absolute;left:0;bottom:0;width:100%;height:2px;background:linear-gradient(90deg,var(--silver-lo),var(--silver-hi));transform:scaleX(0);transform-origin:left;transition:transform .4s}
.idea:hover{background:var(--surface)}
.idea:hover::after{transform:scaleX(1)}
.idea .tp{font-family:var(--mono);font-size:.6rem;letter-spacing:.18em;color:var(--silver);text-transform:uppercase}
.idea h3{font-size:1.02rem;text-transform:uppercase;letter-spacing:.01em}
.idea p{color:var(--muted);font-size:.88rem}
.idea .for{font-family:var(--mono);font-size:.58rem;letter-spacing:.14em;color:var(--faint);text-transform:uppercase;margin-top:4px}
.idea.hide{display:none}
/* direct-answer block — the passage answer engines lift */
.answer{border:1px solid var(--hair2);border-left:2px solid var(--silver-hi);background:var(--ink2);padding:22px 24px;margin-top:26px;max-width:72ch}
.answer .lab{font-family:var(--mono);font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--silver);display:block;margin-bottom:9px}
.answer p{color:var(--text);font-size:1rem;line-height:1.65}
/* filter + search toolbar on hubs */
.toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:18px}
.search{flex:1 1 260px;min-width:220px;position:relative}
.search input{width:100%;background:var(--ink2);border:1px solid var(--hair2);color:var(--text);font-family:var(--body);font-size:.9rem;padding:.75em 1em .75em 2.2em;border-radius:2px;outline:none}
.search input:focus{border-color:var(--silver)}
.search input::placeholder{color:var(--faint)}
.search::before{content:"⌕";position:absolute;left:.85em;top:50%;transform:translateY(-52%);color:var(--silver-lo);font-size:1.05rem}
.hitcount{font-family:var(--mono);font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin:0 0 20px}
.hitcount b{color:var(--silver-hi);font-weight:500}
.grid a.hide,.citylinks a.hide,.qcard.hide,.statecol.hide{display:none}
/* grouped sections on hubs */
.group{margin-bottom:34px}
.group h3{font-family:var(--disp);font-size:1.05rem;text-transform:uppercase;letter-spacing:.02em;margin-bottom:6px}
.group .gb{color:var(--muted);font-size:.88rem;max-width:66ch;margin-bottom:14px}
/* state columns on the locations hub */
.states{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:26px}
.statecol h3{font-family:var(--mono);font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--hair)}
.statecol a{display:block;color:var(--muted);font-size:.83rem;padding:3px 0}
.statecol a:hover{color:var(--silver-hi)}
.statecol a.anchor{color:var(--text);font-weight:600}
.statecol .more{font-family:var(--mono);font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--silver);padding-top:8px}
/* answer cards */
.qcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1px;background:var(--hair)}
.qcard{background:var(--ink);padding:22px 22px;display:block;transition:background .25s}
.qcard:hover{background:var(--ink2)}
.qcard .tp{font-family:var(--mono);font-size:.58rem;letter-spacing:.16em;color:var(--silver);text-transform:uppercase}
.qcard h3{font-size:.98rem;text-transform:none;letter-spacing:0;margin:9px 0 8px;line-height:1.3}
.qcard p{color:var(--muted);font-size:.85rem;line-height:1.6}
/* key/value strip — real local facts, no filler */
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1px;background:var(--hair);border:1px solid var(--hair);margin-top:8px}
.facts div{background:var(--ink);padding:16px 18px}
.facts dt{font-family:var(--mono);font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin-bottom:5px}
.facts dd{color:var(--text);font-size:.9rem}
/* sitemap page */
.smap{columns:4;gap:24px}
@media(max-width:960px){.smap{columns:2}}
@media(max-width:560px){.smap{columns:1}}
.smap a{display:block;color:var(--muted);font-size:.8rem;padding:2px 0;break-inside:avoid}
.smap a:hover{color:var(--silver-hi)}
.smap h3{font-family:var(--mono);font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin:16px 0 8px;break-after:avoid}
/* lead form */
.lead{display:grid;gap:14px;margin-top:22px;max-width:640px}
.lead-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:600px){.lead-row{grid-template-columns:1fr}}
.lead label{display:grid;gap:6px;font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.lead .opt{color:var(--faint);letter-spacing:.1em}
.lead input,.lead textarea{background:var(--ink);border:1px solid var(--hair2);color:var(--text);font-family:var(--body);font-size:.95rem;padding:.72em .9em;border-radius:2px;outline:none;width:100%;text-transform:none;letter-spacing:0}
.lead input:focus,.lead textarea:focus{border-color:var(--silver)}
.lead input::placeholder,.lead textarea::placeholder{color:var(--faint)}
.lead input:disabled,.lead textarea:disabled{opacity:.5}
.lead textarea{resize:vertical}
.lead-foot{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:2px}
.lead button{border:none;cursor:pointer;font-family:var(--mono)}
.lead button:disabled{opacity:.6;cursor:default}
.lead-note{font-size:.8rem;color:var(--faint);max-width:34ch}
.lead-note a{color:var(--silver);text-decoration:underline}
.lead-status{font-size:.88rem;min-height:1.2em}
.lead-status.ok{color:var(--silver-hi)}
.lead-status.warn{color:#e8b4b4}
.lead-status a{color:var(--silver-hi);text-decoration:underline}
/* offer band — the money path on every generated page */
.offer{border:1px solid var(--hair2);background:linear-gradient(120deg,var(--ink2),#141418);padding:clamp(26px,4vw,40px);display:grid;grid-template-columns:1fr auto;gap:34px;align-items:center;margin-top:20px}
.offer-copy h2{font-size:clamp(1.25rem,2.5vw,1.8rem);text-transform:uppercase;margin:10px 0 14px;max-width:22ch}
.offer-copy p{color:var(--muted);max-width:62ch;font-size:.94rem}
.offer-copy p b{color:var(--text)}
.offer-act{display:grid;gap:11px;justify-items:stretch;min-width:210px}
.price{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.price .was{font-family:var(--mono);font-size:1rem;color:var(--faint);text-decoration:line-through}
.price .now{font-family:var(--disp);font-weight:800;font-size:2.4rem;color:var(--silver-hi)}
.price .mono{width:100%}
@media(max-width:760px){.offer{grid-template-columns:1fr;gap:22px}}
/* /start/ — offer page */
.tiers{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--hair);border:1px solid var(--hair);margin-top:8px}
@media(max-width:700px){.tiers{grid-template-columns:1fr}}
.tier{background:var(--ink);padding:26px 24px}
.tier.hi{background:var(--ink2);border-left:2px solid var(--silver-hi)}
.tier h3{font-size:1.05rem;text-transform:uppercase;margin-bottom:6px}
.tier .amt{font-family:var(--disp);font-weight:800;font-size:2.6rem;color:var(--silver-hi);line-height:1;margin:12px 0 8px}
.tier p{color:var(--muted);font-size:.9rem;max-width:44ch}
.tier .btn{margin-top:18px}
.steps{display:grid;gap:1px;background:var(--hair);border:1px solid var(--hair);margin-top:8px}
.step{background:var(--ink);padding:20px 22px;display:grid;grid-template-columns:42px 1fr;gap:16px;align-items:start}
.step .n{font-family:var(--mono);font-size:.7rem;letter-spacing:.14em;color:var(--silver);padding-top:3px}
.step h3{font-size:1rem;text-transform:uppercase;margin-bottom:6px}
.step p{color:var(--muted);font-size:.9rem;max-width:58ch}
.step b{color:var(--text)}
/* six nav items don't fit 375px — scroll the strip instead of overflowing the page */
@media(max-width:760px){
.top .wrap{height:auto;flex-direction:column;align-items:flex-start;gap:7px;padding-top:11px;padding-bottom:11px}
.top nav{width:100%;overflow-x:auto;gap:16px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.top nav::-webkit-scrollbar{display:none}
.top nav a{white-space:nowrap}
.facts{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">`;
const FAVICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%230a0a0a'/%3E%3Ctext x='32' y='42' font-family='Arial Black,sans-serif' font-size='26' font-weight='900' fill='%23e8e8ee' text-anchor='middle'%3EDB%3C/text%3E%3C/svg%3E">`;

/* "where I work" grid — the anchor metro of each region, so the promise is checkable */
const gridCities = anchorCities;
const footerHTML = `<footer><div class="wrap"><div class="fcols">
<div><h3>Services</h3>${core.slice(0, 8).map(s => `<a href="/services/${s.slug}/">${esc(s.short)}</a>`).join('')}<a href="/services/">All ${services.length} services →</a></div>
<div><h3>Industries</h3>${trades.slice(0, 8).map(t => `<a href="/trades/${t.slug}/">${esc(t.name)}</a>`).join('')}<a href="/trades/">All ${trades.length} industries →</a></div>
<div><h3>States</h3>${STATES.map(s => `<a href="/locations/${s.slug}/">${esc(s.name)} (${s.cities.length})</a>`).join('')}<a href="/locations/">All ${locations.length} cities →</a></div>
<div><h3>Company</h3><a href="/start/">Get a site — $500</a><a href="/">Home</a><a href="/about/">About</a><a href="/answers/">Answers</a><a href="/#builds">Builds</a><a href="/ideas/">Ideas Board</a><a href="/products/">SEO Products</a><a href="/sitemap/">Sitemap</a><a href="mailto:${EMAIL}">Email</a><a href="tel:${PHONE_TEL}">Call/Text ${PHONE}</a></div>
<div><h3>Legal</h3><a href="/legal/terms/">Terms of Use</a><a href="/legal/website-terms/">Website Build Agreement</a><a href="/legal/privacy/">Privacy Policy</a><a href="/legal/do-not-sell/">Do Not Sell or Share My Personal Information</a><a href="/legal/accessibility/">Accessibility</a><a href="/legal/disclaimer/">Disclaimer</a></div>
</div><div class="legal"><span class="mono">© 2026 ${BRAND}</span><span class="mono">DB<b>—</b> BUILD. OPERATE. OWN.</span></div></div></footer>`;

/* client-side filter+search shared by the hubs. Progressive: without JS every link is still there. */
const filterJS = (opts = {}) => `<script>(()=>{
const root=document.getElementById('${opts.root || 'filterRoot'}');if(!root)return;
const items=[...root.querySelectorAll('[data-k]')],n=document.getElementById('${opts.count || 'hitN'}'),q=document.getElementById('${opts.input || 'q'}');
let f='all';
const apply=()=>{const term=(q&&q.value||'').trim().toLowerCase();let c=0;
items.forEach(i=>{const okF=f==='all'||(i.dataset.f||'').split(' ').includes(f);const okQ=!term||i.dataset.k.includes(term);const show=okF&&okQ;i.classList.toggle('hide',!show);if(show)c++;});
if(n)n.textContent=c;
root.querySelectorAll('[data-group]').forEach(g=>{g.classList.toggle('hide',!g.querySelector('[data-k]:not(.hide)'))});};
const chips=document.getElementById('${opts.chips || 'chipRow'}');
if(chips)chips.addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;chips.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');f=b.dataset.f;apply();});
if(q)q.addEventListener('input',apply);
})();</script>`;
const toolbar = (placeholder, chips, total, label) => `<div class="toolbar">
<div class="search"><input id="q" type="search" autocomplete="off" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"></div>
</div>
${chips ? `<div class="chips" id="chipRow"><button class="chip on" data-f="all">All</button>${chips.map(c => `<button class="chip" data-f="${c.key}">${esc(c.label)}</button>`).join('')}</div>` : ''}
<p class="hitcount"><b id="hitN">${total}</b> ${esc(label)}</p>`;

/* The business node every Service/FAQ block points at with provider:{@id}. Emitted on
   every page so the reference always resolves for a crawler that only sees one page. */
const businessLD = {
  '@context': 'https://schema.org', '@type': 'ProfessionalService', '@id': BUSINESS_ID,
  name: BRAND, url: `${SITE}/`, email: EMAIL, telephone: PHONE_TEL,
  founder: { '@type': 'Person', name: BRAND },
  address: { '@type': 'PostalAddress', addressRegion: 'OR', addressCountry: 'US' },
  areaServed: STATES.map(s => ({ '@type': 'State', name: s.name })),
  knowsAbout: services.map(s => s.name),
};
/* WebPage.isPartOf points here — define it so the reference resolves on every page */
const websiteLD = {
  '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`,
  url: `${SITE}/`, name: BRAND, publisher: { '@id': BUSINESS_ID }, inLanguage: 'en-US',
};

let urls = [];
/* the URL already encodes what the page is about — derive the lead context from it
   rather than threading it through every call site */
const LOC_BY_SLUG = Object.fromEntries(locations.map(l => [l.slug, l]));
const TRADE_BY_SLUG = Object.fromEntries(trades.map(t => [t.slug, t]));
const SVC_BY_SLUG = Object.fromEntries(services.map(s => [s.slug, s]));
function leadCtxFor(path) {
  const p = path.split('/').filter(Boolean);
  const ctx = { path };
  if (p[0] === 'locations' && LOC_BY_SLUG[p[1]]) {
    const l = LOC_BY_SLUG[p[1]];
    Object.assign(ctx, { city: l.city, state: l.state, type: p[2] ? 'city-service' : 'city' });
    if (p[2] && SVC_BY_SLUG[p[2]]) ctx.service = SVC_BY_SLUG[p[2]].name;
  } else if (p[0] === 'trades' && TRADE_BY_SLUG[p[1]]) {
    Object.assign(ctx, { trade: TRADE_BY_SLUG[p[1]].name, type: p[2] ? 'trade-state' : 'trade' });
    if (p[2]) ctx.state = (STATES.find(s => s.slug === p[2]) || {}).code || '';
  } else if (p[0] === 'services' && SVC_BY_SLUG[p[1]]) {
    Object.assign(ctx, { service: SVC_BY_SLUG[p[1]].name, type: 'service' });
  } else if (p[0]) ctx.type = p[0];
  return ctx;
}
const leadSection = path => `<section id="contact"><div class="wrap"><div class="contact-band"><h2>Tell me what you need.</h2><p>Name and a phone number is enough. You get me — not a form that disappears into an agency inbox.</p>${leadForm(leadCtxFor(path))}</div></div></section>`;

function page({ path, title, desc, crumbs, h1, lede, body, schema, canonicalOverride, noCta, answer, noindex, longTitle, noOffer }) {
  /* every commercial page closes on a form and a price — the site had 1,800 pages, no
     form, and no price, so every one of them leaked its traffic to a mailto link */
  if (!noCta) body += leadSection(path);
  if (!noCta && !noOffer) body += offerBand();
  const canonical = canonicalOverride || `${SITE}${path}`;
  if (desc.length > 155) desc = desc.slice(0, 152).replace(/[,;\s]+\S*$/, '') + '…';
  /* hard cap: anything past ~62 chars gets truncated in the SERP anyway.
     longTitle opts out — a full question beats a truncated one, since the whole
     string still counts for relevance even when the display is clipped. */
  if (!longTitle && title.length > 62) {
    const short = title.replace(` | ${BRAND}`, ' | DB');
    title = short.length > 62 ? short.slice(0, 61).replace(/[\s—–-]+\S*$/, '') + '…' : short;
  }
  const crumbUI = crumbs.map((c, i) => i === crumbs.length - 1 ? esc(c.name) : `<a href="${c.url}">${esc(c.name)}</a> / `).join('');
  const crumbLD = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE}${c.url}` })) };
  /* speakable points answer engines at the block that holds the liftable answer */
  const pageLD = {
    '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${canonical}#page`, url: canonical,
    name: title, description: desc, isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': BUSINESS_ID },
    ...(answer ? { speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.answer'] } } : {}),
  };
  const ld = [businessLD, websiteLD, pageLD, crumbLD, ...(schema ? (Array.isArray(schema) ? schema : [schema]) : [])];
  const answerHTML = answer ? `<div class="answer"><span class="lab">Short answer</span><p>${esc(answer)}</p></div>` : '';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1'}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/og/og-default.png"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0a0a0a">
${FAVICON}
${FONTS}
<style>${CSS}</style>
${ld.map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n')}
</head>
<body>
<a href="#main" style="position:absolute;left:-9999px;top:0" onfocus="this.style.left='8px';this.style.top='8px';this.style.background='#fff';this.style.color='#000';this.style.padding='8px 12px';this.style.zIndex=99" onblur="this.style.left='-9999px'">Skip to content</a>
<header class="top"><div class="wrap"><a class="logo" href="/">DB<span style="color:var(--silver-lo)">—</span></a><nav><a href="/services/">Services</a><a href="/trades/">Industries</a><a href="/locations/">Locations</a><a href="/answers/">Answers</a><a href="/products/">Products</a><a href="/start/" style="color:var(--silver-hi)">Get a site — $500</a></nav></div></header>
<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb">${crumbUI}</nav></div>
<main id="main">
<div class="hero"><div class="wrap"><h1>${h1}</h1><p class="lede">${lede}</p>${answerHTML}
${noCta ? '' : `<div class="cta-row"><a class="btn" href="mailto:${EMAIL}?subject=${encodeURIComponent('Project inquiry — ' + title)}">Get a free strategy brief →</a><a class="btn ghost" href="tel:${PHONE_TEL}">Call/Text ${PHONE}</a></div>`}</div></div>
${body}
</main>
${footerHTML}
</body>
</html>`;
  const dir = join(ROOT, path.slice(1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  /* pages canonicalized elsewhere stay out of the sitemap — it should list canonical URLs only */
  urls.push({ path, html, skipmap: !!canonicalOverride });
}

const faqLD = qs => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qs.map(q => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } })) });
const provider = { '@id': BUSINESS_ID };
const MARKETS = STATES.map(s => s.name);
const MARKET_LINE = `Oregon, Washington, California, Idaho, and Nevada`;
const svcLD = (name, area, path, description) => ({ '@context': 'https://schema.org', '@type': 'Service', name, description, provider, areaServed: area, url: `${SITE}${path}` });
const cityArea = loc => ({ '@type': 'City', name: loc.city, containedInPlace: { '@type': 'State', name: loc.stateName } });
const faqHTML = qs => `<section class="faq"><div class="wrap"><h2>Questions, answered straight</h2>${qs.map(q => `<details><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('')}</div></section>`;
const contactBand = ctx => `<section><div class="wrap"><div class="contact-band"><h2>Let's build something real.</h2><p>${esc(ctx)} Email <b>${EMAIL}</b> or call/text <b>${PHONE}</b> — you get a straight answer from me, not a sales sequence.</p><div class="cta-row"><a class="btn" href="mailto:${EMAIL}">Email Derik →</a><a class="btn ghost" href="tel:${PHONE_TEL}">Call/Text ${PHONE}</a></div></div></div></section>`;

/* ---------- lead capture ----------
   LEAD_ENDPOINT is the only thing that needs filling in. Until it's set the form still
   renders and still works — it just falls back to a prefilled mailto instead of POSTing,
   so the site is shippable either way and switching capture on is a one-line change.
   Every submission carries the page that produced it, so "which of 1,800 pages books
   jobs" is answerable instead of guessed at.

   Set these two and capture is live. Works with Web3Forms and Formspree as-is:
     Web3Forms  → endpoint 'https://api.web3forms.com/submit', key = your access key
     Formspree  → endpoint 'https://formspree.io/f/<your-id>',  key = '' (unused)
   The access key is public by design — it only permits submissions to your own inbox. */
const LEAD_ENDPOINT = '';
const LEAD_ACCESS_KEY = '';
const leadForm = (ctx = {}) => {
  const hidden = Object.entries({ source_path: ctx.path || '', source_type: ctx.type || 'page', source_city: ctx.city || '', source_state: ctx.state || '', source_service: ctx.service || '', source_trade: ctx.trade || '' })
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('');
  return `<form class="lead" id="leadForm" novalidate>
${hidden}
<div class="lead-row"><label>Your name<input name="name" required autocomplete="name" placeholder="First and last"></label>
<label>Phone<input name="phone" type="tel" required autocomplete="tel" placeholder="Best number to reach you"></label></div>
<div class="lead-row"><label>Business<input name="business" autocomplete="organization" placeholder="Company name"></label>
<label>Email <span class="opt">optional</span><input name="email" type="email" autocomplete="email" placeholder="you@company.com"></label></div>
<label>What do you need? <span class="opt">optional</span><textarea name="message" rows="3" placeholder="A site, more calls, the phone answered — whatever it is, plain English is fine."></textarea></label>
<div class="lead-foot"><button class="btn" type="submit">Send it →</button>
<span class="lead-note">Goes straight to me. No sequence, no sales team. Or call/text <a href="tel:${PHONE_TEL}">${PHONE}</a>.</span></div>
<p class="lead-status" id="leadStatus" role="status" aria-live="polite"></p>
</form>
<script>(()=>{
const f=document.getElementById('leadForm');if(!f)return;
const s=document.getElementById('leadStatus');
const EP=${JSON.stringify(LEAD_ENDPOINT)},KEY=${JSON.stringify(LEAD_ACCESS_KEY)},MAIL=${JSON.stringify(EMAIL)};
f.addEventListener('submit',async e=>{
 e.preventDefault();
 const d=Object.fromEntries(new FormData(f).entries());
 if(!d.name||!d.phone){s.textContent='Name and phone, then it sends.';s.className='lead-status warn';return}
 d.page_title=document.title;d.referrer=document.referrer||'';
 const btn=f.querySelector('button');btn.disabled=true;btn.textContent='Sending…';
 if(!EP){ /* no endpoint configured yet — hand off to email rather than lose the lead */
  const body=Object.entries(d).filter(([,v])=>v).map(([k,v])=>k+': '+v).join('\\n');
  location.href='mailto:'+MAIL+'?subject='+encodeURIComponent('Website lead — '+d.name)+'&body='+encodeURIComponent(body);
  s.textContent='Opening your email so this reaches me — hit send.';s.className='lead-status ok';
  btn.disabled=false;btn.textContent='Send it →';return}
 try{
  if(KEY)d.access_key=KEY;
  d.subject='Website lead — '+d.name+(d.business?' ('+d.business+')':'');
  const r=await fetch(EP,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(d)});
  if(!r.ok)throw new Error(r.status);
  f.querySelectorAll('input,textarea,button').forEach(x=>x.disabled=true);
  s.innerHTML='Got it — I\\'ll call you at <b>'+d.phone+'</b>. If it\\'s urgent, call me now: <a href="tel:${PHONE_TEL}">${PHONE}</a>.';
  s.className='lead-status ok';
 }catch(err){
  s.innerHTML='That didn\\'t go through. Call or text <a href="tel:${PHONE_TEL}">${PHONE}</a> — fastest way to reach me.';
  s.className='lead-status warn';btn.disabled=false;btn.textContent='Send it →';
 }
});})();</script>`;
};

/* The offer band. Every generated page had a mailto and no price — this is the
   money path. STRIPE_500 is the live "check out now" link already running on the demos. */
const STRIPE_500 = 'https://buy.stripe.com/3cI14ofqgctp3qBcDZdjO02';
const PRICE_FULL = '$999';
const PRICE_NOW = '$500';
const offerBand = () => `<section><div class="wrap"><div class="offer">
<div class="offer-copy"><span class="mono">The wedge<b>—</b></span><h2>A ${PAGE_MIN}+ page site for your business. <span class="chrome">${PRICE_NOW} if you check out now.</span></h2>
<p>Every service you offer and every town you serve gets its own page — built on your logo, your colors, your license number. Schema, sitemap, and llms.txt so search engines and AI assistants both read you correctly. Delivered in 7 business days. <b>You own all of it</b>, source code included.</p></div>
<div class="offer-act"><div class="price"><span class="was">${PRICE_FULL}</span><span class="now">${PRICE_NOW}</span><span class="mono">checkout price</span></div>
<a class="btn" href="/start/">See what's included →</a><a class="btn ghost" href="tel:${PHONE_TEL}">Call/Text ${PHONE}</a></div>
</div></div></section>`;

/* ---------- copy pools (rewritten post-review: no broken grammar, no flattery, more variants) ---------- */
const whyLocalPool = [
  (svc, loc) => `The ${loc.city} companies winning right now aren't better at the work — they answer first and follow up first. That's the whole point of ${svc.short} here: engineered for ${loc.county} search behavior and the competitors actually running ads in your zip codes.`,
  (svc, loc) => `${loc.city} is not a generic market. National playbooks get outspent or ignored here — the businesses pulling ahead in the ${loc.region} are the ones showing up first and following up automatically. That's the job of ${svc.short}, built for your service area instead of copy-pasted across a franchise.`,
  (svc, loc) => `Plenty of ${loc.city} companies are better at the work than whoever outranks them. The gap is never craft — it's a web presence built once, years ago, and never engineered to compete. That gap is the target here: ${svc.short} engineered to compete, owned by you.`,
  (svc, loc) => `Every week, homeowners and businesses across ${loc.city} and ${loc.nearby[0].replace(/, [A-Z]{2}$/, '')} pick a company off page one and never see page two. Becoming the company they find is the whole job — ${svc.short} measured in booked jobs from the ${loc.region}, not impressions.`,
  (svc, loc) => `Word-of-mouth built your business; it just stopped scaling. In ${loc.county}, the next tier of growth comes from being found first and answering fast — and that's engineering, not luck. This is that engineering.`,
  (svc, loc) => `Watch what the biggest franchises spend in the ${loc.region} and you'll see the game: buy the first impression, let systems do the follow-up. This is the same machinery — ${svc.short} dialed for an independent ${loc.city} operation, without the franchise fees.`,
  (svc, loc) => `A missed call in ${loc.city} isn't a missed call — it's a job your competitor booked. Between ${loc.nearby[0].replace(/, [A-Z]{2}$/, '')} and ${loc.nearby[1].replace(/, [A-Z]{2}$/, '')}, the same customers keep choosing whoever responds first. This stacks that deck for you.`,
  (svc, loc) => `Most agencies treat ${loc.city} like a zip code on an invoice. This is built the other way around: your actual service area across ${loc.county}, your actual competitors, and the only number that matters — what a booked job costs you. That's the standard this work is held to.`,
  (svc, loc) => `Search results in ${loc.city} are decided before anyone reads a word about craftsmanship. Position, review count, response time — that's the scoreboard, and it's all engineering. ${capFirst(svc.short)} here means competing on the parts of the decision that happen before the phone rings.`,
  (svc, loc) => `The ${loc.region} has a short list of companies that always seem to be booked out. It isn't luck and it usually isn't price — they're simply easier to find and faster to reach than everyone else in ${loc.county}. That's a build, and it's the build on offer here.`,
  (svc, loc) => `Ask a ${loc.city} homeowner how they picked their last contractor and the answer is almost never "best reviews after careful research." It's whoever came up first and answered. ${capFirst(svc.short)} exists to make that whoever be you.`,
  (svc, loc) => `There's a version of your ${loc.city} business that shows up first for every service you sell, answers every call inside ten seconds, and follows up on every quote without you remembering to. The distance between that and today is systems — starting with ${svc.short}.`,
  (svc, loc) => `Serving ${loc.city} and ${loc.nearby.slice(0, 2).join(' and ')} means competing in several search markets at once, each with its own leaders. One generic page can't do that. Pages built per town and per service can — that's the structure behind this.`,
  (svc, loc) => `Referrals still close best in ${loc.county} — they just arrive too slowly to grow on. ${capFirst(svc.short)} adds the second channel underneath them: people who've never heard your name finding you at the exact moment they need the work.`,
  (svc, loc) => `Whoever is winning ${loc.city} right now bought or built a head start, and it compounds every month it goes unanswered. The counter isn't outspending them — it's covering the searches, services, and towns across the ${loc.region} they left uncovered.`,
  (svc, loc) => `Nothing about ${loc.city} is served by a template written for a national brand. ${capFirst(svc.short)} here starts from your service radius across ${loc.county}, the trades you actually run, and the jobs you want more of — then gets built to produce those.`,
  (svc, loc) => `Two companies in ${loc.city} can do identical work and end the year fifty jobs apart. The gap is almost always in what happens before and after the job — being found, answering fast, following up. ${capFirst(svc.short)} is the front half of that.`,
  (svc, loc) => `Demand in the ${loc.region} isn't steady, and neither is your competition's attention. The businesses that flatten the slow months are the ones with systems that keep producing when nobody's actively selling. This is one of those systems.`,
  (svc, loc) => `Every quote that goes quiet in ${loc.city} was a customer who wanted the work done. They just found someone easier to deal with first. Fixing that is cheaper than finding new leads, and it starts with ${svc.short}.`,
];
/* second paragraph — varies by state and market size so no two states read alike */
const marketContext = {
  OR: loc => `Oregon markets reward specificity. ${loc.county} buyers check the CCB number, read recent reviews, and call two or three companies in one sitting — so the site has to answer the license question, the service-area question, and the price-range question before anyone dials.`,
  WA: loc => `Washington buyers look up L&I registration and bonding before they let anyone into the house. Getting that on the page — alongside real ${loc.county} service-area coverage — clears the hurdle that costs most contractors the first call.`,
  CA: loc => `California requires the CSLB number in advertising, and buyers in ${loc.county} genuinely check it. Everything here gets built with that on the page, and with targeting scoped to ${loc.region} instead of a whole-region campaign that burns budget on searches you can't service.`,
  ID: loc => `The ${loc.region} has grown faster than most contractors' marketing has. That's the opportunity: plenty of demand in ${loc.county}, and a competitive field where a well-built site and a fast phone still stand out.`,
  NV: loc => `${loc.region} demand swings hard with season and construction cycles, and the field includes operators buying position aggressively. Winning here means covering the specific services and neighborhoods across ${loc.county} the big spenders treat as an afterthought.`,
};
const sizeContext = loc => loc.tier === 1
  ? `${loc.city} is an anchor market, which means real competition and real volume — several companies per trade running ads, and enough search demand to support a full page set for every service you sell.`
  : `${loc.city} is the kind of market where a well-built site wins outright. Search volume is smaller than the metro, and so is the competition — most of the field is running a five-page site nobody has touched in three years.`;
/* per-service local angle — second differentiated block on every city page */
const localAngle = {
  'web-design': (loc) => `A site that loads instantly and reads clearly on a phone wins ${loc.city} jobs before a call is ever made. Yours gets built around the searches people in ${loc.county} actually type, with service pages for the work you want more of — not a brochure with a phone number.`,
  'custom-software': (loc) => `Off-the-shelf tools force your ${loc.city} operation into someone else's workflow. Custom software runs it your way — quoting, scheduling, customer updates — and it talks to the tools your crew already uses instead of replacing them.`,
  'seo': (loc) => `The map pack is the main street of ${loc.city} now. Getting into it takes a tuned Google Business Profile, consistent citations, and content that answers ${loc.region} searches — done in that order, measured by calls.`,
  'google-ads': (loc) => `Ad budgets die fast in ${loc.city} when campaigns chase clicks instead of jobs. Local Services Ads plus tightly-scoped search campaigns put you in front of ${loc.county} buyers at the moment of need — and every dollar gets tracked to a booked job, not a session.`,
  'ai-receptionist': (loc) => `After-hours calls in ${loc.city} don't wait for morning — they dial the next result. An AI receptionist answers in seconds, any hour, books the job onto your calendar, and routes true emergencies to your on-call phone.`,
  'crm': (loc) => `Most ${loc.city} service businesses don't lose jobs to competitors — they lose them to their own inbox. A pipeline that chases every estimate and logs every call means the quote you sent in ${loc.nearby[0].replace(/, [A-Z]{2}$/, '')} last Tuesday doesn't die in silence.`,
  'email-sms-marketing': (loc) => `Your past ${loc.city} customers are the cheapest jobs you'll ever book — if anyone reaches them. Seasonal reminders, estimate follow-ups, and reactivation campaigns run automatically, timed to how demand actually moves in the ${loc.region}.`,
  'reputation-management': (loc) => `In ${loc.city}, your Google rating is your storefront. Review requests fire after every job, responses go out in your voice, and problems route to you before they become public — so the rating reflects the work.`,
  'aeo': (loc) => `A growing share of ${loc.city} buyers now ask an assistant who to call before they ever open a search page. Getting named in that answer takes structured pages, consistent business facts across every source, and schema that tells the model exactly what you do in ${loc.county} — none of which happens by accident.`,
  'landing-pages': (loc) => `Sending ${loc.city} ad traffic to a homepage wastes most of it. One page per service, per town, with the phone number visible before anyone scrolls and the license and reviews right there — that's the difference between paying for clicks and paying for booked jobs across ${loc.region}.`,
};
/* direct, liftable answer at the top of every city-service page (AEO) */
/* service descs and trade systems are authored lower-case already — never run them
   through lc(), which flattens single-capital proper nouns (Gemini, Perplexity). */
const cityServiceAnswer = (svc, loc) =>
  `${svc.name} for ${loc.city}, ${loc.state} service businesses: ${svc.desc.split(' — ')[0]}. Serving ${loc.city}, ${loc.nearby.slice(0, 3).join(', ')}, and the rest of ${loc.county}. Flat pricing quoted up front, and you own everything that gets built. Call or text ${PHONE}.`;
const faqPoolCitySvc = (svc, loc) => {
  const inOR = loc.state === 'OR';
  return [
    { q: `Do you work with businesses in ${loc.city}, ${loc.state}?`, a: `Yes — ${loc.city} and the surrounding ${loc.region} (${loc.nearby.slice(0, 3).join(', ')} and beyond) are core service areas. Everything is delivered remotely with the same speed and accountability, and I'm reachable by phone or text at ${PHONE}.` },
    pick([
      { q: `How is this different from a big agency?`, a: `You work directly with the operator who builds and runs these systems — no account managers, no hand-offs, no invoices for meetings. If it doesn't book revenue for you, it gets rebuilt.` },
      { q: `Why work with you instead of an agency?`, a: `Because the person you call is the person who does the work. The core systems run in my own Oregon business first, and ${inOR ? 'your market is my backyard' : 'the work is digital — results show up on your phone, not in a conference room'}.` },
    ], loc.slug + svc.slug),
    { q: `Do I own what you build?`, a: `Completely. Your domain, your site, your data, your customer list. If we part ways, everything stays with you — that's a rule, not a favor.` },
    pick([
      { q: `How fast can we start?`, a: `Most projects kick off within days of a strategy call, and the first pieces ship fast — a live system beats a perfect plan.` },
      { q: `What does the process look like?`, a: `A short strategy call, a flat quote, then work in the open — you see progress weekly, in plain English, and nothing ships without your sign-off.` },
    ], svc.slug + loc.slug),
    { q: `What's the cost of ${svc.short} in ${loc.city}?`, a: `Flat, quoted-up-front pricing scoped to your goals — no percent-of-revenue, no lock-in contracts. Email ${EMAIL} for a free strategy brief with a straight number.` },
  ];
};

/* ---------- clean old generated dirs ---------- */
for (const d of ['services', 'trades', 'locations', 'products', 'about', 'legal', 'ideas', 'answers', 'sitemap', 'start']) rmSync(join(ROOT, d), { recursive: true, force: true });
mkdirSync(join(ROOT, 'og'), { recursive: true }); /* og-default.png is generated separately — never clean this dir */

/* ---------- service hubs ---------- */
page({
  path: '/services/', title: `Services — Websites, SEO, AEO, Ads, AI & CRM | ${BRAND}`,
  desc: `All ${services.length} systems ${BRAND} builds for service businesses: websites, local SEO, answer engine optimization, Google Ads, AI receptionists, CRM, automation, and more.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Services', url: '/services/' }],
  h1: `Systems that <span class="chrome">book revenue.</span>`,
  lede: `${services.length} systems, grouped by the job they do. The core stack — sites, SEO, AEO, CRM, AI answering — runs in my own business before it runs in yours.`,
  answer: `${BRAND} builds ${services.length} systems for service businesses across ${MARKET_LINE}: websites, local SEO, answer engine optimization, Google Ads and Local Services Ads, AI phone answering, CRM and follow-up automation, reputation management, and custom software. Flat pricing, and you own everything built.`,
  body: `<section><div class="wrap">${toolbar('Search services — "reviews", "ads", "answering"…', null, services.length, 'services')}
<div id="filterRoot">${serviceGroups.map(g => {
    const inGroup = services.filter(s => s.group === g.key);
    return !inGroup.length ? '' : `<div class="group" data-group="${g.key}"><h3>${esc(g.label)}</h3><p class="gb">${esc(g.blurb)}</p><div class="grid">${inGroup.map(s => `<a href="/services/${s.slug}/" data-k="${esc((s.name + ' ' + s.short + ' ' + s.desc).toLowerCase())}"><b>${esc(s.name)}</b>${esc(s.desc.split(' — ')[0])}</a>`).join('')}</div></div>`;
  }).join('')}</div></div></section>` + faqHTML([
    { q: `Which system should a service business build first?`, a: `Almost always the website and the phone. A site that ranks and something that answers every call are what make every other system worth paying for — ads, SEO, and follow-up all leak through an unanswered phone.` },
    { q: `Can I buy one service instead of a package?`, a: `Yes. Everything here is quoted individually and flat. There's no bundle you have to buy to get one piece of it.` },
    { q: `What does AEO mean and do I need it?`, a: `Answer engine optimization — getting your business named when someone asks ChatGPT, Gemini, or Google's AI who to call. If your buyers are homeowners, a growing share of them now ask an assistant first, so yes.` },
  ]) + contactBand(`Not sure which system your business needs first?`) + filterJS(),
  schema: { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Services', numberOfItems: services.length, itemListElement: services.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, url: `${SITE}/services/${s.slug}/` })) },
});
for (const s of services) {
  /* /services/link-building + /services/press-releases duplicate /products/ pages — canonical there */
  const canonicalOverride = s.slug === 'link-building' ? `${SITE}/products/link-building/` : s.slug === 'press-releases' ? `${SITE}/products/press-releases/` : undefined;
  const svcCities = locations.filter(l => servicesFor(l).some(x => x.slug === s.slug));
  const cityLinks = svcCities.length ? `<section><div class="wrap"><h2>${esc(s.short)}, market by market</h2><p class="body-copy">${svcCities.length} markets across ${MARKET_LINE} — each one its own page, built around that city's county, service area, and competition.</p><div class="citylinks" style="margin-top:18px">${svcCities.map(l => `<a href="/locations/${l.slug}/${s.slug}/">${esc(s.short)} in ${esc(l.city)}, ${l.state}</a>`).join('')}</div></div></section>` : '';
  page({
    path: `/services/${s.slug}/`, title: (() => { const t = `${s.name} for Service Businesses | ${BRAND}`; return t.length > 65 ? `${s.name} | ${BRAND}` : t; })(),
    desc: `${s.metaShort}. For service businesses across ${MARKET_LINE} — ${locations.length} markets. Flat pricing, and you own everything.`,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Services', url: '/services/' }, { name: s.short, url: `/services/${s.slug}/` }],
    h1: `${esc(s.name)}<span class="chrome"> that earns its keep.</span>`,
    lede: `${esc(capFirst(s.desc))}. Built by an operator who runs these systems in his own business.`,
    answer: `${s.name}: ${s.desc}. Built by ${BRAND} for service businesses across ${MARKET_LINE}. Flat pricing quoted up front, no percent-of-revenue and no lock-in, and you own the work outright. Call or text ${PHONE}.`,
    body: `<section><div class="wrap"><h2>What's included</h2><ul class="feat">${s.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div></section>
<section><div class="wrap"><h2>Built for your industry</h2><p class="body-copy">No two trades win work the same way. This gets built around how yours does — all ${trades.length} industries:</p><div class="grid" style="margin-top:20px">${trades.map(t => `<a href="/trades/${t.slug}/"><b>${esc(t.name)}</b>${esc(s.short)} for ${esc(t.plural)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Where I work</h2><p class="body-copy">${locations.length} markets across ${MARKET_LINE}. The anchor metros:</p><div class="grid" style="margin-top:20px">${gridCities.map(l => `<a href="/locations/${l.slug}/${servicesFor(l).some(x => x.slug === s.slug) ? s.slug + '/' : ''}"><b>${esc(l.city)}, ${l.state}</b>${esc(s.short)} in the ${esc(l.region)}</a>`).join('')}<a href="/locations/"><b>All ${locations.length} cities →</b>Every market I serve</a></div></div></section>` + cityLinks +
      faqHTML([
        { q: `What makes your ${s.short} different?`, a: `It's operator-built: the core systems run in my own business, so recommendations come from what already worked with my own money on the line — not from what bills the most hours.` },
        { q: `Do I own the work?`, a: `Yes — domain, code, content, data, all of it. Walk away any time and take everything with you.` },
        { q: `How do you price it?`, a: `Flat and quoted up front after a free strategy brief. No percent-of-revenue, no surprise invoices. Email ${EMAIL} to start.` },
      ]) + contactBand(`Want ${s.short} built to book jobs?`),
    schema: svcLD(s.name, MARKETS, `/services/${s.slug}/`, s.desc),
    canonicalOverride,
  });
}

/* ---------- trade hubs ---------- */
page({
  path: '/trades/', title: `Industries — Marketing & Software by Trade | ${BRAND}`,
  desc: `Purpose-built websites, SEO, AEO, ads, and AI systems for ${trades.length} service industries — roofing, plumbing, HVAC, electrical, fencing, pools, decks, restoration, and more.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Industries', url: '/trades/' }],
  h1: `Every trade gets <span class="chrome">its own playbook.</span>`,
  lede: `${trades.length} industries, each with systems built around how that trade actually wins work — no "home services" bucket, no recycled template.`,
  answer: `${BRAND} builds marketing and software systems for ${trades.length} service industries, including roofing, plumbing, HVAC, electrical, fencing, pools and spas, decks, concrete, landscaping, restoration, garage doors, solar, and EV charger installation. Each trade gets systems built around how it actually books work.`,
  body: `<section><div class="wrap">${toolbar('Search industries — "fence", "pool", "roof"…', tradeCategories, trades.length, 'industries')}
<div id="filterRoot">${tradeCategories.map(c => {
    const inCat = trades.filter(t => t.category === c.key);
    return !inCat.length ? '' : `<div class="group" data-group="${c.key}"><h3>${esc(c.label)}</h3><div class="grid">${inCat.map(t => `<a href="/trades/${t.slug}/" data-f="${t.category}" data-k="${esc((t.name + ' ' + t.plural).toLowerCase())}"><b>${esc(t.name)}</b>Systems for ${esc(t.plural)}</a>`).join('')}</div></div>`;
  }).join('')}</div></div></section>` + contactBand(`Don't see your exact trade? If you roll a truck, these systems fit.`) + filterJS(),
  schema: { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Industries served', numberOfItems: trades.length, itemListElement: trades.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}/trades/${t.slug}/` })) },
});
for (const t of trades) {
  /* name-based, not plural-based — "Software Development for Janitorial and Commercial
     Cleaning Companies" blows past every SERP limit and loses the brand to truncation. */
  let title = `${t.name} Marketing & Software | ${BRAND}`;
  if (title.length > 62) title = `${t.name} Marketing & Software | DB`;
  if (title.length > 62) title = `${t.name} Marketing | DB`;
  page({
    path: `/trades/${t.slug}/`, title,
    desc: `Marketing and software for ${t.plural}: websites, local SEO, AEO, Google Ads, AI receptionists, CRM, and custom tools. Serving ${MARKET_LINE}.`,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Industries', url: '/trades/' }, { name: t.name, url: `/trades/${t.slug}/` }],
    h1: `Systems built for <span class="chrome">${esc(tradeLc(t))}.</span>`,
    lede: `I build for ${esc(t.plural)} specifically. You deal with ${esc(t.pain)} — your systems should be built around exactly that.`,
    answer: `${BRAND} builds websites, local SEO, answer engine optimization, Google Ads, AI phone answering, and CRM systems for ${t.plural} across ${MARKET_LINE}. The trade-specific pieces: ${t.systems}. Flat pricing, and you own the work. Call or text ${PHONE}.`,
    body: `<section><div class="wrap"><h2>What I build for ${esc(t.plural)}</h2><p class="body-copy">Beyond the core stack — a ranking website, answer-engine visibility, dialed Google Ads, an AI receptionist that answers every call, and a CRM that never forgets a quote — ${esc(t.plural)} get the trade-specific stack: <b>${esc(t.systems)}</b>.</p></div></section>
<section><div class="wrap"><h2>The full stack</h2><div class="grid">${services.map(s => `<a href="/services/${s.slug}/"><b>${esc(s.short)}</b>${esc(s.desc.split(' — ')[0])}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>${esc(capFirst(t.plural))} by state</h2><p class="body-copy">Licensing, seasonality, and competition differ by state. Each one gets its own page:</p><div class="grid" style="margin-top:20px">${STATES.map(st => `<a href="/trades/${t.slug}/${st.slug}/"><b>${esc(st.name)}</b>${esc(t.name)} systems in ${st.cities.length} ${st.name} markets</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Anchor markets</h2><div class="grid">${gridCities.map(l => `<a href="/locations/${l.slug}/"><b>${esc(l.city)}, ${l.state}</b>${esc(t.name)} systems in the ${esc(l.region)}</a>`).join('')}<a href="/locations/"><b>All ${locations.length} cities →</b>Every market I serve</a></div></div></section>` +
      faqHTML([
        { q: `Do you actually understand the ${tradeLc(t)} business?`, a: `The systems are built from running my own service business and studying how ${t.plural} win work — around ${t.pain}, not around a generic agency playbook.` },
        { q: `What should a ${tradeLc(t)} company fix first?`, a: `Usually the leaks: calls that go unanswered and leads that never get followed up. An AI receptionist plus automated follow-up typically pays for everything else.` },
        { q: `Do you take my competitors as clients?`, a: `I keep conflicts off my plate. If I'm already working deep with a ${tradeLc(t)} company in your service area, I'll tell you straight and we'll sort scope or a referral — ask about market exclusivity on retainer work.` },
      ]) + contactBand(`Ready to be the ${tradeLc(t)} company everyone in your market finds first?`),
    schema: svcLD(`Software & Marketing for ${t.name} Companies`, MARKETS, `/trades/${t.slug}/`, `Websites, SEO, ads, AI answering, CRM, and custom software for ${t.plural}.`),
  });
}

/* ---------- trade × state (the commercial money pages: "roofing marketing in California") ----------
   State facts are regulatory and geographic — checkable, never invented. */
const stateFacts = {
  OR: { license: 'a CCB number from the Oregon Construction Contractors Board', check: 'Oregon buyers are trained to look up the CCB number before they call', geo: 'the Portland metro, the Willamette Valley corridor, Central Oregon, the Rogue Valley, the coast, and the eastern side', season: 'a long wet season that drives roofing, gutter, drainage, and moisture work from October through spring' },
  WA: { license: 'contractor registration and a bond through Washington Labor & Industries', check: 'L&I registration is publicly searchable and Washington buyers do search it', geo: 'the Puget Sound corridor, southwest Washington, and the very different economics east of the Cascades', season: 'wet, mild winters west of the Cascades and genuine freeze cycles east of them' },
  CA: { license: 'a CSLB license number, which California requires in your advertising', check: 'CSLB rules require licensed contractors to publish the license number in advertising', geo: 'Greater Los Angeles, the Bay Area, San Diego, the Inland Empire, the Central Valley, the Central Coast, and the far north', season: 'wildfire hardening, drought and water rules, Title 24 energy requirements, and seismic work as year-round demand drivers' },
  ID: { license: 'state contractor registration', check: 'registration and insurance details clear the first hurdle for a cautious buyer', geo: 'the Treasure Valley around Boise and the Inland Northwest around Coeur d\'Alene', season: 'hard winters and a short, crowded building season' },
  NV: { license: 'a license from the Nevada State Contractors Board', check: 'Nevada buyers can look the license up, and the unlicensed field makes them want to', geo: 'the Las Vegas Valley and the Truckee Meadows around Reno', season: 'extreme heat cycles in the south and real snow load in the north' },
};
for (const t of trades) for (const st of STATES) {
  const f = stateFacts[st.code];
  const anchors = st.cities.filter(l => l.tier === 1);
  const key = t.slug + st.code;
  let title = `${t.name} Marketing in ${st.name} | ${BRAND}`;
  if (title.length > 60) title = `${t.name} Marketing — ${st.name} | DB`;
  const qs = [
    { q: `Do you work with ${t.plural} across ${st.name}?`, a: `Yes — ${st.cities.length} ${st.name} markets have their own pages, from ${anchors.slice(0, 3).map(l => l.city).join(', ')} out to the smaller towns. Everything is delivered remotely with direct phone and text access to me at ${PHONE}.` },
    { q: `What should a ${st.name} ${tradeLc(t)} company fix first?`, a: `Usually two things: the phone and the pages. Something has to answer every call, and there has to be a real page for each service in each town you serve. ${capFirst(f.check)}, so the license number belongs on the site too.` },
    { q: `How is marketing for ${t.plural} different in ${st.name}?`, a: `Licensing and geography. You need ${f.license}, and ${st.name} is not one market — ${f.geo} behave differently on cost, competition, and season. A single statewide campaign overspends in the cheap markets and gets buried in the expensive ones.` },
    { q: `What does it cost?`, a: `Flat and quoted up front after a free strategy brief specific to your ${st.name} market and your competition. No percent-of-revenue, no lock-in. Email ${EMAIL}.` },
  ];
  page({
    path: `/trades/${t.slug}/${st.slug}/`, title,
    desc: `Websites, local SEO, AEO, ads, and AI answering for ${st.name} ${t.plural} — ${st.cities.length} markets. Flat pricing, you own everything.`,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Industries', url: '/trades/' }, { name: t.name, url: `/trades/${t.slug}/` }, { name: st.name, url: `/trades/${t.slug}/${st.slug}/` }],
    h1: `${esc(capFirst(tradeLc(t)))} marketing in <span class="chrome">${esc(st.name)}.</span>`,
    lede: `Growth systems for ${esc(t.plural)} across ${esc(st.name)} — ${st.cities.length} markets, each with its own page, its own county, and its own competition.`,
    answer: `${BRAND} builds websites, local SEO, answer engine optimization, Google Ads, AI phone answering, and CRM systems for ${st.name} ${t.plural} in ${st.cities.length} markets. ${capFirst(st.name)} contractors need ${f.license}. Flat pricing quoted up front, and you own the work.`,
    body: `<section><div class="wrap"><h2>What matters for ${esc(t.plural)} in ${esc(st.name)}</h2><p class="body-copy">${esc(capFirst(f.check))} — so the license number, the bond, and the insurance belong on the page, not buried in a PDF. Beyond that, ${esc(t.plural)} live and die by ${esc(t.pain)}, which is what the trade-specific stack is built around: <b>${esc(t.systems)}</b>.</p>
<p class="body-copy" style="margin-top:14px">${esc(capFirst(st.name))} is not one market. ${esc(capFirst(f.geo))} differ enough on cost per click, competition, and buying behavior that they need separate plans and separate budgets. And the calendar matters: ${esc(f.season)}.</p></div></section>
<section><div class="wrap"><h2>${esc(st.name)} markets</h2><div class="citylinks">${st.cities.map(l => `<a href="/locations/${l.slug}/">${esc(t.name)} systems in ${esc(l.city)}, ${l.state}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>The stack</h2><div class="grid">${core.map(s => `<a href="/services/${s.slug}/"><b>${esc(s.short)}</b>${esc(s.desc.split(' — ')[0])}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>${esc(t.name)} in other states</h2><div class="grid">${STATES.filter(x => x.code !== st.code).map(x => `<a href="/trades/${t.slug}/${x.slug}/"><b>${esc(x.name)}</b>${esc(t.name)} systems in ${x.cities.length} markets</a>`).join('')}${trades.filter(x => x.slug !== t.slug && x.category === t.category).slice(0, 3).map(x => `<a href="/trades/${x.slug}/${st.slug}/"><b>${esc(x.name)}</b>${esc(st.name)} ${esc(x.plural)}</a>`).join('')}</div></div></section>` +
      faqHTML(qs) + contactBand(`Want the free brief on ${lc(t.name)} search in your ${st.name} market — who ranks, who's buying ads, and where the gap is?`),
    schema: [svcLD(`${t.name} Marketing in ${st.name}`, { '@type': 'State', name: st.name }, `/trades/${t.slug}/${st.slug}/`, `Websites, SEO, AEO, ads, AI answering, and CRM for ${st.name} ${t.plural}.`), faqLD(qs)],
  });
  void key;
}

/* ---------- location hubs + state hubs + city-service pages ---------- */
page({
  path: '/locations/', title: `Locations — ${locations.length} West Coast Markets | ${BRAND}`,
  desc: `${BRAND} builds websites, SEO, AEO, and growth systems in ${locations.length} markets across ${MARKET_LINE}. Find your city.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Locations', url: '/locations/' }],
  h1: `${locations.length} markets. <span class="chrome">The whole coast.</span>`,
  lede: `Based in Oregon, building across ${esc(MARKET_LINE)} — ${locations.length} cities, each with its own page, county, and service area. Start typing your town.`,
  answer: `${BRAND} serves ${locations.length} markets across ${MARKET_LINE}: ${STATES.map(s => `${s.cities.length} in ${s.name}`).join(', ')}. Every city has its own page covering that market's county, service area, and neighboring towns. Work is delivered remotely with direct phone and text access at ${PHONE}.`,
  body: `<section><div class="wrap">${toolbar('Search your city or county…', STATES.map(s => ({ key: s.code, label: s.name })), locations.length, 'markets')}
<div id="filterRoot"><div class="states">${STATES.map(st => `<div class="statecol" data-group="${st.code}"><h3><a href="/locations/${st.slug}/" style="color:inherit">${esc(st.name)} →</a></h3>${st.cities.map(l => `<a class="${l.tier === 1 ? 'anchor' : ''}" href="/locations/${l.slug}/" data-f="${l.state}" data-k="${esc((l.city + ' ' + l.county + ' ' + l.region + ' ' + l.nearby.join(' ')).toLowerCase())}">${esc(l.city)}${l.tier === 1 ? '' : ''}</a>`).join('')}<span class="more">${st.cities.length} markets</span></div>`).join('')}</div></div></div></section>
<section><div class="wrap"><h2>By state</h2><div class="grid">${STATES.map(st => `<a href="/locations/${st.slug}/"><b>${esc(st.name)}</b>${st.cities.length} markets — ${st.cities.filter(c => c.tier === 1).length} anchor metros</a>`).join('')}</div></div></section>` + contactBand(`Your town not on the list? If it's within reach of a market that is, say so — the page can be built.`) + filterJS(),
  schema: { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Markets served', numberOfItems: locations.length, itemListElement: STATES.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, url: `${SITE}/locations/${s.slug}/` })) },
});

/* state hubs */
for (const st of STATES) {
  const f = stateFacts[st.code];
  const anchors = st.cities.filter(l => l.tier === 1);
  const counties = [...new Set(st.cities.map(l => l.county))];
  const qs = [
    { q: `What ${st.name} markets do you serve?`, a: `${st.cities.length} of them, from ${anchors.slice(0, 4).map(l => l.city).join(', ')} out to smaller towns across ${counties.length} counties. Each market has its own page — pick yours from the list above.` },
    { q: `Do I need a ${st.name} contractor license to advertise?`, a: `For licensed trades you need ${f.license}, and it belongs on your website and your Google profile. ${capFirst(f.check)}. Confirm the current requirement with the board itself — rules change and they're enforced.` },
    { q: `Do you have an office in ${st.name}?`, a: st.code === 'OR' ? `Yes — I'm an Oregon operator, and Oregon is home. I run my own business here and the systems I sell run inside it daily.` : `No — I'm an Oregon operator serving ${st.name} remotely. Same systems, same speed, direct access to me by phone or text. The work is digital; results show up on your phone, not in a conference room.` },
    { q: `Can you cover the whole state in one campaign?`, a: `You shouldn't. ${capFirst(f.geo)} differ enough on cost, competition, and season that one statewide campaign overspends in the cheap markets and gets buried in the expensive ones. Separate plans, separate budgets.` },
  ];
  page({
    path: `/locations/${st.slug}/`, title: `${st.name} — ${st.cities.length} Markets | ${BRAND}`,
    desc: `Websites, local SEO, AEO, ads, and AI answering for ${st.name} service businesses in ${st.cities.length} markets across ${counties.length} counties.`,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Locations', url: '/locations/' }, { name: st.name, url: `/locations/${st.slug}/` }],
    h1: `${esc(st.name)}: <span class="chrome">${st.cities.length} markets.</span>`,
    lede: `Growth systems for ${esc(st.name)} service businesses — ${st.cities.length} cities across ${counties.length} counties, each with its own page and its own plan.`,
    answer: `${BRAND} serves ${st.cities.length} ${st.name} markets across ${counties.length} counties, anchored by ${anchors.slice(0, 5).map(l => l.city).join(', ')}. ${capFirst(st.name)} contractors need ${f.license}. Systems built: websites, local SEO, answer engine optimization, ads, AI phone answering, and CRM. Call or text ${PHONE}.`,
    body: `<section><div class="wrap"><h2>What's different about ${esc(st.name)}</h2><p class="body-copy">You need ${esc(f.license)}, and ${esc(f.check)} — so it goes on the site, the profile, and the truck. Past that, the calendar drives demand: ${esc(f.season)}.</p>
<p class="body-copy" style="margin-top:14px">${esc(capFirst(st.name))} is really several markets stacked together — ${esc(f.geo)}. Each has its own competition and its own cost per lead, which is why every city below gets a page instead of one statewide sweep.</p>
<dl class="facts"><div><dt>Markets</dt><dd>${st.cities.length}</dd></div><div><dt>Counties covered</dt><dd>${counties.length}</dd></div><div><dt>Anchor metros</dt><dd>${anchors.length}</dd></div><div><dt>Industries served</dt><dd>${trades.length}</dd></div></dl></div></section>
<section><div class="wrap"><h2>Anchor metros</h2><div class="grid">${anchors.map(l => `<a href="/locations/${l.slug}/"><b>${esc(l.city)}, ${l.state}</b>${esc(l.county)} — ${esc(l.region)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Every ${esc(st.name)} market</h2><div class="citylinks">${st.cities.map(l => `<a href="/locations/${l.slug}/">${esc(l.city)}, ${l.state} — ${esc(l.county)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Industries across ${esc(st.name)}</h2><div class="grid">${trades.map(t => `<a href="/trades/${t.slug}/${st.slug}/"><b>${esc(t.name)}</b>${esc(st.name)} ${esc(t.plural)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Other states</h2><div class="grid">${STATES.filter(x => x.code !== st.code).map(x => `<a href="/locations/${x.slug}/"><b>${esc(x.name)}</b>${x.cities.length} markets</a>`).join('')}</div></div></section>` +
      faqHTML(qs) + contactBand(`Want the free market brief for your ${st.name} town — who ranks, who's buying ads, and where the gap is?`),
    schema: [svcLD(`Marketing & Growth Systems in ${st.name}`, { '@type': 'State', name: st.name }, `/locations/${st.slug}/`, `Websites, SEO, AEO, ads, AI answering, and CRM for ${st.name} service businesses.`), faqLD(qs)],
  });
}
locations.forEach(loc => {
  const mates = clusterMates(loc);
  const inOR = loc.state === 'OR';
  const st = stateOf(loc.state);
  const mine = servicesFor(loc);
  const others = services.filter(s => !mine.some(x => x.slug === s.slug));
  let hubTitle = `Marketing & Growth Systems in ${loc.city}, ${loc.state} | ${BRAND}`;
  if (hubTitle.length > 60) hubTitle = `Marketing & Growth Systems — ${loc.city}, ${loc.state} | DB`;
  const whyAnswer = inOR
    ? `Because I live and operate here. I run my own real-estate business in Oregon, the core systems I sell run inside it daily, and I know what Oregon customers respond to — and what a booked job is actually worth.`
    : `I'm an Oregon operator serving ${loc.city} remotely — same systems, same speed, direct access to me by phone or text. The work is digital; the results show up on your phone.`;
  const hubFaq = [
    { q: `Do you serve all of ${loc.county}?`, a: `Yes — ${loc.city}, the surrounding ${loc.region}, and nearby communities like ${loc.nearby.join(', ')}. Systems are delivered remotely with direct phone/text access to me at ${PHONE}.` },
    { q: `Why hire an Oregon builder instead of a national agency?`, a: whyAnswer },
    { q: `Which system should a ${loc.city} business start with?`, a: `A site that ranks and something that answers every call. Ads and follow-up both leak through an unanswered phone, so those two come first — then SEO and AEO compound underneath them.` },
    { q: `What does it cost?`, a: `Flat, up-front pricing scoped to your goals. The strategy brief is free and specific to the ${loc.city} market — email ${EMAIL}.` },
  ];
  page({
    path: `/locations/${loc.slug}/`, title: hubTitle,
    desc: `Websites, SEO, AEO, ads, AI answering, and CRM for service businesses in ${loc.city}, ${loc.stateName} — ${loc.county} and the ${loc.region}.`,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Locations', url: '/locations/' }, { name: st.name, url: `/locations/${st.slug}/` }, { name: `${loc.city}, ${loc.state}`, url: `/locations/${loc.slug}/` }],
    h1: `${esc(loc.city)}, ${loc.state}: <span class="chrome">own your market.</span>`,
    lede: `Growth systems for service businesses in ${esc(loc.city)} and across ${esc(loc.county)} — including ${esc(loc.nearby.slice(0, 3).join(', '))}. Built by an Oregon operator.`,
    answer: `${BRAND} builds websites, local SEO, answer engine optimization, Google Ads, AI phone answering, and CRM systems for service businesses in ${loc.city}, ${loc.stateName} — covering ${loc.county} and nearby ${loc.nearby.slice(0, 3).join(', ')}. Flat pricing quoted up front, you own everything built. Call or text ${PHONE}.`,
    body: `<section><div class="wrap"><h2>The ${esc(loc.city)} market</h2><dl class="facts"><div><dt>County</dt><dd>${esc(loc.county)}</dd></div><div><dt>Region</dt><dd>${esc(capFirst(loc.region))}</dd></div><div><dt>Also serving</dt><dd>${esc(loc.nearby.slice(0, 3).join(', '))}</dd></div><div><dt>Market type</dt><dd>${loc.tier === 1 ? 'Anchor metro' : 'Regional market'}</dd></div></dl>
<p class="body-copy" style="margin-top:20px">${esc(sizeContext(loc))} ${esc(marketContext[loc.state](loc))}</p></div></section>
<section><div class="wrap"><h2>Systems available in ${esc(loc.city)}</h2><div class="grid">${mine.map(s => `<a href="/locations/${loc.slug}/${s.slug}/"><b>${esc(s.short)}</b>For ${esc(loc.city)} service businesses</a>`).join('')}${others.map(s => `<a href="/services/${s.slug}/"><b>${esc(s.short)}</b>${esc(s.desc.split(' — ')[0])}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Industries I build for in ${esc(loc.city)}</h2><div class="grid">${trades.map(t => `<a href="/trades/${t.slug}/${st.slug}/"><b>${esc(t.name)}</b>${esc(t.plural)} in the ${esc(loc.region)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>More markets</h2><div class="grid">${mates.map(n => `<a href="/locations/${n.slug}/"><b>${esc(n.city)}, ${n.state}</b>${esc(n.region)}</a>`).join('')}<a href="/locations/${st.slug}/"><b>All of ${esc(st.name)} →</b>${st.cities.length} markets</a></div></div></section>` +
      faqHTML(hubFaq) + contactBand(`Want the free ${loc.city} market brief — who ranks, who's buying ads, and where the gap is?`),
    schema: [svcLD(`Marketing & Growth Systems in ${loc.city}, ${loc.state}`, cityArea(loc), `/locations/${loc.slug}/`, `Websites, SEO, AEO, ads, AI answering, and CRM for ${loc.city} service businesses.`), faqLD(hubFaq)],
  });
  for (const s of mine) {
    const key = `${loc.slug}|${s.slug}`;
    const shownFaq = faqPoolCitySvc(s, loc);
    const rotatedTrades = trades.map((t, ti) => ({ t, r: (ti + hash(key)) % trades.length })).sort((a, b) => a.r - b.r).slice(0, 8).map(x => x.t);
    let title = `${s.short} in ${loc.city}, ${loc.state} | ${BRAND}`;
    if (title.length > 60) title = `${s.short} in ${loc.city}, ${loc.state} | DB`;
    page({
      path: `/locations/${loc.slug}/${s.slug}/`, title,
      desc: `${s.metaShort} — for ${loc.city}, ${loc.state} service businesses. Flat pricing, you own everything. Serving ${loc.county}.`,
      crumbs: [{ name: 'Home', url: '/' }, { name: 'Locations', url: '/locations/' }, { name: st.name, url: `/locations/${st.slug}/` }, { name: `${loc.city}, ${loc.state}`, url: `/locations/${loc.slug}/` }, { name: s.short, url: `/locations/${loc.slug}/${s.slug}/` }],
      h1: `${esc(s.short)} in <span class="chrome">${esc(loc.city)}, ${loc.state}.</span>`,
      lede: `${esc(capFirst(s.desc))} — for service businesses in ${esc(loc.city)}, ${esc(loc.nearby.slice(0, 2).join(', '))}, and across ${esc(loc.county)}.`,
      answer: cityServiceAnswer(s, loc),
      body: `<section><div class="wrap"><h2>Why it matters in ${esc(loc.city)}</h2><p class="body-copy">${esc(pick(whyLocalPool, key)(s, loc))}</p><p class="body-copy" style="margin-top:14px">${esc(localAngle[s.slug](loc))}</p><p class="body-copy" style="margin-top:14px">${esc(marketContext[loc.state](loc))}</p></div></section>
<section><div class="wrap"><h2>What's included</h2><ul class="feat">${s.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div></section>
<section><div class="wrap"><h2>${esc(loc.city)} service area</h2><dl class="facts"><div><dt>County</dt><dd>${esc(loc.county)}</dd></div><div><dt>Region</dt><dd>${esc(capFirst(loc.region))}</dd></div><div><dt>Nearby towns covered</dt><dd>${esc(loc.nearby.join(', '))}</dd></div><div><dt>Pricing</dt><dd>Flat, quoted up front</dd></div></dl></div></section>
<section><div class="wrap"><h2>${esc(loc.city)} industries this is built for</h2><div class="grid">${rotatedTrades.map(t => `<a href="/trades/${t.slug}/${st.slug}/"><b>${esc(t.name)}</b>${esc(s.short)} for ${esc(st.name)} ${esc(t.plural)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>More in ${esc(loc.city)} — and other markets</h2><div class="grid">${mine.filter(x => x.slug !== s.slug).slice(0, 5).map(x => `<a href="/locations/${loc.slug}/${x.slug}/"><b>${esc(x.short)}</b>${esc(x.short)} in ${esc(loc.city)}</a>`).join('')}${mates.filter(n => servicesFor(n).some(x => x.slug === s.slug)).map(n => `<a href="/locations/${n.slug}/${s.slug}/"><b>${esc(n.city)}, ${n.state}</b>${esc(s.short)} in ${esc(n.city)}</a>`).join('')}<a href="/locations/${loc.slug}/"><b>All ${esc(loc.city)} systems →</b>${esc(loc.county)}</a></div></div></section>` +
        faqHTML(shownFaq) + contactBand(`Want a free, specific brief on ${s.short} for your ${loc.city} business?`),
      schema: [svcLD(`${s.name} in ${loc.city}, ${loc.state}`, cityArea(loc), `/locations/${loc.slug}/${s.slug}/`, s.desc), faqLD(shownFaq)],
    });
  }
});

/* ---------- white-label SEO products ---------- */
const products = [
  { slug: 'managed-seo', name: 'Managed SEO', desc: 'a fully managed monthly SEO engine — research, on-page, content, and authority links — run under one accountable operator', del: ['Keyword & competitor research refreshed monthly', 'On-page fixes shipped, not just reported', 'Content written and published for you', 'Authority links built white-hat only', 'Plain-English monthly reporting tied to calls'] },
  { slug: 'link-building', name: 'Authority Link Building', desc: 'manual, white-hat backlinks from real sites that move rankings', del: ['Manual outreach to real publications', 'DR/DA-tiered placements to fit budget', 'Anchors planned against your keyword map', 'Full transparency: every URL reported', 'No PBNs, no spam, nothing that risks the domain'] },
  { slug: 'guest-posts', name: 'Guest Posts', desc: 'unique articles written and placed on relevant industry sites with links back to you', del: ['Real sites with real traffic, tiered by authority', 'Original articles written for the host site', 'In-content links to your money pages', 'Placement report with live URLs', 'Scales monthly with your budget'] },
  { slug: 'press-releases', name: 'Press Release Writing & Distribution', desc: 'professionally written announcements distributed through established newswire networks', del: ['Written by a newswire pro, edited and approved by me', 'Distribution through established newswire networks', 'Local media targeting for your market', 'Brand-search dominance for your company name', 'Live syndication report'] },
  { slug: 'local-citations', name: 'Local Citations & Listings', desc: 'your business name, address, and phone locked in across the directories that feed the map pack', del: ['Core + niche directory submissions', 'Duplicate cleanup and NAP consistency', 'Google Business Profile optimization', 'Data-aggregator syndication', 'Ongoing monitoring'] },
  { slug: 'blog-content', name: 'SEO Blog Content', desc: 'keyword-mapped articles written, optimized, and published every month', del: ['Topics mapped to real local searches', 'Written for homeowners, optimized for rankings', 'Internal links that lift money pages', 'Published straight to your site', 'Scales from 2 to 20 posts a month'] },
];
page({
  path: '/products/', title: `SEO Products — Links, Press, Citations, Content | ${BRAND}`,
  desc: `Productized SEO under the ${BRAND} brand: managed SEO, authority links, guest posts, press releases, local citations, and blog content. Flat pricing, quoted fast.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Products', url: '/products/' }],
  h1: `Productized SEO. <span class="chrome">No mystery meat.</span>`,
  lede: `The deliverables agencies quietly outsource and mark up — sourced direct, quality-checked by me, reported in plain English under one accountable brand.`,
  body: `<section><div class="wrap"><div class="grid">${products.map(p => `<a href="/products/${p.slug}/"><b>${esc(p.name)}</b>${esc(p.desc.split(' — ')[0])}</a>`).join('')}</div></div></section>` + contactBand(`Tell me your market and your goal — I'll tell you which products move it and quote flat prices.`),
});
for (const p of products) {
  page({
    path: `/products/${p.slug}/`, title: `${p.name} | ${BRAND}`,
    desc: `${p.name} by ${BRAND}: ${p.desc}. Flat pricing, fast turnaround, plain-English reporting.`,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Products', url: '/products/' }, { name: p.name, url: `/products/${p.slug}/` }],
    h1: `${esc(p.name)}<span class="chrome">, handled.</span>`,
    lede: `${esc(capFirst(p.desc))}. Ordered à la carte or folded into a managed plan.`,
    body: `<section><div class="wrap"><h2>What you get</h2><ul class="feat">${p.del.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div></section>
<section><div class="wrap"><h2>Pairs with</h2><div class="grid">${products.filter(x => x.slug !== p.slug).slice(0, 3).map(x => `<a href="/products/${x.slug}/"><b>${esc(x.name)}</b>${esc(x.desc.split(' — ')[0])}</a>`).join('')}<a href="/services/seo/"><b>Full SEO service →</b>The complete local search system</a></div></div></section>` +
      faqHTML([
        { q: `Who actually does the work?`, a: `A specialist fulfillment network, quality-checked and reported under one brand — mine. You get one name to call and one plain-English report.` },
        { q: `Is this safe, white-hat SEO?`, a: `Yes. Nothing that risks your domain — no PBNs, no spam networks, no shortcuts that turn into penalties.` },
        { q: `How is it priced?`, a: `Flat per-deliverable or monthly pricing, quoted up front. Email ${EMAIL} with your market and goals for a same-week quote.` },
      ]) + contactBand(`Want a flat quote on ${lc(p.name)}?`),
    schema: svcLD(p.name, 'United States', `/products/${p.slug}/`, p.desc),
  });
}

/* ---------- /answers/ — the AEO corpus. One question per page, answered directly
   at the top so an answer engine can lift it, expanded underneath for humans. ---------- */
const svcBySlug = Object.fromEntries(services.map(s => [s.slug, s]));
const catLabel = k => (answerCategories.find(c => c.key === k) || { label: k }).label;
page({
  path: '/answers/', title: `Answers — ${answers.length} Straight Answers for the Trades | ${BRAND}`,
  desc: `${answers.length} direct answers on local SEO, AEO and AI search, websites, ads, AI answering, reviews, and what marketing should cost a service business.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Answers', url: '/answers/' }],
  h1: `Straight answers. <span class="chrome">No lead magnet.</span>`,
  lede: `${answers.length} questions service-business owners actually ask — answered directly, with the parts most agencies leave out. Nothing gated, no email required.`,
  answer: `${answers.length} direct answers for service-business owners on local SEO, answer engine optimization, websites, Google Ads and Local Services Ads, AI phone answering, CRM and follow-up, reviews, and marketing budgets — written by ${BRAND}, an Oregon operator who builds these systems.`,
  body: `<section><div class="wrap">${toolbar('Search the questions…', answerCategories, answers.length, 'answers')}
<div id="filterRoot"><div class="qcards">${answers.map(a => `<a class="qcard" href="/answers/${a.slug}/" data-f="${a.cat}" data-k="${esc((a.q + ' ' + a.a.slice(0, 90)).toLowerCase())}"><span class="tp">${esc(catLabel(a.cat))}</span><h3>${esc(a.q)}</h3><p>${esc(a.a.slice(0, 130).replace(/\s\S*$/, ''))}…</p></a>`).join('')}</div></div></div></section>` + contactBand(`Question that isn't answered here? Ask it — you'll get a straight answer, not a discovery call.`) + filterJS(),
  schema: { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Answers', numberOfItems: answers.length, itemListElement: answers.map((a, i) => ({ '@type': 'ListItem', position: i + 1, name: a.q, url: `${SITE}/answers/${a.slug}/` })) },
});
for (const a of answers) {
  const svc = svcBySlug[a.svc];
  const sameCat = answers.filter(x => x.cat === a.cat && x.slug !== a.slug).slice(0, 6);
  const others = answers.filter(x => x.cat !== a.cat).slice(0, 4);
  const title = `${a.q} | ${BRAND}`.length > 62 ? a.q : `${a.q} | ${BRAND}`;
  page({
    path: `/answers/${a.slug}/`, title, longTitle: true,
    desc: a.a.length > 155 ? a.a.slice(0, 152).replace(/[,;\s]+\S*$/, '') + '…' : a.a,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Answers', url: '/answers/' }, { name: catLabel(a.cat), url: `/answers/#${a.cat}` }, { name: a.q, url: `/answers/${a.slug}/` }],
    h1: esc(a.q),
    lede: `${esc(catLabel(a.cat))} — answered straight, by an operator who builds these systems rather than an agency selling them.`,
    answer: a.a,
    body: `<section><div class="wrap"><h2>The longer version</h2>${a.body.map(p => `<p class="body-copy">${esc(p)}</p>`).join('')}</div></section>
<section><div class="wrap"><h2>If you want this handled</h2><div class="grid"><a href="/services/${svc.slug}/"><b>${esc(svc.name)}</b>${esc(svc.desc.split(' — ')[0])}</a><a href="/services/"><b>All ${services.length} services →</b>Grouped by the job they do</a><a href="/locations/"><b>${locations.length} markets →</b>${esc(MARKET_LINE)}</a></div></div></section>
<section><div class="wrap"><h2>More on ${esc(catLabel(a.cat).toLowerCase())}</h2><div class="grid">${sameCat.map(x => `<a href="/answers/${x.slug}/"><b>${esc(x.q)}</b>${esc(x.a.slice(0, 90).replace(/\s\S*$/, ''))}…</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Other questions</h2><div class="grid">${others.map(x => `<a href="/answers/${x.slug}/"><b>${esc(x.q)}</b>${esc(catLabel(x.cat))}</a>`).join('')}<a href="/answers/"><b>All ${answers.length} answers →</b>Searchable, filterable</a></div></div></section>` +
      contactBand(`Want this done for your business instead of explained?`),
    schema: {
      '@context': 'https://schema.org', '@type': 'QAPage',
      mainEntity: {
        '@type': 'Question', name: a.q, text: a.q, answerCount: 1,
        acceptedAnswer: { '@type': 'Answer', text: [a.a, ...a.body].join(' '), url: `${SITE}/answers/${a.slug}/`, author: { '@id': BUSINESS_ID } },
      },
    },
  });
}

/* ---------- /start/ — the offer page. Claims here must match /legal/website-terms/ exactly. ---------- */
const startFaq = [
  { q: `What exactly do I get for ${PRICE_NOW}?`, a: `A ${PAGE_MIN}+ page website: one page per service you offer, one per town you serve, plus hubs, about, contact, and FAQ. Built on your logo, colors, business name, phone, address, and license number. Schema markup, sitemap, robots.txt, and llms.txt included. You get the source code.` },
  { q: `Why is it ${PRICE_NOW} instead of ${PRICE_FULL}?`, a: `${PRICE_FULL} is the price when I invoice you. ${PRICE_NOW} applies when you check out immediately — no invoicing, no chasing payment, no back-and-forth. That genuinely costs me less to deliver, so I pass it on. Same build either way.` },
  { q: `How long does it take?`, a: `7 business days from payment and receipt of your information, whichever is later. If I already built a demo for you, it's usually the same or next business day.` },
  { q: `Do I own it?`, a: `Completely. The code, the content, the structure, the domain. It's yours to keep, move, edit, or hand to another developer. There's no license you keep paying to use your own site — read the <a href="/legal/website-terms/"><b>build agreement</b></a>.` },
  { q: `Will this get me to #1 on Google?`, a: `Nobody can promise that — not me, not an agency charging ten times as much. What I guarantee is the build: the pages, the structure, and the technical work to spec. Rankings depend on your market, your competition, and search engines that change the rules without asking.` },
  { q: `What if I need changes?`, a: `One round of revisions is included, requested within 14 days. Wrong phone number, a service you don't offer, a town you don't serve, wording you'd say differently — send it all in one list.` },
  { q: `What if I don't have a logo or photos?`, a: `The site gets built either way. Send whatever you have — even the original file from whoever made your logo. Twenty photos off your phone of finished jobs beat anything else that could go on the page, and crooked ones are fine.` },
  { q: `What's your refund policy?`, a: `Before I've started building: full refund, no questions. Once the site is delivered you own it and the fee is non-refundable. If I fail to deliver what's described here, you get your money back.` },
];
page({
  path: '/start/', title: `Get the ${PAGE_MIN}-Page Site — ${PRICE_NOW} | ${BRAND}`,
  desc: `A ${PAGE_MIN}+ page SEO and AEO website for your service business. ${PRICE_FULL} invoiced, ${PRICE_NOW} if you check out now. Delivered in 7 business days. You own everything.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Start', url: '/start/' }],
  h1: `${PAGE_MIN}+ pages. 7 days. <span class="chrome">You own it.</span>`,
  lede: `One page for every service you sell and every town you serve — built on your brand, engineered to rank, and readable by the AI assistants your customers now ask first.`,
  answer: `${BRAND} builds ${PAGE_MIN}+ page SEO and AEO websites for service businesses for ${PRICE_FULL}, or ${PRICE_NOW} when you check out immediately. Delivered in 7 business days, including schema markup, sitemap, and llms.txt. The client owns the domain, source code, and content outright. Call or text ${PHONE}.`,
  noOffer: true,
  body: `<section><div class="wrap"><h2>The price</h2><div class="tiers">
<div class="tier"><h3>Invoiced</h3><div class="amt">${PRICE_FULL}</div><p>I send an invoice, you pay it, I build. Same site, same spec, same 7-day delivery.</p><a class="btn ghost" href="mailto:${EMAIL}?subject=${encodeURIComponent('Invoice me for the site build')}">Ask for an invoice →</a></div>
<div class="tier hi"><h3>Check out now</h3><div class="amt">${PRICE_NOW}</div><p>No invoicing, no chasing payment, no back-and-forth — which costs me less to deliver, so I pass it on. Build starts today.</p><a class="btn" href="${STRIPE_500}">Check out — ${PRICE_NOW} →</a></div>
</div><p class="body-copy" style="margin-top:18px">Both prices buy the identical build. Terms are in the <a href="/legal/website-terms/" style="color:var(--silver);text-decoration:underline">website build agreement</a> — read it before you pay, it's in plain English.</p></div></section>

<section><div class="wrap"><h2>What you get</h2><ul class="feat">
<li>A page for <b>every service you offer</b> — the ones you want more of, not a single "Services" list</li>
<li>A page for <b>every town you serve</b>, built around that town's county and neighbors</li>
<li>Your <b>logo, colors, business name, phone, address, and license number</b> throughout</li>
<li><b>SEO setup:</b> schema markup, canonicals, internal linking, sitemap, unique titles and meta descriptions</li>
<li><b>AEO setup:</b> direct-answer blocks, FAQ schema, llms.txt, AI-crawler access — so ChatGPT, Gemini, and Google's AI can quote you correctly</li>
<li>Mobile-responsive layout, accessibility basics, and a static build with <b>no plugins to break</b></li>
<li>Deployment to hosting and the steps to point your domain at it</li>
<li><b>The full source code, handed to you</b></li>
</ul></div></section>

<section><div class="wrap"><h2>How it goes</h2><div class="steps">
<div class="step"><span class="n">01</span><div><h3>You check out</h3><p>Payment confirms the build. You get a Stripe receipt and an email from me the same day.</p></div></div>
<div class="step"><span class="n">02</span><div><h3>You send six things</h3><p>Your <b>logo</b>, <b>photos of finished jobs</b>, the <b>services you actually offer</b>, the <b>towns you actually serve</b>, your <b>license number and hours</b>, and your <b>domain</b> (or tell me you need one).</p></div></div>
<div class="step"><span class="n">03</span><div><h3>I build it — 7 business days</h3><p>Same or next business day if I already built you a demo. You get a link, not a status meeting.</p></div></div>
<div class="step"><span class="n">04</span><div><h3>You review it</h3><p><b>One round of revisions</b>, within 14 days. Wrong number, wrong town, wording you'd change — one list, handled.</p></div></div>
<div class="step"><span class="n">05</span><div><h3>It goes live and it's yours</h3><p>I point your domain at it, set up HTTPS, submit it to Google Search Console, and hand you the source code. <b>Nothing to keep paying me for.</b></p></div></div>
</div></div></section>

<section><div class="wrap"><h2>What's not included</h2><ul class="feat">
<li>Your domain registration or renewal fees — you buy and own the domain</li>
<li>Ongoing SEO, content, link building, or ads management — separate services, quoted separately</li>
<li>Professional photography, logo design, or copywriting beyond the generated pages</li>
<li>E-commerce, booking systems, CRM, or custom applications — separate scope</li>
<li>Third-party subscriptions (CRM, phone systems, email platforms)</li>
</ul><p class="body-copy" style="margin-top:16px"><b>You're responsible for the accuracy of your business information</b> — licenses, insurance, guarantees, years in business. I build what you tell me is true. If you're not sure a claim is accurate, leave it off.</p></div></section>

<section><div class="wrap"><h2>Want to see one first?</h2><p class="body-copy">Fair. Every industry page on this site shows the systems, and the <a href="/#builds" style="color:var(--silver);text-decoration:underline">builds section</a> links live sites. Or call me and I'll walk you through one for a business in your trade — ${PHONE}.</p><div class="grid" style="margin-top:20px"><a href="/trades/"><b>All ${trades.length} industries</b>Systems by trade</a><a href="/locations/"><b>${locations.length} markets</b>${esc(MARKET_LINE)}</a><a href="/answers/"><b>${answers.length} straight answers</b>What this costs, what works, what doesn't</a></div></div></section>` +
    faqHTML(startFaq) +
    `<section><div class="wrap"><div class="contact-band"><h2>Ready?</h2><p>Check out and the build starts today. Not ready — call or text <b>${PHONE}</b> and ask me anything. You get me, not a sales team.</p><div class="cta-row"><a class="btn" href="${STRIPE_500}">Check out — ${PRICE_NOW} →</a><a class="btn ghost" href="tel:${PHONE_TEL}">Call/Text ${PHONE}</a><a class="btn ghost" href="mailto:${EMAIL}">Email Derik</a></div></div></div></section>`,
  schema: [{
    '@context': 'https://schema.org', '@type': 'Product',
    name: `${PAGE_MIN}+ Page SEO & AEO Website Build`, brand: { '@id': BUSINESS_ID },
    description: `A ${PAGE_MIN}+ page website for a service business: a page per service and per town served, with schema markup, sitemap, and llms.txt. Delivered in 7 business days. Client owns the source code.`,
    offers: [
      { '@type': 'Offer', price: '500', priceCurrency: 'USD', name: 'Check out now', url: `${SITE}/start/`, availability: 'https://schema.org/InStock', seller: { '@id': BUSINESS_ID } },
      { '@type': 'Offer', price: '999', priceCurrency: 'USD', name: 'Invoiced', url: `${SITE}/start/`, availability: 'https://schema.org/InStock', seller: { '@id': BUSINESS_ID } },
    ],
  }, faqLD(startFaq)],
});

/* ---------- HTML sitemap — the "more intuitive" backstop for humans and crawlers ---------- */
page({
  path: '/sitemap/', title: `Sitemap — Every Page | ${BRAND}`,
  desc: `Every page on derikbannister.com: ${services.length} services, ${trades.length} industries, ${locations.length} markets, ${answers.length} answers, and the products, legal, and company pages.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Sitemap', url: '/sitemap/' }],
  h1: `Everything, <span class="chrome">on one page.</span>`,
  lede: `The whole site in one list — ${services.length} services, ${trades.length} industries, ${locations.length} markets, ${answers.length} answers. The XML version lives at <a href="/sitemap.xml" style="color:var(--silver);text-decoration:underline">sitemap.xml</a>.`,
  noCta: true,
  body: `<section><div class="wrap"><h2>Services</h2><div class="smap">${services.map(s => `<a href="/services/${s.slug}/">${esc(s.name)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Industries</h2><div class="smap">${trades.map(t => `<a href="/trades/${t.slug}/">${esc(t.name)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Industries by state</h2><div class="smap">${STATES.map(st => `<h3>${esc(st.name)}</h3>${trades.map(t => `<a href="/trades/${t.slug}/${st.slug}/">${esc(t.name)} — ${esc(st.name)}</a>`).join('')}`).join('')}</div></div></section>
<section><div class="wrap"><h2>Markets</h2><div class="smap">${STATES.map(st => `<h3>${esc(st.name)} (${st.cities.length})</h3>${st.cities.map(l => `<a href="/locations/${l.slug}/">${esc(l.city)}, ${l.state}</a>`).join('')}`).join('')}</div></div></section>
<section><div class="wrap"><h2>Answers</h2><div class="smap">${answerCategories.map(c => { const list = answers.filter(a => a.cat === c.key); return !list.length ? '' : `<h3>${esc(c.label)}</h3>${list.map(a => `<a href="/answers/${a.slug}/">${esc(a.q)}</a>`).join('')}`; }).join('')}</div></div></section>
<section><div class="wrap"><h2>Company</h2><div class="smap"><a href="/">Home</a><a href="/about/">About</a><a href="/products/">SEO Products</a><a href="/ideas/">Ideas Board</a><a href="/world/">The World (scroll film)</a><a href="/legal/">Legal</a><a href="/legal/terms/">Terms of Use</a><a href="/legal/privacy/">Privacy Policy</a><a href="/legal/website-terms/">Website Build Agreement</a><a href="/legal/do-not-sell/">Do Not Sell or Share</a><a href="/legal/accessibility/">Accessibility</a><a href="/legal/disclaimer/">Disclaimer</a></div></div></section>`,
});

/* ---------- about (E-E-A-T anchor; facts limited to confirmed) ---------- */
page({
  path: '/about/', title: `About Derik Bannister — Operator & Founder`,
  desc: `Derik Bannister: Oregon real-estate agent, co-founder of REoperative.ai, and builder of websites, software, and growth systems for service businesses.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'About', url: '/about/' }],
  h1: `The operator behind <span class="chrome">the systems.</span>`,
  lede: `I'm Derik Bannister — an Oregon operator, not an agency. I sell real estate at The Operative Group, co-founded REoperative.ai, and build growth systems for service businesses across the Northwest.`,
  body: `<section><div class="wrap"><h2>Why that matters to you</h2><p class="body-copy">Everything on this site comes from operating, not theorizing. The CRM, the AI answering, the follow-up automation, the search strategy — the core stack runs inside my own real-estate business on live deals and real phones before any of it is offered to yours. When something doesn't book revenue, I feel it before you would.</p><p class="body-copy">That also means you deal with me. No account managers, no hand-offs, no ticket queues — email <b>${EMAIL}</b> or text <b>${PHONE}</b> and the person who answers is the person doing the work.</p></div></section>
<section><div class="wrap"><h2>The work</h2><div class="grid"><a href="https://www.reoperative.ai" target="_blank" rel="noopener"><b>REoperative.ai</b>Co-founder — operating system for real-estate teams</a><a href="/"><b>The Operative Group</b>Real-estate agent — Oregon</a><a href="/#builds"><b>Recent builds</b>Sites shipped for local businesses</a></div></div></section>` + contactBand(`Want to talk to the person who'd actually build it?`),
  schema: { '@context': 'https://schema.org', '@type': 'Person', name: BRAND, email: EMAIL, telephone: PHONE_TEL, url: `${SITE}/about/`, jobTitle: 'Operator & Founder', worksFor: { '@id': BUSINESS_ID }, address: { '@type': 'PostalAddress', addressRegion: 'OR', addressCountry: 'US' } },
});

/* ---------- ideas board (filterable, from data/ideas.json) ---------- */
const ideas = JSON.parse(readFileSync(join(ROOT, 'data/ideas.json'), 'utf8'));
const IDEA_TYPES = [
  { key: 'ai', label: 'AI' }, { key: 'agentic', label: 'Agentic AI' }, { key: 'automation', label: 'Automation' },
  { key: 'marketing', label: 'Marketing' }, { key: 'software', label: 'Software' }, { key: 'growth', label: 'Growth' }, { key: 'ops', label: 'Ops' },
];
const tradeName = Object.fromEntries(trades.map(t => [t.slug, t.name]));
const ideaFor = list => list.includes('all') ? 'EVERY TRADE' : list.slice(0, 3).map(s => tradeName[s] || s).join(' · ').toUpperCase() + (list.length > 3 ? ` +${list.length - 3}` : '');
page({
  path: '/ideas/', title: `${ideas.length} Build Ideas for the Trades | ${BRAND}`,
  desc: `${ideas.length} concrete systems worth building for roofing, HVAC, plumbing, electrical, and 14 more trades — AI, agentic AI, automation, marketing, and software. Filterable by industry.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Ideas', url: '/ideas/' }],
  h1: `Things I've already <span class="chrome">thought of for you.</span>`,
  lede: `${ideas.length} systems I'd build for the trades, free to take. Filter to your industry, steal anything on the board — or hand me one and I'll have it booking revenue while your competitors are still "circling back."`,
  noCta: true,
  body: `<section><div class="wrap">
<div class="chips" id="tradeChips"><span class="lab">Industry</span><button class="chip on" data-f="all">All trades</button>${trades.map(t => `<button class="chip" data-f="${t.slug}">${esc(t.name)}</button>`).join('')}</div>
<div class="chips" id="typeChips"><span class="lab">Type</span><button class="chip on" data-f="all">Everything</button>${IDEA_TYPES.map(t => `<button class="chip" data-f="${t.key}">${esc(t.label)}</button>`).join('')}</div>
<p class="idea-count" aria-live="polite"><b id="ideaN">${ideas.length}</b> IDEAS ON THE BOARD</p>
<div class="ideas" id="ideaGrid">${ideas.map(i => `<div class="idea" data-trades="${i.trades.join(' ')}" data-type="${i.type}"><span class="tp">${esc((IDEA_TYPES.find(t => t.key === i.type) || { label: i.type }).label)}</span><h3>${esc(i.title)}</h3><p>${esc(i.desc)}</p><span class="for">FOR: ${esc(ideaFor(i.trades))}</span></div>`).join('')}</div>
</div></section>` + contactBand(`See one your shop needs? Tell me which — flat quote, fast ship.`) + `
<script>(()=>{
let trade='all',type='all';
const cards=[...document.querySelectorAll('.idea')],n=document.getElementById('ideaN');
const apply=()=>{let c=0;cards.forEach(k=>{const ts=k.dataset.trades.split(' ');const okT=trade==='all'||ts.includes('all')||ts.includes(trade);const okY=type==='all'||k.dataset.type===type;k.classList.toggle('hide',!(okT&&okY));if(okT&&okY)c++;});n.textContent=c;};
const wire=(id,set)=>{const box=document.getElementById(id);box.addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;box.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');set(b.dataset.f);apply();});};
wire('tradeChips',v=>trade=v);wire('typeChips',v=>type=v);
})();</script>`,
});

/* ---------- legal pages (templates — not legal advice; have counsel review) ---------- */
const LEGAL_DATE = 'July 30, 2026';
const legalPages = [
  { slug: 'terms', name: 'Terms of Use', blurb: 'The rules for using this website' },
  { slug: 'privacy', name: 'Privacy Policy', blurb: 'What this site collects (very little) and how it’s handled' },
  { slug: 'do-not-sell', name: 'Do Not Sell or Share My Personal Information', blurb: 'Your opt-out rights — and why there’s nothing to opt out of' },
  { slug: 'accessibility', name: 'Accessibility', blurb: 'The standard this site is built to and how to report barriers' },
  { slug: 'disclaimer', name: 'Disclaimer', blurb: 'What the numbers and examples on this site do and don’t promise' },
];
const lp = (t) => `<p class="body-copy">${t}</p>`;
const lsec = (h, ...ps) => `<section><div class="wrap"><h2>${h}</h2>${ps.join('')}</div></section>`;
const legalCrumb = (name, slug) => [{ name: 'Home', url: '/' }, { name: 'Legal', url: '/legal/' }, { name, url: `/legal/${slug}/` }];

page({
  path: '/legal/', title: `Legal | ${BRAND}`,
  desc: `The policies that govern derikbannister.com: terms of use, privacy policy, data opt-out rights, accessibility statement, and disclaimer.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Legal', url: '/legal/' }],
  h1: `The fine print, <span class="chrome">in plain English.</span>`,
  lede: `Straight policies for a straight operation. Each one is short, readable, and current as of ${LEGAL_DATE}.`,
  body: `<section><div class="wrap"><div class="grid">${legalPages.map(l => `<a href="/legal/${l.slug}/"><b>${esc(l.name)}</b>${esc(l.blurb)}</a>`).join('')}</div></div></section>`,
  noCta: true,
});

page({
  path: '/legal/terms/', title: `Terms of Use | ${BRAND}`,
  desc: `Terms of use for derikbannister.com — permitted use, intellectual property, disclaimers, limitation of liability, and Oregon governing law.`,
  crumbs: legalCrumb('Terms of Use', 'terms'),
  h1: `Terms of <span class="chrome">use.</span>`,
  lede: `Effective ${LEGAL_DATE}. By using derikbannister.com (the &ldquo;Site&rdquo;), you agree to these terms. If you don't agree, don't use the Site.`,
  noCta: true,
  body:
    lsec(`Who I am`, lp(`The Site is operated by ${BRAND}, an individual doing business from Oregon, USA (&ldquo;I,&rdquo; &ldquo;me,&rdquo; &ldquo;my&rdquo;). Contact: <b>${EMAIL}</b> or <b>${PHONE}</b>.`)) +
    lsec(`What the Site is`, lp(`The Site is an informational showcase of services and past work. Nothing on it is an offer that binds me until we both sign a written agreement or I confirm a scope and price in writing.`), lp(`If you engage me for services, that engagement is governed by its own written agreement or quoted scope. If those terms conflict with these, the engagement terms win for that work. These Terms govern the Site itself.`)) +
    lsec(`Intellectual property`, lp(`The Site's design, text, code, and branding are mine. You may browse, link to, and share the Site; you may not copy, scrape at scale, republish, or use its content to build a competing offering without written permission. Search engines and AI assistants may index the Site as described in robots.txt and llms.txt.`), lp(`Client sites shown in the &ldquo;Builds&rdquo; section belong to their respective owners and appear as portfolio references. All third-party names and trademarks belong to their owners; no affiliation or endorsement is implied.`)) +
    lsec(`Acceptable use`, lp(`Don't use the Site to break the law, probe or disrupt its hosting, misrepresent your identity to me, or harvest information about others. I may restrict access to anyone abusing the Site.`)) +
    lsec(`No professional advice`, lp(`Content on the Site is general information about marketing, software, and business systems. It is not legal, financial, tax, or other professional advice, and it isn't advice tailored to your situation until you hire me and we scope it.`)) +
    lsec(`No guaranteed results`, lp(`Examples, portfolio pieces, interface mock-ups, and figures on the Site are illustrative. Marketing and software outcomes depend on your market, budget, competition, and execution. I don't guarantee rankings, lead volume, or revenue — anyone who does is lying to you. See the <a href="/legal/disclaimer/"><b>Disclaimer</b></a>.`)) +
    lsec(`The Site is provided &ldquo;as is&rdquo;`, lp(`To the fullest extent permitted by law, the Site is provided without warranties of any kind, express or implied — including merchantability, fitness for a particular purpose, and non-infringement. I don't promise the Site will be uninterrupted, error-free, or secure.`)) +
    lsec(`Limitation of liability`, lp(`To the fullest extent permitted by law, I am not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the Site. My total liability for any claim relating to the Site is capped at $100. Some jurisdictions don't allow certain limits, so parts of this may not apply to you.`)) +
    lsec(`Indemnification`, lp(`You agree to defend and hold me harmless from claims arising out of your misuse of the Site or violation of these Terms.`)) +
    lsec(`Third-party links`, lp(`The Site links to sites I don't control (including portfolio sites). I'm not responsible for their content or practices.`)) +
    lsec(`Governing law`, lp(`These Terms are governed by the laws of the State of Oregon, USA, without regard to conflict-of-law rules. Disputes belong exclusively in the state or federal courts serving Lane County, Oregon, and you consent to that venue.`)) +
    lsec(`Changes & housekeeping`, lp(`I may update these Terms by posting a revised version with a new effective date — continued use means acceptance. If any part is held unenforceable, the rest stands. These Terms plus the <a href="/legal/privacy/"><b>Privacy Policy</b></a> are the whole agreement about Site use.`), lp(`Questions: <b>${EMAIL}</b>.`)),
});

page({
  path: '/legal/privacy/', title: `Privacy Policy | ${BRAND}`,
  desc: `Privacy policy for derikbannister.com: no accounts, no ad trackers, no analytics cookies. What little is collected, how it's used, and your rights.`,
  crumbs: legalCrumb('Privacy Policy', 'privacy'),
  h1: `Privacy <span class="chrome">policy.</span>`,
  lede: `Effective ${LEGAL_DATE}. Short version: this is a static website with one contact form. No accounts, no ad trackers, no analytics cookies — and I don't sell personal information. Ever.`,
  noCta: true,
  body:
    lsec(`Who is responsible`, lp(`${BRAND}, Oregon, USA. Contact: <b>${EMAIL}</b> or <b>${PHONE}</b>. This policy covers derikbannister.com only — portfolio sites linked from here have their own policies.`)) +
    lsec(`What this Site collects`, `<ul class="feat"><li><b>What you send me.</b> If you email, call, or text, I receive what you choose to share — your address or number and the content of the message.</li><li><b>The contact form.</b> If you submit it, I receive the name, phone number, and any business name, email address, or message you enter. The form also records which page you submitted it from, so I know what you were reading when you reached out. It's used to respond to you and scope work — nothing else, and it is never sold or shared for advertising.</li><li><b>Hosting logs.</b> The Site is served by GitHub Pages. GitHub may log visitor IP addresses for security and abuse prevention under its own privacy policy.</li><li><b>Fonts.</b> Typefaces load from Google Fonts. When they load, your browser discloses your IP address to Google under Google's privacy policy.</li><li><b>One local flag.</b> The Site stores a single value ("db-booted") in your browser's sessionStorage so the intro animation plays once per visit. It never leaves your device and is deleted when you close the tab. No tracking cookies are set by this Site.</li></ul>`) +
    lsec(`How your information is used`, lp(`To respond to you, scope and deliver services you ask about, keep normal business records, and meet legal obligations. That's it. No ad targeting, no lookalike audiences, no data brokers.`)) +
    lsec(`Calls & texts`, lp(`If you text or call, replies come from me and only about what you raised. Message and data rates may apply through your carrier. Reply STOP to end texts at any time.`)) +
    lsec(`Sharing`, lp(`I do not sell personal information and do not share it for cross-context behavioral advertising. Information passes only through the service providers needed to run things: GitHub (hosting), Google (fonts), and email/phone carriers — each under their own terms. I may disclose information if the law genuinely requires it.`)) +
    lsec(`Retention`, lp(`Correspondence is kept as long as it's useful for the business relationship or required for legal and accounting purposes, then deleted.`)) +
    lsec(`Your rights`, lp(`Depending on where you live — including under the Oregon Consumer Privacy Act, the California Consumer Privacy Act as amended, and similar laws — you may have rights to access, correct, delete, or receive a copy of your personal information, and to opt out of sales or targeted advertising (nothing to opt out of here, but the right is yours). Email <b>${EMAIL}</b> with the subject &ldquo;Privacy request&rdquo; and I'll respond within 45 days. I'll never treat you worse for exercising your rights. California residents: see <a href="/legal/do-not-sell/"><b>Do Not Sell or Share My Personal Information</b></a>.`)) +
    lsec(`Global Privacy Control`, lp(`The Site sets no trackers, so a GPC signal has nothing to switch off — you're already at the setting GPC asks for.`)) +
    lsec(`Children`, lp(`The Site is a business site not directed to children under 13, and I don't knowingly collect their information. If you believe a child sent me personal information, email me and I'll delete it.`)) +
    lsec(`Security & where data lives`, lp(`Correspondence lives in standard commercial email and phone services with reasonable safeguards. Processing happens in the United States. No transmission or storage method is 100% secure.`)) +
    lsec(`Changes`, lp(`Updates get posted here with a new effective date. Material changes will be obvious. Questions: <b>${EMAIL}</b>.`)),
});

page({
  path: '/legal/do-not-sell/', title: `Do Not Sell or Share My Personal Information | ${BRAND}`,
  desc: `derikbannister.com does not sell personal information or share it for cross-context behavioral advertising. How to submit a privacy opt-out request anyway.`,
  crumbs: legalCrumb('Do Not Sell or Share', 'do-not-sell'),
  h1: `Do not sell or share <span class="chrome">my personal information.</span>`,
  lede: `Effective ${LEGAL_DATE}. The short answer: I don't sell your data, I don't share it for behavioral advertising, and I never have. This page exists so that promise is on the record — and so you can hold me to it.`,
  noCta: true,
  body:
    lsec(`The commitment`, lp(`As the terms are defined in the California Consumer Privacy Act (as amended by the CPRA) and similar state laws: this Site has not sold personal information and has not shared it for cross-context behavioral advertising in the preceding 12 months, and does not do so today. There are no third-party advertising trackers, pixels, or analytics cookies on this Site at all.`)) +
    lsec(`Global Privacy Control`, lp(`Browsers sending a Global Privacy Control signal are already fully honored — with no tracking and no data sales, the Site is permanently in the state GPC requests.`)) +
    lsec(`Submitting a request anyway`, lp(`If you'd still like a formal response — or want to exercise access, deletion, or correction rights — email <b>${EMAIL}</b> with the subject &ldquo;Privacy request.&rdquo; Include what right you're exercising and the email address or phone number you've used to contact me, so I can find any correspondence. I'll verify the request against that correspondence and respond within 45 days.`), lp(`You may use an authorized agent; I'll ask for proof you authorized them. You will never receive worse service or pricing for exercising a privacy right.`)) +
    lsec(`Everything else`, lp(`The full picture of what this Site collects (very little) is in the <a href="/legal/privacy/"><b>Privacy Policy</b></a>.`)),
});

page({
  path: '/legal/accessibility/', title: `Accessibility | ${BRAND}`,
  desc: `Accessibility statement for derikbannister.com: WCAG 2.1 AA target, reduced-motion support, semantic markup, and how to report a barrier.`,
  crumbs: legalCrumb('Accessibility', 'accessibility'),
  h1: `Built for <span class="chrome">everyone.</span>`,
  lede: `Updated ${LEGAL_DATE}. I want every visitor to be able to read, navigate, and contact me here — and when something falls short, I want to hear about it and fix it fast.`,
  noCta: true,
  body:
    lsec(`The standard`, lp(`This Site targets Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. It's a hand-built static site, which means accessibility issues are mine to fix directly — no platform or plugin in the way.`)) +
    lsec(`What's implemented`, `<ul class="feat"><li>Semantic HTML with a logical heading structure and one H1 per page</li><li>Reduced-motion support: every animation and scroll effect is disabled when your system sets &ldquo;prefers reduced motion&rdquo;</li><li>High-contrast monochrome palette designed to hold up for low-vision readers</li><li>Text alternatives on meaningful images; decorative graphics hidden from screen readers</li><li>Keyboard-navigable links and controls; no keyboard traps; no time-limited content</li><li>Responsive layout that supports zoom to 200% and small screens without horizontal scrolling</li><li>Descriptive link text and ARIA labels on navigation landmarks</li></ul>`) +
    lsec(`Known limitations`, lp(`The homepage leans on motion design; if an effect bothers you, enabling your operating system's reduced-motion setting turns all of it off. Portfolio sites linked from here are separate properties and may not meet the same standard.`)) +
    lsec(`Found a barrier?`, lp(`Tell me and I'll fix it: <b>${EMAIL}</b> or call/text <b>${PHONE}</b>. Include the page and what went wrong. I aim to respond within two business days.`)),
});

page({
  path: '/legal/disclaimer/', title: `Disclaimer | ${BRAND}`,
  desc: `Disclaimer for derikbannister.com: illustrative figures, portfolio references, no earnings guarantees, and no professional advice.`,
  crumbs: legalCrumb('Disclaimer', 'disclaimer'),
  h1: `What this site <span class="chrome">does and doesn't promise.</span>`,
  lede: `Effective ${LEGAL_DATE}. I'd rather under-promise here and over-deliver in the work. So let's be precise about what the words and numbers on this Site mean.`,
  noCta: true,
  body:
    lsec(`Illustrative figures`, lp(`Interface mock-ups, sample metrics, and growth figures shown on this Site (for example, the animated dashboard graphics on the homepage) are illustrations of the kind of systems I build — not measurements from a specific client engagement unless expressly labeled as such.`)) +
    lsec(`No earnings or results guarantee`, lp(`Marketing, SEO, advertising, and software outcomes depend on your market, competition, budget, follow-through, and factors nobody controls (including search engines changing the rules). Nothing on this Site guarantees rankings, lead volume, revenue, or any specific result. Past work shown is not a promise of future performance.`)) +
    lsec(`Portfolio references`, lp(`Sites in the &ldquo;Builds&rdquo; section are real projects shown as examples of work. They belong to their owners, and their presence doesn't imply those businesses endorse anything on this Site.`)) +
    lsec(`Not professional advice`, lp(`Content here is general business information — not legal, financial, tax, or investment advice. Decisions you make from reading this Site are your own; for advice on your specific situation, hire the appropriate professional (for services I offer, that can be me — scoped and in writing).`)) +
    lsec(`Third parties`, lp(`All third-party trademarks, product names, and logos belong to their owners. Links to external sites don't mean I control or vouch for them.`)) +
    lsec(`Questions`, lp(`If any of this is unclear, ask before you rely on it: <b>${EMAIL}</b>.`)),
});

/* ---------- website build agreement (linked from Stripe checkout) ---------- */
page({
  path: '/legal/website-terms/', title: `Website Build Agreement | ${BRAND}`,
  desc: `The terms for the 250+ page website build: scope, what's included, ownership, timeline, revisions, refunds, and the honest limits on SEO results.`,
  crumbs: legalCrumb('Website Build Agreement', 'website-terms'),
  h1: `Website build <span class="chrome">agreement.</span>`,
  lede: `Effective ${LEGAL_DATE}. Plain English, because you should know exactly what you're buying before you pay. Purchasing the build means you agree to this.`,
  noCta: true,
  body:
    lsec(`What you're buying`, lp(`A programmatically generated website of <b>250 or more pages</b> for your business: a page for each service you offer, a page for each town you serve, plus hubs, an about page, a contact page, and an FAQ section. Every page ships with structured data (schema.org), unique titles and meta descriptions, a sitemap, robots.txt, and an llms.txt file so AI answer engines can read your business correctly. The site is static — fast, no plugins, nothing to break.`)) +
    lsec(`What's included`, `<ul class="feat"><li>The complete page build, using your logo, colors, business name, phone, address, license number, services, and service areas</li><li>SEO setup: schema, canonicals, internal linking, sitemap, meta data</li><li>AEO setup: FAQ blocks, direct-answer sections, llms.txt, AI-crawler permissions</li><li>Mobile-responsive layout and accessibility basics</li><li>One round of revisions within 14 days of delivery</li><li>Deployment to hosting, and the setup steps to point your domain at it</li><li>The full source code, handed to you</li></ul>`) +
    lsec(`What's not included`, `<ul class="feat"><li>Your domain name registration or renewal fees (you buy and own the domain)</li><li>Ongoing hosting costs beyond initial deployment, if you outgrow free static hosting</li><li>Ongoing SEO work, content updates, link building, or ads management — those are separate services</li><li>Professional photography, logo design, or copywriting beyond the generated pages</li><li>E-commerce, booking systems, CRM, or custom applications — separate scope, quoted separately</li><li>Third-party subscriptions (CRM, phone systems, email platforms)</li></ul>`) +
    lsec(`What I need from you`, lp(`To build it I need: your logo file, your correct business name, phone, address, and license number, the list of services you actually offer, and the towns you actually serve. If you have project photos, send them — real photos of your work beat anything else on the page.`) + lp(`<b>You are responsible for the accuracy of your business information</b> — licenses, certifications, insurance, guarantees, years in business, and any claim about your work. I build what you tell me is true. If you're not sure a claim is accurate, leave it off.`)) +
    lsec(`Timeline`, lp(`The build is delivered within <b>7 business days</b> of payment and receipt of the information above, whichever is later. If a demo site was already built for you, it's typically the same or next business day.`) + lp(`Revisions are one round, requested within 14 days of delivery. Reasonable corrections — wrong phone number, a service you don't offer, a town you don't serve, wording you want changed. It doesn't include a redesign or a change of scope.`)) +
    lsec(`Ownership — you own it`, lp(`On payment, <b>you own the website</b>: the code, the content, the structure, all of it. It's yours to keep, move, edit, or hand to another developer. I don't hold your domain, your content, or your hosting hostage, and there's no license you have to keep paying to use your own site.`) + lp(`I keep the right to describe the work and show the site as an example in my portfolio. If you'd rather I didn't, say so and I won't.`)) +
    lsec(`No ranking or revenue guarantee`, lp(`This is the important one. <b>Nobody can guarantee search rankings, AI citations, lead volume, or revenue</b> — not me, not an agency charging ten times as much. Results depend on your market, your competition, your follow-through, and search engines that change their rules without asking. What I guarantee is the build: the pages, the structure, and the technical work, done to the spec above. If anyone promises you a #1 ranking, they're either guessing or lying.`)) +
    lsec(`Refunds`, lp(`Before I've started building: full refund, no questions, just email me. Once the site is built and delivered, the work is done and the fee is non-refundable — you've received the deliverable and you own it. If I fail to deliver what's described here, you get your money back.`)) +
    lsec(`Pricing`, lp(`The build is <b>$999</b>. The <b>$500</b> price applies when you check out immediately — paying up front means no invoicing, no chasing payment, and no back-and-forth, which genuinely costs me less to deliver, so I pass that on. Both prices are for the same build.`)) +
    lsec(`Support after delivery`, lp(`The site is static, so there's nothing that breaks on its own — no plugins to update, no database to corrupt. After the revision window, changes and additions are quoted separately, and ongoing services (SEO, ads, CRM, AI answering) are separate engagements you're free to take or leave.`)) +
    lsec(`Liability`, lp(`My total liability under this agreement is limited to the amount you paid. I'm not liable for indirect or consequential losses — lost profits, lost business, or lost data. This doesn't limit liability that can't be limited by law.`)) +
    lsec(`Governing law`, lp(`Oregon law governs this agreement, and disputes go to the state or federal courts of Oregon. If we disagree about something, email me first — I'd rather fix it than litigate it.`)) +
    lsec(`Questions before you buy`, lp(`Ask. Email <b>${EMAIL}</b> or call/text <b>${PHONE}</b> and you'll get me, not a sales team.`)),
});

/* ---------- /thanks/ — Stripe success URL. Standalone: noindex, not in sitemap,
   not in the footer nav. Its only job is turning a payment into a started job. ---------- */
mkdirSync(join(ROOT, 'thanks'), { recursive: true });
writeFileSync(join(ROOT, 'thanks/index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>You're in — here's what happens next | ${BRAND}</title>
<meta name="robots" content="noindex,nofollow">
${FAVICON}${FONTS}<style>${CSS}
.tk{min-height:100svh;display:flex;flex-direction:column;justify-content:center;padding:90px 0 60px}
.tk h1{font-size:clamp(2rem,5.6vw,3.8rem);text-transform:uppercase;line-height:1.03;margin:16px 0 22px}
.steps{display:grid;gap:1px;background:var(--hair);margin:38px 0;max-width:760px}
.step{background:var(--ink);padding:24px 26px;display:grid;grid-template-columns:44px 1fr;gap:18px;align-items:start}
.step .n{font-family:var(--mono);font-size:.72rem;letter-spacing:.14em;color:var(--silver);padding-top:3px}
.step h3{font-size:1.05rem;text-transform:uppercase;margin-bottom:7px}
.step p{color:var(--muted);font-size:.93rem;max-width:56ch}
.step b{color:var(--text)}
.send{border:1px solid var(--hair2);padding:26px 28px;max-width:760px;margin-top:8px}
.send h2{font-size:1.1rem;text-transform:uppercase;margin-bottom:14px}
.send ul{list-style:none;display:grid;gap:9px}
.send li{color:var(--muted);font-size:.93rem;padding-left:20px;position:relative}
.send li::before{content:"→";position:absolute;left:0;color:var(--silver)}
</style></head>
<body>
<header class="top"><div class="wrap"><a class="logo" href="/">DB<span style="color:var(--silver-lo)">—</span></a><nav><a href="/services/">Services</a><a href="/trades/">Industries</a><a href="/locations/">Locations</a></nav></div></header>
<main><div class="wrap tk">
  <p class="mono" style="color:var(--silver)">Payment received</p>
  <h1>You're in. <span class="chrome">Now I build.</span></h1>
  <p class="lede" style="max-width:60ch">You'll get a receipt from Stripe in a minute. Here's exactly what happens from here — no mystery, no waiting to hear from a project manager. You deal with me.</p>

  <div class="steps">
    <div class="step"><span class="n">01</span><div><h3>Today</h3><p>I email you from <b>${EMAIL}</b> to confirm I've got it, and to ask anything I still need. If you don't see it, check spam and add me to your contacts.</p></div></div>
    <div class="step"><span class="n">02</span><div><h3>Within 7 business days</h3><p>Your site is built and I send you the link. If a demo was already built for you, it's usually the <b>same or next business day</b>.</p></div></div>
    <div class="step"><span class="n">03</span><div><h3>You review it</h3><p>Wrong phone number, a service you don't offer, a town you don't serve, wording you'd say differently — send it all back in one list. <b>One round of revisions</b> is included, within 14 days.</p></div></div>
    <div class="step"><span class="n">04</span><div><h3>It goes live</h3><p>I point your domain at it, set up HTTPS, submit it to Google Search Console, and hand you the source code. <b>You own all of it</b> — code, content, domain. Nothing to keep paying me for.</p></div></div>
  </div>

  <div class="send">
    <h2>Send me these now and it ships faster</h2>
    <ul>
      <li>Your <b>logo</b> — any format, even the original file from whoever made it</li>
      <li><b>20 photos off your phone</b> of finished jobs. Real photos beat anything else on the page, and crooked ones are fine.</li>
      <li>The <b>services you actually offer</b> — and any you don't want listed</li>
      <li>The <b>towns you actually serve</b> (and how far you'll really drive)</li>
      <li>Your <b>license number, hours,</b> and the best number for customers to call</li>
      <li>Your <b>domain</b> — or tell me you need one and I'll tell you what to buy</li>
    </ul>
    <div class="cta-row" style="margin-top:24px">
      <a class="btn" href="mailto:${EMAIL}?subject=My%20site%20build%20-%20here's%20my%20info">Email it to me →</a>
      <a class="btn ghost" href="tel:${PHONE_TEL}">Or call/text ${PHONE}</a>
    </div>
  </div>

  <p class="body-copy" style="margin-top:34px;max-width:62ch">Questions, second thoughts, or something you forgot to mention — just reply to the confirmation email. Terms for this build are at <a href="/legal/website-terms/" style="color:var(--silver);text-decoration:underline">the build agreement</a>.</p>
</div></main>
${footerHTML}</body></html>`);

/* ---------- 404 ---------- */
writeFileSync(join(ROOT, '404.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 — Off the map | ${BRAND}</title><meta name="robots" content="noindex">${FAVICON}${FONTS}<style>${CSS}.err{min-height:70vh;display:flex;flex-direction:column;justify-content:center}</style></head>
<body><header class="top"><div class="wrap"><a class="logo" href="/">DB<span style="color:var(--silver-lo)">—</span></a><nav><a href="/services/">Services</a><a href="/trades/">Industries</a><a href="/locations/">Locations</a><a href="/products/">Products</a></nav></div></header>
<main><div class="wrap err"><p class="mono">[ 404 ]</p><h1 style="font-size:clamp(2rem,6vw,4rem);text-transform:uppercase;margin:18px 0">Off the <span class="chrome">map.</span></h1><p class="body-copy">This page doesn't exist — but the work does. Three ways back in:</p><div class="cta-row"><a class="btn" href="/">Home →</a><a class="btn ghost" href="/services/">Services</a><a class="btn ghost" href="/locations/">Locations</a></div></div></main>${footerHTML}</body></html>`);

/* ---------- CNAME, llms.txt ---------- */
writeFileSync(join(ROOT, 'CNAME'), 'derikbannister.com\n');
const LLMS_HEAD = `# Derik Bannister — derikbannister.com

> Operator and founder based in Oregon. Builds websites, local SEO, answer engine
> optimization (AEO), Google Ads and Local Services Ads, AI phone answering, CRM and
> follow-up automation, reputation systems, and custom software for service businesses
> across ${MARKET_LINE} — ${locations.length} markets and ${trades.length} trades.
> Flat pricing quoted up front; the client owns the domain, code, content, and data.
> Contact: ${EMAIL} · call/text ${PHONE}.
`;
writeFileSync(join(ROOT, 'llms.txt'), `${LLMS_HEAD}
## Services (${services.length})
${services.map(s => `- [${s.name}](${SITE}/services/${s.slug}/): ${s.metaShort}`).join('\n')}

## Industries (${trades.length})
${trades.map(t => `- [${t.name}](${SITE}/trades/${t.slug}/): systems for ${t.plural}`).join('\n')}

## States
${STATES.map(s => `- [${s.name}](${SITE}/locations/${s.slug}/): ${s.cities.length} markets`).join('\n')}

## Answers (${answers.length})
${answers.map(a => `- [${a.q}](${SITE}/answers/${a.slug}/)`).join('\n')}

## Optional
- [All ${locations.length} markets](${SITE}/locations/)
- [SEO products](${SITE}/products/)
- [About Derik Bannister](${SITE}/about/)
- [Full sitemap](${SITE}/sitemap/)
`);
/* llms-full.txt — the direct answers themselves, so an assistant that fetches one file
   still gets citable content rather than a link list. */
writeFileSync(join(ROOT, 'llms-full.txt'), `${LLMS_HEAD}
## Markets served (${locations.length})
${STATES.map(s => `### ${s.name}\n${s.cities.map(l => `- ${l.city}, ${l.state} — ${l.county}, ${l.region}. Also serving ${l.nearby.slice(0, 3).join(', ')}. ${SITE}/locations/${l.slug}/`).join('\n')}`).join('\n\n')}

## Services (${services.length})
${services.map(s => `### ${s.name}\n${capFirst(s.desc)}.\n${s.features.map(f => `- ${f}`).join('\n')}\n${SITE}/services/${s.slug}/`).join('\n\n')}

## Industries (${trades.length})
${trades.map(t => `### ${t.name}\nFor ${t.plural}. Common problems: ${t.pain}. Trade-specific systems: ${t.systems}.\n${SITE}/trades/${t.slug}/`).join('\n\n')}

## Answers (${answers.length})
${answers.map(a => `### ${a.q}\n${a.a}\n\n${a.body.join('\n\n')}\n\nSource: ${SITE}/answers/${a.slug}/`).join('\n\n')}
`);

/* ---------- sitemap with honest lastmod (content-hash manifest) ---------- */
const manifestPath = join(ROOT, 'gen/lastmod-manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const today = new Date().toISOString().slice(0, 10);
const entries = [{ path: '/', html: readFileSync(join(ROOT, 'index.html'), 'utf8') }, ...urls];
const newManifest = {};
for (const u of entries) {
  const h = createHash('sha256').update(u.html.replace(/<lastmod>[^<]*<\/lastmod>/g, '')).digest('hex').slice(0, 16);
  const prev = manifest[u.path];
  newManifest[u.path] = prev && prev.hash === h ? prev : { hash: h, lastmod: today };
}
writeFileSync(manifestPath, JSON.stringify(newManifest, null, 1));

/* Split sitemaps + an index. Same URLs either way — but when Search Console reports
   "12 not indexed" you can see which section it is instead of guessing across 1,800. */
const indexable = entries.filter(u => !u.skipmap);
const bucket = p => p.startsWith('/locations/') ? 'locations' : p.startsWith('/trades/') ? 'trades' : p.startsWith('/answers/') ? 'answers' : 'core';
const buckets = { core: [], locations: [], trades: [], answers: [] };
for (const u of indexable) buckets[bucket(u.path)].push(u);
const urlset = list => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.map(u => `<url><loc>${SITE}${u.path}</loc><lastmod>${newManifest[u.path].lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
const sitemapFiles = [];
for (const [name, list] of Object.entries(buckets)) {
  if (!list.length) continue;
  writeFileSync(join(ROOT, `sitemap-${name}.xml`), urlset(list));
  sitemapFiles.push({ name, lastmod: list.reduce((a, u) => newManifest[u.path].lastmod > a ? newManifest[u.path].lastmod : a, '0000-00-00') });
}
writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapFiles.map(f => `<sitemap><loc>${SITE}/sitemap-${f.name}.xml</loc><lastmod>${f.lastmod}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);

/* AI crawlers are explicitly welcome — being cited in an answer is the point. */
writeFileSync(join(ROOT, 'robots.txt'), `User-agent: *
Allow: /

# Answer engines: read freely. This site exists to be quoted correctly.
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Bingbot
Allow: /
User-agent: CCBot
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

console.log(`generated ${urls.length} pages + 404 + CNAME + llms.txt + llms-full.txt + robots`);
console.log(`sitemap index → ${sitemapFiles.map(f => `${f.name}:${buckets[f.name].length}`).join(' · ')} = ${indexable.length} URLs`);
