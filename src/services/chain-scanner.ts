import type { Dex } from '../types.js';
import { logger } from '../utils/logger.js';
import {
  CHAIN_PROGRAMS,
  isTradableMint,
  matchProgramLogs,
  type ChainProgramKind,
  type ChainProgramSpec,
} from './chain-programs.js';

export interface ChainDiscovery {
  mint: string;
  dex: Dex;
  signature: string;
  poolAddress: string | null;
  programKind: ChainProgramKind;
  /** 发现源自带的元数据（如 PumpPortal name/symbol） */
  name?: string | null;
  symbol?: string | null;
  imageUrl?: string | null;
  uri?: string | null;
}

export interface ChainScannerOptions {
  connection: any;
  PublicKey: new (value: string) => unknown;
  /** 启用的程序族：pump / raydium（raydium 含 AMM + CPMM） */
  enabled: { pump: boolean; raydium: boolean };
  onDiscovery: (event: ChainDiscovery) => void;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  /** 并行解析交易数，默认 4 */
  parseConcurrency?: number;
}

/**
 * 订阅 Pump + Raydium program logs，解析交易后回调新 mint。
 * 依赖 RPC WebSocket；公共节点易断，内置退避重连。
 */
export class ChainScanner {
  private readonly connection: any;
  private readonly PublicKey: new (value: string) => unknown;
  private readonly enabled: { pump: boolean; raydium: boolean };
  private readonly onDiscovery: (event: ChainDiscovery) => void;
  private readonly commitment: 'processed' | 'confirmed' | 'finalized';
  private readonly parseConcurrency: number;

