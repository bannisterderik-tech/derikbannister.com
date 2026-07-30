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

const trades = JSON.parse(readFileSync(join(ROOT, 'data/trades.json'), 'utf8'));
const services = JSON.parse(readFileSync(join(ROOT, 'data/services.json'), 'utf8'));
const locations = JSON.parse(readFileSync(join(ROOT, 'data/locations.json'), 'utf8'));
const core = services.filter(s => s.core);

const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const pick = (arr, key) => arr[hash(key) % arr.length];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* lowercase that never mangles acronyms/proper nouns (HVAC, SEO, Google Ads…) */
const lc = s => s.split(' ').map(w => (w === w.toUpperCase() && w.length > 1) || /[A-Z].*[A-Z]/.test(w) ? w : w.toLowerCase()).join(' ');
const tradeLc = t => t.name === t.name.toUpperCase() ? t.name : t.name.toLowerCase();
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);

/* region clusters → honest "other markets" links (no fake geography) */
const cluster = l => {
  if (l.state !== 'OR') return 'x-' + l.state;
  const r = l.region;
  if (/Portland metro/.test(r)) return 'pdx';
  if (/Willamette Valley|Chehalem|Yamhill/.test(r)) return 'valley';
  if (/coast/.test(r)) return 'coast';
  if (/Gorge/.test(r)) return 'gorge';
  if (/Central Oregon/.test(r)) return 'central';
  if (/Rogue|Umpqua|Klamath/.test(r)) return 'southern';
  return 'eastern';
};
const clusterMates = loc => {
  const mine = cluster(loc);
  let mates = locations.filter(l => l.slug !== loc.slug && cluster(l) === mine);
  if (mates.length < 3) mates = mates.concat(locations.filter(l => l.slug !== loc.slug && l.state === loc.state && !mates.includes(l)));
  if (mates.length < 3) mates = mates.concat(locations.filter(l => l.slug !== loc.slug && !mates.includes(l)));
  return mates.slice(0, 3);
};

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
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">`;
const FAVICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%230a0a0a'/%3E%3Ctext x='32' y='42' font-family='Arial Black,sans-serif' font-size='26' font-weight='900' fill='%23e8e8ee' text-anchor='middle'%3EDB%3C/text%3E%3C/svg%3E">`;

/* metro-mixed grid for "where I work" (promise = neighboring metros, so show them) */
const gridCities = [...locations.slice(0, 7), ...locations.filter(l => l.state !== 'OR')];
const footerHTML = `<footer><div class="wrap"><div class="fcols">
<div><h3>Services</h3>${services.slice(0, 8).map(s => `<a href="/services/${s.slug}/">${esc(s.short)}</a>`).join('')}<a href="/services/">All services →</a></div>
<div><h3>Industries</h3>${trades.slice(0, 8).map(t => `<a href="/trades/${t.slug}/">${esc(t.name)}</a>`).join('')}<a href="/trades/">All industries →</a></div>
<div><h3>Locations</h3>${locations.slice(0, 8).map(l => `<a href="/locations/${l.slug}/">${esc(l.city)}, ${l.state}</a>`).join('')}<a href="/locations/">All locations →</a></div>
<div><h3>Company</h3><a href="/">Home</a><a href="/about/">About</a><a href="/#builds">Builds</a><a href="/products/">SEO Products</a><a href="mailto:${EMAIL}">Email</a><a href="tel:${PHONE_TEL}">Call/Text ${PHONE}</a></div>
</div><div class="legal"><span class="mono">© 2026 ${BRAND}</span><span class="mono">DB<b>—</b> BUILD. OPERATE. OWN.</span></div></div></footer>`;

