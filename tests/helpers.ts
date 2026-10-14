import type {
  FilterDecision,
  HolderData,
  LiquidityData,
  SecurityData,
  TokenProfile,
  WhaleInfo,
} from '../src/types.js';

export function makeSecurity(overrides: Partial<SecurityData> = {}): SecurityData {
  return {
    mintAuthorityRenounced: true,
    freezeAuthorityRenounced: true,
    metadataMutable: false,
    isHoneypot: false,
    verified: true,
    ...overrides,
  };
}

export function makeLiquidity(overrides: Partial<LiquidityData> = {}): LiquidityData {
  return {
    usd: 80_000,
    lpLocked: true,
    lockPct: 100,
    lpBurnPct: 100,
    lockEndTimeMs: null,
    ...overrides,
  };
}

export function makeHolders(overrides: Partial<HolderData> = {}): HolderData {
  return {
    total: 500,
    top10Pct: 20,
    devPct: 3,
    largestWhalePct: 2,
    whaleCount: 0,
    whales: [],
    ...overrides,
  };
}

export function makeWhale(overrides: Partial<WhaleInfo> = {}): WhaleInfo {
  return {
    address: 'Whale1111111111111111111111111111111111111',
    pct: 6,
    entering: true,
    buyVolumeUsd: 25_000,
    ...overrides,
  };
}

export function makeToken(overrides: Partial<TokenProfile> = {}): TokenProfile {
  const now = Date.now();
  return {
    mint: 'Mint111111111111111111111111111111111111111',
    symbol: 'TEST',
    name: 'Test Token',
    imageUrl: null,
    dex: 'raydium',
    poolAddress: 'Pool1111111111111111111111111111111111111',
    createdAtMs: now - 120_000,
    discoveredAtMs: now,
    priceUsd: 0.01,
    marketCapUsd: 100_000,
    volume24hUsd: 50_000,
    liquidity: makeLiquidity(),
    holders: makeHolders(),
    security: makeSecurity(),
    ...overrides,
  };
}

export function pass(checkId: FilterDecision['checkId']): FilterDecision {
  return { checkId, passed: true, reason: 'ok', observations: [] };
}

export function fail(checkId: FilterDecision['checkId'], reason = 'fail'): FilterDecision {
  return { checkId, passed: false, reason, observations: [] };
}
