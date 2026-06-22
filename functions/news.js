/**
 * CopaAmerica · /news · v3.0
 * Real JSON APIs only — no RSS (blocked from CF Workers)
 * ESPN + Guardian + football match reports
 * Unlimited pagination · Auto-refresh safe · Fast
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control':                'public, max-age=60, stale-while-revalidate=120',
};

/* ── ESPN Copa América news (primary — best source) ── */
async function fetchESPNCA() {
  try {
    const r = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/conmebol.copa.america/news?limit=50',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.articles || []).slice(0, 40).map((a, i) => ({
      id:      'ca_' + i + '_' + Date.now(),
      title:   a.headline || a.title || '',
      summary: a.description || a.summary || '',
      image:   a.images?.[0]?.url || null,
      source:  'ESPN',
      url:     a.links?.web?.href || a.link || '',
      date:    a.published || a.lastModified || new Date().toISOString(),
      category:'copa-america',
    })).filter(a => a.title);
  } catch(e) { return []; }
}

/* ── ESPN general soccer news (secondary — always has content) ── */
async function fetchESPNSoccer() {
  try {
    const r = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/news?limit=40',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.articles || []).slice(0, 25).map((a, i) => ({
      id:      'espns_' + i + '_' + Date.now(),
      title:   a.headline || a.title || '',
      summary: a.description || a.summary || '',
      image:   a.images?.[0]?.url || null,
      source:  'ESPN FC',
      url:     a.links?.web?.href || a.link || '',
      date:    a.published || new Date().toISOString(),
      category:'football',
    })).filter(a => a.title);
  } catch(e) { return []; }
}

/* ── Guardian API (test key — 12 free/day, enough with CF caching) ── */
async function fetchGuardian(key) {
  const apiKey = key || 'test';
  try {
    const queries = ['copa america', 'south america football', 'conmebol'];
    const q = queries[Math.floor(Date.now() / 3600000) % queries.length];
    const r = await fetch(
      `https://content.guardianapis.com/search?q=${encodeURIComponent(q)}&section=football&show-fields=thumbnail,trailText&page-size=30&api-key=${apiKey}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.response?.results || []).map((a, i) => ({
      id:      'g_' + i + '_' + Date.now(),
      title:   a.webTitle || '',
      summary: (a.fields?.trailText || '').replace(/<[^>]+>/g, '').slice(0, 200),
      image:   a.fields?.thumbnail || null,
      source:  'The Guardian',
      url:     a.webUrl || '',
      date:    a.webPublicationDate || new Date().toISOString(),
      category:'football',
    })).filter(a => a.title);
  } catch(e) { return []; }
}

/* ── Match result articles from TheSportsDB ── */
async function fetchMatchResults() {
  try {
    const r = await fetch(
      'https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4319&s=2024',
      { signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.events || [])
      .filter(e => e.strStatus === 'Match Finished')
      .slice(0, 20)
      .map((e, i) => ({
        id:      'tsdb_' + e.idEvent,
        title:   `${e.strHomeTeam} ${e.intHomeScore}–${e.intAwayScore} ${e.strAwayTeam} | Copa América`,
        summary: `Full time: ${e.strHomeTeam} ${e.intHomeScore}, ${e.strAwayTeam} ${e.intAwayScore}. Played ${e.dateEvent || ''} at ${e.strVenue || 'Copa América venue'}.`,
        image:   e.strThumb || e.strBanner || null,
        source:  'TheSportsDB',
        url:     '',
        date:    (e.dateEvent || '') + 'T' + (e.strTime || '00:00:00'),
        category:'results',
      }));
  } catch(e) { return []; }
}

/* ── Hardcoded fallback (always shows something) ── */
function fallbackArticles() {
  const now = new Date().toISOString();
  return [
    { id:'f1', title:'Copa América — Live Scores & Results', summary:'Follow every match from Copa América with live scores, lineups and match reports for all 16 nations.', image:null, source:'CopaAmerica', url:'', date:now, category:'copa-america' },
    { id:'f2', title:'Copa América Group Stage Standings', summary:'Current standings from Groups A, B, C and D. Who is advancing to the quarter-finals?', image:null, source:'CopaAmerica', url:'', date:now, category:'copa-america' },
    { id:'f3', title:'Top Scorers — Copa América 2024', summary:'Who is leading the golden boot race? Check the latest top scorers and assists across all Copa América matches.', image:null, source:'CopaAmerica', url:'', date:now, category:'copa-america' },
    { id:'f4', title:'Argentina vs Brazil — Head to Head', summary:'The biggest rivalry in South American football. Check Copa América history between the two giants.', image:null, source:'CopaAmerica', url:'', date:now, category:'copa-america' },
    { id:'f5', title:'CONMEBOL Copa América 2024 — All Teams', summary:'All 16 nations: Argentina, Brazil, Colombia, Uruguay, USA, Mexico, Ecuador, Venezuela, Chile, Peru, Jamaica, Panama, Bolivia, Paraguay, Canada and Costa Rica.', image:null, source:'CopaAmerica', url:'', date:now, category:'copa-america' },
  ];
}

export async function onRequestGet(context) {
  const url    = new URL(context.request.url);
  const page   = parseInt(url.searchParams.get('page') || '1', 10);
  const filter = url.searchParams.get('filter') || 'all';
  const key    = context.env?.GUARDIAN_KEY || 'test';

  /* Run all sources in parallel */
  const [caNews, soccerNews, guardian, results] = await Promise.all([
    fetchESPNCA(),
    fetchESPNSoccer(),
    fetchGuardian(key),
    fetchMatchResults(),
  ]);

  let articles = [...caNews, ...soccerNews, ...guardian, ...results];

  /* Deduplicate by title */
  const seen = new Set();
  articles = articles.filter(a => {
    if (!a.title) return false;
    const k = a.title.toLowerCase().slice(0, 50);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  /* Sort newest first */
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  /* Filter by category */
  if (filter !== 'all') {
    const filterMap = {
      'copa-america': ['copa', 'america', 'conmebol', 'argentina', 'brazil', 'colombia',
                       'uruguay', 'mexico', 'usa', 'ecuador', 'venezuela', 'chile'],
      'results':      ['result', 'final', 'win', 'beat', 'defeat', 'draw', 'goal', 'score', '–', '-'],
      'transfers':    ['transfer', 'sign', 'deal', 'fee', 'move', 'join'],
      'injuries':     ['injur', 'injure', 'return', 'fitness', 'sidelined'],
    };
    const words = filterMap[filter] || [];
    if (words.length) {
      articles = articles.filter(a => {
        const t = (a.title + ' ' + (a.summary || '')).toLowerCase();
        return words.some(w => t.includes(w));
      });
    }
  }

  /* Fallback if nothing found */
  if (!articles.length) articles = fallbackArticles();

  /* Paginate — 15 per page for infinite scroll */
  const perPage = 15;
  const start   = (page - 1) * perPage;
  const paged   = articles.slice(start, start + perPage);

  return new Response(JSON.stringify({
    success:  true,
    page,
    total:    articles.length,
    hasMore:  start + perPage < articles.length,
    sources:  [...new Set(articles.map(a => a.source))],
    articles: paged,
  }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
