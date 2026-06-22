/**
 * CopaAmerica · /data · Cloudflare Worker
 * Sources: ESPN (unofficial) + TheSportsDB (free) + Sofascore (unofficial)
 * Copa América focused — all 16 nations
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control':                'public, max-age=60',
};

const CA_TEAMS = [
  {name:'Argentina',flag:'🇦🇷',group:'A',abbr:'ARG'},
  {name:'Chile',    flag:'🇨🇱',group:'A',abbr:'CHI'},
  {name:'Peru',     flag:'🇵🇪',group:'A',abbr:'PER'}, // replaced by Ecuador in 2024
  {name:'Canada',   flag:'🇨🇦',group:'A',abbr:'CAN'},
  {name:'Mexico',   flag:'🇲🇽',group:'B',abbr:'MEX'},
  {name:'Ecuador',  flag:'🇪🇨',group:'B',abbr:'ECU'},
  {name:'Venezuela',flag:'🇻🇪',group:'B',abbr:'VEN'},
  {name:'Jamaica',  flag:'🇯🇲',group:'B',abbr:'JAM'},
  {name:'Uruguay',  flag:'🇺🇾',group:'C',abbr:'URU'},
  {name:'USA',      flag:'🇺🇸',group:'C',abbr:'USA'},
  {name:'Panama',   flag:'🇵🇦',group:'C',abbr:'PAN'},
  {name:'Bolivia',  flag:'🇧🇴',group:'C',abbr:'BOL'},
  {name:'Brazil',   flag:'🇧🇷',group:'D',abbr:'BRA'},
  {name:'Colombia', flag:'🇨🇴',group:'D',abbr:'COL'},
  {name:'Paraguay', flag:'🇵🇾',group:'D',abbr:'PAR'},
  {name:'Costa Rica',flag:'🇨🇷',group:'D',abbr:'CRC'},
];

async function espnFetch(path) {
  try {
    const r = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/' + path,
      { signal: AbortSignal.timeout(7000) }
    );
    return r.ok ? r.json() : null;
  } catch(e) { return null; }
}

async function tsdbFetch(path) {
  try {
    const r = await fetch(
      'https://www.thesportsdb.com/api/v1/json/3/' + path,
      { signal: AbortSignal.timeout(7000) }
    );
    return r.ok ? r.json() : null;
  } catch(e) { return null; }
}

async function sofaFetch(path) {
  try {
    const r = await fetch('https://api.sofascore.com/api/v1/' + path, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' },
      signal: AbortSignal.timeout(7000),
    });
    return r.ok ? r.json() : null;
  } catch(e) { return null; }
}

/* ── FIXTURES ── */
async function getFixtures() {
  /* ESPN Copa América scoreboard */
  const espn = await espnFetch('conmebol.copa.america/scoreboard');
  if (espn?.events?.length) {
    const now     = new Date();
    const todayS  = now.toISOString().slice(0,10);
    const matches = espn.events.map(e => {
      const comp  = e.competitions?.[0];
      const teams = comp?.competitors || [];
      const home  = teams.find(t => t.homeAway==='home') || teams[0] || {};
      const away  = teams.find(t => t.homeAway==='away') || teams[1] || {};
      const st    = comp?.status?.type?.name || '';
      const isLive = st === 'in' || st === 'in progress';
      const isDone = st === 'post';
      const dateS  = (e.date||'').slice(0,10);
      return {
        id:        e.id,
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
      };
    });
    const now2 = new Date();
    const todayStr = now2.toISOString().slice(0,10);
    const groups = {
      live:     matches.filter(m => m.isLive),
      today:    matches.filter(m => !m.isLive && m.isToday),
      upcoming: matches.filter(m => !m.isLive && !m.isDone && m.dateStr > todayStr),
      results:  matches.filter(m => m.isDone),
    };
    return { source:'ESPN', total:matches.length, groups, matches };
  }

  /* TheSportsDB fallback — Copa América league ID 4319 */
  const tsdb = await tsdbFetch('eventsseason.php?id=4319&s=2024');
  if (tsdb?.events?.length) {
    const matches = tsdb.events.map(e => ({
      id:        e.idEvent,
      homeTeam:  e.strHomeTeam || '',
      awayTeam:  e.strAwayTeam || '',
      homeLogo:  e.strHomeTeamBadge || '',
      awayLogo:  e.strAwayTeamBadge || '',
      homeScore: e.intHomeScore !== null ? parseInt(e.intHomeScore) : null,
      awayScore: e.intAwayScore !== null ? parseInt(e.intAwayScore) : null,
      status:    e.strStatus || '',
      isDone:    e.strStatus === 'Match Finished',
      isLive:    e.strStatus === 'Live',
      utcDate:   e.dateEvent + 'T' + (e.strTime||'00:00:00'),
      venue:     e.strVenue || '',
      round:     e.strRound || '',
    }));
    return { source:'TheSportsDB', total:matches.length, matches,
      groups:{ live:[], today:[], upcoming:matches.filter(m=>!m.isDone), results:matches.filter(m=>m.isDone) } };
  }

  return { source:'none', total:0, matches:[],
    groups:{ live:[], today:[], upcoming:[], results:[] } };
}

