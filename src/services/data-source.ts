import { config } from '../config.js';
import type { Dex, HolderData, LiquidityData, SecurityData, TokenProfile, WhaleInfo } from '../types.js';
import { logger } from '../utils/logger.js';
import { mulberry32 } from '../utils/rng.js';
import { ChainScanner } from './chain-scanner.js';
import { PumpPortalScanner } from './pumpportal-scanner.js';

// ============================================================================
// 数据源抽象 —— 六模块里的「数据采集器」依赖它拿数据。
// demo：离线模拟，开箱即用；solana：真实链上 + 公共免费接口。
// ============================================================================

export interface DataSource {
  readonly kind: 'demo' | 'solana';
  init(): Promise<void>;
  /** 拉取当前活跃的新币/新池子（一次性） */
  fetchNewTokens(limit?: number): Promise<TokenProfile[]>;
  /** 订阅新币事件，返回取消订阅函数 */
  subscribeNewTokens(handler: (t: TokenProfile) => void): Promise<() => void>;
  /** 按 mint 拉取完整画像（观察列表 / 持仓复扫） */
  fetchTokenProfile(mint: string): Promise<TokenProfile | null>;
  /** 轻量报价：价格 + 市值（动态刷新） */
  fetchQuote(mint: string): Promise<{ priceUsd: number; marketCapUsd: number } | null>;
  /** 拉取某代币最新价格（用于持仓更新与止盈止损） */
  fetchPrice(mint: string): Promise<number | null>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Demo 数据源：用可复现随机数生成三种原型的 Meme 币，展示垃圾币/巨鲸/貔貅等形态
// ---------------------------------------------------------------------------

interface SimAsset {
  price: number;
  drift: number; // 每 tick 对数收益率偏置
  vol: number;
  reverseAt: number; // 多少个 tick 后反转方向（-1 = 不反转）
  ticks: number;
}

type Archetype = 'garbage' | 'mediocre' | 'clean';

const SYMBOLS = [
  'PEPE', 'DOGE', 'WOOF', 'MOON', 'LAMBO', 'RUGX', 'HONEY', 'GMI', 'WAGMI',
  'FOMO', 'BONK', 'SHEEP', 'TURBO', 'COPE', 'GIGA', 'MOG', 'BRETT', 'WIF',
];

export class DemoDataSource implements DataSource {
  readonly kind = 'demo' as const;
  private rng: () => number;
  private timers: NodeJS.Timeout[] = [];
  private assets = new Map<string, SimAsset>();
  private counter = 0;

  constructor(private opts: { seed: number; initialTokens: number; tokenIntervalMs: number }) {
    this.rng = mulberry32(opts.seed);
  }

  async init(): Promise<void> {}

