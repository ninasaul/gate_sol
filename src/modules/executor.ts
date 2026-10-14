import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { bus } from '../state/event-bus.js';
import type { Position, Stats, TokenProfile, TradeRecord, TrendPoint } from '../types.js';
import { pct, price, signedUsd, usd } from '../utils/format.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// 模块 6/6 —— 执行器（纸面）
// 职责：模拟开仓/持仓管理/止损/让利润奔跑，并统计盈亏。
// ============================================================================

export class PaperExecutor {
  private positions = new Map<string, Position>();
  private trades: TradeRecord[] = [];
  private trend: TrendPoint[] = [];
  private onChange: (() => void) | null = null;

  constructor(private priceSource: (mint: string) => Promise<number | null>) {
    this.sampleTrend();
  }

  setOnChange(handler: (() => void) | null): void {
    this.onChange = handler;
  }

  private notifyChange(): void {
    this.onChange?.();
  }

  open(token: TokenProfile): Position | null {
    const openCount = [...this.positions.values()].filter((position) => position.status === 'open')
      .length;
    if (openCount >= config.trading.maxConcurrentPositions) {
      logger.warn(`已达最大同时持仓 ${config.trading.maxConcurrentPositions}，跳过 ${token.symbol}`);
      return null;
    }
    if (
      [...this.positions.values()].some(
        (position) => position.status === 'open' && position.mint === token.mint,
      )
    ) {
      logger.warn(`已持有 ${token.symbol}，跳过重复开仓`);
      return null;
    }

    const size = config.trading.positionSizeUsd;
    const fill = token.priceUsd * (1 + config.trading.slippagePct / 100);
    const position: Position = {
      id: randomUUID(),
      mint: token.mint,
      symbol: token.symbol,
      entryPriceUsd: token.priceUsd,
      fillPriceUsd: fill,
      entryTimeMs: Date.now(),
      sizeUsd: size,
      tokensHeld: size / fill,
      currentPriceUsd: fill,
      marketCapUsd: token.marketCapUsd || 0,
      stopLossUsd: fill * (1 - config.trading.stopLossPct / 100),
      moonActivateUsd: fill * (1 + config.trading.moonActivatePct / 100),
      mooned: false,
      highestPriceUsd: fill,
      status: 'open',
    };
    this.positions.set(position.id, position);
    bus.emit('open', {
      symbol: position.symbol,
      sizeUsd: size,
      entryPriceUsd: fill,
      ts: Date.now(),
    });
    this.sampleTrend();
    this.notifyChange();
    logger.success(
      `开仓 ${position.symbol} ${usd(size)} @ ${price(fill)}（SL ${price(position.stopLossUsd)} / 让利润奔跑触发 ${price(position.moonActivateUsd)}）`,
    );
    return position;
  }

  applyQuote(mint: string, priceUsd: number, marketCapUsd: number): boolean {
    let changed = false;
    for (const position of this.positions.values()) {
      if (position.status !== 'open' || position.mint !== mint) continue;
      position.currentPriceUsd = priceUsd;
      position.highestPriceUsd = Math.max(position.highestPriceUsd, priceUsd);
      if (marketCapUsd > 0) position.marketCapUsd = marketCapUsd;
      changed = true;
    }
    return changed;
  }

  /** 报价已写入持仓后，刷新盈亏曲线样本 */
  markToMarket(): void {
    this.sampleTrend();
    this.notifyChange();
  }

  async monitor(): Promise<void> {
    let changed = false;
    for (const position of this.positions.values()) {
      if (position.status !== 'open') continue;
      const current = await this.priceSource(position.mint);
      if (current == null) continue;

      position.currentPriceUsd = current;
      position.highestPriceUsd = Math.max(position.highestPriceUsd, current);

      if (!position.mooned && current >= position.moonActivateUsd) {
        position.mooned = true;
        changed = true;
        logger.info(
          `${position.symbol} 涨幅 ${pct((current / position.fillPriceUsd - 1) * 100)} 触发让利润奔跑，转移动止损`,
        );
      }

      const trailingStop = position.highestPriceUsd * (1 - config.trading.trailingStopPct / 100);

      let reason: string | null = null;
      let exit = current;
      if (current <= position.stopLossUsd) {
        reason = '止损';
        exit = position.stopLossUsd;
      } else if (position.mooned && current <= trailingStop) {
        reason = '移动止盈';
        exit = trailingStop;
      }

      if (reason) {
        this.close(position, exit, reason);
        changed = true;
      }
    }
    this.sampleTrend();
    if (changed) this.notifyChange();
  }

