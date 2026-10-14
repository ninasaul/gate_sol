import { config } from './config.js';
import type { DataSource } from './services/data-source.js';
import type { ScreeningReport, Stats, TokenProfile } from './types.js';
import { DataCollector } from './modules/data-collector.js';
import { SecurityAuditor } from './modules/security-auditor.js';
import { LiquidityChecker } from './modules/liquidity-checker.js';
import { HolderAnalyzer } from './modules/holder-analyzer.js';
import { StrategyEngine } from './modules/strategy-engine.js';
import { PaperExecutor } from './modules/executor.js';
import { Store } from './state/store.js';
import { bus } from './state/event-bus.js';
import { loadRuntimeSnapshot, saveRuntimeSnapshot } from './state/runtime.js';
import { pct, price, usd } from './utils/format.js';
import { logger } from './utils/logger.js';

// ============================================================================
// 流水线编排 —— 采集 → 安全审计 → 流动性校验 → 持仓分析 → 策略决策 → (纸面)执行
// ============================================================================

const VERDICT_LABEL: Record<string, string> = {
  BUY: '[BUY    ]',
  OBSERVE: '[OBSERVE]',
  SKIP: '[SKIP   ]',
};

export class Pipeline {
  private collector: DataCollector;
  private auditor = new SecurityAuditor();
  private liquidity = new LiquidityChecker();
  private holders = new HolderAnalyzer();
  private strategy = new StrategyEngine();
  private executor: PaperExecutor;
  private store = new Store();
  private monitorTimer: NodeJS.Timeout | null = null;
  private persistTimer: NodeJS.Timeout | null = null;
  private rescanTimer: NodeJS.Timeout | null = null;
  private quoteTimer: NodeJS.Timeout | null = null;
  private processed = 0;
  private rescanBusy = false;
  private quoteBusy = false;

  constructor(private source: DataSource) {
    this.collector = new DataCollector(source, { onToken: (token) => this.handle(token) });
    this.executor = new PaperExecutor((mint) => source.fetchPrice(mint));
    this.executor.setOnChange(() => this.persistRuntime());
  }

  async start(): Promise<void> {
    this.hydrateFromDisk();
    await this.collector.start();
    this.monitorTimer = setInterval(() => {
      void this.executor.monitor();
    }, config.sim.monitorMs);
    this.persistTimer = setInterval(() => this.persistRuntime(), 10_000);
    // 观察列表复扫；持仓价格由 monitor 负责
    this.rescanTimer = setInterval(() => {
      void this.rescanWatchlist();
    }, 60_000);
    this.quoteTimer = setInterval(() => {
      void this.refreshQuotes();
    }, Math.max(config.sim.monitorMs, 5_000));
    void this.refreshQuotes();
    logger.info(`监控循环已启动（每 ${config.sim.monitorMs}ms 检查持仓止盈/止损）`);
    logger.info('观察列表复扫已启动（每 60s）');
    logger.info('报价刷新已启动（价格/市值动态更新）');
  }

  private hydrateFromDisk(): void {
    const snapshot = loadRuntimeSnapshot();
    if (!snapshot) return;
    this.store.hydrate(snapshot.signals, snapshot.watchlist);
    this.executor.hydrate({
      openPositions: snapshot.openPositions,
      trades: snapshot.trades,
      trend: snapshot.trend,
    });
    this.processed = snapshot.signals.length;
    logger.info(
      `已从 runtime 恢复：信号 ${snapshot.signals.length} · 持仓 ${snapshot.openPositions.length} · 成交 ${snapshot.trades.length}`,
    );
  }

  persistRuntime(): void {
    const execution = this.executor.getPersistencePayload();
    saveRuntimeSnapshot({
      openPositions: execution.openPositions,
      trades: execution.trades,
      trend: execution.trend,
      signals: this.store.getAllSignals(),
      watchlist: this.store.getWatchlist(),
    });
  }

  handle(token: TokenProfile): void {
    this.processed += 1;
    const decisions = [
      this.auditor.check(token),
      this.liquidity.check(token),
      this.holders.check(token),
    ];
    const report = this.strategy.evaluate(token, decisions);
    this.store.recordSignal(report);
    this.printReport(report);

    const checks = {
      security: decisions[0]?.passed ?? false,
      liquidity: decisions[1]?.passed ?? false,
      holders: decisions[2]?.passed ?? false,
    };
    bus.emit('signal', {
      symbol: token.symbol,
      mint: token.mint,
      imageUrl: token.imageUrl ?? null,
      dex: token.dex,
      verdict: report.verdict,
      checks,
      reasons: report.reasons,
      priceUsd: token.priceUsd,
      marketCapUsd: token.marketCapUsd,
      liquidityUsd: token.liquidity.usd,
      devPct: token.holders.devPct,
      whaleCount: token.holders.whaleCount,
      ts: Date.now(),
    });

    if (report.verdict === 'BUY') {
      this.store.removeWatch(token.mint);
      this.executor.open(token);
    } else if (report.verdict === 'OBSERVE') {
      this.store.addWatch(report);
      bus.emit('observe', {
        symbol: token.symbol,
        mint: token.mint,
        reasons: report.reasons,
        ts: Date.now(),
      });
      logger.warn(`加入观察列表：${token.symbol}（${report.reasons.join(' / ')}）`);
    }

    this.persistRuntime();
  }

