/**
 * CopaAmerica · /images · v3.0
 * Wikimedia Commons — truly unlimited infinite scroll
 * Rotates 20+ queries — pages 1→100 all return fresh content
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control':                'public, max-age=300, stale-while-revalidate=600',
};

/* 20 queries — rotate per page for maximum variety */
const ALL_QUERIES = [
  'Copa America football tournament',
  'Premier League football match',
  'Champions League football',
  'World Cup FIFA football',
  'football stadium crowd',
  'Copa Libertadores football',
  'La Liga football Spain',
  'Bundesliga football Germany',
  'Serie A football Italy',
  'football referee goal celebration',
  'South America football fans',
  'football training session',
  'football trophy award ceremony',
  'Wembley stadium football',
  'football penalty kick',
  'football header goal',
  'international football match',
  'football pitch aerial view',
  'football dribbling skill',
  'football goalkeeper save',
];

const CAT_QUERIES = {
  all:      ALL_QUERIES,
  players:  ['football player dribbling','football striker goal','football midfielder','football defender'],
  stadiums: ['football stadium full','soccer arena night','football ground crowd','stadium aerial view'],
  fans:     ['football supporters crowd','football fans celebration','ultras football supporters'],
  trophies: ['FIFA World Cup trophy','football championship trophy','Copa America trophy CONMEBOL'],
};

async function wikimediaSearch(query, offset, limit) {
  const url = 'https://commons.wikimedia.org/w/api.php'
    + '?action=query'
    + '&generator=search'
    + '&gsrnamespace=6'
    + '&gsrsearch=' + encodeURIComponent(query + ' filetype:jpeg|jpg|png')
    + '&gsrlimit=' + limit
    + '&gsroffset=' + offset
    + '&prop=imageinfo'
    + '&iiprop=url|size|mime|extmetadata'
    + '&iiurlwidth=1200'
    + '&format=json'
    + '&origin=*';
  const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) return [];
  const d = await r.json();
  return Object.values(d.query?.pages || {}).map(p => {
    const info = p.imageinfo?.[0];
    if (!info) return null;
    const mime = info.mime || '';
    if (!mime.startsWith('image/') || mime.includes('svg')) return null;
    const meta    = info.extmetadata || {};
    const caption = (meta.ImageDescription?.value || meta.ObjectName?.value || p.title || '')
      .replace(/<[^>]+>/g,'').replace(/&[a-z]+;/gi,'').slice(0,120);
    const license = (meta.LicenseShortName?.value || 'CC Licensed').slice(0,30);
    const author  = (meta.Artist?.value || '').replace(/<[^>]+>/g,'').slice(0,50);
    if (!info.url || info.url.includes('.svg')) return null;
    return {
      id:      'wm_'+p.pageid,
      url:     info.url,
      thumb:   info.thumburl || info.url,
      fullUrl: info.url,
      caption: caption || 'Football Image',
      author, license,
      source:  'Wikimedia Commons',
      width:   info.width  || 0,
      height:  info.height || 0,
    };
  }).filter(Boolean);
}

export async function onRequestGet(context) {
  const url      = new URL(context.request.url);
  const category = url.searchParams.get('category') || 'all';
  const page     = Math.max(1, parseInt(url.searchParams.get('page')||'1',10));
  const perPage  = 12;

  const queries = CAT_QUERIES[category] || CAT_QUERIES.all;

  /* Use 2 queries per page for more images and variety */
  const q1 = queries[(page-1) % queries.length];
  const q2 = queries[page % queries.length];
  const offset1 = Math.floor((page-1)/queries.length) * perPage;
  const offset2 = Math.floor((page-1)/queries.length) * 6;

  /* Run 2 queries in parallel */
  const [imgs1, imgs2] = await Promise.all([
    wikimediaSearch(q1, offset1, perPage).catch(()=>[]),
    wikimediaSearch(q2, offset2, 8).catch(()=>[]),
  ]);

  /* Merge and deduplicate */
  const seen = new Set();
  const merged = [...imgs1, ...imgs2].filter(img => {
    if (!img?.url || seen.has(img.url)) return false;
    seen.add(img.url); return true;
  });

  /* Filter minimum quality */
  const filtered = merged.filter(img =>
    img.url &&
    !img.url.toLowerCase().endsWith('.svg') &&
    (img.width === 0 || img.width >= 200)
  );

  /* Reliable fallbacks */
  const fallbacks = [
    { id:'fb1', url:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Football_Pallo_valmiina-cropped.jpg/800px-Football_Pallo_valmiina-cropped.jpg', thumb:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Football_Pallo_valmiina-cropped.jpg/400px-Football_Pallo_valmiina-cropped.jpg', fullUrl:'https://upload.wikimedia.org/wikipedia/commons/9/91/Football_Pallo_valmiina-cropped.jpg', caption:'Football', source:'Wikimedia Commons', license:'CC BY-SA', width:800, height:600 },
    { id:'fb2', url:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/800px-Camponotus_flavomarginatus_ant.jpg', thumb:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Football_Pallo_valmiina-cropped.jpg/400px-Football_Pallo_valmiina-cropped.jpg', fullUrl:'https://upload.wikimedia.org/wikipedia/commons/9/91/Football_Pallo_valmiina-cropped.jpg', caption:'Football Match', source:'Wikimedia Commons', license:'CC BY-SA', width:800, height:600 },
  ];

  const result = filtered.length >= 2 ? filtered : [...filtered, ...fallbacks.slice(0, 3-filtered.length)];

  return new Response(JSON.stringify({
    success:  true,
    category, page,
    query:    q1,
    total:    result.length,
    hasMore:  page < 100, /* Always true — 100 pages of variety */
    images:   result,
  }), { headers: { ...CORS, 'Content-Type':'application/json' } });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
