# DB— derikbannister.com

Personal site for Derik Bannister — operator & founder. Black / white / silver.

## Build

Two steps, in order:

```bash
node gen/expand-data.mjs   # compact tables  -> data/*.json
node gen/build.mjs         # data/*.json     -> ~1,800 static pages + sitemaps + llms.txt
```

**Source of truth is `gen/expand-data.mjs` and `gen/answers-src.mjs`, not `data/*.json`.**
The JSON files are generated; editing them directly gets overwritten on the next run.

- `gen/expand-data.mjs` — pipe-delimited tables for locations (212), trades (53),
  services (23), plus the taxonomy used for grouped/filterable hubs. It validates on
  the way out: unique slugs, every answer pointing at a real service, no direct answer
  long enough to be unliftable.
- `gen/answers-src.mjs` — the AEO corpus (69 Q&As). Each entry becomes a page with a
  direct answer at the top, `QAPage` schema, and `speakable` markup.
- `gen/build.mjs` — emits every page, both sitemaps, `robots.txt`, `llms.txt`, and
  `llms-full.txt`.

`index.html` is hand-built and is **not** generated — the builder only reads it for the
sitemap. Everything under `/services/`, `/trades/`, `/locations/`, `/answers/`,
`/products/`, `/about/`, `/legal/`, `/ideas/`, and `/sitemap/` is generated and gets
wiped on each run. Never hand-edit those; change the data or the builder and rebuild.

## Page matrix

| Section | Pages |
|---|---|
| Services (grouped, searchable hub) | 23 + hub |
| Industries (53 trades) | 53 + hub |
| Industries × state | 265 |
| Markets (212 cities, 5 states) | 212 + 5 state hubs + hub |
| City × service | 1,148 |
| Answers (AEO corpus) | 69 + hub |
| Products, about, ideas, legal, sitemap | ~17 |
| **Total** | **~1,796** |

Tier-1 cities (50 anchor metros) get a page for all 10 core services; tier-2 markets get
the four that carry the most weight. That's set by `tier` in the locations table.

## SEO / AEO conventions

- Slugs are always `{city}-{state}` (`/locations/portland-or/`). Changing that 404s every
  URL Google has indexed.
- Every page carries `ProfessionalService` + `WebSite` + `WebPage` + `BreadcrumbList`
  JSON-LD, so `provider: {"@id": ...}` references resolve on any single page a crawler sees.
- Pages with a direct answer emit `speakable` pointing at `h1` and `.answer`.
- `sitemap.xml` is an index over `sitemap-{core,locations,trades,answers}.xml` — split so
  Search Console coverage problems are attributable to a section.
- `robots.txt` explicitly allows AI crawlers. Being cited in an answer is the point.
- Copy rule: no invented statistics, no fake case studies. Where a number isn't
  verifiable, the answer describes the shape instead of inventing a figure.

## Verify

```bash
node gen/build.mjs && node gen/verify.mjs
```

Checks internal links, JSON-LD parseability, duplicate titles/descriptions, title and
meta lengths, and H1 counts across every generated page.
