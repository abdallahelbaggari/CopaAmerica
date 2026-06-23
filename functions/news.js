/**
 * CopaAmerica · /news · v4.0
 * Real sources — ESPN + Guardian + football-data.org match reports
 * Unlimited pagination · stale-while-revalidate · fast
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control':                'public, max-age=60, stale-while-revalidate=120',
};

/* Rotate query per page for variety */
const ESPN_SLUGS = [
  { slug:'conmebol.copa.america',  name:'Copa América' },
  { slug:'conmebol.libertadores',  name:'Libertadores' },
  { slug:'soccer',                 name:'ESPN FC' },
];

async function fetchESPN(page) {
  const idx  = (page - 1) % ESPN_SLUGS.length;
  const comp = ESPN_SLUGS[idx];
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${comp.slug}/news?limit=50`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.articles || []).map((a, i) => ({
      id:      `espn_${comp.slug}_${i}_${page}`,
      title:   a.headline || a.title || '',
      summary: (a.description || a.summary || '').slice(0, 200),
      image:   a.images?.[0]?.url || null,
      source:  comp.name,
      url:     a.links?.web?.href || '',
      date:    a.published || new Date().toISOString(),
      category:'football',
    })).filter(a => a.title);
  } catch(e) { return []; }
}

async function fetchESPNGeneral(page) {
  try {
    const r = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/news?limit=50',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    const offset = (page - 1) * 15;
    return (d.articles || []).slice(offset, offset + 20).map((a, i) => ({
      id:      `espng_${page}_${i}`,
      title:   a.headline || '',
      summary: (a.description || a.summary || '').slice(0, 200),
      image:   a.images?.[0]?.url || null,
      source:  'ESPN FC',
      url:     a.links?.web?.href || '',
      date:    a.published || new Date().toISOString(),
      category:'football',
    })).filter(a => a.title);
  } catch(e) { return []; }
}

async function fetchGuardian(page, key) {
  const queries = [
    'copa america football',
    'south america football',
    'premier league',
    'champions league',
    'la liga serie a bundesliga',
  ];
  const q = queries[(page - 1) % queries.length];
  try {
    const r = await fetch(
      `https://content.guardianapis.com/search?q=${encodeURIComponent(q)}&section=football` +
      `&show-fields=thumbnail,trailText&page-size=20&page=${Math.ceil(page/queries.length)}&api-key=${key || 'test'}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.response?.results || []).map((a, i) => ({
      id:      `g_${page}_${i}`,
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

async function fetchFDResults(apiKey) {
  if (!apiKey) return [];
  try {
    const now  = new Date();
    const from = new Date(now); from.setDate(from.getDate() - 3);
    const fmt  = d => d.toISOString().slice(0, 10);
    const r    = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${fmt(from)}&dateTo=${fmt(now)}&status=FINISHED`,
      { headers: { 'X-Auth-Token': apiKey }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.matches || []).slice(0, 20).map((m, i) => {
      const hs = m.score?.fullTime?.home;
      const as = m.score?.fullTime?.away;
      const home = m.homeTeam?.name || '';
      const away = m.awayTeam?.name || '';
      return {
        id:      `fd_${m.id}`,
        title:   `${home} ${hs}–${as} ${away} | ${m.competition?.name || 'Football'}`,
        summary: `Full time: ${home} ${hs}, ${away} ${as}. ${m.competition?.name || ''} match on ${(m.utcDate||'').slice(0,10)}.`,
        image:   m.homeTeam?.crest || null,
        source:  'football-data.org',
        url:     '',
        date:    m.utcDate || new Date().toISOString(),
        category:'results',
      };
    });
  } catch(e) { return []; }
}

function fallback() {
  const now = new Date().toISOString();
  return [
    { id:'f1', title:'Copa América — Live Tournament Coverage', summary:'Live scores, standings and news for all 16 nations in Copa América.', image:null, source:'CopaAmerica', url:'', date:now },
    { id:'f2', title:'Copa Libertadores — South America\'s Biggest Club Cup', summary:'Follow every match from CONMEBOL Copa Libertadores — South America\'s Champions League.', image:null, source:'CopaAmerica', url:'', date:now },
    { id:'f3', title:'World Cup 2026 — USA, Canada and Mexico', summary:'The 2026 FIFA World Cup. 48 teams, 3 host nations, the biggest tournament in football history.', image:null, source:'CopaAmerica', url:'', date:now },
    { id:'f4', title:'Premier League — Latest Results', summary:'All the latest results, standings and news from the English Premier League.', image:null, source:'CopaAmerica', url:'', date:now },
    { id:'f5', title:'Champions League — Europe\'s Elite', summary:'Follow every match from the UEFA Champions League group stage and knockouts.', image:null, source:'CopaAmerica', url:'', date:now },
  ];
}

export async function onRequestGet(context) {
  const url    = new URL(context.request.url);
  const page   = parseInt(url.searchParams.get('page') || '1', 10);
  const filter = url.searchParams.get('filter') || 'all';
  const fdKey  = context.env?.FD_API_KEY || 'ff8b4eed3f2b426aab199e77061149b4';
  const gKey   = context.env?.GUARDIAN_KEY || 'test';

  /* Run all in parallel */
  const [espn, espnG, guardian, fdRes] = await Promise.all([
    fetchESPN(page),
    fetchESPNGeneral(page),
    fetchGuardian(page, gKey),
    fetchFDResults(fdKey),
  ]);

  let articles = [...espn, ...espnG, ...guardian, ...fdRes];

  /* Deduplicate */
  const seen = new Set();
  articles = articles.filter(a => {
    if (!a.title) return false;
    const k = a.title.toLowerCase().slice(0, 50);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  /* Sort newest first */
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  /* Filter */
  if (filter !== 'all') {
    const maps = {
      'copa-america': ['copa','america','conmebol','argentina','brazil','colombia','uruguay'],
      'libertadores': ['libertadores','lib','south america','conmebol'],
      'results':      ['result','score','win','beat','defeat','draw','goal','–','-'],
      'transfers':    ['transfer','sign','deal','fee','join','move'],
      'injuries':     ['injur','return','fitness','sidelined'],
    };
    const words = maps[filter] || [];
    if (words.length) {
      articles = articles.filter(a => {
        const t = (a.title + ' ' + (a.summary || '')).toLowerCase();
        return words.some(w => t.includes(w));
      });
    }
  }

  if (!articles.length) articles = fallback();

  /* Paginate — 15 per page */
  const perPage = 15;
  const start   = (page - 1) * perPage;
  const paged   = articles.slice(start, start + perPage);

  /* hasMore: true if there are more articles OR if we can fetch more pages */
  const hasMore = paged.length >= perPage || page < 10;

  return new Response(JSON.stringify({
    success:  true,
    page,
    total:    articles.length,
    hasMore,
    sources:  [...new Set(articles.map(a => a.source))],
    articles: paged,
  }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
