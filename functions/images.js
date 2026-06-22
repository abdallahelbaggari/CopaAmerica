/**
 * CopaAmerica · /images · v2.0
 * Wikimedia Commons — Copa América football images
 * No API key required · CC Licensed · Unlimited pagination
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control':                'public, max-age=300, stale-while-revalidate=600',
};

/* Rotate queries per page for variety */
const QUERIES = {
  all:      ['Copa America football', 'CONMEBOL football', 'South America soccer',
             'Argentina football national team', 'Brazil football', 'football stadium USA'],
  players:  ['Copa America player', 'South America football player',
             'Argentina football player', 'Brazil football player'],
  stadiums: ['football stadium United States', 'soccer stadium Miami',
             'football arena Dallas', 'MetLife Stadium football'],
  fans:     ['football fans South America', 'Copa America supporters',
             'Argentina football fans', 'Brazil football supporters'],
  trophies: ['Copa America trophy', 'CONMEBOL trophy football',
             'football trophy South America'],
};

async function fetchWikimedia(query, page, limit) {
  const offset = (page - 1) * limit;
  const url    = 'https://commons.wikimedia.org/w/api.php'
    + '?action=query'
    + '&generator=search'
    + '&gsrnamespace=6'
    + '&gsrsearch=' + encodeURIComponent(query)
    + '&gsrlimit=' + limit
    + '&gsroffset=' + offset
    + '&prop=imageinfo'
    + '&iiprop=url|size|mime|extmetadata'
    + '&iiurlwidth=1200'
    + '&format=json'
    + '&origin=*';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const d = await r.json();
    const pages = d.query?.pages || {};
    return Object.values(pages).map(p => {
      const info = p.imageinfo?.[0];
      if (!info) return null;
      const mime = info.mime || '';
      if (!mime.startsWith('image/') || mime.includes('svg')) return null;
      const meta    = info.extmetadata || {};
      const caption = (meta.ImageDescription?.value || meta.ObjectName?.value || p.title || '')
        .replace(/<[^>]+>/g, '').slice(0, 120);
      const author  = (meta.Artist?.value || '').replace(/<[^>]+>/g, '').slice(0, 50);
      const license = (meta.LicenseShortName?.value || 'CC Licensed').slice(0, 30);
      return {
        id:      'wm_' + p.pageid,
        url:     info.url,
        thumb:   info.thumburl || info.url,
        fullUrl: info.url,
        caption, author, license,
        source:  'Wikimedia Commons',
        width:   info.width,
        height:  info.height,
      };
    }).filter(Boolean);
  } catch(e) { return []; }
}

/* Reliable fallback images always visible */
function fallbackImages() {
  return [
    { id:'fb1', url:'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/CONMEBOL_logo.svg/800px-CONMEBOL_logo.svg.png', thumb:'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/CONMEBOL_logo.svg/400px-CONMEBOL_logo.svg.png', fullUrl:'https://upload.wikimedia.org/wikipedia/commons/8/8c/CONMEBOL_logo.svg', caption:'CONMEBOL Logo', source:'Wikimedia', license:'Public Domain' },
    { id:'fb2', url:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Football_Pallo_valmiina-cropped.jpg/800px-Football_Pallo_valmiina-cropped.jpg', thumb:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Football_Pallo_valmiina-cropped.jpg/400px-Football_Pallo_valmiina-cropped.jpg', fullUrl:'https://upload.wikimedia.org/wikipedia/commons/9/91/Football_Pallo_valmiina-cropped.jpg', caption:'Football', source:'Wikimedia', license:'CC BY-SA' },
    { id:'fb3', url:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Copa_Am%C3%A9rica_2024_logo.svg/800px-Copa_Am%C3%A9rica_2024_logo.svg.png', thumb:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Copa_Am%C3%A9rica_2024_logo.svg/400px-Copa_Am%C3%A9rica_2024_logo.svg.png', fullUrl:'https://upload.wikimedia.org/wikipedia/commons/1/16/Copa_Am%C3%A9rica_2024_logo.svg', caption:'Copa América 2024 Logo', source:'Wikimedia', license:'Public Domain' },
  ];
}

export async function onRequestGet(context) {
  const url      = new URL(context.request.url);
  const category = url.searchParams.get('category') || 'all';
  const page     = parseInt(url.searchParams.get('page') || '1', 10);
  const perPage  = 12;

  const queries = QUERIES[category] || QUERIES.all;
  /* Rotate query per page for infinite scroll variety */
  const query   = queries[(page - 1) % queries.length];

  console.log(`[CopaAmerica/images] category=${category} page=${page} query="${query}"`);

  const images = await fetchWikimedia(query, page, perPage);

  /* Filter valid images */
  const filtered = images.filter(img =>
    img.url &&
    !img.url.endsWith('.svg') &&
    img.url.includes('wikimedia') &&
    (img.width === undefined || img.width >= 300)
  );

  const result = filtered.length ? filtered : fallbackImages();

  return new Response(JSON.stringify({
    success:  true,
    category,
    page,
    query,
    total:    result.length,
    hasMore:  filtered.length >= perPage - 2,
    images:   result,
  }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
