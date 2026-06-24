/**
 * CopaAmerica · /data · v5.0 — COMPLETE REBUILD
 * football-data.org FREE TIER key: ff8b4eed3f2b426aab199e77061149b4
 * Free tier competitions: WC CL PL PD SA BL1 FL1 DED PPL ELC BSA EC
 * ESPN unofficial: Copa América, Libertadores, Sudamericana (not in FD free)
 *
 * RATE LIMIT: 10 calls/min — Cloudflare Cache-Control handles this
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control':                'public, max-age=60, stale-while-revalidate=120',
};

const FD_BASE  = 'https://api.football-data.org/v4';
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

/* ── Free tier competition codes ── */
const FD_CODES = ['WC','CL','PL','PD','SA','BL1','FL1','DED','PPL','ELC','BSA','EC'];

/* ── ESPN slugs for South American comps (not in FD free tier) ── */
const ESPN_COMPS = [
  { slug:'conmebol.copa.america',  name:'Copa América' },
  { slug:'conmebol.libertadores',  name:'Copa Libertadores' },
  { slug:'conmebol.sudamericana',  name:'Copa Sudamericana' },
];

/* ── League map for frontend ── */
const LEAGUES = [
  { code:'ALL', name:'All Competitions',   source:'both' },
  { code:'CA',  name:'Copa América',        source:'espn', slug:'conmebol.copa.america' },
  { code:'LIB', name:'Copa Libertadores',   source:'espn', slug:'conmebol.libertadores' },
  { code:'SUD', name:'Copa Sudamericana',   source:'espn', slug:'conmebol.sudamericana' },
  { code:'WC',  name:'World Cup',           source:'fd'  },
  { code:'CL',  name:'Champions League',    source:'fd'  },
  { code:'PL',  name:'Premier League',      source:'fd'  },
  { code:'PD',  name:'La Liga',             source:'fd'  },
  { code:'SA',  name:'Serie A',             source:'fd'  },
  { code:'BL1', name:'Bundesliga',          source:'fd'  },
  { code:'FL1', name:'Ligue 1',             source:'fd'  },
  { code:'DED', name:'Eredivisie',          source:'fd'  },
  { code:'PPL', name:'Primeira Liga',       source:'fd'  },
  { code:'ELC', name:'Championship',        source:'fd'  },
  { code:'BSA', name:'Brasileirao',         source:'fd'  },
  { code:'EC',  name:'Euro Championship',   source:'fd'  },
];

/* ── Helpers ── */
function shiftDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

