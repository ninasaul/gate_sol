import { config } from '../config.js';
import type { Pipeline } from '../pipeline.js';
import type { FinalVerdict } from '../types.js';

// ============================================================================
// 看板状态快照 —— 供 HTTP /api/state 与测试复用
// ============================================================================

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
  signalSeries: Array<{ ts: number; verdict: FinalVerdict | string }>;
  trend: Array<{ ts: number; realized: number; unrealized: number; total: number }>;
}

export function buildDashboardState(pipeline: Pipeline, startedAt: number): DashboardState {
  const stats = pipeline.getStats();

  const watchlist = pipeline.getWatchlist().map((report) => ({
    symbol: report.token.symbol,
    mint: report.token.mint,
    reasons: report.reasons,
  }));

  const recentSignals = pipeline.getRecentSignals(80).map((report) => {
    const checks = { security: false, liquidity: false, holders: false };
    for (const decision of report.decisions) checks[decision.checkId] = decision.passed;
    return {
      symbol: report.token.symbol,
      mint: report.token.mint,
      imageUrl: report.token.imageUrl ?? null,
      dex: report.token.dex,
      verdict: report.verdict,
      checks,
      reasons: report.reasons,
      priceUsd: report.token.priceUsd,
      marketCapUsd: report.token.marketCapUsd || 0,
      liquidityUsd: report.token.liquidity.usd,
      devPct: report.token.holders.devPct,
      whaleCount: report.token.holders.whaleCount,
      ts: report.token.discoveredAtMs,
    };
  });

  const openPositions = pipeline.getOpenPositions().map((position) => {
    const unrealizedUsd =
      (position.currentPriceUsd - position.fillPriceUsd) * position.tokensHeld;
    return {
      id: position.id,
      symbol: position.symbol,
      mint: position.mint,
      sizeUsd: position.sizeUsd,
      entryPriceUsd: position.entryPriceUsd,
      fillPriceUsd: position.fillPriceUsd,
      currentPriceUsd: position.currentPriceUsd,
      marketCapUsd: position.marketCapUsd || 0,
      stopLossUsd: position.stopLossUsd,
      moonActivateUsd: position.moonActivateUsd,
      highestPriceUsd: position.highestPriceUsd,
      mooned: position.mooned,
      entryTimeMs: position.entryTimeMs,
      unrealizedPct: (position.currentPriceUsd / position.fillPriceUsd - 1) * 100,
      unrealizedUsd,
    };
  });

  let cumulative = 0;
  const equity = [...stats.trades]
    .sort((left, right) => left.closeTimeMs - right.closeTimeMs)
    .map((trade) => {
      cumulative += trade.pnlUsd;
      return {
        ts: trade.closeTimeMs,
        pnl: Number(trade.pnlUsd.toFixed(2)),
        cum: Number(cumulative.toFixed(2)),
        symbol: trade.symbol,
        reason: trade.closeReason,
      };
    });

  const signalSeries = pipeline.getRecentSignals(1000).map((report) => ({
    ts: report.token.discoveredAtMs,
    verdict: report.verdict,
  }));

  const trend = pipeline.getTrend().map((point) => ({
    ts: point.ts,
    realized: Number(point.realized.toFixed(2)),
    unrealized: Number(point.unrealized.toFixed(2)),
    total: Number(point.total.toFixed(2)),
  }));

  return {
    mode: pipeline.getMode(),
    startedAt,
    now: Date.now(),
    summary: pipeline.getSummary(),
    stats: {
      totalTrades: stats.totalTrades,
      wins: stats.wins,
      losses: stats.losses,
      winRatePct: stats.winRatePct,
      totalPnlUsd: stats.totalPnlUsd,
      grossProfitUsd: stats.grossProfitUsd,
      grossLossUsd: stats.grossLossUsd,
      profitFactor: stats.profitFactor,
      avgWinUsd: stats.avgWinUsd,
      avgLossUsd: stats.avgLossUsd,
      bestTradeUsd: stats.bestTradeUsd,
      worstTradeUsd: stats.worstTradeUsd,
    },
    config: {
      filters: { ...config.filters },
      trading: { ...config.trading },
    },
    openPositions,
    watchlist,
    recentSignals,
    recentTrades: stats.trades.slice(-80).map((trade) => ({
      symbol: trade.symbol,
      pnlUsd: trade.pnlUsd,
      pnlPct: trade.pnlPct,
      reason: trade.closeReason,
      ts: trade.closeTimeMs,
    })),
    equity,
    signalSeries,
    trend,
  };
}