  /** 刷新持仓 + 近期信号的价格/市值 */
  private async refreshQuotes(): Promise<void> {
    if (this.quoteBusy) return;
    const mints = new Set<string>();
    for (const position of this.executor.getOpenPositions()) mints.add(position.mint);
    for (const report of this.store.getWatchlist()) mints.add(report.token.mint);
    for (const report of this.store.getSignals(40)) mints.add(report.token.mint);
    if (mints.size === 0) return;

    this.quoteBusy = true;
    try {
      let updated = 0;
      for (const mint of [...mints].slice(0, 20)) {
        const quote = await this.source.fetchQuote(mint);
        if (!quote) continue;
        const positionChanged = this.executor.applyQuote(
          mint,
          quote.priceUsd,
          quote.marketCapUsd,
        );
        const signalChanged = this.store.applyQuote(mint, quote.priceUsd, quote.marketCapUsd);
        if (positionChanged || signalChanged) {
          updated += 1;
          bus.emit('quote', {
            mint,
            priceUsd: quote.priceUsd,
            marketCapUsd: quote.marketCapUsd,
            ts: Date.now(),
          });
        }
      }
      if (updated > 0) {
        this.executor.markToMarket();
        this.persistRuntime();
      }
    } finally {
      this.quoteBusy = false;
    }
  }

  /** 复扫观察列表：条件转好则升级买入；转差则移出观察 */
  private async rescanWatchlist(): Promise<void> {
    if (this.rescanBusy) return;
    const watchlist = this.store.getWatchlist().slice(0, 8);
    if (watchlist.length === 0) return;
    this.rescanBusy = true;
    let upgraded = 0;
    let dropped = 0;
    let kept = 0;
    try {
      for (const item of watchlist) {
        const mint = item.token.mint;
        // 已开仓则无需再观察
        if (this.executor.getOpenPositions().some((position) => position.mint === mint)) {
          this.store.removeWatch(mint);
          continue;
        }
        const token = await this.source.fetchTokenProfile(mint);
        if (!token) continue;

        const decisions = [
          this.auditor.check(token),
          this.liquidity.check(token),
          this.holders.check(token),
        ];
        const report = this.strategy.evaluate(token, decisions);

        if (report.verdict === 'BUY') {
          upgraded += 1;
          logger.success(`观察升级买入：${token.symbol}`);
          this.handle(token);
        } else if (report.verdict === 'SKIP') {
          dropped += 1;
          this.store.removeWatch(mint);
          logger.info(`观察移出：${token.symbol}（转为 SKIP）`);
        } else {
          kept += 1;
          this.store.addWatch(report);
        }
      }
      if (upgraded || dropped || kept) {
        logger.info(`观察复扫：升级 ${upgraded} · 移出 ${dropped} · 维持 ${kept}`);
        this.persistRuntime();
      }
    } finally {
      this.rescanBusy = false;
    }
  }

  getMode(): 'demo' | 'live' {
    return config.mode;
  }

  getSummary() {
    return this.store.summary();
  }

  getStats(): Stats {
    return this.executor.getStats();
  }

  getTrend() {
    return this.executor.getTrend();
  }

  getOpenPositions() {
    return this.executor.getOpenPositions();
  }

  getWatchlist() {
    return this.store.getWatchlist();
  }

  getRecentSignals(limit = 60) {
    return this.store.getSignals(limit);
  }

  private printReport(report: ScreeningReport): void {
    const label = VERDICT_LABEL[report.verdict] ?? `[${report.verdict}]`;
    const checks = report.decisions
      .map((decision) => `${decision.passed ? 'Y' : 'N'}${decision.checkId}`)
      .join(' ');
    logger.info(
      `${label} ${report.token.symbol.padEnd(9)} ${checks}  ${report.reasons.join('；')}`,
    );
    logger.info(
      `        ${report.token.dex.padEnd(8)} price=${price(report.token.priceUsd)}  liq=${usd(report.token.liquidity.usd)}  ` +
        `dev=${pct(report.token.holders.devPct)}  whales=${report.token.holders.whaleCount}`,
    );
  }

  async stop(): Promise<void> {
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    if (this.persistTimer) clearInterval(this.persistTimer);
    if (this.rescanTimer) clearInterval(this.rescanTimer);
    if (this.quoteTimer) clearInterval(this.quoteTimer);
    this.collector.stop();
    await this.source.close();
    const stats = this.executor.getStats();
    this.persistRuntime();
    this.store.save(stats, this.executor.getOpenPositions());
    this.printFinal(stats);
  }

  private printFinal(stats: Stats): void {
    const line = '----------------------------------------------';
    logger.info(line);
    logger.info(`处理代币总数：${this.processed}`);
    const summary = this.store.summary();
    logger.info(
      `筛选结果：买入 ${summary.BUY}  观察 ${summary.OBSERVE}  跳过 ${summary.SKIP}  观察列表 ${summary.watchlist}`,
    );
    logger.info(line);
    if (stats.totalTrades === 0) {
      logger.warn('本次运行未产生任何纸面交易。');
      return;
    }
    logger.info(
      `纸面交易：共 ${stats.totalTrades} 笔  ·  胜 ${stats.wins} / 负 ${stats.losses}  ·  胜率 ${stats.winRatePct.toFixed(1)}%`,
    );
    logger.info(
      `总盈亏：${stats.totalPnlUsd >= 0 ? '+' : '-'}${usd(Math.abs(stats.totalPnlUsd))}  ·  盈利因子 ${Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : 'inf'}`,
    );
    logger.info(
      `平均盈利 ${usd(stats.avgWinUsd)} / 平均亏损 ${usd(stats.avgLossUsd)}  ·  最佳 ${usd(stats.bestTradeUsd)} / 最差 ${usd(stats.worstTradeUsd)}`,
    );
    if (stats.losses > stats.wins && stats.totalPnlUsd > 0) {
      logger.success('非对称收益成立：亏损笔数更多，但一笔大赚已覆盖全部亏损并盈利。');
    }
    logger.info('完整报告已写入 data/report.json · 运行时状态 data/runtime.json');
  }
}
