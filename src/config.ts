import 'dotenv/config';

// ============================================================================
// 全局配置 —— 所有阈值集中在此，可用 .env 覆盖
// ============================================================================

function num(key: string, def: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function bool(key: string, def: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  return ['true', '1', 'yes', 'on'].includes(v.toLowerCase());
}

export type RunMode = 'demo' | 'live';

function parseChainPrograms(raw: string | undefined): { pump: boolean; raydium: boolean } {
  const value = (raw ?? 'pump,raydium').toLowerCase();
  const parts = value.split(/[,|\s]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0 || parts.includes('all')) {
    return { pump: true, raydium: true };
  }
  return {
    pump: parts.includes('pump') || parts.includes('pumpfun'),
    raydium: parts.includes('ray') || parts.includes('raydium'),
  };
}

export const config = {
  mode: (process.env.MODE ?? 'demo') as RunMode,
  solanaRpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',

  // —— 链上扫链发现（live） ——
  chainScan: {
    /** live 下默认开启；false 时回退 Gecko 轮询发现 */
    enabled: bool('CHAIN_SCAN_ENABLED', true),
    programs: parseChainPrograms(process.env.CHAIN_SCAN_PROGRAMS),
  },

  // —— 六模块筛选阈值 ——
  filters: {
    /** 最低流动性（美元），低于直接排除 */
    minLiquidityUsd: num('MIN_LIQUIDITY_USD', 50_000),
    /** 是否要求 LP 已锁/已燃烧 */
    requireLpLocked: bool('REQUIRE_LP_LOCKED', true),
    /** 项目方持仓上限（%），超过直接跳过 */
    maxDevHoldingPct: num('MAX_DEV_HOLDING_PCT', 7),
    /** 前 10 大持仓合计上限（%） */
    maxTop10HoldingPct: num('MAX_TOP10_HOLDING_PCT', 35),
    /** 超过该持仓占比即视为鲸鱼（%） */
    whaleHoldingPct: num('WHALE_HOLDING_PCT', 5),
    /** 最低持有人数 */
    minHolders: num('MIN_HOLDERS', 100),
    /** 池子最小年龄（毫秒），太新的观望 */
    minPoolAgeMs: num('MIN_POOL_AGE_MS', 60_000),
    /** 池子最大年龄（毫秒），太老的不追 */
    maxPoolAgeMs: num('MAX_POOL_AGE_MS', 86_400_000),
  },

  // —— 交易 / 风控参数（纸面） ——
  trading: {
    /** 单笔仓位（美元） */
    positionSizeUsd: num('POSITION_SIZE_USD', 100),
    /** 触发「让利润奔跑」的涨幅（%），超过后由移动止损锁定利润 */
    moonActivatePct: num('MOON_ACTIVATE_PCT', 30),
    /** 止损（%），快速斩断亏损 → 小亏 */
    stopLossPct: num('STOP_LOSS_PCT', 10),
    /** 移动止损（%），进入让利润奔跑后回撤该幅度即止盈 → 大赚 */
    trailingStopPct: num('TRAILING_STOP_PCT', 20),
    /** 最大同时持仓数 */
    maxConcurrentPositions: num('MAX_CONCURRENT_POSITIONS', 5),
    /** 滑点（%），模拟成交损耗 */
    slippagePct: num('SLIPPAGE_PCT', 2),
  },

  // —— 模拟 / 运行参数 ——
  sim: {
    seed: num('SIM_SEED', 20241013),
    initialTokens: num('SIM_INITIAL_TOKENS', 12),
    tokenIntervalMs: num('SIM_TOKEN_INTERVAL_MS', 6_000),
    monitorMs: num('MONITOR_MS', 4_000),
    runDurationMs: num('RUN_DURATION_MS', 60_000),
  },
};

export type Config = typeof config;
