// CopaAmerica competition catalogue. Each entry maps to an ID per data provider.
// fd = football-data.org v4 competition id, af = API-Football (api-sports) league id.
// null means that provider does not offer the competition; the app shows it as
// "not in the current data plan" instead of pretending to cover it.
// API-Football IDs: confirm against GET /leagues?id=<id> after you get a key —
// the competition page always shows the provider's own name for the ID.

export const GROUPS = ['Americas', 'International', 'Top leagues', 'Europe', 'Africa', 'Middle East & Asia', 'Women'];

// Order = display priority (the Americas first). Entries without an id for the active provider
// are hidden in the app; they switch on automatically if the data plan includes them later.
export const CATALOGUE = [
  // Americas
  { key: 'brasileirao', name: 'Brasileirão Série A', country: 'Brazil', group: 'Americas', fd: 2013, af: 71 },
  { key: 'libertadores', name: 'Copa Libertadores', country: 'South America', group: 'Americas', fd: null, af: 13 },
  { key: 'sudamericana', name: 'Copa Sudamericana', country: 'South America', group: 'Americas', fd: null, af: 11 },
  { key: 'argentina', name: 'Liga Profesional', country: 'Argentina', group: 'Americas', fd: null, af: 128 },
  { key: 'mls', name: 'Major League Soccer', country: 'USA', group: 'Americas', fd: null, af: 253 },
  { key: 'ligamx', name: 'Liga MX', country: 'Mexico', group: 'Americas', fd: null, af: 262 },
  { key: 'copaam', name: 'Copa América', country: 'South America', group: 'Americas', fd: null, af: 9 },
  { key: 'wcqsa', name: 'World Cup Qualifiers — South America', country: 'World', group: 'Americas', fd: null, af: 34 },
  // International
  { key: 'wc', name: 'FIFA World Cup', country: 'World', group: 'International', fd: 2000, af: 1 },
  { key: 'euro', name: 'European Championship', country: 'Europe', group: 'International', fd: 2018, af: 4 },
  // Top leagues
  { key: 'epl', name: 'Premier League', country: 'England', group: 'Top leagues', fd: 2021, af: 39 },
  { key: 'ucl', name: 'UEFA Champions League', country: 'Europe', group: 'Top leagues', fd: 2001, af: 2 },
  { key: 'laliga', name: 'La Liga', country: 'Spain', group: 'Top leagues', fd: 2014, af: 140 },
  { key: 'seriea', name: 'Serie A', country: 'Italy', group: 'Top leagues', fd: 2019, af: 135 },
  { key: 'bundesliga', name: 'Bundesliga', country: 'Germany', group: 'Top leagues', fd: 2002, af: 78 },
  { key: 'ligue1', name: 'Ligue 1', country: 'France', group: 'Top leagues', fd: 2015, af: 61 },
  // Europe
  { key: 'championship', name: 'Championship', country: 'England', group: 'Europe', fd: 2016, af: 40 },
  { key: 'eredivisie', name: 'Eredivisie', country: 'Netherlands', group: 'Europe', fd: 2003, af: 88 },
  { key: 'primeira', name: 'Primeira Liga', country: 'Portugal', group: 'Europe', fd: 2017, af: 94 },
  { key: 'uel', name: 'UEFA Europa League', country: 'Europe', group: 'Europe', fd: null, af: 3 },
  // Africa / Asia (available with a fuller data plan)
  { key: 'cafcl', name: 'CAF Champions League', country: 'Africa', group: 'Africa', fd: null, af: 12 },
  { key: 'afcon', name: 'Africa Cup of Nations', country: 'Africa', group: 'Africa', fd: null, af: 6 },
  { key: 'spl', name: 'Saudi Pro League', country: 'Saudi Arabia', group: 'Middle East & Asia', fd: null, af: 307 },
  { key: 'wwc', name: "FIFA Women's World Cup", country: 'World', group: 'Women', fd: null, af: 8 },
];

const FD_CODES = {2021:"PL", 2001:"CL", 2014:"PD", 2019:"SA", 2002:"BL1", 2015:"FL1", 2016:"ELC", 2003:"DED", 2017:"PPL", 2000:"WC", 2018:"EC", 2013:"BSA"};

export function catalogueFor(provider) {
  const field = provider === 'api-football' ? 'af' : 'fd';
  return CATALOGUE.map((c, i) => ({
    id: c[field] ?? null,
    key: c.key,
    name: c.name,
    country: c.country,
    group: c.group,
    priority: i,
    covered: c[field] != null,
    logo: c[field] == null ? null : field === 'af'
      ? `https://media.api-sports.io/football/leagues/${c.af}.png`
      : FD_CODES[c.fd] ? `https://crests.football-data.org/${FD_CODES[c.fd]}.png` : null,
  }));
}

export function priorityOf(provider, compId) {
  let field = provider === 'api-football' ? 'af' : 'fd';
  let id = compId;
  if (provider === 'hybrid' && /^a\d+$/.test(String(compId))) { field = 'af'; id = String(compId).slice(1); }
  const i = CATALOGUE.findIndex((c) => c[field] === Number(id));
  return i === -1 ? 999 : i;
}