  async close(): Promise<void> {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  async fetchNewTokens(limit = this.opts.initialTokens): Promise<TokenProfile[]> {
    const out: TokenProfile[] = [];
    for (let i = 0; i < limit; i++) out.push(this.makeToken());
    return out;
  }

  async subscribeNewTokens(handler: (t: TokenProfile) => void): Promise<() => void> {
    const id = setInterval(() => handler(this.makeToken()), this.opts.tokenIntervalMs);
    this.timers.push(id);
    return () => clearInterval(id);
  }

  async fetchPrice(mint: string): Promise<number | null> {
    const a = this.assets.get(mint);
    if (!a) return null;
    this.tick(a);
    return a.price;
  }

  async fetchTokenProfile(_mint: string): Promise<TokenProfile | null> {
    // demo 持续推送新币；观察复扫仅 live 有意义
    return null;
  }

  async fetchQuote(mint: string): Promise<{ priceUsd: number; marketCapUsd: number } | null> {
    const priceUsd = await this.fetchPrice(mint);
    if (priceUsd == null) return null;
    const asset = this.assets.get(mint);
    // demo 用价格比例粗估市值变化
    const marketCapUsd = asset ? priceUsd * 1e9 : priceUsd * 1e9;
    return { priceUsd, marketCapUsd };
  }

  private tick(a: SimAsset): void {
    a.ticks += 1;
    // 冲高后反转回落：模拟「拉升 → 砸盘」，让移动止损能锁定利润
    if (a.reverseAt > 0 && a.ticks >= a.reverseAt) {
      a.drift = -(0.06 + this.rng() * 0.08);
      a.reverseAt = -1;
    }
    const ret = a.drift + (this.rng() * 2 - 1) * a.vol;
    a.price = Math.max(1e-12, a.price * Math.exp(ret));
  }

  private makeToken(): TokenProfile {
    this.counter += 1;
    const r = this.rng;
    const mint = `Demo${this.counter.toString().padStart(6, '0')}${this.counter}`;
    const dex: Dex = r() < 0.6 ? 'pumpfun' : 'raydium';
    const now = Date.now();

    // —— 三种原型：垃圾币(40%) / 普通币(30%) / 优质币(30%) ——
    const roll = r();
    const archetype: Archetype = roll < 0.4 ? 'garbage' : roll < 0.7 ? 'mediocre' : 'clean';

    let liquidityUsd: number;
    let lpBurnPct: number;
    let lpLocked: boolean;
    let lockPct: number;
    let mintRenounced: boolean;
    let freezeRenounced: boolean;
    let isHoneypot: boolean;
    let devPct: number;
    let top10Pct: number;
    let totalHolders: number;
    let whaleCount: number;
    let whaleEnteringChance: number;

    if (archetype === 'garbage') {
      liquidityUsd = 5_000 + r() * 45_000; // 几乎都低于 50k
      lpBurnPct = 0;
      lpLocked = r() < 0.3;
      lockPct = lpLocked ? 30 + r() * 40 : 0;
      mintRenounced = r() < 0.6;
      freezeRenounced = r() < 0.4;
      isHoneypot = r() < 0.3;
      devPct = 8 + r() * 40; // 几乎都超 7%
      top10Pct = Math.min(95, devPct + 20 + r() * 35);
      totalHolders = 20 + Math.floor(r() * 180);
      whaleCount = Math.floor(r() * 3);
      whaleEnteringChance = 0.3;
    } else if (archetype === 'mediocre') {
      liquidityUsd = 40_000 + r() * 80_000;
      lpBurnPct = dex === 'pumpfun' ? 100 : 0;
      lpLocked = lpBurnPct >= 100 || r() < 0.5; // 一半锁、一半没锁
      lockPct = lpLocked ? (lpBurnPct >= 100 ? 100 : 40 + r() * 40) : 0;
      mintRenounced = r() < 0.85;
      freezeRenounced = r() < 0.5;
      isHoneypot = false;
      devPct = 4 + r() * 6; // 有时略超 7
      top10Pct = devPct + 20 + r() * 25; // 有时超 35
      totalHolders = 60 + Math.floor(r() * 500);
      whaleCount = Math.floor(r() * 2);
      whaleEnteringChance = 0.3;
    } else {
      // clean：基本都能过筛选，但可能带「进场鲸鱼」→ 仅观察
      liquidityUsd = 80_000 + r() * 420_000;
      lpBurnPct = dex === 'pumpfun' ? 100 : r() < 0.8 ? 100 : 0;
      lpLocked = lpBurnPct >= 100 || r() < 0.9;
      lockPct = lpLocked ? (lpBurnPct >= 100 ? 100 : 70 + r() * 30) : 0;
      mintRenounced = true;
      freezeRenounced = true; // 优质币安全面基本干净
      isHoneypot = false;
      devPct = 1 + r() * 5; // 基本低于 7
      top10Pct = devPct + 10 + r() * 15; // 基本低于 35
      totalHolders = 150 + Math.floor(r() * 2000);
      whaleCount = Math.floor(r() * 2);
      whaleEnteringChance = 0.35;
    }

    // —— 鲸鱼 ——
    const whales: WhaleInfo[] = [];
    let largestWhalePct = 0;
    // 优质币有 35% 概率带一个「正在进场」的鲸鱼 → 触发仅观察
    if (archetype === 'clean' && r() < 0.35) {
      const p = 5 + r() * 12;
      whales.push({ address: `Whale${this.counter}_0`, pct: p, entering: true, buyVolumeUsd: 10_000 + r() * 90_000 });
      largestWhalePct = p;
    }
    for (let i = 0; i < whaleCount; i++) {
      const p = 3 + r() * 15;
      const entering = r() < whaleEnteringChance;
      whales.push({
        address: `Whale${this.counter}_${i + 1}`,
        pct: p,
        entering,
        buyVolumeUsd: entering ? 5_000 + r() * 80_000 : 0,
      });
      largestWhalePct = Math.max(largestWhalePct, p);
    }

    // —— 价格 / 市值 ——
    const priceUsd = 10 ** (-8 - r() * 4); // 1e-8 ~ 1e-4 的典型 meme 币价格
    const supply = 1e9 * (1 + r() * 9);
    const marketCapUsd = priceUsd * supply;
    const volume24hUsd = marketCapUsd * (0.2 + r() * 3);
    const ageMs = 30_000 + r() * 5 * 60 * 60 * 1000;

    const liquidity: LiquidityData = {
      usd: liquidityUsd,
      lpLocked,
      lockPct,
      lpBurnPct,
      lockEndTimeMs: lpLocked && lpBurnPct < 100 ? now + 7 * 24 * 3600 * 1000 : null,
    };
    const holders: HolderData = {
      total: totalHolders,
      top10Pct,
      devPct,
      largestWhalePct,
      whaleCount: whales.length,
      whales,
    };
    const security: SecurityData = {
      mintAuthorityRenounced: mintRenounced,
      freezeAuthorityRenounced: freezeRenounced,
      metadataMutable: r() < 0.6,
      isHoneypot,
      verified: !isHoneypot && r() < 0.85,
    };

    // —— 价格走势：多数阴跌（小亏），少数暴涨（大赚）→ 非对称收益 ——
    let drift: number;
    let reverseAt = -1;
    if (archetype === 'clean' && r() < 0.3) {
      // 少数暴涨，随后冲高回落 → 移动止损锁定大额利润（大赚）
      drift = 0.12 + r() * 0.18;
      reverseAt = 3 + Math.floor(r() * 4);
    } else if (archetype === 'clean') {
      drift = -(0.02 + r() * 0.04); // 阴跌 → 止损（小亏）
    } else {
      drift = -(0.02 + r() * 0.05);
    }
    this.assets.set(mint, { price: priceUsd, drift, vol: 0.015 + r() * 0.045, reverseAt, ticks: 0 });

    return {
      mint,
      symbol: `${SYMBOLS[this.counter % SYMBOLS.length]}${this.counter}`,
      name: `Meme Token ${this.counter}`,
      imageUrl: null,
      dex,
      poolAddress: `Pool${this.counter}`,
      createdAtMs: now - ageMs,
      discoveredAtMs: now,
      priceUsd,
      marketCapUsd,
      volume24hUsd,
      liquidity,
      holders,
      security,
    };
  }
}

// ---------------------------------------------------------------------------
// Solana 数据源：GeckoTerminal（新池/价格）+ RugCheck（安全/LP 锁）+ RPC（持仓分布）
// 均为公共免费接口；生产环境建议换付费 RPC + 交易流（如 Helius/Birdeye）以跟踪鲸鱼进场。
// ---------------------------------------------------------------------------

const numOr0 = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

interface PoolCandidate {
  mint: string;
  attrs: Record<string, unknown>;
  pool: unknown;
  imageUrl: string | null;
  dex?: Dex;
}

export class SolanaDataSource implements DataSource {
  readonly kind = 'solana' as const;
  private connection: any = null;
  private web3: any = null;

