import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Position, ScreeningReport, Stats } from '../types.js';
import { ensureDataDirectory } from './runtime.js';

// ============================================================================
// 状态存储 —— 记录筛选信号、观察列表，并把运行报告落盘到 data/report.json
// ============================================================================

export class Store {
  private signals: ScreeningReport[] = [];
  private watchlist: ScreeningReport[] = [];
  private dir = join(process.cwd(), 'data');

  constructor() {
    ensureDataDirectory();
  }

  recordSignal(report: ScreeningReport): void {
    this.signals.push(report);
  }

  addWatch(report: ScreeningReport): void {
    const mint = report.token.mint;
    const index = this.watchlist.findIndex((item) => item.token.mint === mint);
    if (index >= 0) {
      this.watchlist[index] = report;
      return;
    }
    this.watchlist.push(report);
  }

  removeWatch(mint: string): void {
    this.watchlist = this.watchlist.filter((item) => item.token.mint !== mint);
  }

  applyQuote(mint: string, priceUsd: number, marketCapUsd: number): boolean {
    let changed = false;
    for (const report of this.signals) {
      if (report.token.mint !== mint) continue;
      report.token.priceUsd = priceUsd;
      if (marketCapUsd > 0) report.token.marketCapUsd = marketCapUsd;
      changed = true;
    }
    for (const report of this.watchlist) {
      if (report.token.mint !== mint) continue;
      report.token.priceUsd = priceUsd;
      if (marketCapUsd > 0) report.token.marketCapUsd = marketCapUsd;
      changed = true;
    }
    return changed;
  }

  getWatchlist(): ScreeningReport[] {
    return [...this.watchlist];
  }

  getSignals(limit = 60): ScreeningReport[] {
    return this.signals.slice(-limit);
  }

  getAllSignals(): ScreeningReport[] {
    return [...this.signals];
  }

  hydrate(signals: ScreeningReport[], watchlist: ScreeningReport[]): void {
    this.signals = [...signals];
    this.watchlist = [...watchlist];
  }

  summary(): { total: number; BUY: number; OBSERVE: number; SKIP: number; watchlist: number } {
    const counts = { BUY: 0, OBSERVE: 0, SKIP: 0 };
    for (const signal of this.signals) counts[signal.verdict] += 1;
    return { total: this.signals.length, ...counts, watchlist: this.watchlist.length };
  }

  save(stats?: Stats, openPositions?: Position[]): void {
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: this.summary(),
      stats: stats
        ? {
            totalTrades: stats.totalTrades,
            wins: stats.wins,
            losses: stats.losses,
            winRatePct: Number(stats.winRatePct.toFixed(1)),
            totalPnlUsd: Number(stats.totalPnlUsd.toFixed(2)),
            grossProfitUsd: Number(stats.grossProfitUsd.toFixed(2)),
            grossLossUsd: Number(stats.grossLossUsd.toFixed(2)),
            profitFactor: Number.isFinite(stats.profitFactor)
              ? Number(stats.profitFactor.toFixed(2))
              : null,
            avgWinUsd: Number(stats.avgWinUsd.toFixed(2)),
            avgLossUsd: Number(stats.avgLossUsd.toFixed(2)),
            bestTradeUsd: Number(stats.bestTradeUsd.toFixed(2)),
            worstTradeUsd: Number(stats.worstTradeUsd.toFixed(2)),
            trades: stats.trades.map((trade) => ({
              symbol: trade.symbol,
              pnlUsd: Number(trade.pnlUsd.toFixed(2)),
              pnlPct: Number(trade.pnlPct.toFixed(1)),
              reason: trade.closeReason,
            })),
          }
        : null,
      openPositions:
        openPositions?.map((position) => ({
          symbol: position.symbol,
          sizeUsd: position.sizeUsd,
          currentPriceUsd: position.currentPriceUsd,
          unrealizedPct: Number(
            ((position.currentPriceUsd / position.fillPriceUsd - 1) * 100).toFixed(1),
          ),
        })) ?? [],
      watchlist: this.watchlist.map((report) => ({
        symbol: report.token.symbol,
        mint: report.token.mint,
        reasons: report.reasons,
      })),
      recentSignals: this.signals.slice(-60).map((report) => ({
        symbol: report.token.symbol,
        mint: report.token.mint,
        dex: report.token.dex,
        verdict: report.verdict,
        reasons: report.reasons,
      })),
    };
    try {
      writeFileSync(join(this.dir, 'report.json'), JSON.stringify(payload, null, 2));
    } catch {
      /* 落盘失败不影响运行 */
    }
  }
}
