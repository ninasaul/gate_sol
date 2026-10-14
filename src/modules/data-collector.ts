import type { DataSource } from '../services/data-source.js';
import type { TokenProfile } from '../types.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// 模块 1/6 —— 数据采集器
// 职责：从数据源拉取新币/新池子，持续发现并分发给下游筛选管道。
// ============================================================================

export interface DataCollectorOptions {
  onToken: (t: TokenProfile) => void;
}

export class DataCollector {
  private stopFn: (() => void) | null = null;

  constructor(
    private source: DataSource,
    private opts: DataCollectorOptions,
  ) {}

  async start(): Promise<void> {
    await this.source.init();
    // 订阅内部会立即拉一轮；不在此阻塞，避免 live 外网/RPC 拖死看板启动
    this.stopFn = await this.source.subscribeNewTokens((token) => this.opts.onToken(token));
    logger.info('数据采集器：已订阅新池发现');
  }

  stop(): void {
    this.stopFn?.();
  }
}