let urls = [];
function page({ path, title, desc, crumbs, h1, lede, body, schema, canonicalOverride }) {
  const canonical = canonicalOverride || `${SITE}${path}`;
  if (desc.length > 158) desc = desc.slice(0, 155).replace(/[,;\s]+\S*$/, '') + '…';
  const crumbUI = crumbs.map((c, i) => i === crumbs.length - 1 ? esc(c.name) : `<a href="${c.url}">${esc(c.name)}</a> / `).join('');
  const crumbLD = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE}${c.url}` })) };
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/og/og-default.png"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0a0a0a">
${FAVICON}
${FONTS}
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(crumbLD)}</script>
${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ''}
</head>
<body>
<header class="top"><div class="wrap"><a class="logo" href="/">DB<span style="color:var(--silver-lo)">—</span></a><nav><a href="/services/">Services</a><a href="/trades/">Industries</a><a href="/locations/">Locations</a><a href="/products/">Products</a><a href="/#contact">Contact</a></nav></div></header>
<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb">${crumbUI}</nav></div>
<main>
<div class="hero"><div class="wrap"><h1>${h1}</h1><p class="lede">${lede}</p>
<div class="cta-row"><a class="btn" href="mailto:${EMAIL}?subject=${encodeURIComponent('Project inquiry — ' + title)}">Get a free strategy brief →</a><a class="btn ghost" href="tel:${PHONE_TEL}">Call/Text ${PHONE}</a></div></div></div>
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
const MARKETS = ['Oregon', 'Boise ID', 'Spokane WA', 'Vancouver WA', 'Reno NV', 'Redding CA'];
const svcLD = (name, area, path, description) => ({ '@context': 'https://schema.org', '@type': 'Service', name, description, provider, areaServed: area, url: `${SITE}${path}` });
const cityArea = loc => ({ '@type': 'City', name: loc.city, containedInPlace: { '@type': 'State', name: loc.stateName } });
const faqHTML = qs => `<section class="faq"><div class="wrap"><h2>Questions, answered straight</h2>${qs.map(q => `<details><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('')}</div></section>`;
const contactBand = ctx => `<section><div class="wrap"><div class="contact-band"><h2>Let's build something real.</h2><p>${esc(ctx)} Email <b>${EMAIL}</b> or call/text <b>${PHONE}</b> — you get a straight answer from me, not a sales sequence.</p><div class="cta-row"><a class="btn" href="mailto:${EMAIL}">Email Derik →</a><a class="btn ghost" href="tel:${PHONE_TEL}">Call/Text ${PHONE}</a></div></div></div></section>`;

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
];
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
};
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
for (const d of ['services', 'trades', 'locations', 'products', 'about']) rmSync(join(ROOT, d), { recursive: true, force: true });
mkdirSync(join(ROOT, 'og'), { recursive: true }); /* og-default.png is generated separately — never clean this dir */