  constructor(private rpcUrl: string) {}

  async init(): Promise<void> {
    // 动态导入：demo 模式永不加载 web3，保证离线可用
    const mod = await import('@solana/web3.js');
    this.web3 = mod;
    this.connection = new mod.Connection(this.rpcUrl, {
      // 拉交易最低 confirmed；日志订阅可在 ChainScanner 里单独用 processed
      commitment: 'confirmed',
      // 公共 RPC 易 429；禁止无限重试，避免启动卡死
      disableRetryOnRateLimit: true,
    });
  }

  async close(): Promise<void> {}

  async fetchNewTokens(limit = 20): Promise<TokenProfile[]> {
    const { candidates } = await this.fetchNewCandidates(limit);
    const out: TokenProfile[] = [];
    const concurrency = 3;
    for (let index = 0; index < candidates.length; index += concurrency) {
      const batch = candidates.slice(index, index + concurrency);
      const profiles = await Promise.all(
        batch.map((candidate) =>
          this.enrich(candidate.mint, candidate.attrs, candidate.pool, candidate.imageUrl),
        ),
      );
      for (const profile of profiles) {
        if (profile) out.push(profile);
      }
    }
    return out;
  }

  async subscribeNewTokens(handler: (t: TokenProfile) => void): Promise<() => void> {
    if (config.chainScan.enabled) {
      return this.subscribeViaChainScan(handler);
    }
    return this.subscribeViaGeckoPoll(handler);
  }