  private stopped = false;
  private subscriptionIds: number[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private reconnectBound = false;
  private seenSignatures = new Set<string>();
  private parseBusy = false;
  private parseQueue: Array<{ signature: string; spec: ChainProgramSpec }> = [];
  private readonly maxParseQueue = 80;
  /** 动态并发：遇 429 降到 1，连续成功再抬回目标值 */
  private activeConcurrency: number;
  private rateLimitBackoffMs = 0;
  private successStreak = 0;

  constructor(opts: ChainScannerOptions) {
    this.connection = opts.connection;
    this.PublicKey = opts.PublicKey;
    this.enabled = opts.enabled;
    this.onDiscovery = opts.onDiscovery;
    this.commitment = opts.commitment ?? 'processed';
    this.parseConcurrency = Math.max(1, Math.min(8, opts.parseConcurrency ?? 4));
    this.activeConcurrency = this.parseConcurrency;
  }

  async start(): Promise<() => void> {
    this.stopped = false;
    await this.subscribeAll();
    this.bindSocketReconnect();
    const kinds = this.activeSpecs()
      .map((spec) => spec.kind)
      .join(', ');
    logger.info(
      `链上扫链已启动：${kinds || '（无启用程序）'} · 订阅=${this.commitment} · 解析目标并发 ${this.parseConcurrency}`,
    );
    return () => this.stop();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.unsubscribeAll();
    this.parseQueue.length = 0;
  }

  private activeSpecs(): ChainProgramSpec[] {
    return CHAIN_PROGRAMS.filter((spec) => {
      if (spec.kind === 'pump') return this.enabled.pump;
      return this.enabled.raydium;
    });
  }

  private async subscribeAll(): Promise<void> {
    this.unsubscribeAll();
    for (const spec of this.activeSpecs()) {
      try {
        const programId = new this.PublicKey(spec.programId);
        const subscriptionId = this.connection.onLogs(
          programId,
          (logInfo: { logs?: string[]; err: unknown; signature: string }) => {
            if (this.stopped || logInfo.err) return;
            if (!matchProgramLogs(logInfo.logs, spec.logPatterns)) return;
            this.enqueueParse(logInfo.signature, spec);
          },
          this.commitment,
        );
        this.subscriptionIds.push(subscriptionId);
        logger.info(`已订阅 ${spec.kind} (${spec.programId.slice(0, 8)}…)`);
      } catch (error) {
        logger.warn(
          `订阅 ${spec.kind} 失败：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private unsubscribeAll(): void {
    for (const subscriptionId of this.subscriptionIds) {
      try {
        void this.connection.removeOnLogsListener(subscriptionId);
      } catch {
        /* 连接已断时忽略 */
      }
    }
    this.subscriptionIds = [];
  }

  private bindSocketReconnect(): void {
    const socket = this.connection?._rpcWebSocket;
    if (!socket || this.reconnectBound) return;
    this.reconnectBound = true;
    const onClose = () => {
      if (this.stopped) return;
      logger.warn('RPC WebSocket 断开，准备重连扫链订阅');
      this.scheduleReconnect();
    };
    const onError = (error: unknown) => {
      if (this.stopped) return;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`RPC WebSocket 错误：${message}`);
    };
    try {
      socket.on('close', onClose);
      socket.on('error', onError);
    } catch {
      /* 部分 RPC 客户端无事件 API */
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    const delayMs = Math.min(60_000, 2_000 * 2 ** Math.min(this.reconnectAttempt - 1, 5));
    logger.warn(`扫链 ${Math.round(delayMs / 1000)}s 后重连（第 ${this.reconnectAttempt} 次）`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.resubscribe();
    }, delayMs);
  }

  private async resubscribe(): Promise<void> {
    if (this.stopped) return;
    try {
      await this.subscribeAll();
      this.reconnectAttempt = 0;
      logger.info('扫链订阅已恢复');
    } catch (error) {
      logger.warn(
        `扫链重连失败：${error instanceof Error ? error.message : String(error)}`,
      );
      this.scheduleReconnect();
    }
  }

  private enqueueParse(signature: string, spec: ChainProgramSpec): void {
    if (this.seenSignatures.has(signature)) return;
    this.seenSignatures.add(signature);
    if (this.seenSignatures.size > 5_000) {
      const drop = [...this.seenSignatures].slice(0, 2_000);
      for (const key of drop) this.seenSignatures.delete(key);
    }
    if (this.parseQueue.length >= this.maxParseQueue) {
      this.parseQueue.shift();
    }
    this.parseQueue.push({ signature, spec });
    void this.drainParseQueue();
  }

  private async drainParseQueue(): Promise<void> {
    if (this.parseBusy || this.stopped) return;
    this.parseBusy = true;
    try {
      while (this.parseQueue.length > 0 && !this.stopped) {
        if (this.rateLimitBackoffMs > 0) {
          const waitMs = this.rateLimitBackoffMs;
          logger.warn(`RPC 限流冷却 ${Math.round(waitMs / 1000)}s（解析并发降至 ${this.activeConcurrency}）`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          if (this.stopped) break;
        }

        const batch = this.parseQueue.splice(0, this.activeConcurrency);
        const results = await Promise.all(
          batch.map(async (item) => {
            try {
              return {
                discovery: await this.parseSignature(item.signature, item.spec),
                rateLimited: false,
                signature: item.signature,
              };
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              logger.warn(`解析交易失败 ${item.signature.slice(0, 12)}…：${message}`);
              return {
                discovery: null,
                rateLimited: /429|Too Many Requests|rate.?limit/i.test(message),
                signature: item.signature,
              };
            }
          }),
        );

        let hitRateLimit = false;
        for (const result of results) {
          if (result.rateLimited) hitRateLimit = true;
          if (result.discovery && !this.stopped) this.onDiscovery(result.discovery);
        }

        if (hitRateLimit) {
          this.activeConcurrency = 1;
          this.successStreak = 0;
          this.rateLimitBackoffMs = Math.min(
            60_000,
            Math.max(2_000, this.rateLimitBackoffMs ? this.rateLimitBackoffMs * 2 : 3_000),
          );
          // 积压过大时丢弃一半，优先保活而不是打爆公共 RPC
          if (this.parseQueue.length > 20) {
            const drop = Math.floor(this.parseQueue.length / 2);
            this.parseQueue.splice(0, drop);
            logger.warn(`解析队列过长，丢弃最早 ${drop} 条`);
          }
        } else {
          this.successStreak += 1;
          this.rateLimitBackoffMs = 0;
          if (this.successStreak >= 8 && this.activeConcurrency < this.parseConcurrency) {
            this.activeConcurrency += 1;
            this.successStreak = 0;
            logger.info(`RPC 恢复，解析并发升至 ${this.activeConcurrency}`);
          }
        }
      }
    } finally {
      this.parseBusy = false;
      if (this.parseQueue.length > 0 && !this.stopped) void this.drainParseQueue();
    }
  }

  private async parseSignature(
    signature: string,
    spec: ChainProgramSpec,
  ): Promise<ChainDiscovery | null> {
    // getParsedTransaction 最低要求 confirmed；订阅仍可用 processed 抢更早的 signature
    const fetchCommitment =
      this.commitment === 'finalized' ? 'finalized' : 'confirmed';
    const tx = await Promise.race([
      this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 1,
        commitment: fetchCommitment,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
    ]);
    if (!tx) {
      logger.warn(`交易超时或为空，跳过 ${signature.slice(0, 12)}…`);
      return null;
    }

    const mint = pickMintFromParsedTransaction(tx);
    if (!mint) {
      logger.warn(`未能从交易抽出 mint，跳过 ${signature.slice(0, 12)}… (${spec.kind})`);
      return null;
    }

    return {
      mint,
      dex: spec.dex,
      signature,
      poolAddress: null,
      programKind: spec.kind,
    };
  }
}

/** 从解析后的交易里挑非报价 mint；优先「仅出现在 post」的新币，其次 pump 后缀 */
export function pickMintFromParsedTransaction(tx: any): string | null {
  const preMints = ((tx?.meta?.preTokenBalances ?? []) as any[])
    .map((row) => String(row?.mint ?? ''))
    .filter((mint): mint is string => isTradableMint(mint));
  const pre = new Set<string>(preMints);
  const post = ((tx?.meta?.postTokenBalances ?? []) as any[])
    .map((row) => String(row?.mint ?? ''))
    .filter((mint): mint is string => isTradableMint(mint));

  const novel = [...new Set(post.filter((mint) => !pre.has(mint)))];
  if (novel.length === 1) return novel[0] ?? null;
  if (novel.length > 1) {
    const pumpish = novel.find((mint) => /pump$/i.test(mint));
    if (pumpish) return pumpish;
    return novel[0] ?? null;
  }

  const all = [...new Set(post.length ? post : preMints)];
  if (all.length === 1) return all[0] ?? null;
  if (all.length > 1) {
    const pumpish = all.find((mint) => /pump$/i.test(mint));
    if (pumpish) return pumpish;
    return all[0] ?? null;
  }

  // 兜底：账户键里找像 mint 的 base58（较少用）
  const keys = (tx?.transaction?.message?.accountKeys ?? []) as any[];
  for (const key of keys) {
    const value = typeof key === 'string' ? key : String(key?.pubkey ?? '');
    if (isTradableMint(value) && /pump$/i.test(value)) return value;
  }
  return null;
}
