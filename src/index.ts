import { config } from './config.js';
import { Pipeline } from './pipeline.js';
import { DashboardServer } from './dashboard.js';
import { DemoDataSource, SolanaDataSource } from './services/data-source.js';
import type { DataSource } from './services/data-source.js';
import { logger } from './utils/logger.js';

// ============================================================================
// 入口 —— 解析运行模式，组装数据源、流水线与 Bot API，优雅退出
// ============================================================================

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function resolveMode(): 'demo' | 'live' {
  if (hasFlag('--live')) return 'live';
  if (hasFlag('--demo')) return 'demo';
  return config.mode;
}

function resolveApiPort(): number {
  const value = Number(process.env.BOT_API_PORT ?? 3940);
  return Number.isFinite(value) && value > 0 && value < 65536 ? Math.floor(value) : 3940;
}

async function main(): Promise<void> {
  const mode = resolveMode();
  // --api / --web 均启 API；dev 脚本默认带 --api
  const enableApi = hasFlag('--api') || hasFlag('--web');

  logger.info('================================================');
  logger.info('  GateSol · 六模块筛选 + 纸面交易');
  logger.info(
    `  模式：${mode === 'demo' ? 'demo（离线模拟）' : 'live（真实链上数据）'}${enableApi ? ' · Bot API' : ''}`,
  );
  logger.info('================================================');
  logger.info(
    '筛选规则：流动性不足排除 · LP 未锁不碰 · 项目方持仓>7%跳过 · 巨鲸进场仅观察',
  );

  // 同步 mode 到 config，供 Pipeline.getMode 与看板快照使用
  (config as { mode: 'demo' | 'live' }).mode = mode;

  const source: DataSource =
    mode === 'live'
      ? new SolanaDataSource(config.solanaRpcUrl)
      : new DemoDataSource({
          seed: config.sim.seed,
          initialTokens: config.sim.initialTokens,
          tokenIntervalMs: config.sim.tokenIntervalMs,
        });

  const pipeline = new Pipeline(source);

  // 先起 API，避免 live 采集（外部接口/RPC）阻塞看板
  let dashboard: DashboardServer | null = null;
  if (enableApi) {
    dashboard = new DashboardServer(pipeline, resolveApiPort());
    await dashboard.start();
  }

  await pipeline.start();

  const shutdown = async (): Promise<void> => {
    if (dashboard) await dashboard.stop();
    await pipeline.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    logger.warn('收到退出信号，正在收尾…');
    void shutdown();
  });
  process.on('SIGTERM', () => {
    logger.warn('收到终止信号，正在收尾…');
    void shutdown();
  });

  // 开着 API 时不自动结束，由用户 Ctrl-C 停止；否则按配置时长自动结束
  if (mode === 'demo' && !enableApi) {
    setTimeout(() => {
      logger.info(`运行时长 ${config.sim.runDurationMs}ms 已到，自动结束。`);
      void shutdown();
    }, config.sim.runDurationMs);
  }
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