/* ---------- service hubs ---------- */
page({
  path: '/services/', title: `Services — Websites, Software, SEO, AI & CRM | ${BRAND}`,
  desc: `Every system ${BRAND} builds for service businesses: websites, custom software, SEO, Google Ads, AI receptionists, CRM, email/SMS, and reputation.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Services', url: '/services/' }],
  h1: `Systems that <span class="chrome">book revenue.</span>`,
  lede: `The core systems — sites, SEO, CRM, AI answering — run in my own business before they run in yours. The rest ships to the same standard: if it wouldn't book revenue for me, it doesn't ship for you.`,
  body: `<section><div class="wrap"><div class="grid">${services.map(s => `<a href="/services/${s.slug}/"><b>${esc(s.name)}</b>${esc(s.desc.split(' — ')[0])}</a>`).join('')}</div></div></section>` + contactBand(`Not sure which system your business needs first?`),
});
for (const s of services) {
  /* /services/link-building + /services/press-releases duplicate /products/ pages — canonical there */
  const canonicalOverride = s.slug === 'link-building' ? `${SITE}/products/link-building/` : s.slug === 'press-releases' ? `${SITE}/products/press-releases/` : undefined;
  const cityLinks = s.core ? `<section><div class="wrap"><h2>${esc(s.short)}, market by market</h2><div class="citylinks">${locations.map(l => `<a href="/locations/${l.slug}/${s.slug}/">${esc(s.short)} in ${esc(l.city)}, ${l.state}</a>`).join('')}</div></div></section>` : '';
  page({
    path: `/services/${s.slug}/`, title: (() => { const t = `${s.name} for Service Businesses | ${BRAND}`; return t.length > 65 ? `${s.name} | ${BRAND}` : t; })(),
    desc: `${s.metaShort}. For service businesses across Oregon, Boise, Spokane, Vancouver WA, Reno, and Redding. Flat pricing — you own everything.`,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Services', url: '/services/' }, { name: s.short, url: `/services/${s.slug}/` }],
    h1: `${esc(s.name)}<span class="chrome"> that earns its keep.</span>`,
    lede: `${esc(capFirst(s.desc))}. Built by an operator who runs these systems in his own business.`,
    body: `<section><div class="wrap"><h2>What's included</h2><ul class="feat">${s.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div></section>
<section><div class="wrap"><h2>Built for your industry</h2><p class="body-copy">No two trades win work the same way. This gets built around how yours does:</p><div class="grid" style="margin-top:20px">${trades.map(t => `<a href="/trades/${t.slug}/"><b>${esc(t.name)}</b>${esc(s.short)} for ${esc(t.plural)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Where I work</h2><p class="body-copy">Every Oregon market, plus the neighboring metros I serve:</p><div class="grid" style="margin-top:20px">${gridCities.map(l => `<a href="/locations/${l.slug}/${s.core ? s.slug + '/' : ''}"><b>${esc(l.city)}, ${l.state}</b>${esc(s.short)} in the ${esc(l.region)}</a>`).join('')}<a href="/locations/"><b>All locations →</b>Every city I serve</a></div></div></section>` + cityLinks +
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
  path: '/trades/', title: `Industries — Software & Marketing by Trade | ${BRAND}`,
  desc: `Purpose-built websites, software, SEO, and AI systems for 18 service industries — roofing, plumbing, HVAC, electrical, and more.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Industries', url: '/trades/' }],
  h1: `Every trade gets <span class="chrome">its own playbook.</span>`,
  lede: `Each industry below gets systems built around how that trade actually wins work — no "home services" bucket, no recycled template.`,
  body: `<section><div class="wrap"><div class="grid">${trades.map(t => `<a href="/trades/${t.slug}/"><b>${esc(t.name)}</b>Systems for ${esc(t.plural)}</a>`).join('')}</div></div></section>` + contactBand(`Don't see your exact trade? If you roll a truck, these systems fit.`),
});
for (const t of trades) {
  const titlePlural = t.plural.split(' ').map(w => w === 'and' || w === 'or' ? w : w[0].toUpperCase() + w.slice(1)).join(' ');
  let title = `Software Development for ${titlePlural} | ${BRAND}`;
  if (title.length > 60) title = `Software Development for ${titlePlural} | DB`;
  page({
    path: `/trades/${t.slug}/`, title,
    desc: `Software development and growth systems for ${t.plural}: websites, SEO, Google Ads, AI receptionists, CRM, and custom tools. Oregon + neighboring metros.`,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Industries', url: '/trades/' }, { name: t.name, url: `/trades/${t.slug}/` }],
    h1: `Systems built for <span class="chrome">${esc(tradeLc(t))}.</span>`,
    lede: `I build for ${esc(t.plural)} specifically. You deal with ${esc(t.pain)} — your systems should be built around exactly that.`,
    body: `<section><div class="wrap"><h2>What I build for ${esc(t.plural)}</h2><p class="body-copy">Beyond the core stack — a ranking website, dialed Google Ads, an AI receptionist that answers every call, and a CRM that never forgets a quote — ${esc(t.plural)} get the trade-specific stack: <b>${esc(t.systems)}</b>.</p></div></section>
<section><div class="wrap"><h2>The full stack</h2><div class="grid">${services.map(s => `<a href="/services/${s.slug}/"><b>${esc(s.short)}</b>${esc(s.desc.split(' — ')[0])}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Markets I serve</h2><div class="grid">${gridCities.map(l => `<a href="/locations/${l.slug}/"><b>${esc(l.city)}, ${l.state}</b>${esc(t.name)} systems in the ${esc(l.region)}</a>`).join('')}<a href="/locations/"><b>All locations →</b>Every city I serve</a></div></div></section>` +
      faqHTML([
        { q: `Do you actually understand the ${tradeLc(t)} business?`, a: `The systems are built from running my own service business and studying how ${t.plural} win work — around ${t.pain}, not around a generic agency playbook.` },
        { q: `What should a ${tradeLc(t)} company fix first?`, a: `Usually the leaks: calls that go unanswered and leads that never get followed up. An AI receptionist plus automated follow-up typically pays for everything else.` },
        { q: `Do you take my competitors as clients?`, a: `I keep conflicts off my plate. If I'm already working deep with a ${tradeLc(t)} company in your service area, I'll tell you straight and we'll sort scope or a referral — ask about market exclusivity on retainer work.` },
      ]) + contactBand(`Ready to be the ${tradeLc(t)} company everyone in your market finds first?`),
    schema: svcLD(`Software & Marketing for ${t.name} Companies`, MARKETS, `/trades/${t.slug}/`, `Websites, SEO, ads, AI answering, CRM, and custom software for ${t.plural}.`),
  });
}