/* ── STANDINGS ── */
async function getStandings() {
  const espn = await espnFetch('conmebol.copa.america/standings');
  if (espn?.standings?.length) {
    const groups = [];
    espn.standings.forEach(group => {
      const rows = (group.entries || []).map((e,i) => ({
        position:  i+1,
        team:      e.team?.displayName || '',
        abbr:      e.team?.abbreviation || '',
        logo:      e.team?.logos?.[0]?.href || '',
        played:    e.stats?.find(s=>s.name==='gamesPlayed')?.value    || 0,
        won:       e.stats?.find(s=>s.name==='wins')?.value            || 0,
        drawn:     e.stats?.find(s=>s.name==='ties')?.value            || 0,
        lost:      e.stats?.find(s=>s.name==='losses')?.value          || 0,
        gf:        e.stats?.find(s=>s.name==='pointsFor')?.value       || 0,
        ga:        e.stats?.find(s=>s.name==='pointsAgainst')?.value   || 0,
        gd:        e.stats?.find(s=>s.name==='pointDifferential')?.value || 0,
        points:    e.stats?.find(s=>s.name==='points')?.value          || 0,
      }));
      groups.push({ name: group.name || group.abbreviation || '', rows });
    });
    return { source:'ESPN', groups };
  }
  /* Fallback: static groups from CA_TEAMS */
  const staticGroups = ['A','B','C','D'].map(g => ({
    name: 'Group ' + g,
    rows: CA_TEAMS.filter(t=>t.group===g).map((t,i) => ({
      position:i+1, team:t.name, abbr:t.abbr, logo:'',
      played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, points:0,
    })),
  }));
  return { source:'static', groups: staticGroups };
}

/* ── SCORERS ── */
async function getScorers() {
  const espn = await espnFetch('conmebol.copa.america/leaders');
  if (espn?.categories?.length) {
    const goals = espn.categories.find(c => c.name==='goals' || c.abbreviation==='G');
    if (goals?.leaders?.length) {
      return {
        source: 'ESPN',
        scorers: goals.leaders.slice(0,20).map(l => ({
          name:   l.athlete?.displayName || '',
          team:   l.team?.displayName || '',
          logo:   l.team?.logos?.[0]?.href || '',
          goals:  l.value || 0,
        })),
      };
    }
  }
  return { source:'none', scorers:[] };
}

/* ── TEAMS ── */
function getTeams() {
  return { source:'static', teams: CA_TEAMS };
}

/* ── LIVE ── */
async function getLive() {
  const data = await getFixtures();
  return { source: data.source, matches: data.groups?.live || [] };
}

/* ── MAIN ── */
export async function onRequestGet(context) {
  const url   = new URL(context.request.url);
  const type  = url.searchParams.get('type') || 'health';
  const match = url.searchParams.get('match') || '';

  let data;
  switch(type) {
    case 'fixtures':  data = await getFixtures();  break;
    case 'standings': data = await getStandings(); break;
    case 'scorers':   data = await getScorers();   break;
    case 'teams':     data = getTeams();            break;
    case 'live':      data = await getLive();       break;
    default:
      data = { status:'ok', app:'CopaAmerica', version:'1.0',
        now: new Date().toISOString(),
        endpoints: ['/data?type=fixtures','/data?type=standings',
          '/data?type=scorers','/data?type=teams','/data?type=live'] };
  }
  return new Response(JSON.stringify({ success:true, type, ...data }), {
    headers: { ...CORS, 'Content-Type':'application/json' },
  });
}
export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
