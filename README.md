# GateSol

**English** | [中文](./README.zh-CN.md)

Solana meme-token paper trading bot focused on **hard filter gates before entry**.

The system is split into **six modules**. Every candidate runs through hard filters before a paper open. Whale entries are observe-only. Risk follows an asymmetric profile: cut losses quickly, let winners run.

Architecture is **two processes**:

- **Bot** (`tsx`): discovery / screening / paper execution, plus Bot API on `BOT_API_PORT` (default `3940`) — `/api/state` and `/api/events` (SSE)
- **Dashboard** (Next.js + Tailwind + TypeScript): `WEB_PORT` (default `3939`), proxies `/api/*` via Next rewrites

---

## Six modules

| # | Module | File | Role |
|---|--------|------|------|
| 1 | Data collector | `src/modules/data-collector.ts` | Discover new tokens / pools |
| 2 | Security auditor | `src/modules/security-auditor.ts` | Honeypot, mint/freeze, metadata |
| 3 | Liquidity checker | `src/modules/liquidity-checker.ts` | Liquidity, LP lock, pool age |
| 4 | Holder analyzer | `src/modules/holder-analyzer.ts` | Dev / top-10 / whales |
| 5 | Strategy engine | `src/modules/strategy-engine.ts` | `SKIP` / `OBSERVE` / `BUY` |
| 6 | Executor | `src/modules/executor.ts` | Paper open, stop-loss, trailing take-profit |

```
Data source → [1 Collect] → [2 Security] → [3 Liquidity] → [4 Holders] → [5 Strategy] → [6 Execute]
                                    └──────── three hard gates ────────┘
```

## Pre-entry filters

| Rule | Outcome |
|------|---------|
| Liquidity &lt; 50,000 USD | Exclude |
| LP unlocked / unburned | Skip |
| Dev holding &gt; 7% | Skip |
| Top-10 holdings &gt; 35% | Skip |
| Honeypot / mint·freeze not renounced | Exclude |
| Whale entry (holding &gt;= 5%) | **Observe only** |
| All hard checks pass | Paper buy |

All thresholds are configurable via `.env`.

## Discovery (live)

In `live` mode, discovery defaults to **on-chain log scanning**:

- Pump.fun program create events
- Raydium AMM v4 `initialize2` and CPMM `CreatePool`

Parsed mints go through RugCheck + quote enrichment, then the six-module pipeline.

Set `CHAIN_SCAN_ENABLED=false` to fall back to GeckoTerminal `new_pools` polling.

**RPC note:** public `mainnet-beta` often rate-limits `logsSubscribe` / `getParsedTransaction`. Prefer Helius, QuickNode, or another WebSocket-capable RPC.

## Trading / risk (paper)

- Stop-loss `-10%`
- After `+30%`, switch to trailing stop `-20%` (let profits run)
- Max concurrent positions and size are env-configurable

## Quick start

```bash
# Install (this repo uses a local pnpm store)
pnpm install --store-dir .pnpm-store

cp .env.example .env

# Offline demo (no API; stops after RUN_DURATION_MS and writes a report)
pnpm demo

# Dual process: Bot API + Next dashboard (recommended)
pnpm dev
# Open http://localhost:3939

# Live chain data + dashboard
pnpm dev:live

# Bot + API only
pnpm bot:demo
pnpm bot:live

# Next only (Bot API must already be running)
pnpm web

# Tests / types / lint
pnpm test
pnpm typecheck
pnpm lint
```

Runtime state is written to **`data/runtime.json`** (positions / trades / signals survive restart). Session summaries still go to **`data/report.json`**.

## Dashboard

Next.js App Router + Tailwind command deck (dark / light themes).

- Top bar: mode, SSE status, clock, theme toggle
- Holdings, watchlist, reject reasons, filter thresholds
- PnL trend chart, live signal stream, trade history

Bot serves API/SSE; Next proxies `/api/*` through [`next.config.ts`](next.config.ts).

## Configuration

Copy `.env.example` to `.env`. Important keys:

```bash
MODE=demo
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
CHAIN_SCAN_ENABLED=true
CHAIN_SCAN_PROGRAMS=pump,raydium
BOT_API_PORT=3940
WEB_PORT=3939
MIN_LIQUIDITY_USD=50000
REQUIRE_LP_LOCKED=true
MAX_DEV_HOLDING_PCT=7
WHALE_HOLDING_PCT=5
MOON_ACTIVATE_PCT=30
STOP_LOSS_PCT=10
TRAILING_STOP_PCT=20
MAX_CONCURRENT_POSITIONS=5
```

See [`.env.example`](./.env.example) for the full list.

## Layout

```
src/                 # Bot core (modules + pipeline + API)
app/                 # Next.js App Router
components/          # Dashboard React components
lib/                 # Frontend helpers and icons
tests/               # Vitest unit tests
data/                # runtime.json / report.json
public/assets/       # Static assets
```

## From paper to live trading

This project is **paper trading only**: `executor.ts` never touches private keys. Going live would require:

1. A reliable realtime data path (paid RPC + trade stream)
2. Jupiter (or similar) swap integration
3. Keys injected only via environment variables — never committed

Trading is risky. Validate win rate and profit factor in paper mode first.

## License

MIT