/* ---------- location hubs + city-service pages ---------- */
page({
  path: '/locations/', title: `Locations — Oregon + Neighboring Metros | ${BRAND}`,
  desc: `${BRAND} builds websites, software, and growth systems across every Oregon market plus Boise, Spokane, Vancouver WA, Reno, and Redding.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'Locations', url: '/locations/' }],
  h1: `All of Oregon. <span class="chrome">Then some.</span>`,
  lede: `Based in Oregon, working every Oregon market — plus the neighboring Western metros: Boise, Spokane, Vancouver, Reno, Redding. Pick yours.`,
  body: `<section><div class="wrap"><h2>Oregon</h2><div class="grid">${locations.filter(l => l.state === 'OR').map(l => `<a href="/locations/${l.slug}/"><b>${esc(l.city)}</b>${esc(l.county)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Beyond Oregon</h2><div class="grid">${locations.filter(l => l.state !== 'OR').map(l => `<a href="/locations/${l.slug}/"><b>${esc(l.city)}, ${l.state}</b>${esc(l.region)}</a>`).join('')}</div></div></section>` + contactBand(`Your market not listed? If you're in Oregon or a neighboring state, I can help.`),
});
locations.forEach(loc => {
  const mates = clusterMates(loc);
  const inOR = loc.state === 'OR';
  let hubTitle = `Marketing & Growth Systems in ${loc.city}, ${loc.state} | ${BRAND}`;
  if (hubTitle.length > 60) hubTitle = `Marketing & Growth Systems in ${loc.city}, ${loc.state} | DB`;
  const whyAnswer = inOR
    ? `Because I live and operate here. I run my own real-estate business in Oregon, the core systems I sell run inside it daily, and I know what Oregon customers respond to — and what a booked job is actually worth.`
    : `I'm an Oregon operator serving ${loc.city} remotely — same systems, same speed, direct access to me by phone or text. The work is digital; the results show up on your phone.`;
  page({
    path: `/locations/${loc.slug}/`, title: hubTitle,
    desc: `Websites, software, SEO, ads, AI answering, and CRM for service businesses in ${loc.city}, ${loc.stateName} — ${loc.county} and the ${loc.region}.`,
    crumbs: [{ name: 'Home', url: '/' }, { name: 'Locations', url: '/locations/' }, { name: `${loc.city}, ${loc.state}`, url: `/locations/${loc.slug}/` }],
    h1: `${esc(loc.city)}, ${loc.state}: <span class="chrome">own your market.</span>`,
    lede: `Growth systems for service businesses in ${esc(loc.city)} and across ${esc(loc.county)} — including ${esc(loc.nearby.slice(0, 3).join(', '))}. Built by an Oregon operator.`,
    body: `<section><div class="wrap"><h2>Systems available in ${esc(loc.city)}</h2><div class="grid">${core.map(s => `<a href="/locations/${loc.slug}/${s.slug}/"><b>${esc(s.short)}</b>For ${esc(loc.city)} service businesses</a>`).join('')}${services.filter(s => !s.core).map(s => `<a href="/services/${s.slug}/"><b>${esc(s.short)}</b>${esc(s.desc.split(' — ')[0])}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>Industries I build for in ${esc(loc.city)}</h2><div class="grid">${trades.map(t => `<a href="/trades/${t.slug}/"><b>${esc(t.name)}</b>${esc(t.plural)} in the ${esc(loc.region)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>More markets</h2><div class="grid">${mates.map(n => `<a href="/locations/${n.slug}/"><b>${esc(n.city)}, ${n.state}</b>${esc(n.region)}</a>`).join('')}</div></div></section>` +
      faqHTML([
        { q: `Do you serve all of ${loc.county}?`, a: `Yes — ${loc.city}, the surrounding ${loc.region}, and nearby communities like ${loc.nearby.join(', ')}. Systems are delivered remotely with direct phone/text access to me at ${PHONE}.` },
        { q: `Why hire an Oregon builder instead of a national agency?`, a: whyAnswer },
        { q: `What does it cost?`, a: `Flat, up-front pricing scoped to your goals. The strategy brief is free and specific to the ${loc.city} market — email ${EMAIL}.` },
      ]) + contactBand(`Want the free ${loc.city} market brief — who ranks, who's buying ads, and where the gap is?`),
    schema: svcLD(`Marketing & Growth Systems in ${loc.city}, ${loc.state}`, cityArea(loc), `/locations/${loc.slug}/`, `Websites, software, SEO, ads, AI answering, and CRM for ${loc.city} service businesses.`),
  });
  for (const s of core) {
    const key = `${loc.slug}|${s.slug}`;
    const shownFaq = faqPoolCitySvc(s, loc);
    const rotatedTrades = trades.map((t, ti) => ({ t, r: (ti + hash(key)) % trades.length })).sort((a, b) => a.r - b.r).slice(0, 8).map(x => x.t);
    let title = `${s.short} in ${loc.city}, ${loc.state} | ${BRAND}`;
    if (title.length > 60) title = `${s.short} in ${loc.city}, ${loc.state} | DB`;
    page({
      path: `/locations/${loc.slug}/${s.slug}/`, title,
      desc: `${s.metaShort} — for ${loc.city}, ${loc.state} service businesses. Flat pricing, you own everything. Serving ${loc.county}.`,
      crumbs: [{ name: 'Home', url: '/' }, { name: 'Locations', url: '/locations/' }, { name: `${loc.city}, ${loc.state}`, url: `/locations/${loc.slug}/` }, { name: s.short, url: `/locations/${loc.slug}/${s.slug}/` }],
      h1: `${esc(s.short)} in <span class="chrome">${esc(loc.city)}, ${loc.state}.</span>`,
      lede: `${esc(capFirst(s.desc))} — for service businesses in ${esc(loc.city)}, ${esc(loc.nearby.slice(0, 2).join(', '))}, and across ${esc(loc.county)}.`,
      body: `<section><div class="wrap"><h2>Why it matters in ${esc(loc.city)}</h2><p class="body-copy">${esc(pick(whyLocalPool, key)(s, loc))}</p><p class="body-copy" style="margin-top:14px">${esc(localAngle[s.slug](loc))}</p></div></section>
<section><div class="wrap"><h2>What's included</h2><ul class="feat">${s.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div></section>
<section><div class="wrap"><h2>${esc(loc.city)} industries this is built for</h2><div class="grid">${rotatedTrades.map(t => `<a href="/trades/${t.slug}/"><b>${esc(t.name)}</b>${esc(s.short)} for ${esc(t.plural)}</a>`).join('')}</div></div></section>
<section><div class="wrap"><h2>More in ${esc(loc.city)} — and other markets</h2><div class="grid">${core.filter(x => x.slug !== s.slug).slice(0, 4).map(x => `<a href="/locations/${loc.slug}/${x.slug}/"><b>${esc(x.short)}</b>${esc(x.short)} in ${esc(loc.city)}</a>`).join('')}${mates.map(n => `<a href="/locations/${n.slug}/${s.slug}/"><b>${esc(n.city)}, ${n.state}</b>${esc(s.short)} in ${esc(n.city)}</a>`).join('')}</div></div></section>` +
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

/* ---------- about (E-E-A-T anchor; facts limited to confirmed) ---------- */
page({
  path: '/about/', title: `About Derik Bannister — Operator & Founder`,
  desc: `Derik Bannister: Oregon real-estate agent, co-founder of REoperative.ai, and builder of websites, software, and growth systems for service businesses.`,
  crumbs: [{ name: 'Home', url: '/' }, { name: 'About', url: '/about/' }],
  h1: `The operator behind <span class="chrome">the systems.</span>`,
  lede: `I'm Derik Bannister — an Oregon operator, not an agency. I sell real estate at The Operative Group, co-founded REoperative.ai, and build growth systems for service businesses across the Northwest.`,
  body: `<section><div class="wrap"><h2>Why that matters to you</h2><p class="body-copy">Everything on this site comes from operating, not theorizing. The CRM, the AI answering, the follow-up automation, the search strategy — the core stack runs inside my own real-estate business on live deals and real phones before any of it is offered to yours. When something doesn't book revenue, I feel it before you would.</p><p class="body-copy">That also means you deal with me. No account managers, no hand-offs, no ticket queues — email <b>${EMAIL}</b> or text <b>${PHONE}</b> and the person who answers is the person doing the work.</p></div></section>
<section><div class="wrap"><h2>The work</h2><div class="grid"><a href="https://www.reoperative.ai" target="_blank" rel="noopener"><b>REoperative.ai</b>Co-founder — operating system for real-estate teams</a><a href="/#work"><b>The Operative Group</b>Real-estate agent — Oregon</a><a href="/#builds"><b>Recent builds</b>Sites shipped for local businesses</a></div></div></section>` + contactBand(`Want to talk to the person who'd actually build it?`),
  schema: { '@context': 'https://schema.org', '@type': 'Person', name: BRAND, email: EMAIL, telephone: PHONE_TEL, url: `${SITE}/about/`, jobTitle: 'Operator & Founder', worksFor: { '@id': BUSINESS_ID }, address: { '@type': 'PostalAddress', addressRegion: 'OR', addressCountry: 'US' } },
});

/* ---------- 404 ---------- */
writeFileSync(join(ROOT, '404.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 — Off the map | ${BRAND}</title><meta name="robots" content="noindex">${FAVICON}${FONTS}<style>${CSS}.err{min-height:70vh;display:flex;flex-direction:column;justify-content:center}</style></head>
<body><header class="top"><div class="wrap"><a class="logo" href="/">DB<span style="color:var(--silver-lo)">—</span></a><nav><a href="/services/">Services</a><a href="/trades/">Industries</a><a href="/locations/">Locations</a><a href="/products/">Products</a></nav></div></header>
<main><div class="wrap err"><p class="mono">[ 404 ]</p><h1 style="font-size:clamp(2rem,6vw,4rem);text-transform:uppercase;margin:18px 0">Off the <span class="chrome">map.</span></h1><p class="body-copy">This page doesn't exist — but the work does. Three ways back in:</p><div class="cta-row"><a class="btn" href="/">Home →</a><a class="btn ghost" href="/services/">Services</a><a class="btn ghost" href="/locations/">Locations</a></div></div></main>${footerHTML}</body></html>`);

/* ---------- CNAME, llms.txt ---------- */
writeFileSync(join(ROOT, 'CNAME'), 'derikbannister.com\n');
writeFileSync(join(ROOT, 'llms.txt'), `# Derik Bannister — derikbannister.com

> Operator & founder in Oregon. Builds websites, custom software, SEO, Google Ads,
> AI receptionists, CRM/automation, and reputation systems for service businesses
> (roofing, plumbing, HVAC, electrical, and 14 more trades) across every Oregon
> market plus Boise ID, Spokane WA, Vancouver WA, Reno NV, and Redding CA.
> Contact: ${EMAIL} · call/text ${PHONE}.

## Services
${services.map(s => `- [${s.name}](${SITE}/services/${s.slug}/): ${s.metaShort}`).join('\n')}

## Industries
${trades.map(t => `- [${t.name}](${SITE}/trades/${t.slug}/)`).join('\n')}

## Markets
${locations.map(l => `- [${l.city}, ${l.state}](${SITE}/locations/${l.slug}/)`).join('\n')}

## SEO Products
- [Product index](${SITE}/products/)
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
writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.filter(u => !u.skipmap).map(u => `<url><loc>${SITE}${u.path}</loc><lastmod>${newManifest[u.path].lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`generated ${urls.length} pages + 404 + CNAME + llms.txt + sitemap(${entries.length}) + robots`);
