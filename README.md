# CopaAmerica — Every Kick. Every Goal. Live.

App name: **CopaAmerica** · Domain: **copaamerica.pi** · Cloudflare Pages: **copaamerica.pages.dev** · Support: support.copaamerica.pi@gmail.com

Football-only Pi Network PWA: live scores, fixtures and results, match centre, league tables, team pages,
search and follows, Pi sign-in and Pi support payments. The Americas come first; every competition the
data plan covers is shown, and others switch on automatically when the plan includes them.

Separate app with its own repo and Cloudflare project (testnet: `copaamerica-testnet`). Never combine with SPL or Copa.

## Cloudflare settings (Settings → Variables and Secrets)
| Name | What |
|---|---|
| `PI_API_KEY` (secret) | From develop.pi (this app) |
| `PI_VALIDATION_KEY` (optional) | Domain validation key, if not using `validation-key.txt` |
| `FD_API_KEY` (secret) | football-data.org key — **use a new key, the old one was exposed in the previous code** |
| `API_FOOTBALL_KEY` (secret, optional) | API-Football key (mainnet only); `AF_LEAGUES` default `13,128` |

**Bindings → KV namespace:** variable name `CA_CACHE`. Then open **`/launch-check`**: every row should be green.

## Local test
`MOCK=hy node test/serve.mjs 8789` then open http://localhost:8789 (mock data, fake Pi).
