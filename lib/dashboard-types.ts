export interface DashboardSignal {
  symbol: string;
  mint: string;
  imageUrl: string | null;
  dex: string;
  verdict: string;
  checks: { security: boolean; liquidity: boolean; holders: boolean };
  reasons: string[];
  priceUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  holderCount: number;
  devPct: number;
  whaleCount: number;
  ts: number;
}

export interface DashboardPosition {
  id: string;
  symbol: string;
  mint: string;
  sizeUsd: number;
  entryPriceUsd: number;
  fillPriceUsd: number;
  currentPriceUsd: number;
  marketCapUsd: number;
  stopLossUsd: number;
  moonActivateUsd: number;
  highestPriceUsd: number;
  mooned: boolean;
  entryTimeMs: number;
  unrealizedPct: number;
  unrealizedUsd: number;
}

export interface DashboardConfig {
  filters: {
    minLiquidityUsd: number;
    requireLpLocked: boolean;
    maxDevHoldingPct: number;
    maxTop10HoldingPct: number;
    whaleHoldingPct: number;
    minHolders: number;
    minPoolAgeMs: number;
    maxPoolAgeMs: number;
  };
  trading: {
    positionSizeUsd: number;
    moonActivatePct: number;
    stopLossPct: number;
    trailingStopPct: number;
    maxConcurrentPositions: number;
    slippagePct: number;
  };
}

export interface DashboardState {
  mode: 'demo' | 'live';
  startedAt: number;
  now: number;
  summary: { total: number; BUY: number; OBSERVE: number; SKIP: number; watchlist: number };
  stats: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRatePct: number;
    totalPnlUsd: number;
    grossProfitUsd: number;
    grossLossUsd: number;
    profitFactor: number;
    avgWinUsd: number;
    avgLossUsd: number;
    bestTradeUsd: number;
    worstTradeUsd: number;
  };
  config: DashboardConfig;
  openPositions: DashboardPosition[];
  watchlist: Array<{ symbol: string; mint: string; reasons: string[] }>;
  recentSignals: DashboardSignal[];
  recentTrades: Array<{
    symbol: string;
    pnlUsd: number;
    pnlPct: number;
    reason: string;
    ts: number;
  }>;
  equity: Array<{
    ts: number;
    pnl: number;
    cum: number;
    symbol: string;
    reason: string;
  }>;
  signalSeries: Array<{ ts: number; verdict: string }>;
  trend: Array<{ ts: number; realized: number; unrealized: number; total: number }>;
}

export type VerdictFilter = 'ALL' | 'BUY' | 'OBSERVE' | 'SKIP';
export type DexFilter = 'ALL' | 'pumpfun' | 'raydium';

export const emptyConfig = (): DashboardConfig => ({
  filters: {
    minLiquidityUsd: 50_000,
    requireLpLocked: true,
    maxDevHoldingPct: 7,
    maxTop10HoldingPct: 35,
    whaleHoldingPct: 5,
    minHolders: 100,
    minPoolAgeMs: 60_000,
    maxPoolAgeMs: 86_400_000,
  },
  trading: {
    positionSizeUsd: 100,
    moonActivatePct: 30,
    stopLossPct: 10,
    trailingStopPct: 20,
    maxConcurrentPositions: 5,
    slippagePct: 2,
  },
});

export const emptyState = (): DashboardState => ({
  mode: 'demo',
  startedAt: Date.now(),
  now: Date.now(),
  summary: { total: 0, BUY: 0, OBSERVE: 0, SKIP: 0, watchlist: 0 },
  stats: {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRatePct: 0,
    totalPnlUsd: 0,
    grossProfitUsd: 0,
    grossLossUsd: 0,
    profitFactor: 0,
    avgWinUsd: 0,
    avgLossUsd: 0,
    bestTradeUsd: 0,
    worstTradeUsd: 0,
  },
  config: emptyConfig(),
  openPositions: [],
  watchlist: [],
  recentSignals: [],
  recentTrades: [],
  equity: [],
  signalSeries: [],
  trend: [],
});