  close(position: Position, exitPriceUsd: number, reason: string): void {
    position.status = 'closed';
    position.closePriceUsd = exitPriceUsd;
    position.closeTimeMs = Date.now();
    position.pnlUsd = (exitPriceUsd - position.fillPriceUsd) * position.tokensHeld;
    position.pnlPct = (exitPriceUsd / position.fillPriceUsd - 1) * 100;
    position.closeReason = reason;

    this.trades.push({
      id: position.id,
      symbol: position.symbol,
      mint: position.mint,
      entryPriceUsd: position.entryPriceUsd,
      exitPriceUsd,
      sizeUsd: position.sizeUsd,
      pnlUsd: position.pnlUsd,
      pnlPct: position.pnlPct,
      closeReason: reason,
      entryTimeMs: position.entryTimeMs,
      closeTimeMs: position.closeTimeMs,
      heldMs: position.closeTimeMs - position.entryTimeMs,
    });

    bus.emit('close', {
      symbol: position.symbol,
      pnlUsd: position.pnlUsd,
      pnlPct: position.pnlPct,
      reason,
      ts: Date.now(),
    });

    logger.verdict(
      `平仓 ${position.symbol} [${reason}] ${signedUsd(position.pnlUsd)}（${pct(position.pnlPct)}）`,
    );
    this.notifyChange();
  }

  private sampleTrend(): void {
    const realized = this.trades.reduce((sum, trade) => sum + trade.pnlUsd, 0);
    let unrealized = 0;
    for (const position of this.positions.values()) {
      if (position.status === 'open') {
        unrealized += (position.currentPriceUsd - position.fillPriceUsd) * position.tokensHeld;
      }
    }
    this.trend.push({ ts: Date.now(), realized, unrealized, total: realized + unrealized });
    if (this.trend.length > 720) this.trend = this.trend.slice(-720);
  }

  hydrate(input: {
    openPositions: Position[];
    trades: TradeRecord[];
    trend: TrendPoint[];
  }): void {
    this.positions.clear();
    for (const position of input.openPositions) {
      if (position.status !== 'open') continue;
      this.positions.set(position.id, {
        ...position,
        marketCapUsd: position.marketCapUsd ?? 0,
      });
    }
    this.trades = input.trades.map((trade) => ({ ...trade }));
    this.trend = input.trend.map((point) => ({ ...point }));
    if (this.trend.length === 0) this.sampleTrend();
  }

  getPersistencePayload(): {
    openPositions: Position[];
    trades: TradeRecord[];
    trend: TrendPoint[];
  } {
    return {
      openPositions: this.getOpenPositions().map((position) => ({ ...position })),
      trades: [...this.trades],
      trend: [...this.trend],
    };
  }

  getTrend(): TrendPoint[] {
    return this.trend;
  }

  getOpenPositions(): Position[] {
    return [...this.positions.values()].filter((position) => position.status === 'open');
  }

  getStats(): Stats {
    const wins = this.trades.filter((trade) => trade.pnlUsd > 0);
    const losses = this.trades.filter((trade) => trade.pnlUsd <= 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnlUsd, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnlUsd, 0));
    const totalPnl = grossProfit - grossLoss;

    return {
      totalTrades: this.trades.length,
      wins: wins.length,
      losses: losses.length,
      winRatePct: this.trades.length ? (wins.length / this.trades.length) * 100 : 0,
      totalPnlUsd: totalPnl,
      grossProfitUsd: grossProfit,
      grossLossUsd: grossLoss,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      avgWinUsd: wins.length ? grossProfit / wins.length : 0,
      avgLossUsd: losses.length ? grossLoss / losses.length : 0,
      bestTradeUsd: this.trades.length ? Math.max(...this.trades.map((trade) => trade.pnlUsd)) : 0,
      worstTradeUsd: this.trades.length ? Math.min(...this.trades.map((trade) => trade.pnlUsd)) : 0,
      trades: [...this.trades],
    };
  }
}
