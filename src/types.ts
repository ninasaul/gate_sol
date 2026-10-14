// ============================================================================
// 核心类型定义 —— 贯穿六个模块的数据契约
// ============================================================================

/** 交易所 / 发行平台 */
export type Dex = 'pumpfun' | 'raydium';

/** 最终判定：跳过 / 观察 / 买入 */
export type FinalVerdict = 'SKIP' | 'OBSERVE' | 'BUY';

/** 筛选检查项 */
export type CheckId = 'security' | 'liquidity' | 'holders';

/** 流动性数据 */
export interface LiquidityData {
  /** 池子流动性（美元） */
  usd: number;
  /** LP 是否已锁定（含燃烧，pump.fun 燃烧 LP 视为锁定） */
  lpLocked: boolean;
  /** LP 锁仓比例 0-100 */
  lockPct: number;
  /** LP 燃烧比例 0-100 */
  lpBurnPct: number;
  /** 锁定到期时间（毫秒时间戳，null 表示永久/已燃烧） */
  lockEndTimeMs: number | null;
}

/** 鲸鱼信息 */
export interface WhaleInfo {
  address: string;
  /** 持仓占比 0-100 */
  pct: number;
  /** 是否正在进场（近期大额买入） */
  entering: boolean;
  /** 近期买入金额（美元） */
  buyVolumeUsd: number;
}

/** 持仓分布数据 */
export interface HolderData {
  /** 持有人总数（-1 表示未知） */
  total: number;
  /** 前 10 大持仓占比 0-100 */
  top10Pct: number;
  /** 项目方 / 团队持仓占比 0-100 */
  devPct: number;
  /** 最大鲸鱼持仓占比 0-100 */
  largestWhalePct: number;
  /** 鲸鱼数量 */
  whaleCount: number;
  whales: WhaleInfo[];
}

/** 安全审计数据 */
export interface SecurityData {
  /** mint 权限是否已放弃 */
  mintAuthorityRenounced: boolean;
  /** freeze 权限是否已放弃 */
  freezeAuthorityRenounced: boolean;
  /** metadata 是否可修改 */
  metadataMutable: boolean;
  /** 是否疑似貔貅盘（无法卖出） */
  isHoneypot: boolean;
  /** 是否通过外部验证（如 RugCheck） */
  verified: boolean;
}

/** 完整代币画像 —— 各模块共享的统一数据对象 */
export interface TokenProfile {
  mint: string;
  symbol: string;
  name: string;
  /** 代币头像/图标 URL（live 模式来自 GeckoTerminal；demo 为 null） */
  imageUrl: string | null;
  dex: Dex;
  poolAddress: string | null;
  /** 池子创建时间（毫秒时间戳） */
  createdAtMs: number;
  /** 本系统发现时间（毫秒时间戳） */
  discoveredAtMs: number;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  liquidity: LiquidityData;
  holders: HolderData;
  security: SecurityData;
}

/** 单项筛选结果 */
export interface FilterDecision {
  checkId: CheckId;
  passed: boolean;
  reason: string;
  observations: string[];
}

/** 完整筛选报告 */
export interface ScreeningReport {
  token: TokenProfile;
  decisions: FilterDecision[];
  verdict: FinalVerdict;
  reasons: string[];
}

/** 持仓（纸面） */
export interface Position {
  id: string;
  mint: string;
  symbol: string;
  entryPriceUsd: number;
  fillPriceUsd: number;
  entryTimeMs: number;
  sizeUsd: number;
  tokensHeld: number;
  currentPriceUsd: number;
  marketCapUsd: number;
  stopLossUsd: number;
  /** 触发「让利润奔跑」的涨幅价（超过后转移动止损） */
  moonActivateUsd: number;
  /** 是否已进入「让利润奔跑」模式 */
  mooned: boolean;
  highestPriceUsd: number;
  status: 'open' | 'closed';
  closePriceUsd?: number;
  closeTimeMs?: number;
  pnlUsd?: number;
  pnlPct?: number;
  closeReason?: string;
}

/** 已平仓交易记录 */
export interface TradeRecord {
  id: string;
  symbol: string;
  mint: string;
  entryPriceUsd: number;
  exitPriceUsd: number;
  sizeUsd: number;
  pnlUsd: number;
  pnlPct: number;
  closeReason: string;
  entryTimeMs: number;
  closeTimeMs: number;
  heldMs: number;
}

/** 统计汇总 */
export interface Stats {
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
  trades: TradeRecord[];
}

/** 盈利趋势采样点 */
export interface TrendPoint {
  ts: number;
  /** 已实现盈亏 */
  realized: number;
  /** 浮动盈亏（未平仓） */
  unrealized: number;
  /** 总盈亏 = 已实现 + 浮动 */
  total: number;
}
