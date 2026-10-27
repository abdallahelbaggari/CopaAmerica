// GET /launch-check — one page that shows whether CopaAmerica is ready to list. Shows yes/no only, never a secret.
const NETWORK = 'mainnet';
export async function onRequestGet(context) {
  const env = context.env || {};
  let vkey = !!(env.PI_VALIDATION_KEY || '').trim();
  if (!vkey && env.ASSETS) {
    try { const r = await env.ASSETS.fetch(new URL('/validation-key.txt', context.request.url)); const t = r.ok ? (await r.text()).trim() : ''; vkey = t.length > 20 && t.length < 400 && !t.startsWith('<'); } catch {} // Pages returns index.html for missing files, so reject HTML
  }
  const fd = !!(env.FOOTBALL_DATA_KEY || env.FD_API_KEY), af = !!env.API_FOOTBALL_KEY;
  const checks = [
    ['Network', true, NETWORK === 'mainnet' ? 'Pi Mainnet' : 'Pi Testnet', ''],
    ['Pi API key', !!env.PI_API_KEY, env.PI_API_KEY ? 'Set' : 'Missing', 'Cloudflare → Settings → Variables and Secrets → add PI_API_KEY (from develop.pi)'],
    ['Validation key', vkey, vkey ? 'Set' : 'Missing', 'Cloudflare → Settings → Variables and Secrets → add PI_VALIDATION_KEY (copy it from develop.pi), then redeploy'],
    ['football-data.org key', fd, fd ? 'Set' : 'Missing', 'Add FD_API_KEY in Cloudflare'],
    ['API-Football key', af, af ? 'Set' : 'Not set (extra South American leagues off)', 'Add API_FOOTBALL_KEY in Cloudflare (mainnet only)'],
    ['Shared cache (CA_CACHE)', !!env.CA_CACHE, env.CA_CACHE ? 'Bound' : 'Not bound', 'Cloudflare → Storage → KV → create CA_CACHE, then spl project → Settings → Bindings → KV namespace, variable name CA_CACHE, redeploy'],
  ];
  const needed = NETWORK === 'mainnet' ? checks : checks.filter((c) => c[0] !== 'API-Football key');
  const ready = needed.every((c) => c[1]);
  if (new URL(context.request.url).searchParams.get('format') === 'json') {
    return Response.json({ ready, network: NETWORK, checks: checks.map(([name, ok, value]) => ({ name, ok, value })) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = checks.map(([n, ok, v, fix]) => `<li class="${ok ? 'ok' : 'no'}"><i>${ok ? '✓' : '!'}</i><div><b>${esc(n)}</b><span>${esc(v)}</span>${ok || !fix ? '' : `<small>${esc(fix)}</small>`}</div></li>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>CopaAmerica launch check</title>
<style>body{margin:0;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#F2F6FF;color:#0B1B33}header{background:linear-gradient(100deg,#1A5CFF,#0E43D1);color:#fff;padding:22px 18px}h1{margin:0;font-size:20px}header p{margin:4px 0 0;opacity:.85;font-size:13px}
.st{margin:16px;padding:14px 16px;border-radius:14px;font-weight:800;background:${ready ? '#E5F8EE;color:#0B7A43' : '#FFF4E0;color:#8A5300'}}ul{list-style:none;margin:0 16px;padding:0;background:#fff;border-radius:14px;box-shadow:0 6px 18px rgba(14,52,170,.08)}
li{display:flex;gap:12px;padding:14px 16px;border-top:1px solid rgba(11,27,51,.08)}li:first-child{border-top:0}i{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:900;color:#fff}.ok i{background:#16A34A}.no i{background:#E8890C}
li b{display:block}li span{color:#4E5D75;font-size:13.5px}li small{display:block;margin-top:4px;color:#1652F0;font-size:12.5px}footer{text-align:center;color:#8E9BB0;font-size:12px;padding:20px;font-weight:700;letter-spacing:.04em}</style></head>
<body><header><h1>CopaAmerica launch check</h1><p>${NETWORK === 'mainnet' ? 'Mainnet' : 'Testnet'} · updated ${new Date().toUTCString()}</p></header>
<div class="st">${ready ? 'Everything is set. CopaAmerica is ready to list.' : 'Almost there. Fix the items marked ! below, then reload.'}</div><ul>${rows}</ul><footer>© ${new Date().getFullYear()} CopaAmerica · copaamerica.pi</footer></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