async function fdGet(path, key) {
  const r = await fetch(`${FD_BASE}/${path}`, {
    headers: { 'X-Auth-Token': key },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    const txt = await r.text().catch(()=>'');
    throw new Error(`FD ${r.status}: ${txt.slice(0,100)}`);
  }
  return r.json();
}

async function espnGet(slug, endpoint, params='') {
  const r = await fetch(`${ESPN_BASE}/${slug}/${endpoint}${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`ESPN ${r.status}`);
  return r.json();
}

/* ── Normalise FD match ── */
function normFD(m, compName) {
  const todayS = new Date().toISOString().slice(0,10);
  const dateS  = (m.utcDate||'').slice(0,10);
  const st     = m.status || '';
  const isLive = st==='IN_PLAY' || st==='PAUSED';
  const isDone = st==='FINISHED';
  const hs = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null;
  const as = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null;
  return {
    id:          String(m.id),
    homeTeam:    m.homeTeam?.name || m.homeTeam?.shortName || 'TBA',
    awayTeam:    m.awayTeam?.name || m.awayTeam?.shortName || 'TBA',
    homeAbbr:    m.homeTeam?.tla  || '',
    awayAbbr:    m.awayTeam?.tla  || '',
    homeLogo:    m.homeTeam?.crest || '',
    awayLogo:    m.awayTeam?.crest || '',
    homeScore:   hs,
    awayScore:   as,
    status:      st,
    isLive, isDone,
    utcDate:     m.utcDate || '',
    dateStr:     dateS,
    isToday:     dateS === todayS,
    venue:       m.venue || '',
    round:       m.matchday ? `MD ${m.matchday}` : (m.stage||''),
    minute:      m.minute ? `${m.minute}'` : null,
    competition: compName || m.competition?.name || '',
    source:      'fd',
  };
}

/* ── Normalise ESPN match ── */
function normESPN(e, compName) {
  const todayS = new Date().toISOString().slice(0,10);
  const comp   = e.competitions?.[0];
  const teams  = comp?.competitors || [];
  const home   = teams.find(t=>t.homeAway==='home') || teams[0] || {};
  const away   = teams.find(t=>t.homeAway==='away') || teams[1] || {};
  const st     = comp?.status?.type?.name || comp?.status?.type?.state || '';
  const isLive = ['in','in progress','in-progress','halftime'].includes(st.toLowerCase());
  const isDone = ['post','final'].includes(st.toLowerCase());
  const dateS  = (e.date||'').slice(0,10);
  const todayS2= new Date().toISOString().slice(0,10);
  return {
    id:          'espn_'+e.id,
    homeTeam:    home.team?.displayName || home.team?.name || 'TBA',
    awayTeam:    away.team?.displayName || away.team?.name || 'TBA',
    homeAbbr:    home.team?.abbreviation || '',
    awayAbbr:    away.team?.abbreviation || '',
    homeLogo:    home.team?.logo || '',
    awayLogo:    away.team?.logo || '',
    homeScore:   home.score !== undefined ? Number(home.score) : null,
    awayScore:   away.score !== undefined ? Number(away.score) : null,
    status:      st,
    isLive, isDone,
    utcDate:     e.date || '',
    dateStr:     dateS,
    isToday:     dateS === todayS2,
    venue:       comp?.venue?.fullName || '',
    round:       e.season?.displayName || '',
    minute:      comp?.status?.displayClock || null,
    competition: compName || '',
    source:      'espn',
  };
}

/* ── Group matches ── */
function groupMatches(matches) {
  const todayS = new Date().toISOString().slice(0,10);
  const live     = matches.filter(m => m.isLive);
  const today    = matches.filter(m => !m.isLive && m.isToday && !m.isDone);
  const upcoming = matches.filter(m => !m.isLive && !m.isDone && m.dateStr > todayS)
                          .sort((a,b) => a.utcDate.localeCompare(b.utcDate));
  const results  = matches.filter(m => m.isDone)
                          .sort((a,b) => b.utcDate.localeCompare(a.utcDate))
                          .slice(0,60);
  return { live, today, upcoming: upcoming.slice(0,30), results };
}

/* ══════════════════════════════════════════════
   FIXTURES
══════════════════════════════════════════════ */
async function getFixtures(league, key) {
  const from = shiftDate(-7);
  const to   = shiftDate(14);
  let matches = [];

  if (league === 'ALL') {
    /* ── Pull FD competitions + ESPN South American in parallel ── */
    const fdPromises  = FD_CODES.map(code =>
      fdGet(`competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`, key)
        .then(d => (d.matches||[]).map(m => normFD(m, '')))
        .catch(() => [])
    );
    const espnPromises = ESPN_COMPS.map(c =>
      espnGet(c.slug, 'scoreboard')
        .then(d => (d.events||[]).map(e => normESPN(e, c.name)))
        .catch(() => [])
    );
    const all = await Promise.all([...fdPromises, ...espnPromises]);
    all.forEach(arr => matches.push(...arr));

  } else {
    const lg = LEAGUES.find(l => l.code === league);
    if (!lg) return { total:0, matches:[], groups:groupMatches([]) };

    if (lg.source === 'fd') {
      const d = await fdGet(
        `competitions/${league}/matches?dateFrom=${from}&dateTo=${to}`, key
      );
      matches = (d.matches||[]).map(m => normFD(m, lg.name));
    } else {
      const d = await espnGet(lg.slug, 'scoreboard');
      matches = (d.events||[]).map(e => normESPN(e, lg.name));
    }
  }

  /* Deduplicate */
  const seen = new Set();
  matches = matches.filter(m => {
    const k = `${m.homeTeam}_${m.awayTeam}_${m.dateStr}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  return { total: matches.length, matches, groups: groupMatches(matches) };
}

/* ══════════════════════════════════════════════
   STANDINGS
══════════════════════════════════════════════ */
async function getStandings(league, key) {
  const lg = LEAGUES.find(l => l.code === league) || LEAGUES.find(l=>l.code==='CA');

  if (lg.source === 'fd') {
    const d = await fdGet(`competitions/${lg.code}/standings`, key);
    const groups = (d.standings||[]).map(s => ({
      name: s.group || s.stage || 'Standings',
      rows: (s.table||[]).map(r => ({
        position: r.position,
        team:     r.team?.name || '',
        abbr:     r.team?.tla  || '',
        logo:     r.team?.crest || '',
        played:   r.playedGames || 0,
        won:      r.won  || 0,
        drawn:    r.draw || 0,
        lost:     r.lost || 0,
        gf:       r.goalsFor      || 0,
        ga:       r.goalsAgainst  || 0,
        gd:       r.goalDifference || 0,
        points:   r.points || 0,
        form:     r.form   || '',
      })),
    }));
    return { source:'fd', groups };
  }

  /* ESPN */
  const d = await espnGet(lg.slug, 'standings');
  const groups = (d.standings||[]).map(g => ({
    name: g.name || g.abbreviation || 'Group',
    rows: (g.entries||[]).map((e,i) => {
      const stat = name => e.stats?.find(s=>s.name===name)?.value || 0;
      return {
        position: i+1,
        team:     e.team?.displayName || '',
        abbr:     e.team?.abbreviation || '',
        logo:     e.team?.logos?.[0]?.href || '',
        played:   stat('gamesPlayed'),
        won:      stat('wins'),
        drawn:    stat('ties'),
        lost:     stat('losses'),
        gf:       stat('pointsFor'),
        ga:       stat('pointsAgainst'),
        gd:       stat('pointDifferential'),
        points:   stat('points'),
        form:     '',
      };
    }),
  }));
  return { source:'espn', groups };
}

/* ══════════════════════════════════════════════
   SCORERS
══════════════════════════════════════════════ */
async function getScorers(league, key) {
  const lg = LEAGUES.find(l=>l.code===league) || LEAGUES.find(l=>l.code==='CA');

  if (lg.source === 'fd') {
    const d = await fdGet(`competitions/${lg.code}/scorers?limit=20`, key);
    return {
      source: 'fd',
      scorers: (d.scorers||[]).map(s => ({
        name:      s.player?.name || '',
        team:      s.team?.name   || '',
        logo:      s.team?.crest  || '',
        goals:     s.goals        || 0,
        assists:   s.assists      || 0,
        penalties: s.penalties    || 0,
      })),
    };
  }

  /* ESPN leaders */
  const d = await espnGet(lg.slug, 'leaders');
  const cat = (d.categories||[]).find(c=>c.name==='goals'||c.abbreviation==='G');
  return {
    source: 'espn',
    scorers: (cat?.leaders||[]).slice(0,20).map(l => ({
      name:    l.athlete?.displayName || '',
      team:    l.team?.displayName    || '',
      logo:    l.team?.logos?.[0]?.href || '',
      goals:   l.value || 0,
      assists: 0,
      penalties: 0,
    })),
  };
}

/* ══════════════════════════════════════════════
   MATCH DETAIL (lineups + events)
══════════════════════════════════════════════ */
async function getMatchDetail(matchId, key) {
  /* football-data.org match detail */
  if (!matchId.startsWith('espn_')) {
    const d = await fdGet(`matches/${matchId}`, key);
    const hTeam = d.homeTeam?.name || '';
    const aTeam = d.awayTeam?.name || '';
    const goals = (d.goals||[]).map(g => ({
      minute:  g.minute,
      team:    g.team?.name || '',
      scorer:  g.scorer?.name || '',
      assist:  g.assist?.name || '',
      type:    g.type || 'REGULAR',
    }));
    const bookings = (d.bookings||[]).map(b => ({
      minute: b.minute,
      team:   b.team?.name || '',
      player: b.player?.name || '',
      card:   b.card || 'YELLOW',
    }));
    const subs = (d.substitutions||[]).map(s => ({
      minute:  s.minute,
      team:    s.team?.name || '',
      playerIn:  s.playerIn?.name  || '',
      playerOut: s.playerOut?.name || '',
    }));
    const lineup = d.lineups || [];
    return {
      source: 'fd',
      match:  normFD(d, d.competition?.name),
      goals, bookings, subs, lineup,
    };
  }

  /* ESPN match detail */
  const espnId = matchId.replace('espn_','');
  const d = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/summary?event=${espnId}`,
    { signal: AbortSignal.timeout(8000) }
  ).then(r=>r.json());

  const plays  = (d.plays||[]).filter(p=>p.type?.text);
  const rosters= d.rosters || [];
  return {
    source:  'espn',
    plays,
    rosters,
    raw: {
      homeTeam: d.header?.competitions?.[0]?.competitors?.find(c=>c.homeAway==='home')?.team?.displayName || '',
      awayTeam: d.header?.competitions?.[0]?.competitors?.find(c=>c.homeAway==='away')?.team?.displayName || '',
    },
  };
}

/* ══════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════ */
export async function onRequestGet(context) {
  const url     = new URL(context.request.url);
  const type    = url.searchParams.get('type')    || 'health';
  const league  = (url.searchParams.get('league') || 'ALL').toUpperCase();
  const matchId = url.searchParams.get('match')   || '';
  const key     = context.env?.FD_API_KEY || 'ff8b4eed3f2b426aab199e77061149b4';

  console.log(`[CA/data] type=${type} league=${league} match=${matchId}`);

  try {
    let data;
    switch(type) {
      case 'fixtures':
        data = await getFixtures(league, key);
        break;
      case 'standings':
        data = await getStandings(league, key);
        break;
      case 'scorers':
        data = await getScorers(league, key);
        break;
      case 'match':
        data = await getMatchDetail(matchId, key);
        break;
      case 'leagues':
        data = { leagues: LEAGUES };
        break;
      default:
        data = {
          status: 'ok', app: 'CopaAmerica', version:'5.0',
          now: new Date().toISOString(),
          key_set: !!context.env?.FD_API_KEY,
          free_tier: FD_CODES,
        };
    }
    return new Response(JSON.stringify({ success:true, type, league, ...data }), {
      headers: { ...CORS, 'Content-Type':'application/json' },
    });
  } catch(err) {
    console.error('[CA/data] Error:', err.message);
    return new Response(JSON.stringify({
      success:false, type, league,
      error: err.message,
      hint: 'Check FD_API_KEY env var in Cloudflare Dashboard',
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type':'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
