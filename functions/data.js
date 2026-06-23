/**
 * CopaAmerica · /data · v4.0
 * football-data.org FREE TIER (ff8b4eed3f2b426aab199e77061149b4)
 * 12 competitions: WC, CL, BL1, DED, BSA, PD, FL1, ELC, PPL, EC, SA, PL
 * + ESPN unofficial (Copa América, Libertadores, Sudamericana — not in free tier)
 * + TheSportsDB (Copa América fallback)
 * Rate limit: 10 calls/min → use Cache-Control + stale-while-revalidate
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control':                'public, max-age=60, stale-while-revalidate=120',
};

/* ── COMPETITIONS ── */
/* football-data.org FREE competitions */
const FD_COMPS = {
  WC:  { name:'World Cup',          flag:'🌍', group:'World' },
  CL:  { name:'Champions League',   flag:'⭐', group:'Europe' },
  PL:  { name:'Premier League',     flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', group:'Europe' },
  PD:  { name:'La Liga',            flag:'🇪🇸', group:'Europe' },
  SA:  { name:'Serie A',            flag:'🇮🇹', group:'Europe' },
  BL1: { name:'Bundesliga',         flag:'🇩🇪', group:'Europe' },
  FL1: { name:'Ligue 1',            flag:'🇫🇷', group:'Europe' },
  DED: { name:'Eredivisie',         flag:'🇳🇱', group:'Europe' },
  PPL: { name:'Primeira Liga',      flag:'🇵🇹', group:'Europe' },
  ELC: { name:'Championship',       flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', group:'Europe' },
  BSA: { name:'Brasileirao',        flag:'🇧🇷', group:'South America' },
  EC:  { name:'Euro Championship',  flag:'🇪🇺', group:'Europe' },
};

/* ESPN unofficial — not in FD free tier */
const ESPN_COMPS = {
  'conmebol.copa.america':        { name:'Copa América',        flag:'🏆', group:'South America' },
  'conmebol.libertadores':        { name:'Copa Libertadores',   flag:'🌎', group:'South America' },
  'conmebol.sudamericana':        { name:'Copa Sudamericana',   flag:'⚽', group:'South America' },
  'conmebol.world.qualifying':    { name:'WC Qualifiers CONMEBOL', flag:'🌍', group:'South America' },
  'concacaf.champions':           { name:'CONCACAF Champions',  flag:'🌎', group:'CONCACAF' },
};

/* All league options for the frontend dropdown */
const ALL_LEAGUES = [
  /* South American — CopaAmerica's identity */
  { code:'CA',  name:'Copa América',          flag:'🏆', source:'espn', espn:'conmebol.copa.america' },
  { code:'LIB', name:'Copa Libertadores',     flag:'🌎', source:'espn', espn:'conmebol.libertadores' },
  { code:'SUD', name:'Copa Sudamericana',     flag:'⚽', source:'espn', espn:'conmebol.sudamericana' },
  { code:'BSA', name:'Brasileirao',           flag:'🇧🇷', source:'fd',  fd:'BSA' },
  { code:'WCQ', name:'WC Qualifiers',         flag:'🌍', source:'espn', espn:'conmebol.world.qualifying' },
  /* Global */
  { code:'WC',  name:'World Cup',             flag:'🌍', source:'fd',  fd:'WC' },
  { code:'CL',  name:'Champions League',      flag:'⭐', source:'fd',  fd:'CL' },
  { code:'PL',  name:'Premier League',        flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', source:'fd',  fd:'PL' },
  { code:'PD',  name:'La Liga',               flag:'🇪🇸', source:'fd',  fd:'PD' },
  { code:'SA',  name:'Serie A',               flag:'🇮🇹', source:'fd',  fd:'SA' },
  { code:'BL1', name:'Bundesliga',            flag:'🇩🇪', source:'fd',  fd:'BL1' },
  { code:'FL1', name:'Ligue 1',               flag:'🇫🇷', source:'fd',  fd:'FL1' },
  { code:'EC',  name:'Euro Championship',     flag:'🇪🇺', source:'fd',  fd:'EC' },
];

/* ── FETCH HELPERS ── */
async function fdFetch(path, apiKey) {
  const r = await fetch('https://api.football-data.org/v4/' + path, {
    headers: { 'X-Auth-Token': apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('FD ' + r.status);
  return r.json();
}

async function espnFetch(slug, endpoint) {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/' + slug + '/' + endpoint;
  const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error('ESPN ' + r.status);
  return r.json();
}

async function tsdbFetch(path) {
  const r = await fetch('https://www.thesportsdb.com/api/v1/json/3/' + path, {
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) throw new Error('TSDB ' + r.status);
  return r.json();
}

/* ── NORMALISE MATCH from football-data.org ── */
function normFDMatch(m) {
  const now    = new Date();
  const todayS = now.toISOString().slice(0, 10);
  const dateS  = (m.utcDate || '').slice(0, 10);
  const st     = m.status || '';
  const isLive = st === 'IN_PLAY' || st === 'PAUSED';
  const isDone = st === 'FINISHED';
  const hs = m.score?.fullTime?.home;
  const as = m.score?.fullTime?.away;
  const hht= m.score?.halfTime?.home;
  const aht= m.score?.halfTime?.away;
  return {
    id:        String(m.id),
    homeTeam:  m.homeTeam?.name || m.homeTeam?.shortName || '',
    awayTeam:  m.awayTeam?.name || m.awayTeam?.shortName || '',
    homeAbbr:  m.homeTeam?.tla || '',
    awayAbbr:  m.awayTeam?.tla || '',
    homeLogo:  m.homeTeam?.crest || '',
    awayLogo:  m.awayTeam?.crest || '',
    homeScore: hs !== null && hs !== undefined ? hs : (hht !== null && hht !== undefined ? hht : null),
    awayScore: as !== null && as !== undefined ? as : (aht !== null && aht !== undefined ? aht : null),
    status:    st,
    isLive,
    isDone,
    utcDate:   m.utcDate || '',
    dateStr:   dateS,
    isToday:   dateS === todayS,
    venue:     m.venue || '',
    round:     m.matchday ? 'MD ' + m.matchday : (m.stage || ''),
    minute:    m.minute ? m.minute + "'" : null,
    competition: m.competition?.name || '',
    source:    'football-data',
  };
}

/* ── NORMALISE MATCH from ESPN ── */
function normESPNMatch(e, compName) {
  const now     = new Date();
  const todayS  = now.toISOString().slice(0, 10);
  const comp    = e.competitions?.[0];
  const teams   = comp?.competitors || [];
  const home    = teams.find(t => t.homeAway === 'home') || teams[0] || {};
  const away    = teams.find(t => t.homeAway === 'away') || teams[1] || {};
  const st      = comp?.status?.type?.name || '';
  const isLive  = st === 'in' || st === 'in progress';
  const isDone  = st === 'post';
  const dateS   = (e.date || '').slice(0, 10);
  return {
    id:        'espn_' + e.id,
    homeTeam:  home.team?.displayName || '',
    awayTeam:  away.team?.displayName || '',
    homeAbbr:  home.team?.abbreviation || '',
    awayAbbr:  away.team?.abbreviation || '',
    homeLogo:  home.team?.logo || '',
    awayLogo:  away.team?.logo || '',
    homeScore: home.score !== undefined ? parseInt(home.score) : null,
    awayScore: away.score !== undefined ? parseInt(away.score) : null,
    status:    st,
    isLive,
    isDone,
    utcDate:   e.date || '',
    dateStr:   dateS,
    isToday:   dateS === todayS,
    venue:     comp?.venue?.fullName || '',
    round:     e.season?.displayName || '',
    minute:    comp?.status?.displayClock || null,
    competition: compName || '',
    source:    'espn',
  };
}

/* ── FIXTURES (main) ── */
async function getFixtures(league, apiKey) {
  const now    = new Date();
  const todayS = now.toISOString().slice(0, 10);
  const from   = new Date(now); from.setDate(from.getDate() - 5);
  const to     = new Date(now); to.setDate(to.getDate() + 14);
  const fmt    = d => d.toISOString().slice(0, 10);

  let matches = [];

  if (league === 'ALL' || !league) {
    /* Fetch all FD competitions + ESPN South American */
    const fdCodes  = ['WC','CL','PL','PD','SA','BL1','FL1','BSA'];
    const espnSlugs = [
      { slug:'conmebol.copa.america',     name:'Copa América' },
      { slug:'conmebol.libertadores',     name:'Copa Libertadores' },
      { slug:'conmebol.sudamericana',     name:'Copa Sudamericana' },
    ];

    const [fdResults, ...espnResults] = await Promise.allSettled([
      /* Single FD call — all matches in date range */
      fdFetch(`matches?dateFrom=${fmt(from)}&dateTo=${fmt(to)}`, apiKey),
      ...espnSlugs.map(c => espnFetch(c.slug, 'scoreboard').then(d => ({...d, _name: c.name}))),
    ]);

    if (fdResults.status === 'fulfilled') {
      matches = (fdResults.value.matches || []).map(normFDMatch);
    }
    espnResults.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        const d = r.value;
        (d.events || []).forEach(e => {
          matches.push(normESPNMatch(e, espnSlugs[i].name));
        });
      }
    });

  } else {
    /* Single league */
    const leagueConf = ALL_LEAGUES.find(l => l.code === league);
    if (leagueConf?.source === 'fd') {
      try {
        const d = await fdFetch(
          `competitions/${leagueConf.fd}/matches?dateFrom=${fmt(from)}&dateTo=${fmt(to)}`,
          apiKey
        );
        matches = (d.matches || []).map(normFDMatch);
      } catch(e) { matches = []; }
    } else if (leagueConf?.source === 'espn') {
      try {
        const d = await espnFetch(leagueConf.espn, 'scoreboard');
        matches = (d.events || []).map(e => normESPNMatch(e, leagueConf.name));
      } catch(e) { matches = []; }
    }
  }

  /* Group matches */
  const live     = matches.filter(m => m.isLive);
  const today    = matches.filter(m => !m.isLive && m.isToday);
  const upcoming = matches.filter(m => !m.isLive && !m.isDone && m.dateStr > todayS);
  const results  = matches.filter(m => m.isDone)
                          .sort((a,b) => new Date(b.utcDate) - new Date(a.utcDate))
                          .slice(0, 50);

  return { source: 'fd+espn', total: matches.length, groups: { live, today, upcoming, results }, matches };
}

/* ── STANDINGS ── */
async function getStandings(league, apiKey) {
  const leagueConf = ALL_LEAGUES.find(l => l.code === league) || ALL_LEAGUES.find(l => l.code === 'CA');

  if (leagueConf?.source === 'fd') {
    try {
      const d = await fdFetch(`competitions/${leagueConf.fd}/standings`, apiKey);
      const standings = (d.standings || []).map(s => ({
        name: s.group || s.stage || 'Standings',
        rows: (s.table || []).map(r => ({
          position: r.position,
          team:     r.team?.name || '',
          abbr:     r.team?.tla || '',
          logo:     r.team?.crest || '',
          played:   r.playedGames || 0,
          won:      r.won || 0,
          drawn:    r.draw || 0,
          lost:     r.lost || 0,
          gf:       r.goalsFor || 0,
          ga:       r.goalsAgainst || 0,
          gd:       r.goalDifference || 0,
          points:   r.points || 0,
          form:     r.form || '',
        })),
      }));
      return { source: 'football-data', groups: standings };
    } catch(e) {}
  }

  if (leagueConf?.source === 'espn' || leagueConf?.code === 'CA') {
    try {
      const slug = leagueConf?.espn || 'conmebol.copa.america';
      const d    = await espnFetch(slug, 'standings');
      const groups = (d.standings || []).map(g => ({
        name: g.name || g.abbreviation || 'Group',
        rows: (g.entries || []).map((e, i) => ({
          position: i + 1,
          team:     e.team?.displayName || '',
          abbr:     e.team?.abbreviation || '',
          logo:     e.team?.logos?.[0]?.href || '',
          played:   e.stats?.find(s => s.name === 'gamesPlayed')?.value || 0,
          won:      e.stats?.find(s => s.name === 'wins')?.value || 0,
          drawn:    e.stats?.find(s => s.name === 'ties')?.value || 0,
          lost:     e.stats?.find(s => s.name === 'losses')?.value || 0,
          gf:       e.stats?.find(s => s.name === 'pointsFor')?.value || 0,
          ga:       e.stats?.find(s => s.name === 'pointsAgainst')?.value || 0,
          gd:       e.stats?.find(s => s.name === 'pointDifferential')?.value || 0,
          points:   e.stats?.find(s => s.name === 'points')?.value || 0,
        })),
      }));
      return { source: 'espn', groups };
    } catch(e) {}
  }

  return { source: 'none', groups: [] };
}

/* ── SCORERS ── */
async function getScorers(league, apiKey) {
  const leagueConf = ALL_LEAGUES.find(l => l.code === league) || ALL_LEAGUES.find(l => l.code === 'CA');

  if (leagueConf?.source === 'fd') {
    try {
      const d = await fdFetch(`competitions/${leagueConf.fd}/scorers?limit=20`, apiKey);
      return {
        source: 'football-data',
        scorers: (d.scorers || []).map(s => ({
          name:     s.player?.name || '',
          team:     s.team?.name || '',
          logo:     s.team?.crest || '',
          goals:    s.goals || 0,
          assists:  s.assists || 0,
          penalties: s.penalties || 0,
        })),
      };
    } catch(e) {}
  }

  /* ESPN fallback */
  try {
    const slug = leagueConf?.espn || 'conmebol.copa.america';
    const d    = await espnFetch(slug, 'leaders');
    const cat  = (d.categories || []).find(c => c.name === 'goals' || c.abbreviation === 'G');
    if (cat?.leaders?.length) {
      return {
        source: 'espn',
        scorers: cat.leaders.slice(0, 20).map(l => ({
          name:    l.athlete?.displayName || '',
          team:    l.team?.displayName || '',
          logo:    l.team?.logos?.[0]?.href || '',
          goals:   l.value || 0,
          assists: 0,
        })),
      };
    }
  } catch(e) {}

  return { source: 'none', scorers: [] };
}

/* ── LEAGUES LIST ── */
function getLeagues() {
  return { leagues: ALL_LEAGUES };
}

/* ── MAIN HANDLER ── */
export async function onRequestGet(context) {
  const url    = new URL(context.request.url);
  const type   = url.searchParams.get('type')   || 'health';
  const league = (url.searchParams.get('league') || 'ALL').toUpperCase();
  const apiKey = context.env.FD_API_KEY || 'ff8b4eed3f2b426aab199e77061149b4';

  console.log(`[CopaAmerica/data] type=${type} league=${league}`);

  let data;
  try {
    switch(type) {
      case 'fixtures':  data = await getFixtures(league, apiKey);  break;
      case 'standings': data = await getStandings(league, apiKey); break;
      case 'scorers':   data = await getScorers(league, apiKey);   break;
      case 'leagues':   data = getLeagues();                        break;
      default:
        data = {
          status: 'ok', app: 'CopaAmerica', version: '2.0',
          now: new Date().toISOString(),
          fd_key: apiKey ? 'SET' : 'MISSING',
          competitions: Object.keys(FD_COMPS),
        };
    }
  } catch(err) {
    console.error('[CopaAmerica/data] Error:', err.message);
    data = { error: err.message };
  }

  return new Response(JSON.stringify({ success: true, type, league, ...data }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