  /** 主路径：内盘 PumpPortal + 外盘 migration/Gecko/Ray 链上 → enrich 队列 */
  private async subscribeViaChainScan(handler: (t: TokenProfile) => void): Promise<() => void> {
    // dex:mint —— 同 mint 内盘见过后，毕业上外盘仍可再评估
    const seen = new Set<string>();
    const queue: PoolCandidate[] = [];
    let processBusy = false;
    let stopped = false;
    const concurrency = 3;
    const stopHandles: Array<() => void> = [];

    const processQueue = async () => {
      if (processBusy || stopped) return;
      processBusy = true;
      try {
        while (queue.length > 0 && !stopped) {
          const batch = queue.splice(0, concurrency);
          await Promise.all(
            batch.map(async (candidate) => {
              try {
                const profile = await this.enrich(
                  candidate.mint,
                  candidate.attrs,
                  candidate.pool,
                  candidate.imageUrl,
                  candidate.dex,
                );
                if (profile && !stopped) handler(profile);
              } catch {
                /* 单币富化失败跳过 */
              }
            }),
          );
        }
      } finally {
        processBusy = false;
        if (queue.length > 0 && !stopped) void processQueue();
      }
    };

    const enqueueCandidate = (
      candidate: PoolCandidate,
      sourceLabel: string,
      detail: string,
      options?: { quiet?: boolean },
    ): boolean => {
      if (stopped) return false;
      const dex = candidate.dex ?? 'raydium';
      const dedupeKey = `${dex}:${candidate.mint}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      if (!options?.quiet) logger.info(`${sourceLabel}发现 ${dex} ${detail}`);
      queue.push({ ...candidate, dex });
      void processQueue();
      return true;
    };

    const enqueueDiscovery = (
      event: {
        mint: string;
        dex: Dex;
        programKind: string;
        poolAddress: string | null;
        name?: string | null;
        symbol?: string | null;
        imageUrl?: string | null;
        uri?: string | null;
      },
      sourceLabel: string,
    ) => {
      const label = event.symbol || event.name || event.mint.slice(0, 8);
      enqueueCandidate(
        {
          mint: event.mint,
          attrs: {
            ...(event.symbol ? { symbol: event.symbol } : {}),
            ...(event.name ? { name: event.name } : {}),
            ...(event.uri ? { uri: event.uri } : {}),
          },
          pool: event.poolAddress ? { id: event.poolAddress } : { id: null },
          imageUrl: event.imageUrl ?? null,
          dex: event.dex,
        },
        sourceLabel,
        `${label} mint=${event.mint.slice(0, 8)}… (${event.programKind})`,
      );
    };

    // 内盘 + 毕业外盘：PumpPortal（避开公共 RPC getTransaction）
    if (config.chainScan.programs.pump && config.chainScan.pumpPortalEnabled) {
      const pumpPortal = new PumpPortalScanner({
        onDiscovery: (event) => {
          const sourceLabel =
            event.programKind === 'migration' ? 'PumpPortal毕业' : 'PumpPortal';
          enqueueDiscovery(event, sourceLabel);
        },
      });
      stopHandles.push(await pumpPortal.start());
    }

    // 链上：PumpPortal 开启时不再订 pump，只订 Raydium，显著降低 429
    const chainEnabled = {
      pump: config.chainScan.programs.pump && !config.chainScan.pumpPortalEnabled,
      raydium: config.chainScan.programs.raydium,
    };
    if (chainEnabled.pump || chainEnabled.raydium) {
      const scanner = new ChainScanner({
        connection: this.connection,
        PublicKey: this.web3.PublicKey,
        enabled: chainEnabled,
        commitment: config.chainScan.commitment,
        parseConcurrency: config.chainScan.parseConcurrency,
        onDiscovery: (event) => enqueueDiscovery(event, '链上'),
      });
      stopHandles.push(await scanner.start());
    } else {
      logger.info('链上 program 订阅已跳过（Pump 由 PumpPortal 承担，Raydium 未启用）');
    }

    // 外盘补强：并行 Gecko new_pools（有退避；与内盘共用评估队列）
    if (config.chainScan.geckoDiscoveryEnabled) {
      stopHandles.push(
        this.startGeckoDiscoveryPoll({
          isStopped: () => stopped,
          // 错开启动瞬间，降低与其它 Gecko 调用撞 429
          initialDelayMs: 45_000,
          onCandidates: (candidates, meta) => {
            let novel = 0;
            for (const candidate of candidates) {
              const label =
                String(candidate.attrs?.symbol ?? candidate.attrs?.name ?? '').trim() ||
                candidate.mint.slice(0, 8);
              const added = enqueueCandidate(
                candidate,
                'Gecko',
                `${label} mint=${candidate.mint.slice(0, 8)}… (${meta.kind})`,
                { quiet: true },
              );
              if (added) novel += 1;
            }
            if (novel === 0) {
              logger.info(`Gecko 轮询：本轮 ${candidates.length} 条均为已见`);
            } else {
              logger.info(
                `Gecko 轮询：本轮新增 ${novel} / ${candidates.length}（${meta.kind}，评估队列 ${queue.length}）`,
              );
            }
          },
          onRateLimited: (delayMs) => {
            logger.warn(`Gecko 限流，外盘轮询退避 ${Math.round(delayMs / 1000)}s`);
          },
        }),
      );
    }

    return () => {
      stopped = true;
      for (const stop of stopHandles) stop();
      queue.length = 0;
    };
  }

  /** Gecko new_pools 轮询；可与链上发现并行，也可单独作为回退源 */
  private startGeckoDiscoveryPoll(opts: {
    isStopped: () => boolean;
    onCandidates: (
      candidates: PoolCandidate[],
      meta: { kind: 'new_pools' | 'trending_pools' | 'mixed' },
    ) => void;
    onRateLimited?: (delayMs: number) => void;
    /** 并行模式下默认只拉 new_pools，降低 429 */
    newPoolsOnly?: boolean;
    baseIntervalMs?: number;
    initialDelayMs?: number;
  }): () => void {
    const baseIntervalMs = opts.baseIntervalMs ?? 30_000;
    const maxBackoffMs = 5 * 60_000;
    const newPoolsOnly = opts.newPoolsOnly ?? true;
    const initialDelayMs = Math.max(0, opts.initialDelayMs ?? 0);
    let pollBusy = false;
    let stopped = false;
    let timer: NodeJS.Timeout | null = null;
    let backoffMs = baseIntervalMs;

    const scheduleNext = (delayMs: number) => {
      if (stopped || opts.isStopped()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      if (pollBusy || stopped || opts.isStopped()) return;
      pollBusy = true;
      let nextDelay = baseIntervalMs;
      try {
        if (newPoolsOnly) {
          const result = await this.fetchPoolCandidatesSafe('new_pools', 16);
          if (result.rateLimited) {
            backoffMs = Math.min(maxBackoffMs, Math.max(backoffMs * 2, baseIntervalMs * 2));
            nextDelay = backoffMs;
            opts.onRateLimited?.(nextDelay);
          } else {
            backoffMs = baseIntervalMs;
            nextDelay = baseIntervalMs;
            opts.onCandidates(result.candidates, { kind: 'new_pools' });
          }
        } else {
          const { candidates, rateLimited } = await this.fetchNewCandidates(16);
          if (rateLimited) {
            backoffMs = Math.min(maxBackoffMs, Math.max(backoffMs * 2, baseIntervalMs * 2));
            nextDelay = backoffMs;
            opts.onRateLimited?.(nextDelay);
          } else {
            backoffMs = baseIntervalMs;
            nextDelay = baseIntervalMs;
            opts.onCandidates(candidates, { kind: 'mixed' });
          }
        }
      } catch (error) {
        backoffMs = Math.min(maxBackoffMs, Math.max(backoffMs * 2, baseIntervalMs * 2));
        nextDelay = backoffMs;
        logger.warn(
          `Gecko 轮询失败，${Math.round(nextDelay / 1000)}s 后重试：${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        pollBusy = false;
        scheduleNext(nextDelay);
      }
    };

    logger.info(
      newPoolsOnly
        ? `Gecko 外盘轮询已启动（new_pools，与内盘并行${initialDelayMs ? `，首轮 ${Math.round(initialDelayMs / 1000)}s 后` : ''}）`
        : 'Gecko 发现轮询已启动（new_pools + trending）',
    );
    if (initialDelayMs > 0) scheduleNext(initialDelayMs);
    else void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  /** 回退：Gecko 轮询（CHAIN_SCAN_ENABLED=false） */
  private async subscribeViaGeckoPoll(handler: (t: TokenProfile) => void): Promise<() => void> {
    const seen = new Set<string>();
    const queue: PoolCandidate[] = [];
    let processBusy = false;
    let stopped = false;
    const concurrency = 3;

    const processQueue = async () => {
      if (processBusy || stopped) return;
      processBusy = true;
      try {
        while (queue.length > 0 && !stopped) {
          const batch = queue.splice(0, concurrency);
          await Promise.all(
            batch.map(async (candidate) => {
              try {
                const profile = await this.enrich(
                  candidate.mint,
                  candidate.attrs,
                  candidate.pool,
                  candidate.imageUrl,
                  candidate.dex,
                );
                if (profile && !stopped) handler(profile);
              } catch {
                /* 单币富化失败跳过 */
              }
            }),
          );
        }
      } finally {
        processBusy = false;
        if (queue.length > 0 && !stopped) void processQueue();
      }
    };

    logger.info('链上扫链已关闭，使用 Gecko 轮询发现');
    const stopPoll = this.startGeckoDiscoveryPoll({
      isStopped: () => stopped,
      newPoolsOnly: false,
      onRateLimited: (delayMs) => {
        logger.warn(`Gecko 限流，发现轮询退避 ${Math.round(delayMs / 1000)}s`);
      },
      onCandidates: (candidates) => {
        let novel = 0;
        for (const candidate of candidates) {
          const dedupeKey = `${candidate.dex ?? 'raydium'}:${candidate.mint}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          novel += 1;
          queue.push(candidate);
        }
        if (novel === 0) {
          logger.info(`发现轮询：本轮 ${candidates.length} 条均为已见，继续等待新池`);
        } else {
          logger.info(
            `发现轮询：本轮新增 ${novel} / ${candidates.length}（评估队列 ${queue.length}，并发 ${concurrency}）`,
          );
          void processQueue();
        }
      },
    });

    return () => {
      stopped = true;
      stopPoll();
      queue.length = 0;
    };
  }

  async fetchTokenProfile(mint: string): Promise<TokenProfile | null> {
    try {
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${encodeURIComponent(mint)}?include=top_pools`,
        { headers: { accept: 'application/json' } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      const attrs = data?.data?.attributes ?? {};
      const pools = data?.included?.filter((item: any) => item?.type === 'pool') ?? [];
      const pool = pools[0] ?? { id: null, attributes: {} };
      const imageUrl = attrs?.image_url ?? null;
      const mergedAttrs = {
        ...(pool?.attributes ?? {}),
        base_token_price_usd: attrs?.price_usd ?? pool?.attributes?.base_token_price_usd,
        name: attrs?.symbol ?? attrs?.name ?? pool?.attributes?.name,
        market_cap_usd: attrs?.market_cap_usd ?? attrs?.fdv_usd,
        volume_usd: attrs?.volume_usd ?? pool?.attributes?.volume_usd,
        reserve_in_usd: pool?.attributes?.reserve_in_usd ?? attrs?.total_reserve_in_usd,
      };
      return await this.enrich(mint, mergedAttrs, pool, imageUrl);
    } catch {
      return null;
    }
  }

  async fetchPrice(mint: string): Promise<number | null> {
    const quote = await this.fetchQuote(mint);
    return quote?.priceUsd ?? null;
  }

  async fetchQuote(mint: string): Promise<{ priceUsd: number; marketCapUsd: number } | null> {
    try {
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${encodeURIComponent(mint)}`,
        { headers: { accept: 'application/json' } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      const attrs = data?.data?.attributes ?? {};
      const priceUsd = numOr0(attrs?.price_usd);
      if (!(priceUsd > 0)) return null;
      const marketCapUsd = numOr0(attrs?.market_cap_usd) || numOr0(attrs?.fdv_usd);
      return { priceUsd, marketCapUsd };
    } catch {
      return null;
    }
  }

  private async fetchNewCandidates(
    limit: number,
  ): Promise<{ candidates: PoolCandidate[]; rateLimited: boolean }> {
    const newLimit = Math.max(8, Math.ceil(limit * 0.7));
    const trendLimit = Math.max(4, limit - newLimit);
    // 串行拉两路，降低 Gecko 429；单路失败不拖垮整轮
    const fresh = await this.fetchPoolCandidatesSafe('new_pools', newLimit);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const trending = await this.fetchPoolCandidatesSafe('trending_pools', trendLimit);
    const seen = new Set<string>();
    const out: PoolCandidate[] = [];
    for (const candidate of [...fresh.candidates, ...trending.candidates]) {
      if (seen.has(candidate.mint)) continue;
      seen.add(candidate.mint);
      out.push(candidate);
      if (out.length >= limit) break;
    }
    return {
      candidates: out,
      rateLimited: fresh.rateLimited || trending.rateLimited,
    };
  }

  private async fetchPoolCandidatesSafe(
    kind: 'new_pools' | 'trending_pools',
    limit: number,
  ): Promise<{ candidates: PoolCandidate[]; rateLimited: boolean }> {
    try {
      const candidates = await this.fetchPoolCandidates(kind, limit);
      return { candidates, rateLimited: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const rateLimited = /HTTP 429/i.test(message);
      logger.warn(`发现源 ${kind} 失败：${message}`);
      return { candidates: [], rateLimited };
    }
  }

  /** 仅解析池子候选（不调 RugCheck/RPC），供发现轮询快速完成 */
  private async fetchPoolCandidates(
    kind: 'new_pools' | 'trending_pools',
    limit: number,
  ): Promise<PoolCandidate[]> {
    const url = `https://api.geckoterminal.com/api/v2/networks/solana/${kind}?include=base_token,quote_token&page=1`;
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`GeckoTerminal ${kind} HTTP ${res.status}`);
    const data = (await res.json()) as any;
    const pools = data?.data ?? [];
    const included = data?.included ?? [];
    const out: PoolCandidate[] = [];
    for (const pool of pools.slice(0, Math.max(limit * 2, limit))) {
      if (out.length >= limit) break;
      const resolved = this.resolvePoolToken(pool, included);
      if (!resolved) continue;
      out.push({
        mint: resolved.mint,
        imageUrl: resolved.imageUrl,
        pool,
        dex: this.dexFromGeckoAttrs(pool?.attributes),
        attrs: {
          ...(pool?.attributes ?? {}),
          // 明确写入目标代币价格/符号，避免 base=WSOL 时用错价
          base_token_price_usd: resolved.priceUsd,
          symbol: resolved.symbol,
          name: resolved.name,
        },
      });
    }
    return out;
  }

  private dexFromGeckoAttrs(attrs: Record<string, unknown> | null | undefined): Dex {
    const dexId = String(attrs?.dex_id ?? '').toLowerCase();
    if (dexId.includes('pump')) return 'pumpfun';
    return 'raydium';
  }

  /** 从池子里解析 meme 侧 mint/价格（跳过 WSOL 作为标的） */
  private resolvePoolToken(
    pool: any,
    included: any[],
  ): { mint: string; priceUsd: number; symbol: string; name: string; imageUrl: string | null } | null {
    const wsol = 'So11111111111111111111111111111111111111112';
    const attrs = pool?.attributes ?? {};
    const baseId = String(pool?.relationships?.base_token?.data?.id ?? '');
    const quoteId = String(pool?.relationships?.quote_token?.data?.id ?? '');
    const baseMint = baseId.replace(/^solana_/i, '');
    const quoteMint = quoteId.replace(/^solana_/i, '');
    const baseToken = included.find((token: any) => token?.id === baseId && token?.type === 'token');
    const quoteToken = included.find((token: any) => token?.id === quoteId && token?.type === 'token');

    const baseIsWsol = baseMint === wsol;
    const quoteIsWsol = quoteMint === wsol;
    const useBase = !baseIsWsol && Boolean(baseMint);
    const useQuote = !useBase && !quoteIsWsol && Boolean(quoteMint);
    if (!useBase && !useQuote) return null;

    const mint = useBase ? baseMint : quoteMint;
    const meta = useBase ? baseToken : quoteToken;
    const priceUsd = useBase
      ? numOr0(attrs?.base_token_price_usd)
      : numOr0(attrs?.quote_token_price_usd);
    if (!(priceUsd > 0)) return null;

    const symbol = String(meta?.attributes?.symbol ?? '').trim();
    const name = String(meta?.attributes?.name ?? symbol).trim();
    const imageUrl = meta?.attributes?.image_url ?? null;
    return {
      mint,
      priceUsd,
      symbol: symbol || this.symbolFromPoolName(String(attrs?.name ?? '')),
      name: name || symbol || 'UNKNOWN',
      imageUrl,
    };
  }

  private symbolFromPoolName(poolName: string): string {
    const left = poolName.split('/')[0]?.trim() ?? '';
    return left || 'UNKNOWN';
  }

  private isUnknownLabel(value: string | null | undefined): boolean {
    const text = String(value ?? '').trim();
    return !text || /^unknown$/i.test(text);
  }

  /** 从 token metadata URI（多为 IPFS JSON）取 name/symbol */
  private async fetchUriTokenMeta(
    uri: string,
  ): Promise<{ symbol: string | null; name: string | null; imageUrl: string | null } | null> {
    const raw = uri.trim();
    if (!raw || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(raw)) return null;
    const url = raw.startsWith('ipfs://')
      ? `https://ipfs.io/ipfs/${raw.slice('ipfs://'.length)}`
      : raw;
    if (!/^https?:\/\//i.test(url)) return null;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5_000),
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      const symbol = String(data.symbol ?? '').trim() || null;
      const name = String(data.name ?? '').trim() || null;
      const imageUrl = String(data.image ?? data.image_url ?? '').trim() || null;
      if (!symbol && !name) return null;
      return { symbol, name, imageUrl };
    } catch {
      return null;
    }
  }

  /** 外盘/毕业缺名时兜底：DexScreener（避开 Gecko 429） */
  private async fetchDexScreenerMeta(
    mint: string,
  ): Promise<{ symbol: string | null; name: string | null; imageUrl: string | null } | null> {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
        { signal: AbortSignal.timeout(6_000) },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        pairs?: Array<{
          baseToken?: { address?: string; symbol?: string; name?: string };
          quoteToken?: { address?: string; symbol?: string; name?: string };
          info?: { imageUrl?: string };
        }>;
      };
      const pairs = data.pairs ?? [];
      for (const pair of pairs) {
        for (const side of [pair.baseToken, pair.quoteToken]) {
          if (!side?.address || side.address !== mint) continue;
          const symbol = String(side.symbol ?? '').trim() || null;
          const name = String(side.name ?? '').trim() || symbol;
          const imageUrl = String(pair.info?.imageUrl ?? '').trim() || null;
          if (symbol || name) return { symbol, name, imageUrl };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchRugCheck(mint: string): Promise<any | null> {
    try {
      const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private async fetchHolders(mint: string, rug: any): Promise<HolderData> {
    let top10Pct = 0;
    let largestWhalePct = 0;
    const rugTotal = numOr0(rug?.totalHolders);
    const total = rugTotal > 0 ? Math.floor(rugTotal) : -1;
    const whales: WhaleInfo[] = [];

    // 优先 RugCheck（不依赖公共 RPC 配额）
    let devPct = 0;
    const rugTop = rug?.topHolders ?? [];
    for (const h of rugTop.slice(0, 10)) {
      const p = numOr0(h?.pct);
      if (p > 0) {
        whales.push({
          address: String(h?.owner ?? h?.address ?? ''),
          pct: p,
          entering: false,
          buyVolumeUsd: 0,
        });
        largestWhalePct = Math.max(largestWhalePct, p);
        top10Pct += p;
      }
      if (h?.insider) devPct = Math.max(devPct, p);
    }
    top10Pct = Math.min(100, top10Pct);

    // RPC 补充：短超时，失败则跳过（避免 429 拖垮启动）
    if (whales.length === 0) {
      try {
        const { PublicKey } = this.web3;
        const pubkey = new PublicKey(mint);
        const rpcResult = await Promise.race([
          Promise.all([
            this.connection.getTokenLargestAccounts(pubkey),
            this.connection.getTokenSupply(pubkey),
          ]),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
        ]);
        if (rpcResult) {
          const [largestAccts, supply] = rpcResult;
          const totalSupply = numOr0(supply?.value?.uiAmount);
          const top = (largestAccts?.value ?? []).slice(0, 10);
          if (totalSupply > 0) {
            top10Pct = top.reduce(
              (sum: number, account: any) => sum + (numOr0(account.uiAmount) / totalSupply) * 100,
              0,
            );
            const largest = top[0];
            if (largest) {
              largestWhalePct = (numOr0(largest.uiAmount) / totalSupply) * 100;
              whales.push({
                address: String(largest.address),
                pct: largestWhalePct,
                entering: false,
                buyVolumeUsd: 0,
              });
            }
          }
        }
      } catch {
        /* RPC 受限时忽略 */
      }
    }

    if (devPct === 0 && largestWhalePct > 0) devPct = largestWhalePct;

    const seen = new Set<string>();
    const unique = whales.filter((whale) => {
      if (!whale.address || seen.has(whale.address)) return false;
      seen.add(whale.address);
      return true;
    });

    return { total, top10Pct, devPct, largestWhalePct, whaleCount: unique.length, whales: unique };
  }

  private async enrich(
    mint: string,
    attrs: any,
    pool: any,
    imageUrl: string | null,
    dexHint?: Dex,
  ): Promise<TokenProfile | null> {
    try {
      const rug = await this.fetchRugCheck(mint);
      const holders = await this.fetchHolders(mint, rug);
      const now = Date.now();

      // 优先池子/显式代币价；RugCheck 价格单位偶发不一致，仅作兜底
      const priceUsd =
        numOr0(attrs?.base_token_price_usd) ||
        numOr0(attrs?.price_usd) ||
        numOr0(rug?.price);
      const marketCapUsd = numOr0(attrs?.market_cap_usd) || numOr0(attrs?.fdv_usd);
      const volume24hUsd = numOr0(attrs?.volume_usd?.h24);
      const reserveUsd = numOr0(attrs?.reserve_in_usd);

      const markets = rug?.markets ?? [];
      const lp = markets[0]?.lp ?? {};
      const lpBurnPct = numOr0(lp?.lpBurnPct);
      const lpLocked = Boolean(lp?.lpLocked) || lpBurnPct >= 99 || dexHint === 'pumpfun';
      const lockPct = numOr0(lp?.lpLockedPct) || (lpLocked ? 100 : 0);
      const liquidityUsd = reserveUsd || numOr0(rug?.totalMarketLiquidity);

      const tokenMeta = rug?.tokenMeta ?? {};
      const token = rug?.token ?? {};
      const risks = rug?.risks ?? [];

      const security: SecurityData = {
        mintAuthorityRenounced: token.mintAuthority == null,
        freezeAuthorityRenounced: token.freezeAuthority == null,
        metadataMutable: tokenMeta.mutable !== false,
        isHoneypot: risks.some((r: any) =>
          /honeypot|blacklist|no[- ]sell|貔貅|无法卖出/i.test(String(r?.name ?? '')),
        ),
        verified: !rug?.error && tokenMeta != null,
      };

      const dex: Dex =
        dexHint ??
        (rug?.program === 'pump' || /pump/i.test(String(attrs?.name ?? ''))
          ? 'pumpfun'
          : 'raydium');

      // 新币 RugCheck 常无 meta；优先发现源 attrs → RugCheck → DexScreener
      let resolvedSymbol = String(
        attrs?.symbol || tokenMeta.symbol || this.symbolFromPoolName(String(attrs?.name ?? '')),
      ).trim();
      let resolvedName = String(attrs?.name || tokenMeta.name || '').trim();
      let resolvedImage = imageUrl;

      if (this.isUnknownLabel(resolvedSymbol) || !resolvedName) {
        const uriMeta = await this.fetchUriTokenMeta(String(attrs?.uri ?? ''));
        if (uriMeta) {
          if (this.isUnknownLabel(resolvedSymbol) && uriMeta.symbol) {
            resolvedSymbol = uriMeta.symbol;
          }
          if (!resolvedName && uriMeta.name) resolvedName = uriMeta.name;
          if (!resolvedImage && uriMeta.imageUrl) resolvedImage = uriMeta.imageUrl;
        }
      }

      if (this.isUnknownLabel(resolvedSymbol) || !resolvedName) {
        const external = await this.fetchDexScreenerMeta(mint);
        if (external) {
          if (this.isUnknownLabel(resolvedSymbol) && external.symbol) {
            resolvedSymbol = external.symbol;
          }
          if (!resolvedName && external.name) resolvedName = external.name;
          if (!resolvedImage && external.imageUrl) resolvedImage = external.imageUrl;
        }
      }

      const rawSymbol = resolvedSymbol || 'UNKNOWN';
      const symbol = rawSymbol.includes('/')
        ? this.symbolFromPoolName(rawSymbol)
        : rawSymbol || 'UNKNOWN';
      const displayName = (resolvedName || symbol).trim() || symbol;

      return {
        mint,
        symbol: symbol.toUpperCase(),
        name: displayName,
        imageUrl: resolvedImage,
        dex,
        poolAddress: String(pool?.id ?? lp?.pool_pubkey ?? null),
        createdAtMs: now,
        discoveredAtMs: now,
        priceUsd,
        marketCapUsd,
        volume24hUsd,
        liquidity: { usd: liquidityUsd, lpLocked, lockPct, lpBurnPct, lockEndTimeMs: null },
        holders,
        security,
      };
    } catch {
      return null;
    }
  }
}
